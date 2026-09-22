/**
 * Firebase ID token verification using only the Web Crypto API — no `jose`
 * or other JWT dependency, per the org's zero-dependency Worker convention.
 *
 * Firebase ID tokens are RS256-signed JWTs. Google publishes the current
 * signing keys as a JWK Set at a fixed URL; each token's header carries the
 * `kid` that identifies which key signed it. We fetch that JWK Set (cached
 * in-isolate for the `Cache-Control` max-age Google returns, typically
 * several hours), verify the signature with `crypto.subtle.verify`, and then
 * check the standard Firebase claims (`iss`, `aud`, `exp`).
 */

const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

interface JsonWebKey extends globalThis.JsonWebKey {
  readonly kid?: string;
}

interface JwksCacheEntry {
  readonly keys: readonly JsonWebKey[];
  readonly expiresAt: number;
}

// Module-scoped — persists across requests within the same isolate, reset on
// isolate recycle. This is an acceptable, low-risk cache: worst case we
// re-fetch a public key set slightly more often than necessary.
let jwksCache: JwksCacheEntry | null = null;

async function fetchJwks(): Promise<readonly JsonWebKey[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const res = await fetch(FIREBASE_JWKS_URL);
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`Failed to fetch Firebase JWKS: HTTP ${res.status}`);
  }

  const maxAgeMatch = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "");
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  const body = (await res.json()) as { keys?: readonly JsonWebKey[] };
  const keys = body.keys ?? [];
  jwksCache = { keys, expiresAt: now + maxAgeSeconds * 1000 };
  return keys;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJsonSegment<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

interface FirebaseJwtHeader {
  readonly alg: string;
  readonly kid: string;
}

interface FirebaseJwtPayload {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly exp: number;
  readonly iat: number;
  readonly email?: string;
}

export interface VerifiedFirebaseUser {
  readonly uid: string;
  readonly email: string | undefined;
}

export class FirebaseAuthError extends Error {}

/**
 * Verifies a Firebase ID token against one specific Firebase project. Throws
 * `FirebaseAuthError` on any failure (malformed token, unknown key, bad
 * signature, wrong issuer/audience, expired token) — callers should treat
 * that uniformly as "reject with 401", never surface the specific reason to
 * the caller.
 */
export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId: string,
): Promise<VerifiedFirebaseUser> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new FirebaseAuthError("Malformed token.");
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];

  const header = decodeJsonSegment<FirebaseJwtHeader>(headerSegment);
  if (header.alg !== "RS256") {
    throw new FirebaseAuthError(`Unsupported algorithm: ${header.alg}`);
  }
  if (!header.kid) {
    throw new FirebaseAuthError("Token header missing kid.");
  }

  const keys = await fetchJwks();
  const matchingKey = keys.find((key) => key.kid === header.kid);
  if (!matchingKey) {
    throw new FirebaseAuthError("No matching signing key found.");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    matchingKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signedData = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signature = base64UrlToUint8Array(signatureSegment);

  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signedData,
  );
  if (!validSignature) {
    throw new FirebaseAuthError("Invalid signature.");
  }

  const payload = decodeJsonSegment<FirebaseJwtPayload>(payloadSegment);

  const nowSeconds = Date.now() / 1000;
  if (payload.exp <= nowSeconds) {
    throw new FirebaseAuthError("Token expired.");
  }
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new FirebaseAuthError("Unexpected issuer.");
  }
  if (payload.aud !== expectedProjectId) {
    throw new FirebaseAuthError("Unexpected audience.");
  }
  if (!payload.sub) {
    throw new FirebaseAuthError("Token missing subject.");
  }

  return { uid: payload.sub, email: payload.email };
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}
