---
applyTo: "backend/**/*.ts"
description: Backend (Express + node:sqlite + zod) conventions
---

# Backend instructions

## Module & runtime

- Target Node.js ≥ 22.5 (uses built-in `node:sqlite`). Do **not** add
  `better-sqlite3`, `sqlite3`, or any other SQLite driver.
- CommonJS modules (`"module": "commonjs"` in `backend/tsconfig.json`).
  Use `import` syntax — TypeScript transpiles it.
- Entry: `backend/src/index.ts`. Runs migrations + seed on boot, then `app.listen`.

## SQL & data access

- All SQL lives behind prepared statements via `db.prepare(...)`.
- Use named parameters with `@param` for inserts of object-shaped rows.
- Wrap multi-statement writes in an explicit transaction:

  ```ts
  db.exec('BEGIN');
  try {
    // ... writes ...
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  ```

- `node:sqlite` accepts only `string | number | bigint | null | Uint8Array` as
  parameter values — cast objects you pass to `.run(obj)` as
  `Record<string, string | number>` (see `backend/src/db/seed.ts`).
- `info.lastInsertRowid` is a `bigint` — wrap in `Number(...)` before returning.

## Route conventions

- One router per resource under `backend/src/routes/`, mounted in `index.ts`
  under `/api/<resource>`.
- **Every** request body & query param is validated with `zod` before use:

  ```ts
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', details: parsed.error.flatten() });
  ```

- Return shapes:
  - `200` on read success with the resource JSON
  - `201` on resource creation
  - `400` for validation errors (include `details`)
  - `404` for missing resources (`{ error: 'X not found' }`)
  - `409` for conflicts (e.g. insufficient stock)
- Never trust client-supplied prices — re-read `price_cents` from the DB.

## What not to do

- Don't add Express middleware globally without weighing it (we use only `cors()` and `express.json()`).
- Don't add an ORM (Prisma, Drizzle, TypeORM). Stay with raw SQL via `node:sqlite`.
- Don't introduce async DB calls — `node:sqlite` is synchronous by design and that's intentional.
- Don't log request bodies (they may contain customer emails/addresses).
