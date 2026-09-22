# Cloudflare D1 (SQLite) Guidelines

## D1 Query Mechanics in Workers
* **Prepared Statements:** Always use prepared statements via `env.DB.prepare(...).bind(...)` to prevent SQL injection. NEVER concatenate strings into SQL queries.
* **Execution Methods:** Choose the correct execution method based on the use case:
  * `.first()`: Retrieve a single row or single value.
  * `.all()`: Retrieve an array of all matching rows.
  * `.run()`: For execution queries (INSERT, UPDATE, DELETE) where results aren't returned.
  * `.batch()`: For executing multiple *related* statements atomically in one round trip — e.g. inserting a parent row plus its child rows, or a delete-then-reinsert to replace a child collection. Reach for it whenever a request needs more than one write that should logically succeed or fail together.
* **`RETURNING` avoids a redundant read-back:** D1's SQLite supports `INSERT ... RETURNING *` / `UPDATE ... RETURNING *`. Prefer it over a separate `INSERT` followed by a `SELECT` to fetch the row you just wrote — one round trip instead of two, and no window where a concurrent write could change what the follow-up `SELECT` sees.
* **No multi-statement transactions — D1 has no `BEGIN`/`COMMIT`.** For an atomic "claim one row among possible concurrent callers" pattern (a queue-like table, a cron job that must not double-process a row), use a single guarded `UPDATE` as the entire operation — never a separate read-then-write:
  ```sql
  UPDATE jobs SET claimed = 1, claimed_at = datetime('now')
  WHERE id = ? AND claimed = 0
  ```
  Check the statement's reported row count (or re-`SELECT` only *after* a successful claim) to know whether *this* caller won the claim. A `SELECT` to find a candidate row followed by a separate `UPDATE` on its id is a race under concurrency — two overlapping calls can both select the same unclaimed row before either writes.

## SQL Creation Scripts (DDL)
* **Dialect:** The target SQL dialect is SQLite (specifically the version used by D1).
* **Data Types:** Use SQLite standard types: `TEXT`, `INTEGER`, `REAL`, `BLOB`. (e.g., Booleans should be `INTEGER` 0 or 1, Dates should be `TEXT` ISO8601 strings or `INTEGER` unix timestamps).
* **Primary Keys:** Clearly define `PRIMARY KEY`. For auto-incrementing IDs, use `INTEGER PRIMARY KEY AUTOINCREMENT`. For UUIDs, specify as `TEXT PRIMARY KEY`.
* **Idempotency:** Forward migration files should be rerunnable without errors — rely on `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc. **Never put a `DROP TABLE` in the same directory as forward migrations** — see the dedicated rollback-location rule below; this is a real footgun, not a style preference.
* **Default Values & Constraints:** Use `NOT NULL`, `UNIQUE`, and `DEFAULT` constraints appropriately to enforce schema integrity.
* **Foreign Keys:** D1/SQLite has foreign-key enforcement **off by default** — a `FOREIGN KEY (column) REFERENCES table(column)` clause is not validated at all unless the connection explicitly runs `PRAGMA foreign_keys = ON`. Declare FKs for documentation/intent regardless, but don't assume they're enforced. If you ever do turn enforcement on, create referenced tables before the tables that reference them in the same migration file — DDL order matters once enforcement is active, even though it's silently ignored today.

## Rollback files: never in `migrations_dir`
* **This is the single most important rule in this file.** `wrangler d1 migrations apply <db>` / `wrangler d1 migrations list <db>` treat **every** `.sql` file directly under the configured `migrations_dir` as a forward migration to run — there is no filename convention (`_rollback_`, `down_`, anything) that wrangler recognizes as "skip this on `apply`." A rollback script placed next to its forward migration gets applied as the *next* migration on the very next `apply`, running whatever destructive statements it contains (typically `DROP TABLE`) immediately, with no warning distinguishing it from a normal successful migration.
* **Store rollback scripts in a separate directory outside `migrations_dir`** (e.g. `db/rollbacks/` next to `db/migrations/`), and apply one only via an explicit file path, never through the migrations command:
  ```bash
  wrangler d1 execute <db-name> --file=db/rollbacks/0001_rollback_initial_schema.sql
  ```
* Still pair every forward migration with a rollback script (write the rollback first, per the usual convention) — just never in the same folder wrangler scans for migrations to auto-apply.
