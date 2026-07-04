# ScopeLock — Phase 2 Report

## Scope

Phase 2 builds one repeatable, seedable Xero demo scenario (Baker & Co, a
kitchen refurbishment quote, and its pricing catalogue) so Phase 3 has real
financial data to compare client requests against. Phase 1's Xero
integration (OAuth, encrypted token storage, generic quotes/contacts/items
reads, the test-draft-quote panel) was reused as-is and not modified beyond
two small additions to `src/lib/xero/queries.ts` and one fix in
`src/lib/xero/normalize.ts` (see "Files modified").

## Files created

**Demo domain logic** (`src/lib/demo/`)
- `demo-types.ts` — constants (customer, item specs, quote line specs,
  the fixed next-phase message) and shared types (`SeedStepResult`,
  `SeedResult`, `SeedStepStatus`).
- `xero-lookups.ts` — read-only find functions shared by seed and verify
  (`findSalesAccountCode`, `findContactByEmail`, `findItemByCode`,
  `findQuoteByReference`).
- `seed-demo.ts` — `runDemoSeed()`, the find-or-create pipeline.
- `verify-demo.ts` — `runDemoVerify()`, the read-only counterpart.
- `project-detail.ts` — `loadProjectDetail(slug)`, loads a project's local
  link plus its live Xero quote/contact/pricing for the project page.

**API routes** (`src/app/api/demo/`)
- `seed/route.ts` — `POST`, runs `runDemoSeed()`.
- `verify/route.ts` — `GET`, runs `runDemoVerify()`.
- `reset-local/route.ts` — `POST`, requires `{"confirm": true}`, deletes only
  the local `DemoProject` row.

**Pages**
- `src/app/demo/page.tsx` + `src/components/demo/{DemoSetupPage,StepRow,
  StatusBadge,types}.tsx` — the `/demo` setup checklist, Create/Verify/Reset
  buttons.
- `src/app/projects/[slug]/page.tsx` — the project detail page
  (`/projects/demo-kitchen`): source quote summary, agreed scope table,
  trusted pricing catalogue, next-phase preview card.

**Docs**
- `PHASE2_DEMO_SETUP.md`, `PHASE2_REPORT.md` (this file).

## Files modified

- `prisma/schema.prisma` — added the `DemoProject` model.
- `prisma/migrations/20260704161228_add_demo_project/` — new migration.
- `src/lib/xero/queries.ts` — added `fetchQuoteById` and `fetchContactById`
  (singular-record reads via `getQuote`/`getContact`), reused by the project
  page instead of duplicating Xero-calling logic.
- `src/lib/xero/normalize.ts` — `normalizeQuote`'s `date`/`expiryDate` now go
  through a `toDateOnly()` helper that trims to `YYYY-MM-DD`. Found live: the
  singular `getQuote` endpoint doesn't populate `dateString` the way the
  list endpoint does, so it was falling back to the raw `date` field, which
  is a full ISO timestamp — the project page was showing
  `2026-07-04T00:00:00` instead of `2026-07-04`.
- `src/app/projects/page.tsx` — was a static "coming soon" placeholder; now
  an async Server Component that lists any seeded `DemoProject` rows (still
  falls back to the "coming soon" message when none exist), each linking to
  `/projects/[slug]`. Marked `export const dynamic = "force-dynamic"`.
- `src/components/layout/nav-items.ts` — added a "Demo" nav item, and
  flipped "Projects" from `comingSoon: true` to `false` now that it shows
  real (if minimal) content.
- `src/components/layout/NavIcon.tsx` — added an icon path for `/demo`.

## Database changes

Added one model via `npx prisma migrate dev --name add_demo_project`:

```prisma
model DemoProject {
  id                    String   @id @default(cuid())
  slug                  String   @unique
  name                  String
  status                String
  xeroTenantId          String
  xeroContactId         String
  xeroSourceQuoteId     String
  xeroSourceQuoteNumber String
  seedReference         String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

Matches the spec's detailed field list exactly (the shorter illustrative
JSON example in the spec included a `customerName` field, but the more
precise "LOCAL DATA MODEL" list did not — the customer's name is fetched
live from Xero via `xeroContactId` instead of being duplicated locally,
consistent with "ScopeLock should never attempt to find the project using
only the customer's name").

## Xero records successfully created or found (live, against the developer's
own connected Xero organisation)

All of the following were exercised against the real Xero API, not mocked:

- **Sales account**: found automatically — account `200` ("Sales"), the
  first active `REVENUE`-class account in the organisation.
- **Contact**: created — Baker & Co, matched afterward by
  `demo-baker@scopelock.local`.
- **Items**: all 5 created — `LED-PACK`, `SOCKET-MOVE`, `HANDLE-BLACK`,
  `PAINT-HALL`, `EXTRA-CAB`, each with the specified sales description and
  unit price.
- **Quote**: created (quote number `QU-0001`), reference
  `SCOPELOCK-DEMO-KITCHEN-001`, 6 line items, total exactly £8,400.00.
  Xero's Demo Company **silently created it as `DRAFT`** even though the
  seed requests `ACCEPTED` — no error was thrown, so the code specifically
  checks the returned status (not just whether the call succeeded) and
  reports `MANUAL_ACTION_REQUIRED` in this case. See
  `PHASE2_DEMO_SETUP.md` → "Manual quote-status step".
- **Local `DemoProject` link**: created, then re-verified after a
  disconnect/reconnect-style local reset (`reset-local` → `verify` showed
  `projectLink: FAILED` while all Xero-side steps still showed `FOUND`,
  confirming the reset never touched Xero) and re-seeded back to a working
  state.
- **Idempotency**: re-ran the full seed after the first successful run —
  every step reported `FOUND` (sales account, contact, all 5 items, quote),
  only `projectLink` reported `UPDATED`. No duplicates were created.
- **`/projects/demo-kitchen`**: confirmed live in the browser — quote
  number, status (DRAFT), issue date, customer, total (£8,400.00), all 6
  agreed-scope line items (with `HANDLE-BLACK` correctly tagged with its
  item code), all 5 trusted-pricing items with account codes, and the fixed
  next-phase preview message.
- **`/projects`**: confirmed live — lists the "Kitchen Refurbishment" card,
  links through to the project page.

## Live Xero operations not tested

- A fresh quote creation that Xero *does* accept directly as `ACCEPTED`
  (this environment's Demo Company always downgraded it to `DRAFT` — the
  manual-status-change path was exercised, the direct-success path wasn't).
- Seeding into a second, different Xero organisation (only tested against
  one connected org).
- Behavior when the connected token expires mid-seed (inherits Phase 1's
  untested token-refresh path).

## Manual steps still required

1. **Mark the kitchen quote Accepted in Xero.** It was created as `DRAFT`
   (Business → Quotes → `QU-0001` / reference
   `SCOPELOCK-DEMO-KITCHEN-001`) — open it in Xero and change its status to
   Accepted so it matches the demo's "agreed quote" story. The app never
   does this automatically (quotes are never auto-sent/authorised).

## Build results

- `npx prisma migrate dev --name add_demo_project` — applied cleanly.
- `npx tsc --noEmit` — clean, no errors, at every checkpoint during this
  phase.
- `npx eslint .` — clean (one `react/no-unescaped-entities` error caught and
  fixed — an apostrophe in `DemoSetupPage.tsx`'s reset confirmation copy).
- `npm run build` — succeeds. New routes: `/demo` (static — no server data
  fetched on load, only on button click), `/projects` and
  `/projects/[slug]` (both `force-dynamic`, since they read live DB/Xero
  state), `/api/demo/{seed,verify,reset-local}` (dynamic).

## Known limitations

- Single demo project (`demo-kitchen`) — the model supports more via
  `slug`, but only one is seeded.
- The "default sales account" resolution always picks the first active
  revenue account (preferring `type: SALES`) with no way to override it —
  fine for a single Demo Company, but a real multi-org setup would want an
  explicit configured account code.
- `loadProjectDetail` makes 3 separate authenticated-client calls (contact,
  quote, and 5 item lookups) rather than sharing one client instance across
  all of them — fine at demo scale, not optimized for high traffic.
- No AI, message ingestion, or scope comparison exists yet — the next-phase
  message is stored and displayed only, never analysed, exactly as
  specified.

## Definition of done — status

- [x] Demo scenario seeds safely.
- [x] Rerunning the seed does not create duplicates (verified twice).
- [x] Baker & Co is linked through its ContactID.
- [x] The five pricing items can be retrieved from Xero.
- [x] The kitchen source quote can be retrieved from Xero.
- [x] The local project stores the Xero source quote ID.
- [x] `/projects/demo-kitchen` displays the real agreed scope.
- [x] Trusted pricing is displayed from Xero.
- [x] No AI or messaging functionality has been added.
- [x] Type checking, lint and build succeed.
