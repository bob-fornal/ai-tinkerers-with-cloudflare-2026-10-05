/**
 * SSRF mitigation for the crawler (§10 step 2): block requests — including
 * redirect targets — that resolve to private, link-local, loopback, or
 * cloud-metadata IP ranges (e.g. 169.254.169.254).
 *
 * Workers has no low-level socket API to pin a connection to a
 * pre-validated IP, so this checks DNS resolution *before* issuing the real
 * fetch via DNS-over-HTTPS. That leaves a narrow theoretical DNS-rebinding
 * window between the check and the fetch; it's the practical mitigation
 * available in this runtime, not a perfect one.
 */

const IPV4_OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`);

function isIPv4(host: string): boolean {
  return IPV4_PATTERN.test(host);
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 0) return true; // "this" network
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0) return true; // IETF protocol assignments 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
  if (a === 224) return true; // multicast+
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local fc00::/7
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true; // link-local fe80::/10
  }
  const mappedMatch = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mappedMatch?.[1]) {
    return isPrivateIPv4(mappedMatch[1]);
  }
  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const stripped = ip.replace(/^\[|\]$/g, "");
  if (isIPv4(stripped)) {
    return isPrivateIPv4(stripped);
  }
  if (stripped.includes(":")) {
    return isPrivateIPv6(stripped);
  }
  return false;
}

interface DohAnswer {
  readonly type: number;
  readonly data: string;
}

interface DohResponse {
  readonly Answer?: readonly DohAnswer[];
}

async function resolveViaDoh(hostname: string, type: "A" | "AAAA"): Promise<readonly string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return [];
  }
  const body = (await res.json()) as DohResponse;
  return (body.Answer ?? []).map((answer) => answer.data);
}

export interface UrlSafetyCheck {
  readonly safe: boolean;
  readonly reason?: string;
}

/**
 * Validates a URL is http(s), hostname isn't a literal private/reserved IP,
 * and — for a DNS hostname — every resolved A/AAAA record is public.
 */
export async function checkUrlSafety(url: URL): Promise<UrlSafetyCheck> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { safe: false, reason: `Disallowed protocol: ${url.protocol}` };
  }

  const hostname = url.hostname;
  if (hostname === "localhost") {
    return { safe: false, reason: "Hostname is localhost." };
  }

  if (isIPv4(hostname) || hostname.includes(":")) {
    if (isPrivateOrReservedIp(hostname)) {
      return { safe: false, reason: `Hostname resolves to a private/reserved IP: ${hostname}` };
    }
    return { safe: true };
  }

  const [aRecords, aaaaRecords] = await Promise.all([
    resolveViaDoh(hostname, "A"),
    resolveViaDoh(hostname, "AAAA"),
  ]);
  const allRecords = [...aRecords, ...aaaaRecords];

  if (allRecords.length === 0) {
    return { safe: false, reason: `DNS resolution failed or returned no records for ${hostname}` };
  }
  const unsafeRecord = allRecords.find((ip) => isPrivateOrReservedIp(ip));
  if (unsafeRecord) {
    return { safe: false, reason: `Hostname ${hostname} resolves to a private/reserved IP: ${unsafeRecord}` };
  }
  return { safe: true };
}
