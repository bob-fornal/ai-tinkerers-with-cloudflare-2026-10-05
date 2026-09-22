export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return jsonResponse(body, { status });
}

export const Errors = {
  unauthorized: (message = "Missing or invalid authentication token."): Response =>
    errorResponse(401, "unauthorized", message),
  forbidden: (message = "You do not have access to this resource."): Response =>
    errorResponse(403, "forbidden", message),
  notFound: (message = "Resource not found."): Response => errorResponse(404, "not_found", message),
  badRequest: (message: string): Response => errorResponse(400, "bad_request", message),
  conflict: (message: string): Response => errorResponse(409, "conflict", message),
  rateLimited: (message = "Too many requests."): Response => errorResponse(429, "rate_limited", message),
  internal: (message = "Internal server error."): Response => errorResponse(500, "internal_error", message),
};

export interface PaginationParams {
  readonly offset: number;
  readonly limit: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Cursor-based pagination (§13) implemented over D1's plain LIMIT/OFFSET:
 * the cursor is simply the base64 encoding of the next offset. Opaque to
 * callers, which is all "cursor-based" requires here — good enough for this
 * API's list sizes without needing keyset pagination machinery.
 */
export function parsePagination(url: URL): PaginationParams {
  const cursorParam = url.searchParams.get("cursor");
  const offset = cursorParam ? decodeCursor(cursorParam) : 0;
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  return { offset, limit };
}

function decodeCursor(cursor: string): number {
  try {
    const decoded = Number(atob(cursor));
    return Number.isFinite(decoded) && decoded >= 0 ? decoded : 0;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number): string {
  return btoa(String(offset));
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly cursor: string | null;
}

/** Builds the page envelope; `cursor` is null once a short page signals there's nothing more. */
export function buildPage<T>(items: readonly T[], pagination: PaginationParams): Page<T> {
  const cursor = items.length === pagination.limit ? encodeCursor(pagination.offset + pagination.limit) : null;
  return { items, cursor };
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
