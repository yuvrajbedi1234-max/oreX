# ScopeLock — Phase 3 Report

## Scope

Phase 3 adds the Scope Diff experience: a fixed client message compared
against the real, live Xero source quote, classified as included / likely
variation / needs review, and priced from real Xero items — using a
deterministic (non-AI) analyser. Phase 1 (Xero OAuth/reads) and Phase 2
(demo seeding, project page) were reused as-is; nothing in either was
rebuilt.

## Files created

**Data contract, analyser, pricing** (`src/lib/scope-diff/`)
- `types.ts` — `ScopeClassification`, `ScopeEvidence(Type)`,
  `DetectedRequest`, `PricedVariationLine`, `ScopeDiffResult`,
  `ScopeDiffErrorCode`/`ScopeDiffError`.
- `demo-message.ts` — the fixed client message as a server-side fixture
  (`DEMO_MESSAGE_ID = "demo-message-001"`), reusing Phase 2's
  `DEMO_NEXT_PHASE_MESSAGE` constant rather than duplicating the string.
- `deterministic-analyser.ts` — `normalizeText`, `findQuoteLineByTerms`,
  `buildIncludedRequest`/`buildVariationRequest`/`buildNeedsReviewRequest`,
  and `analyseDemoMessage` (the fixed 3-request pipeline).
- `pricing.ts` — `findXeroItemByCode` (array lookup, distinct from Phase 2's
  live-Xero-query lookup of the same name), `calculateVariationLine`,
  `calculateSubtotal`.
- `build-scope-diff.ts` — `buildScopeDiff`, `loadStoredScopeDiff`,
  `resetScopeDiff`: the orchestrator that ties Xero reads + the analyser +
  storage together.

**API route**
- `src/app/api/projects/[slug]/scope-diff/route.ts` — `POST` (run
  analysis), `GET` (load last stored result), `DELETE` (reset, local only).

**UI**
- `src/app/projects/[slug]/scope-diff/page.tsx` — Server Component; loads
  the project via Phase 2's `loadProjectDetail`, plus the fixed message, and
  passes plain serializable props to the client page.
- `src/components/scope-diff/{ScopeDiffPage,ConversationPanel,
  ScopeAnalysisPanel,RequestCard,VariationPreviewPanel,
  OriginalAgreementDrawer,ClassificationBadge,types}.tsx` — the three-panel
  layout, filters, evidence drawer, original-agreement drawer, loading/error
  states.

**Docs**
- `PHASE3_SCOPE_DIFF.md`, `PHASE3_REPORT.md` (this file).

## Files modified

- `prisma/schema.prisma` — added `ScopeAnalysis` model.
- `prisma/migrations/20260704165735_add_scope_analysis/` — new migration.
- `src/app/projects/[slug]/page.tsx` — the "Next phase preview" card now
  links to `/projects/[slug]/scope-diff` ("Open Scope Diff" button) instead
  of just previewing the message with no next step.
- `src/lib/demo/project-detail.ts` — **bug fix, see below**: the 3 Xero
  reads it fires (contact, quote, 5 items) were changed from `Promise.all`
  to sequential `await`s.
- `src/lib/scope-diff/build-scope-diff.ts` — same concurrency fix applied
  to its own 3-item lookup (this file was written in this phase, but the
  bug was caught during the same live-testing pass, so it's fixed here
  too, not left for a later phase).

## Routes added

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/projects/[slug]/scope-diff` | POST | Runs the deterministic analyser against real Xero data, persists and returns the result |
| `/api/projects/[slug]/scope-diff` | GET | Returns the last stored result (or `{result: null}`), no Xero calls |
| `/api/projects/[slug]/scope-diff` | DELETE | Deletes the stored result only — never touches Xero |
| `/projects/[slug]/scope-diff` | page | The three-panel Scope Diff UI |

## Models added

```prisma
model ScopeAnalysis {
  id            String   @id @default(cuid())
  demoProjectId String
  messageId     String
  analyserType  String
  resultJson    String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([demoProjectId, messageId])
}
```

Stores only the latest result per `(demoProjectId, messageId)` — upserted on
every run, deleted on reset. Not a workflow/history log, as instructed.

## Deterministic rules implemented

See `PHASE3_SCOPE_DIFF.md` → "The deterministic analyser" for the full
table. Summary: each of the 3 fixed requests independently validates its
expected Xero item and/or quote line exist before producing a
classification; a missing dependency degrades that one request to
`NEEDS_REVIEW` with an honest explanation, rather than fabricating evidence
or a price for it. Route-level errors (`project_not_found`, `not_connected`,
`source_quote_missing`, `quote_lines_missing`, `pricing_item_missing`,
`insufficient_permissions`, `invalid_message`) are reserved for failures
that make the whole analysis impossible (can't reach the project, Xero, or
the quote/items API at all) — a single missing item code degrades
gracefully instead.

## Live Xero reads completed

All against the developer's real, connected Xero organisation and the
Phase 2 seeded data:

- `GET` the source quote (`QU-0001`, reference
  `SCOPELOCK-DEMO-KITCHEN-001`) by ID — real line items, real total
  (£8,400.00), real status (**ACCEPTED**).
- `GET` items `LED-PACK`, `SOCKET-MOVE`, `HANDLE-BLACK` by code.
- Full `POST /api/projects/demo-kitchen/scope-diff` run, end to end, through
  the actual browser UI (not just curl/fetch): clicked **Run Scope Diff**,
  confirmed all 3 requests rendered with correct classifications, clicked a
  card to expand evidence, opened **View original agreement** and confirmed
  the matched quote line ("Electrical work at existing socket locations")
  was highlighted for the selected socket-relocation request, tested the
  **Included / Variations / Needs review** filters, tested **Reset
  analysis** (confirmed via a follow-up `GET` that the stored result was
  gone), then re-ran to leave the demo in a ready state.

## A real bug found and fixed during this live testing

**Xero's per-app concurrent-request limit was tripped (`429`, `x-rate-limit-problem: concurrent`).**
Both `loadProjectDetail` (Phase 2) and `buildScopeDiff` (this phase) fired
several Xero API calls via `Promise.all` — up to 7 at once between the
contact, quote, and 5 item lookups. Xero's API enforces a concurrent-call
ceiling per app and rejected the burst. Fixed by making these reads
sequential (`for`-loop with `await` instead of `Promise.all`) in both
files. Confirmed fixed live: the project page and Scope Diff page both
loaded correctly afterward with no more 429s.

## Expected versus actual retrieved item prices

| Item | Expected (per `PHASE2_DEMO_SETUP.md`) | Actual (retrieved live from Xero) |
| --- | --- | --- |
| `LED-PACK` | £240.00 | £240.00 |
| `SOCKET-MOVE` | £180.00 | £180.00 |

Both match — the seeded prices were never changed.

## Expected versus actual subtotal

Expected: **£600.00** (1 × £240 + 2 × £180). Actual, returned live by
`POST /api/projects/demo-kitchen/scope-diff`: **£600.00**. Match.

The "change a price in Xero and rerun" grounding test described in
`PHASE3_SCOPE_DIFF.md` was **not** run in this session — it requires
interactively editing a Xero item's price in the Xero web UI, which is a
manual step for the developer, not something to script around. The code
path that would make it pass (`unitAmount: item.salesUnitPrice`, read
straight from the live API response with no fallback constant) was
inspected and confirmed to contain no hardcoded price.

## Type-check result

`npx tsc --noEmit` — clean, no errors, at every checkpoint during this
phase.

## Lint result

`npx eslint .` — clean, no errors or warnings.

## Build result

`npm run build` — succeeds.

```
├ ƒ /api/projects/[slug]/scope-diff
...
├ ƒ /projects/[slug]/scope-diff
```

Both new routes compile as dynamic, as expected (live Xero/DB reads on
every request).

## Known limitations

- The analyser is entirely fixed to the one demo message
  (`demo-message-001`) and the three requests it contains — it does not
  parse arbitrary text. This is intentional for Phase 3; Phase 4 replaces
  only this layer.
- Evidence highlighting is scoped to "selected card ↔ original agreement
  drawer," not full cross-panel word-level highlighting in the client
  message itself (the spec explicitly allows this simpler fallback).
- `ScopeAnalysis` stores one row per `(project, message)` — rerunning
  overwrites it; there's no history of previous analyses.
- The Node.js `DEP0169 url.parse()` deprecation warning from xero-node's
  own dependency chain still appears in server logs (pre-existing since
  Phase 1, not something this phase's code can fix without patching the
  SDK).
- `Review variation` is a genuinely disabled button (not a styled link) —
  clicking it does nothing, which is correct per spec ("must not create a
  Xero quote in this phase").

## Exact manual demonstration steps

1. Confirm `/demo` shows all green and the source quote is **Accepted** in
   Xero (carry over from Phase 2).
2. Open `/projects/demo-kitchen/scope-diff`.
3. Click **Run Scope Diff**.
4. Confirm: "3 work requests detected" badge on the conversation panel.
5. Confirm: **Under-cabinet LED lighting** — Likely variation, £240,
   `LED-PACK`.
6. Confirm: **Relocate two electrical sockets** — Likely variation,
   quantity 2, £360, `SOCKET-MOVE`.
7. Confirm: **Matte-black cabinet handles** — Included, no price.
8. Confirm: Variation preview subtotal = **£600.00**.
9. Click a request card — evidence expands inline.
10. Click **View original agreement** — confirm the matched quote line is
    highlighted for the selected request; press **Escape** to close it.
11. Try the **Included / Variations / Needs review** filters.
12. Click **Reset analysis**, confirm the page returns to "No analysis
    yet," then click **Run Scope Diff** again to restore the demo-ready
    state.
13. (Optional, manual) Change `LED-PACK`'s price in Xero, rerun, confirm
    the total changes, then change it back to £240.
