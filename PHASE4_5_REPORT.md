# Phase 4 & 5 — AI Scope Diff + Variation Write-Back

This build adds an AI analyser for the Scope Diff (Phase 4) and a human-in-the-
loop variation review that creates a real **DRAFT** quote in Xero (Phase 5).
Everything is layered on top of the Phase 3 contracts — the `ScopeDiffResult`
shape, pricing, storage, and the existing UI were reused, not rewritten.

## Run it

```bash
npm install                 # installs @anthropic-ai/sdk (new dependency)
npm run db:migrate          # applies prisma/migrations/..._add_variation
# add ANTHROPIC_API_KEY=... to .env for AI Analysis (optional — deterministic works without it)
npm run dev
```

---

## Phase 4 — Structured AI Scope Diff

### What changed

- **`src/lib/scope-diff/ai-analyser.ts`** — new. Calls Claude
  (`claude-opus-4-8` by default, override with `SCOPELOCK_AI_MODEL`) via the
  official `@anthropic-ai/sdk`. It receives the client message, the original
  Xero quote lines, the available Xero items, and project/customer context. A
  **forced tool call** guarantees the model returns structured JSON. Returns a
  typed error (never throws) so callers can fall back.
- **`src/lib/scope-diff/ai-schema.ts`** — new. The tool JSON schema plus a
  defensive validator. The AI is never trusted blindly:
  - Unknown classifications → `NEEDS_REVIEW`.
  - `confidence` clamped to `[0,1]`; **anything below 0.6 is forced to
    `NEEDS_REVIEW`** (so uncertain requests never present as confident
    variations).
  - `suggestedItemCode` is accepted **only if it exists in the real Xero item
    list** — the AI can never invent a code, and it never returns a price.
  - `matchedQuoteLineId` accepted only if it matches a real quote line id.
  - Structurally invalid output is rejected (`ai_invalid_output`).
- **`src/lib/scope-diff/build-scope-diff.ts`** — now takes
  `{ analyser, messageId, messageText }`. Routes to the AI or deterministic
  analyser, loads the full seeded item catalogue (all 5 items, so the AI can
  match e.g. `PAINT-HALL`), and records which analyser produced the result.
- **`src/lib/scope-diff/demo-message.ts`** — `buildClientMessage()` lets an
  arbitrary message be analysed, with a stable derived id for storage.
- **API** (`/api/projects/[slug]/scope-diff`) — accepts `analyser` and
  `messageText`; new error codes `ai_unavailable` (503) / `ai_invalid_output`
  (502).
- **UI** (`ScopeDiffPage`) — an **analyser selector** (AI Analysis /
  Deterministic Demo, defaulting to **AI**), an editable client message, a
  badge showing which analyser produced the result, and a one-click "Use
  Deterministic Demo" fallback when AI fails.

### Definition of done

| Item | Where |
| --- | --- |
| A different client message can be analysed | Editable message box → `messageText` → AI analyser |
| Response follows a validated JSON schema | `ai-schema.ts` tool schema + `validateAiAnalysis` |
| Invalid AI output is rejected safely | `validateAiAnalysis` returns `ai_invalid_output`; per-request coercion/drop |
| Pricing still comes from Xero | AI only returns `suggestedItemCode`; `pricing.ts` prices from the Xero item, unchanged |
| Low-confidence requests become NEEDS_REVIEW | `AI_CONFIDENCE_REVIEW_THRESHOLD = 0.6` downgrade |
| Deterministic analyser still works as a fallback | Selector + auto-fallback button; `analyseDemoMessage` untouched |

---

## Phase 5 — Variation review and Xero write-back

### What changed

- **`prisma/schema.prisma`** — new `Variation` model storing the returned
  `xeroQuoteId` / `xeroQuoteNumber` / revision / totals. Migration in
  `prisma/migrations/20260705120000_add_variation/`.
- **`src/lib/xero/queries.ts`** — `createVariationDraftQuote()` creates exactly
  one **DRAFT** quote (never sent/authorised) and returns the QuoteID, number,
  and Xero-computed subtotal/tax/total.
- **`src/lib/variations/build-variation.ts`** — new.
  - `loadVariationReview()` gathers the stored scope diff, the live
    customer/quote/pricing catalogue from Xero, and any existing variation.
  - `createVariation()` re-prices every `XERO_ITEM` line **from Xero**
    (client-sent prices ignored), allows a **manual price** only where the
    owner chose no item, builds the title/reference, creates the draft, and
    stores the record.
- **API** (`/api/projects/[slug]/variation`, POST) — the only endpoint that
  writes to Xero.
- **Page** `/projects/demo-kitchen/variation-review` + **`VariationReview`**
  component — the review interface, confirmation modal, and success screen.

### Xero quote format

```
Title:      Variation 01 — Kitchen Refurbishment
Reference:  SCOPELOCK-VARIATION-QU-1049-01
Summary:    Variation related to original quote QU-1049
Status:     DRAFT   (never sent / authorised)
Lines:      Under-cabinet LED lighting  1 × £240
            Relocate electrical socket  2 × £180
```

The revision number (`01`) increments on "Create another revision".

### Human approval & duplicate protection

- Nothing is written until the owner clicks **Approve and create draft
  variation** and confirms in the modal.
- The approve button is disabled while submitting.
- The returned `QuoteID` is stored; `createVariation()` **refuses to create a
  second quote** when one already exists for the message (returns the existing
  one). On page load an existing draft shows the success screen directly.
- **Create another revision** is a deliberate action that bumps the revision.
- The original quote is only ever read — the flow calls `createQuotes`, never
  `updateQuote`.

### Definition of done

| Item | Where |
| --- | --- |
| Owner can edit the proposed variation | `VariationReview` — description, qty, item, manual price, move between Included / Needs review |
| Approval requires explicit confirmation | `ConfirmModal` before any write |
| A real draft quote is created in Xero | `createVariationDraftQuote` (status DRAFT) |
| Returned QuoteID and QuoteNumber are stored | `Variation` row |
| Duplicate clicks don't create duplicates | idempotency gate + disabled button + unique index |
| Original Xero quote remains unchanged | only `createQuotes` is called |
| Nothing is automatically sent | status is always DRAFT; no send/authorise call exists |

---

## Notes / trade-offs

- **AI provider:** used the official `@anthropic-ai/sdk` with a forced tool
  call for guaranteed-structured output, then re-validate everything server
  side. Model defaults to `claude-opus-4-8`.
- **Tax:** Xero computes tax on the draft; the review shows the subtotal and
  labels tax as "calculated by Xero", and the success screen shows the exact
  Xero-returned subtotal/tax/total.
- **Idempotency** is the "minimum protection" the brief asked for, not full
  production idempotency: the only unprotected window is between the Xero
  create and the local insert on a genuine double-submit race, which the
  disabled button and unique index make very unlikely.
