import "server-only";
import { Account, AccountType } from "xero-node";
import type { Contact, Item, Quote, XeroClient } from "xero-node";

// Read-only lookups shared by the seed (find-or-create) and verify
// (find-only) services. None of these ever create or modify Xero data.

export async function findSalesAccountCode(client: XeroClient, tenantId: string): Promise<Account | null> {
  const res = await client.accountingApi.getAccounts(tenantId);
  const accounts = res.body.accounts ?? [];
  const active = accounts.filter((a) => a.status === Account.StatusEnum.ACTIVE && a._class === Account.ClassEnum.REVENUE);
  const preferred = active.find((a) => a.type === AccountType.SALES);
  return preferred ?? active[0] ?? null;
}

export async function findContactByEmail(
  client: XeroClient,
  tenantId: string,
  email: string
): Promise<Contact | null> {
  const res = await client.accountingApi.getContacts(tenantId, undefined, `EmailAddress=="${email}"`);
  return res.body.contacts?.[0] ?? null;
}

export async function findItemByCode(client: XeroClient, tenantId: string, code: string): Promise<Item | null> {
  const res = await client.accountingApi.getItems(tenantId, undefined, `Code=="${code}"`);
  return res.body.items?.[0] ?? null;
}

export async function findQuoteByReference(
  client: XeroClient,
  tenantId: string,
  contactId: string,
  reference: string
): Promise<Quote | null> {
  // The generated getQuotes() has no generic `where` filter, so fetch this
  // contact's quotes and match the reference client-side — fine for a demo
  // contact that only ever has a handful of quotes.
  const res = await client.accountingApi.getQuotes(
    tenantId,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    contactId
  );
  return res.body.quotes?.find((q) => q.reference === reference) ?? null;
}
