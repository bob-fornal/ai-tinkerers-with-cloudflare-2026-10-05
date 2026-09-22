import type { Env } from "../lib/env";

const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Authorization, Content-Type";

function allowedOrigins(env: Env): readonly string[] {
  return [env.ADMIN_APP_ORIGIN, env.COACH_APP_ORIGIN];
}

/** Explicit two-origin allowlist — never a wildcard, never a reflected Origin header. */
export function corsHeadersFor(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function handlePreflight(request: Request, env: Env): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }
  return new Response(null, { status: 204, headers: corsHeadersFor(request, env) });
}

export function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeadersFor(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
