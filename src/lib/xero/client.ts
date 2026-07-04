import "server-only";
import { XeroClient } from "xero-node";
import { configError, notConnectedError } from "./errors";
import { getConnection, saveConnection } from "./token-store";
import type { TokenSet } from "./types";

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw configError(`Missing required environment variable: ${name}. Check your .env file.`);
  }
  return value;
}

export function getConfiguredScopes(): string[] {
  const raw = process.env.XERO_SCOPES;
  if (!raw || !raw.trim()) {
    throw configError("XERO_SCOPES is not set. Configure granular Xero scopes in .env.");
  }
  return raw.split(" ").filter(Boolean);
}

function baseConfig(state?: string) {
  return {
    clientId: readEnv("XERO_CLIENT_ID"),
    clientSecret: readEnv("XERO_CLIENT_SECRET"),
    redirectUris: [readEnv("XERO_REDIRECT_URI")],
    scopes: getConfiguredScopes(),
    ...(state ? { state } : {}),
  };
}

// Step 1 of OAuth: build the URL the browser is redirected to for consent.
export async function buildConsentUrl(state: string): Promise<string> {
  const client = new XeroClient(baseConfig(state));
  await client.initialize();
  return client.buildConsentUrl();
}

// Step 2 of OAuth: exchange the callback code for tokens and read the
// connected tenant(s). Returns everything token-store needs to persist —
// callers are responsible for calling saveConnection with the result.
export async function exchangeCodeForTokens(callbackUrl: string, state: string): Promise<{
  tokenSet: TokenSet;
  tenantId: string;
  tenantName: string;
  connectionId: string;
}> {
  // xero-node's apiCallback() validates the returned `state` against
  // this.config.state internally — it must be the same client (and state)
  // used to build the consent URL, or the underlying OAuth library throws
  // "checks.state argument is missing".
  const client = new XeroClient(baseConfig(state));
  await client.initialize();

  const tokenSet = await client.apiCallback(callbackUrl);
  client.setTokenSet(tokenSet);

  const tenants = await client.updateTenants(false);
  const tenant = tenants[0] as { id: string; tenantId: string; tenantName: string } | undefined;

  if (!tenant) {
    throw configError(
      "Xero did not return a connected organisation. Approve access to at least one organisation during consent."
    );
  }

  return {
    tokenSet,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    connectionId: tenant.id,
  };
}

function isExpired(tokenSet: TokenSet): boolean {
  return typeof tokenSet.expires_at === "number" ? Date.now() >= tokenSet.expires_at * 1000 : false;
}

// Restores a XeroClient authenticated with the single stored connection,
// transparently refreshing (and re-persisting) the access token if expired.
export async function getAuthenticatedClient(): Promise<{
  client: XeroClient;
  tenantId: string;
  tenantName: string;
  connectionId: string;
}> {
  const stored = await getConnection();
  if (!stored) throw notConnectedError();

  const client = new XeroClient(baseConfig());
  await client.initialize();
  client.setTokenSet(stored.tokenSet);

  let tokenSet = stored.tokenSet;
  if (isExpired(tokenSet)) {
    tokenSet = await client.refreshToken();
    await saveConnection({
      tenantId: stored.tenantId,
      tenantName: stored.tenantName,
      connectionId: stored.connectionId,
      tokenSet,
    });
  }

  return {
    client,
    tenantId: stored.tenantId,
    tenantName: stored.tenantName,
    connectionId: stored.connectionId,
  };
}

// Best-effort revoke of the connection on Xero's side. Local disconnect
// should proceed even if this fails (e.g. already revoked, network error).
export async function tryDisconnectFromXero(connectionId: string): Promise<void> {
  const stored = await getConnection();
  if (!stored) return;

  const client = new XeroClient(baseConfig());
  await client.initialize();
  client.setTokenSet(stored.tokenSet);
  await client.disconnect(connectionId);
}
