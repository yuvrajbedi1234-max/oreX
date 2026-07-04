# ScopeLock

ScopeLock protects small service businesses from unpaid scope creep. It
connects client conversations to accepted Xero quotes so extra work gets
priced and approved before it becomes free labour.

**Phase 1** (this build) delivers the Xero-connected foundation only: OAuth,
encrypted token storage, and reading/writing quotes, contacts and items. Scope
comparison, WhatsApp intake, and AI-drafted variations are later phases.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + Prisma/SQLite + xero-node.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in Xero credentials — see SETUP_XERO.md
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000 and go to **Xero Connection** in the left nav —
it's the only screen with live functionality in Phase 1.

Full walkthrough (creating a Xero app, scopes, encryption key, common errors):
see [SETUP_XERO.md](./SETUP_XERO.md). Build/verification results and known
limitations: see [PHASE1_REPORT.md](./PHASE1_REPORT.md).
