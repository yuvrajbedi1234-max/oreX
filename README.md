# oreX

**oreX catches scope creep before it becomes unpaid work.**

Small trade and service businesses lose real money when a client casually asks
for "just one more thing" in a message and the extra work quietly gets done for
free. oreX connects those client conversations to the customer's **accepted Xero
quote**, works out what is genuinely outside the agreed scope, prices it from the
business's own Xero items, and helps the owner turn it into an approved
variation — all before the work starts.

## How it works

1. **Connect Xero.** Secure OAuth 2.0 with encrypted, server-side token storage —
   tokens never reach the browser.
2. **Scope Diff.** An incoming client message is compared against the accepted
   quote. Each request is classified as **Included**, **Likely variation**, or
   **Needs review**, with supporting evidence and a confidence score. Two
   analysers are available:
   - **AI Analysis** — Claude reads arbitrary client messages, classifies each
     request, and suggests the right Xero item to price it against.
   - **Deterministic Demo** — a fixed, no-AI analyser kept as a reliable fallback.
3. **Trusted pricing.** Every amount comes straight from your **Xero Items** —
   oreX never generates financial figures.
4. **Review & approve.** The owner edits the proposed variation (quantity,
   description, item, or a manual price), then explicitly approves it.
5. **Draft variation in Xero.** On approval, oreX creates a real **DRAFT** quote
   in Xero — never sent or authorised — and stores the returned Quote ID so the
   same variation can't be created twice. The original quote is never touched.

### Guardrails

- The AI classifies and explains; it **never** prices, sends, or approves anything.
- All pricing is retrieved from Xero.
- Every write to Xero requires human confirmation and is always a draft.
- Low-confidence requests are surfaced for review rather than billed automatically.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Prisma/SQLite · xero-node ·
Anthropic Claude (`claude-opus-4-8`).

## Quick start

```bash
npm install
cp .env.example .env      # fill in Xero credentials — see SETUP_XERO.md
npm run db:migrate         # create the local SQLite database
npm run dev
```

Then open http://localhost:3000 and:

1. **Xero Connection** → connect your Xero organisation.
2. **Demo** → create the demo scenario (seeds a customer, pricing items, and an
   accepted quote into Xero so there is real financial data to work against).
3. **Projects** → open the project → **Open Scope Diff** → run it, then
   **Review variation** to create the draft in Xero.

Set `ANTHROPIC_API_KEY` in `.env` to enable **AI Analysis** — it's optional, as
the deterministic analyser works without it.

## Docs

- [SETUP_XERO.md](./SETUP_XERO.md) — creating a Xero app, scopes, the encryption
  key, and common errors.
- Build notes and verification per phase: [PHASE1_REPORT.md](./PHASE1_REPORT.md),
  [PHASE2_REPORT.md](./PHASE2_REPORT.md), [PHASE3_REPORT.md](./PHASE3_REPORT.md),
  [PHASE4_5_REPORT.md](./PHASE4_5_REPORT.md).
