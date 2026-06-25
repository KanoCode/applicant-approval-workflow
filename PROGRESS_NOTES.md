# Progress notes — where this was left off

## Done (complete and should work as-is)

### Backend — fully complete
- `prisma/schema.prisma` — full data model (User, Application, AuditLog, enums).
- `prisma/migrations/20260101000000_init/` — hand-written SQL migration matching
  the schema (no DB connection was available in the sandbox to run
  `prisma migrate dev`, so **run `npx prisma migrate dev` yourself once you
  have Postgres up** — Prisma will tell you immediately if anything's out of
  sync with the schema, and you can re-generate from there if needed).
- `prisma/seed.ts` — seeds 2 applicants + 1 reviewer + sample applications in
  every status. Login: `applicant@example.com` / `applicant2@example.com` /
  `reviewer@example.com`, all with password `password123`.
- `src/services/stateMachine.ts` — the pure state machine. This is the core
  of the exercise; fully implemented.
- `src/middleware/auth.ts`, `errorHandler.ts`, `upload.ts` — JWT auth,
  role guards, centralized error shaping, file upload handling.
- `src/routes/auth.ts`, `src/routes/applications.ts` — all CRUD + transition
  endpoints (`/submit`, `/claim`, `/approve`, `/reject`, `/return`), all
  authorized server-side.
- `src/app.ts`, `src/server.ts` — Express app wiring.
- **Tests**: `src/__tests__/stateMachine.test.ts` (pure unit tests, no DB
  needed, run with just `npm test` after `npm install`) and
  `src/__tests__/applications.api.test.ts` (supertest integration tests
  against a real Postgres test DB — needs `DATABASE_URL` set first).
- `Dockerfile`, `.env.example`, `.gitignore`.

### Frontend — foundation only, not yet a working app
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` — project
  scaffold, ready to `npm install && npm run dev`.
- `src/index.css` — the full design system (paper/ink/stamp palette, the
  "ledger stepper" signature component styles, status pills, forms, docket
  list rows, login card, comment modal, etc.) — **this is done**, just not
  yet wired to JSX.
- `src/types/index.ts` — shared TS types mirroring the Prisma models.
- `src/api/client.ts`, `applications.ts`, `auth.ts` — typed fetch wrapper and
  endpoint calls. **Done.**
- `src/context/AuthContext.tsx` — session state (login/logout/me, token in
  localStorage). **Done.**
- `src/components/StatusPill.tsx` — first component, done.

## Not started yet — what's left

This is the bulk of the remaining frontend work:

1. **`src/main.tsx`** — entry point, wraps `<App />` in `AuthProvider` +
   `BrowserRouter`, imports `index.css`.
2. **`src/App.tsx`** — route table: `/login`, `/` (role-based redirect to
   applicant or reviewer view), `/applications/new`,
   `/applications/:id`, protected-route wrapper that checks `useAuth()`.
3. **`src/pages/LoginPage.tsx`** — uses `.login-card` CSS already written;
   shows the three seeded accounts as a hint (`.seed-hint`).
4. **`src/pages/ApplicantListPage.tsx`** ("My applications") — uses
   `.docket` / `.docket-row` CSS already written; fetches via
   `applicationsApi.list()`; needs loading/error/empty states (CSS for
   `.empty-state` and `.loading-block` already exists).
5. **`src/pages/ApplicationFormPage.tsx`** — create/edit form (title,
   category select from `CATEGORIES`, description textarea, amount input
   using `.amount-input` CSS, optional file attach via
   `applicationsApi.uploadAttachment`). Needs client-side validation
   mirroring the Zod rules server-side (title ≥3 chars, amount >0, etc.) —
   server is the source of truth but should still show field-level errors
   from a failed submit (`ApiClientError.details`).
6. **`src/pages/ApplicationDetailPage.tsx`** — the most involved page:
   - Render the **ledger stepper** (`.ledger-stepper`, `.ledger-step`,
     `.ledger-stamp` classes already in CSS) showing DRAFT → SUBMITTED →
     UNDER_REVIEW → APPROVED, with REJECTED/RETURNED as alternate end
     states — needs a small helper to compute which steps are "done" given
     the current status.
   - Two-column `.detail-grid`: left = description/details panel +
     `.audit-entry` timeline; right = `.decision-actions` panel showing
     buttons appropriate to role + `permissions` from the API response
     (`canEdit`, `canDelete`, `canSubmit`).
   - Reviewer actions: Claim / Approve / Reject / Return — Reject and
     Return need the `.comment-modal` (CSS done) to collect the required
     comment before calling `applicationsApi.reject`/`.return`.
7. **`src/pages/ReviewerQueuePage.tsx`** — uses `.filter-bar` /
   `.filter-chip` CSS already written, calls
   `applicationsApi.list(status)`.
8. **`src/components/ProtectedRoute.tsx`** and maybe
   `RoleRoute.tsx` — route guards using `useAuth()`.
9. **Root `README.md`** — not written yet. Needs: how to run
   (`docker-compose up`, then frontend `npm install && npm run dev`), data
   model summary, trade-offs (e.g. RETURNED modeled as edit-then-resubmit
   rather than a separate revision-history table; no refresh tokens; file
   auth is by unguessable UUID filename not real ACLs — see the comment in
   `src/app.ts`), what you'd add with more time (pagination, notifications,
   revision history — the stretch goals that were intentionally skipped),
   and an "AI usage" section as the assessment's instructions require.
10. **Frontend tests** — not started. The spec's testing requirement (state
    machine unit tests + one 403 authorization test) is already satisfied by
    the backend tests, so this is optional polish, not a gap against the
    rubric.

## Suggested order to finish
`main.tsx` → `App.tsx` → `LoginPage` → `ApplicantListPage` →
`ApplicationFormPage` → `ApplicationDetailPage` → `ReviewerQueuePage` →
`README.md`. The detail page is the biggest single piece — budget the most
time there.
