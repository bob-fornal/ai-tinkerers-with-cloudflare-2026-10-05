# Example Structure

This example's `switch (routeKey)` on an exact `"METHOD /path"` string works because every route below is fully static. It does not extend to a path parameter (`GET /users/:id`) — see [02](02-cloudflare-worker-api-guidelines.md)'s routing note for the small segment-matching router to use once a real route needs one. Likewise, the single shared `x-api-key` header below is the simplest possible auth check; a multi-tenant API with real per-user identity typically needs actual token verification (e.g. Firebase ID tokens verified via JWKS + Web Crypto, with no extra dependency) rather than one static shared secret — out of scope for this minimal example, but don't take the `x-api-key` pattern as the ceiling of what's appropriate.

## schema.sql
```sql
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## index.ts
```typescript
import type { Env } from "./core/environment";
import { processGet } from "./core/processGet";
import { processGetKv } from "./core/processGetKv";
import { processPostKv } from "./core/processPostKv";
import { processPost } from "./core/processPost";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestApiKey = request.headers.get("x-api-key");

    if (!env.API_KEY || requestApiKey !== env.API_KEY) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const routeKey = `${request.method} ${url.pathname}`;

    switch (routeKey) {
      case "GET /users":
        return processGet(env);
      case "GET /kv":
        return processGetKv(url, env);
      case "POST /kv":
        return processPostKv(request, env);
      case "POST /users":
        return processPost(request, env);
      default:
        return new Response("Not Found", { status: 404 });
    }
  },
};
```

## core/environment.ts
```typescript
export interface Env {
  DB: D1Database;
  API_KEY: string;
  MY_KV: KVNamespace;
}
```

## core/processGet.ts
```typescript
import type { Env } from "./environment";

export async function processGet(env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY id DESC LIMIT 10").all();
    return Response.json(results);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

## core/processGetKv.ts
```typescript
import type { Env } from "./environment";

export async function processGetKv(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get("key");
  if (!key) {
    return Response.json({ error: "Query param 'key' is required" }, { status: 400 });
  }

  const document = await env.MY_KV.get(key, { type: "json" });
  if (document === null) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  return Response.json({ key, document });
}
```

## core/processPost.ts
```typescript
import type { Env } from "./environment";

export async function processPost(request: Request, env: Env): Promise<Response> {
  try {
    const { email } = await request.json<{ email: string }>();
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const info = await env.DB.prepare("INSERT INTO users (email) VALUES (?)")
      .bind(email)
      .run();

    return Response.json({ success: true, id: info.meta.last_row_id }, { status: 201 });
  } catch (e: any) {
    // Distinguish an expected conflict (409, not a bug) from a real failure
    // (500, worth logging) — a blanket 500 here would hide the difference
    // between "this email is already taken" and an actual database problem.
    if (typeof e?.message === "string" && /UNIQUE constraint failed/i.test(e.message)) {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }
    console.error("Failed to create user:", e);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
```

## core/processPostKv.ts
```typescript
import type { Env } from "./environment";

export async function processPostKv(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ key?: string; document?: unknown }>();
  const key = body.key?.trim();

  if (!key) {
    return Response.json({ error: "Body field 'key' is required" }, { status: 400 });
  }

  if (typeof body.document === "undefined") {
    return Response.json({ error: "Body field 'document' is required" }, { status: 400 });
  }

  await env.MY_KV.put(key, JSON.stringify(body.document));
  return Response.json({ success: true, key }, { status: 201 });
}
```
