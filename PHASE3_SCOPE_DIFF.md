# Phase 3 — Scope Diff (deterministic demo analyser)

Phase 3 builds the product's core "magic moment" — client message → detected
requests → compared against the agreed Xero quote → included vs. likely
variation → priced from trusted Xero items — using a **fixed, deterministic
analyser** instead of an LLM. This lets UI bugs, Xero bugs, and AI-output
bugs be found and fixed independently. Phase 4 replaces only the analyser.

## The deterministic analyser

`src/lib/scope-diff/deterministic-analyser.ts` exports small, composable
functions rather than one static JSON blob:

- `normalizeText()` — lowercases, strips punctuation, collapses whitespace.
- `findQuoteLineByTerms(quote, terms)` — finds a quote line whose normalized
  description contains every given term. Returns `null` — never invents a
  match — if nothing qualifies.
- `buildIncludedRequest()` / `buildVariationRequest()` / `buildNeedsReviewRequest()`
  — thin builders that attach the right `classification` to a request.
- `analyseDemoMessage({ quote, items })` — the fixed pipeline for the three
  demo requests (LED lighting, socket relocation, matte-black handles).

Each of the three requests independently validates its dependencies before
producing a classification:

| Request | Depends on | If missing |
| --- | --- | --- |
| Under-cabinet LED lighting | Xero item `LED-PACK` | `NEEDS_REVIEW` — "Could not verify pricing" |
| Relocate two sockets | Quote line matching "existing"+"socket", Xero item `SOCKET-MOVE` | `NEEDS_REVIEW` — names whichever is missing |
| Matte-black handles | Quote line matching "matte"+"black"+"handle" | `NEEDS_REVIEW` — "Could not find a matching line" |

No request is ever given evidence, a classification, or a price it can't
actually back up from real data.

## The data contract

`src/lib/scope-diff/types.ts` defines `ScopeClassification`,
`ScopeEvidence`, `DetectedRequest`, `PricedVariationLine`, and
`ScopeDiffResult` — matching the spec's contract field-for-field. This
contract is deliberately independent of the analyser that produces it:
`ScopeDiffResult.analyser` is `"DETERMINISTIC_DEMO" | "AI"`, so **Phase 4
only needs to write a new function with the signature
`(quote, items) => DetectedRequest[]` and swap it into
`build-scope-diff.ts`** — the API route, storage, and every UI component
stay exactly as they are.

## How Xero quote evidence is used

`findQuoteLineByTerms` searches the *real* quote fetched from Xero
(`fetchQuoteById`, reused from Phase 2) — never a cached or hardcoded copy.
Each piece of evidence carries the quote line's real `lineItemId` and
`description` (`ScopeEvidence.sourceId` / `sourceText`), so the UI can
highlight the exact matching line in the "View original agreement" drawer.

## How trusted prices are retrieved

`buildScopeDiff()` fetches `LED-PACK`, `SOCKET-MOVE`, and `HANDLE-BLACK` from
Xero on every run (`findItemByCode`, reused from Phase 2's lookup module —
never re-implemented). `calculateVariationLine()` in
`src/lib/scope-diff/pricing.ts` reads `item.salesUnitPrice` directly from
that live response:

```ts
const unitAmount = item.salesUnitPrice; // always the live Xero value
lineAmount = quantity * unitAmount;
```

There is no fallback constant, no cached "expected" price, and no path where
a number is invented if Xero doesn't return one — `calculateVariationLine`
returns `null` (and that line is simply omitted) if `salesUnitPrice` is
missing.

## Why financial prices are never generated

Every `PricedVariationLine.priceSource` is the literal string `"XERO_ITEM"`
— there's no other value the type allows. The analyser only ever
*classifies* (included / likely variation / needs review) and *matches*
(which item code, which quote line); pricing is a separate step
(`pricing.ts`) that only ever multiplies quantity by a number that came out
of a Xero API response. An AI analyser in Phase 4 will be able to change
classifications and evidence, but it plugs into the same `matchedItemCode`
field — it still can't set a price itself.

## Expected result (fixed demo message)

> "The kitchen looks great. Could you also add LED lights underneath the
> cabinets and move the two sockets beside the fridge? Please make sure the
> handles are matte black like we agreed."

| Request | Classification | Price |
| --- | --- | --- |
| Under-cabinet LED lighting | Likely variation | £240 (1 × `LED-PACK`) |
| Relocate two sockets | Likely variation | £360 (2 × `SOCKET-MOVE` @ £180) |
| Matte-black handles | Already included | £0 |

**Subtotal: £600** (+ applicable tax) — confirmed live against the seeded
Phase 2 data (see PHASE3_REPORT.md).

## Missing-data behaviour

- **Project not linked / not seeded** → `project_not_found`, points to `/demo`.
- **Xero not connected** → `not_connected`, points to `/xero`.
- **Quote can't be fetched from Xero at all** → `source_quote_missing`.
- **Quote exists but has zero line items** → `quote_lines_missing`.
- **Can't reach the Items API at all** (auth/network failure, not just one
  missing code) → `pricing_item_missing`.
- **Missing Xero permission** (e.g. `accounting.invoices` revoked) →
  `insufficient_permissions`.
- **Unknown `messageId`** → `invalid_message` (this demo only recognises
  `demo-message-001`).
- **One specific expected item/quote line missing** (e.g. someone deleted
  `LED-PACK` from Xero but everything else still works) does **not** fail
  the whole route — only that one request degrades to `NEEDS_REVIEW`.

The Scope Diff page never shows a blank/broken dashboard for these — see
"Loading and error states" in `PHASE3_REPORT.md` for what each one looks
like in the UI.

## How to run the Scope Diff demo

1. Make sure the Phase 2 demo scenario is seeded (`/demo` → all green) and
   the source quote is **Accepted** in Xero.
2. Go to `/projects/demo-kitchen/scope-diff`.
3. Click **Run Scope Diff**.
4. Click a request card to expand its evidence.
5. Click **View original agreement** to see the full quote, with the
   selected request's matching line highlighted.
6. Use the **All / Included / Variations / Needs review** filters.
7. Click **Reset analysis** to clear the stored result and start over.

### Recommended manual verification (proves pricing is genuinely grounded)

Change `LED-PACK`'s unit price in Xero (Business → Products and services),
then click **Run Scope Diff** again. The Under-cabinet LED lighting line and
the subtotal should update to reflect the new price — if they don't,
something is hardcoded. Change it back to £240 afterward to keep the demo
scenario consistent with `PHASE2_DEMO_SETUP.md`.

## How Phase 4 will replace only the extraction/classification layer

Everything in this phase — the API route
(`src/app/api/projects/[slug]/scope-diff/route.ts`), storage
(`ScopeAnalysis` model), and every UI component under
`src/components/scope-diff/` — consumes `ScopeDiffResult` and has no
knowledge of *how* `requests` was produced. Phase 4 should:

1. Add a new function (e.g. `src/lib/scope-diff/ai-analyser.ts`) with the
   same signature as `analyseDemoMessage` conceptually — given a quote, the
   available Xero items, and a real (not fixed) client message, return
   `DetectedRequest[]`.
2. Swap the call in `buildScopeDiff()` from `analyseDemoMessage` to the new
   function, and set `result.analyser = "AI"`.
3. Keep pricing (`calculateVariationLine`/`calculateSubtotal`) exactly as-is
   — the AI should only ever return a `matchedItemCode`, never a price.

No other file needs to change.
