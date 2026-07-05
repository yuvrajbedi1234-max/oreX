# Setting up the Xero connection

ScopeLock Phase 1 needs a Xero developer app, a local SQLite database, and a
few environment variables. This walks through all of it end to end.

## 1. Create a Xero developer app

1. Go to https://developer.xero.com/app/manage and sign in.
2. Click **New app**.
3. Choose **Web app**.
4. Give it any name (e.g. "ScopeLock Dev").
5. Set the company/privacy URLs to anything valid (they're not checked in dev).
6. Once created, open the app and copy the **Client ID**. Click **Generate a
   secret** and copy the **Client Secret** — you won't be able to see it again.

## 2. Callback URI to configure

In the app's **Configuration** tab, add this exact redirect URI:

```
http://localhost:3000/api/xero/callback
```

It must match `XERO_REDIRECT_URI` in `.env` character-for-character, including
the port and path. This is the #1 source of connection failures.

## 3. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `XERO_CLIENT_ID` | From the Xero app you just created |
| `XERO_CLIENT_SECRET` | From the Xero app you just created |
| `XERO_REDIRECT_URI` | Must exactly match the URI configured in step 2 |
| `XERO_SCOPES` | Space-separated granular scopes (see default in `.env.example`) |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 key used to encrypt stored tokens |
| `DATABASE_URL` | SQLite connection string, e.g. `file:./dev.db` |
| `ANTHROPIC_API_KEY` | **(Phase 4)** Anthropic API key for the AI Scope Diff analyser. Optional — without it, use the "Deterministic Demo" analyser fallback. |
| `SCOPELOCK_AI_MODEL` | **(Phase 4, optional)** Override the Claude model used for AI analysis. Defaults to `claude-opus-4-8`. |

Never commit `.env` — it's already gitignored.

## 4. Generate a valid 32-byte encryption key

```bash
openssl rand -base64 32
```

Paste the output as `TOKEN_ENCRYPTION_KEY`. If it's missing or doesn't decode
to exactly 32 bytes, every route that touches the stored connection will
return a clear `config_error` instead of silently failing.

## 5. Initialise the database

```bash
npm install
npx prisma migrate dev
```

This creates `dev.db` (SQLite) in the project root and generates the Prisma
Client into `src/generated/prisma`. `npm install` also runs `prisma generate`
automatically via a `postinstall` script.

> SQLite is a hackathon convenience. Before any real deployment, switch the
> `datasource` provider in `prisma/schema.prisma` to `postgresql`, point
> `DATABASE_URL` at a real Postgres instance, and re-run `prisma migrate dev`.

## 6. Start the application

```bash
npm run dev
```

Open http://localhost:3000 and go to **Xero Connection** in the left nav.

## 7. Connect a Xero Demo Company

1. Click **Connect to Xero**.
2. Log in with your Xero developer account.
3. Xero auto-provisions a **Demo Company** the first time you authorize a new
   app — select it (or any other sandbox/test organisation you have) on the
   organisation picker.
4. Approve the requested permissions. You'll be redirected back to
   `/xero?connected=true`.

Use only a Demo Company or another test organisation for this phase — never
a real production ledger.

## 8. Update permissions after changing scopes

If you edit `XERO_SCOPES` in `.env` (e.g. add a scope):

1. Restart the dev server so the new value is loaded.
2. On the Xero Connection page, click **Update Xero permissions** (shown
   automatically once the app detects the connected token is missing a
   scope you now require).
3. Approve the new permission set in the Xero consent screen.

## 9. Run the read tests

With a connection active, click **Run connection tests**. This calls the
Quotes, Contacts and Items read endpoints with a small request each and
reports Passed/Failed per capability. The fourth check ("Draft quote
writable") only inspects whether the `accounting.invoices` scope was
granted — it never creates a quote.

## 10. Create the disposable test draft quote

In the **Create test draft quote** panel:

1. Select a contact from the dropdown (populated from your connected org).
2. Tick "I confirm I am using a Xero Demo Company or test organisation."
3. Click **Create test draft quote**.

This creates exactly one quote with reference `SCOPELOCK-INTEGRATION-TEST`,
status `DRAFT`, a single $1 line item, and a 14-day expiry. It is never sent
or authorised — find it in Xero under Business → Quotes and delete it
whenever you like.

## 11. Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| **Invalid redirect URI** (Xero consent screen rejects the request) | `XERO_REDIRECT_URI` doesn't exactly match what's configured in the Xero app | Make them identical, including protocol/port/path |
| **invalid_scope** (on the Xero consent screen itself, before you even log in) | `XERO_SCOPES` requests a scope your app isn't entitled to — often the deprecated `accounting.transactions`, which apps created after March 2026 can no longer request at all | Check Configuration > Authorisation > Scopes in the Xero developer portal for the exact list your app can request. Quotes now live under the granular `accounting.invoices` scope (along with purchase orders, credit notes, and items), not `accounting.transactions` |
| **insufficient_scope** (after connecting, on a specific API call) | The connected token doesn't include a scope that request needs | Add the scope to `XERO_SCOPES` (only if it's actually available — see above), restart, then click **Update Xero permissions** |
| **No connected tenant** | OAuth completed but no organisation was authorized | Reconnect and make sure you select an organisation on Xero's picker screen |
| **Expired token** | Access token expired and refresh failed (e.g. revoked externally) | Disconnect and reconnect from the Xero Connection page |
| **Missing environment variable** | `.env` is incomplete | Check the app's error message — it names the exact variable that's missing |
| **Xero validation error** | Xero rejected a request body (e.g. bad line item) | The app surfaces Xero's validation message directly; fix the underlying data and retry |
