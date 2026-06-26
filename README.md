# Casework — request submission & approval workflow

A small two-sided app: an **Applicant** drafts and submits a request; a
**Reviewer** approves, rejects, or returns it with a comment. The focus of
this build is a correctly enforced status workflow with a full audit trail,
backed by real server-side authorization — not breadth of features.

## Table of Contents

- [Stack](#stack)
- [Running it](#running-it)
  - [1. Backend + database (Docker)](#1-backend--database-docker)
  - [2. Frontend](#2-frontend)
  - [Running without Docker](#running-without-docker)
  - [Running tests](#running-tests)
- [Data model](#data-model)
- [The state machine](#the-state-machine)
- [Authorization](#authorization)
- [Trade-offs and what I'd add with more time](#trade-offs-and-what-id-add-with-more-time)
- [Use of AI tools](#use-of-ai-tools)

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT auth, Zod validation, Jest + Supertest.
- **Frontend:** React + TypeScript (Vite), React Router, no extra state library (the API surface is small enough that local component state + fetch is clearer than introducing one).
- **Run:** `docker-compose.yml` brings up Postgres + the backend; the frontend runs separately via Vite's dev server.

## Running it

### 1. Backend + database (Docker)

- git clone [this repo](https://github.com/KanoCode/applicant-approval-workflow.git)

```bash
cd approval-app

docker compose up --build

npm run seed

```

This starts Postgres on `:5432` and the API on `:4000`, running
`prisma migrate deploy` automatically on container start. Once it's up,
seed some data:

```bash
cd backend
cp .env.example .env   # if running prisma CLI commands from your host
npm install
npm run seed
```

**Seeded logins** (password for all: `password123`):

| Role      | Email                     |
|-----------|---------------------------|
| Applicant | `applicant@example.com`   |
| Applicant | `applicant2@example.com`  |
| Reviewer  | `reviewer@example.com`    |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/uploads` to the
backend on `:4000` (see `vite.config.ts`), so no CORS configuration or
absolute URLs are needed in frontend code.

### Running without Docker

Point `DATABASE_URL` (in `backend/.env`) at any Postgres instance, then:

```bash
cd backend
npm install
npx prisma migrate deploy   # or `npx prisma migrate dev` for the first run
npm run seed
npm run dev
```

### Running tests

```bash
cd backend
npm install
npm test
```

`stateMachine.test.ts` is pure unit testing — no database needed.
`applications.api.test.ts` uses Supertest against the real Express app and
a real Postgres database via Prisma, so it needs `DATABASE_URL` pointed at
a real (ideally disposable/test) database before running. It includes the
403-on-unauthorized-action test the spec calls for directly: an applicant
attempting to approve their own application is asserted to get back `403`,
not `200`, and the application's status is asserted to be unchanged
afterward.


## Data model

```
User            (id, email, passwordHash, name, role)
Application     (id, title, category, description, amount,
                 attachmentPath, attachmentName, status,
                 ownerId -> User, reviewerId -> User?,
                 createdAt, updatedAt)
AuditLog        (id, applicationId -> Application, actorId -> User,
                 fromStatus, toStatus, comment?, createdAt)
```

- `AuditLog` rows are append-only — every transition writes exactly one row,
  and the API never updates or deletes them. The detail page renders this
  as the audit trail.
- `Application.reviewerId` is set when a reviewer claims or decides on a
  case, mostly so the queue can show who's handling what — claiming isn't
  a precondition for approving/rejecting/returning directly from
  `SUBMITTED`.
- `amount` is `Decimal(12,2)` in Postgres; Prisma serializes Decimals as
  strings over JSON, which is why the frontend types model `amount` as
  `string` and parses it only when needed (avoids floating-point drift on
  money).

## The state machine

```
DRAFT --submit--> SUBMITTED --claim--> UNDER_REVIEW
                      |                     |
                      |--approve---+  +--approve
                      |--reject----+  +--reject (comment required)
                      +--return----+  +--return (comment required)
                            |
                            v
                        APPROVED / REJECTED (terminal)

RETURNED --(owner edits)--submit--> SUBMITTED
```

All of this lives in one pure, dependency-free module:
`backend/src/services/stateMachine.ts`. It takes `(currentStatus, action,
actorRole, isOwner, comment)` and either returns the next status or throws
a typed `StateTransitionError` with a `code` of `ILLEGAL_TRANSITION`,
`FORBIDDEN_ROLE`, or `COMMENT_REQUIRED`. Keeping it pure (no Express, no
Prisma) is what makes `stateMachine.test.ts` exhaustive and fast — every
legal and illegal transition is tested without touching a database.

Route handlers in `applications.ts` call this function and persist its
result; they never branch on status themselves. This means there's exactly
one place the rules can be wrong, and it's the one place that's unit
tested most thoroughly.

## Authorization

Authorization is enforced at two independent layers, deliberately
redundant:

1. **Route-level role gate** (`requireRole('REVIEWER')` etc. in
   `middleware/auth.ts`) — rejects the wrong role with `403` before any
   handler logic or database query runs.
2. **`applyTransition` itself** re-checks `actorRole` and, for owner-only
   actions, `isOwner` — so even a mis-wired route couldn't let the wrong
   actor through, because the state machine is the actual source of truth,
   not the route wiring.

this is to cover the assertion "an applicant must not be able to approve
their own application even by calling the API directly": there's no
client-supplied field that grants a different role, and ownership is
always computed server-side from the JWT subject and the database row, not
trusted from the request body.

`applications.api.test.ts` has a dedicated test for this scenario
(submitting then attempting to approve as the owner) plus equivalent tests
for reject and the create-as-reviewer case.

## Trade-offs and what I'd add with more time


- **No refresh tokens / session renewal.** JWTs expire after 8 hours and
  there's no refresh flow — acceptable for an assessment, not for
  production.
- **File attachment authorization is by unguessable filename, not a real
  ACL.
- ** Uploaded files are renamed to a random UUID on disk and served
  from a static `/uploads` route. Anyone with the exact URL can fetch the
  file without re-checking that they're allowed to see that application.
  For a real deployment I'd stream the file through an authenticated route
  handler instead of `express.static`.
- **No pagination on the reviewer queue.** Fine at seed-data scale; the
  queue stretch goal (pagination + search/filter) was the other one I
  intentionally left out.

- **Single amount field, no separate date field.** The spec's example
  schema lists "an amount or date field" — I kept just `amount` as a single
  decimal rather than adding a separate date, to keep the surface small per
  the brief's emphasis on depth over breadth. A `dueDate` or `eventDate`
  field would be a natural small addition.
- **Frontend has no automated tests.** The spec's testing requirement
  (state-machine unit tests + an authorization API test) is fully covered
  on the backend; frontend tests were left out as polish rather than a
  rubric gap, given the time budget.

## Use of AI tools

This entire project — backend, frontend, tests, and this README — was
generated working with Claude (Anthropic) in conversation, iteratively,
across the data model, state machine, API, and UI. The state-machine logic
and authorization wiring were reviewed most closely since that's the part
of the rubric weighted most heavily, checking the test coverage against the
legal/illegal transition table in the spec. As noted above, the code was
**not run or tested in a live environment** before delivery — running
`npm install`, the test suites, and a manual click-through of the full
workflow (draft -> submit -> claim -> approve, and the
reject/return-with-comment paths) is the first thing to do with it, and
should be treated as part of "understanding every line," not a formality.