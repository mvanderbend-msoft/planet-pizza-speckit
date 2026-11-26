<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: First ratified constitution; all placeholders replaced (MAJOR baseline).

Modified principles (template placeholder → new title):
  [PRINCIPLE_1_NAME] → I. Server Is the Source of Truth (NON-NEGOTIABLE)
  [PRINCIPLE_2_NAME] → II. Strict Type Safety
  [PRINCIPLE_3_NAME] → III. Consistent API Contracts
  [PRINCIPLE_4_NAME] → IV. Use the Existing Stack
  [PRINCIPLE_5_NAME] → V. Planet Pizza Voice
Added principles:
  VI. Green Build Quality Gate
Added sections:
  Scope & Stack Constraints (was [SECTION_2_NAME])
  Development Workflow & Quality Gates (was [SECTION_3_NAME])
Removed sections: none

Templates / guidance checked:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic and derives
     its gates from this file; "Complexity Tracking" table serves as the place to justify
     new dependencies (Principle IV). No edit needed.
  ✅ .specify/templates/spec-template.md — no conflicting mandatory sections. No edit needed.
  ✅ .specify/templates/tasks-template.md — tests are already OPTIONAL, consistent with
     Principle VI (no test runner today). No edit needed.
  ✅ .github/agents/speckit.*.agent.md, .github/prompts/speckit.*.prompt.md — no
     agent-specific (e.g. CLAUDE-only) references. No edit needed.
  ✅ .github/copilot-instructions.md, README.md — principles were derived from these;
     both remain consistent. No edit needed.

Deferred TODOs: none
-->

# Planet Pizza Constitution

## Core Principles

### I. Server Is the Source of Truth (NON-NEGOTIABLE)

The backend owns every fact that matters for money and orders.

- Prices, line totals, and order totals MUST be recomputed on the backend from the
  `products` table on every order. Any price sent by the client MUST be ignored.
- Every request body, route param, and query string MUST be parsed with a `zod` schema
  before it reaches business logic or the database.
- Money MUST be stored and transported as integer cents in fields named `*_cents`
  (API/DB) or `*Cents` (local TS variables). Floats MUST NOT be used for money.
  Display formatting MUST go through `formatPrice` in `frontend/src/api/client.ts`.
- Multi-statement writes MUST run inside an explicit
  `BEGIN` / `COMMIT` / `ROLLBACK` block (`node:sqlite` has no transaction helper).

**Rationale**: The browser is untrusted. Recomputing prices and validating input on the
server is the only way to guarantee customers pay the right amount; integer cents remove
rounding errors.

### II. Strict Type Safety

- Both `backend/` and `frontend/` MUST keep `"strict": true` in `tsconfig.json`.
- `any` (explicit, or implicit via casts like `as any`) MUST NOT be introduced. Use
  `unknown` plus narrowing, `zod`-inferred types, or explicit types instead.
- `// @ts-ignore` and `// @ts-expect-error` MUST NOT be used to silence real errors.

**Rationale**: Strict types catch contract drift and money bugs at build time, which is
our main safety net while there is no automated test suite.

### III. Consistent API Contracts

- JSON fields in API requests and responses MUST use `snake_case`, matching the SQLite
  column names.
- TypeScript types in `frontend/src/api/client.ts` MUST mirror the backend response
  shapes exactly, keeping `snake_case`. The API MUST NOT be camelCased on either side.
- Any change to an endpoint's shape MUST update the backend route, the frontend types,
  and the API table in `README.md` in the same change.
- Schema changes MUST update the `CREATE TABLE IF NOT EXISTS` statements in
  `backend/src/db/index.ts` (and `seed.ts` if needed), and the plan MUST call out that
  `backend/data/app.db` may need to be reset.

**Rationale**: One naming scheme end to end means no mapping layer to drift out of sync.

### IV. Use the Existing Stack

- New work MUST use the established stack: Express + `node:sqlite` + `zod` on the
  backend; React 18 + React Router v6 + Vite + Tailwind on the frontend.
- Styling MUST use Tailwind and the shared classes in `frontend/src/index.css`
  (`btn-primary`, `btn-secondary`, `card`, `input`, `eyebrow`). No inline `style`
  props, CSS Modules, or CSS-in-JS.
- `better-sqlite3` MUST NOT be used (native build fails on Windows ARM64).
- Any new runtime or dev dependency MUST be justified in the feature's `plan.md`
  (Complexity Tracking table): what it does, why the existing stack can't do it, and
  the simpler alternative that was rejected.

**Rationale**: A small, known stack keeps the shop easy to run, review, and maintain.
Every dependency is a long-term cost and a supply-chain risk.

### V. Planet Pizza Voice

- All user-facing copy (UI text, product names and descriptions, error and empty
  states, confirmation messages) MUST stay in the Planet Pizza voice: playful,
  conspiratorial, deadpan Alien / Area 51 humor. It MUST NOT be crude or political.
- Copy MUST reuse the established metaphors where they fit (cargo bay, earthling,
  transmission, drop coordinates, confirmed by the mothership) without overloading them.
- Emoji are allowed in copy but MUST NOT appear in identifiers, SKUs, or API fields.
- Product names MUST be 2–4 words; SKUs MUST be `UPPER-SNAKE` with `PZ-` (pizza) or
  `MR-` (merch) prefixes; categories are exactly `pizza` and `merch`.

**Rationale**: The brand is the product. Consistent voice is what makes the shop
recognisably Planet Pizza.

### VI. Green Build Quality Gate

- `npm run build` from the repo root (backend + frontend type-check and build) MUST
  pass before any change is considered done or merged.
- The repo has no test runner today. Features MUST NOT invent one implicitly; adding a
  test framework is a new dependency and falls under Principle IV.
- Behavior changes MUST be verified by building the affected package and, for API
  changes, exercising the running endpoint (e.g. with `curl`).

**Rationale**: The build is the one automated gate everyone can run. Keeping it green
keeps `main` shippable.

## Scope & Stack Constraints

- **Runtime**: Node.js ≥ 22.5 (built-in `node:sqlite`). Two-package monorepo
  (`backend/`, `frontend/`) driven by `npm --prefix`; no workspace tooling.
- **Out of scope unless explicitly approved**: authentication, real payment processing,
  admin UI, pizza size/topping customization, new product categories. A spec that
  needs any of these MUST flag it as a scope change and get user confirmation before
  planning.
- **Stock**: checked on order but not decremented; there is no inventory system.
- **Docs**: the root `README.md` is the only README. No READMEs inside `backend/` or
  `frontend/`.

## Development Workflow & Quality Gates

- Every feature follows spec → plan → tasks → implement. The plan's
  **Constitution Check** MUST list each principle (I–VI) as pass / violation.
- Violations MUST be recorded in the plan's Complexity Tracking table with a
  justification, or the design MUST change. Unjustified violations block the plan.
- Reviews MUST verify: server-side pricing and `zod` validation (I), no new `any` (II),
  `snake_case` contracts mirrored in `client.ts` (III), justified dependencies (IV),
  on-brand copy (V), and a passing `npm run build` (VI).
- Runtime coding guidance lives in `.github/copilot-instructions.md` and
  `.github/instructions/*.instructions.md`; those files MUST stay consistent with this
  constitution.

## Governance

- This constitution supersedes other practices and guidance in this repository. Where
  guidance files conflict with it, the constitution wins and the guidance file MUST be
  updated.
- Amendments are made via `/speckit.constitution`, MUST include an updated Sync Impact
  Report, and MUST propagate to dependent templates and guidance files in the same
  change.
- Versioning follows semantic versioning:
  - **MAJOR**: a principle is removed or redefined in a backward-incompatible way.
  - **MINOR**: a principle or section is added or materially expanded.
  - **PATCH**: clarifications, wording, and typo fixes.
- Compliance is checked at plan time (Constitution Check) and at review time (checklist
  above).

**Version**: 1.0.0 | **Ratified**: 2026-11-26 | **Last Amended**: 2026-11-26
