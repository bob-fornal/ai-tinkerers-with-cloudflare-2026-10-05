import type { Env } from "./lib/env";
import type { VerifiedFirebaseUser } from "./lib/firebaseAuth";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestContext {
  readonly request: Request;
  readonly env: Env;
  readonly ctx: ExecutionContext;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  /** Set by the admin/coach auth middleware before the handler runs; null on the one public route. */
  readonly user: VerifiedFirebaseUser | null;
}

export type Handler = (context: RequestContext) => Promise<Response>;

export interface AuthedRequestContext extends RequestContext {
  readonly user: VerifiedFirebaseUser;
}

export type AuthedHandler = (context: AuthedRequestContext) => Promise<Response>;

/**
 * Narrows `RequestContext.user` from nullable to required for every
 * admin/me handler — `index.ts` has already returned 401 before reaching
 * here for any route registered through this wrapper, so a null user at
 * this point would be a routing bug, not a client error.
 */
export function withAuth(handler: AuthedHandler): Handler {
  return async (context) => {
    if (!context.user) {
      throw new Error("withAuth handler reached without an authenticated user — routing bug.");
    }
    return handler(context as AuthedRequestContext);
  };
}

interface Route {
  readonly method: HttpMethod;
  readonly segments: readonly string[];
  readonly handler: Handler;
}

/**
 * Minimal hand-rolled method+path router — no framework dependency, per the
 * org's zero-dependency Worker convention. Supports static segments and
 * `:param` segments only (sufficient for this API's flat resource paths).
 */
export class Router {
  private readonly routes: Route[] = [];

  add(method: HttpMethod, path: string, handler: Handler): void {
    this.routes.push({ method, segments: splitPath(path), handler });
  }

  get(path: string, handler: Handler): void {
    this.add("GET", path, handler);
  }
  post(path: string, handler: Handler): void {
    this.add("POST", path, handler);
  }
  patch(path: string, handler: Handler): void {
    this.add("PATCH", path, handler);
  }
  put(path: string, handler: Handler): void {
    this.add("PUT", path, handler);
  }
  delete(path: string, handler: Handler): void {
    this.add("DELETE", path, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const requestSegments = splitPath(pathname);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchSegments(route.segments, requestSegments);
      if (params) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

function splitPath(path: string): readonly string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function matchSegments(
  routeSegments: readonly string[],
  requestSegments: readonly string[],
): Record<string, string> | null {
  if (routeSegments.length !== requestSegments.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i] ?? "";
    const requestSegment = requestSegments[i] ?? "";
    if (routeSegment.startsWith(":")) {
      params[routeSegment.slice(1)] = decodeURIComponent(requestSegment);
    } else if (routeSegment !== requestSegment) {
      return null;
    }
  }
  return params;
}
