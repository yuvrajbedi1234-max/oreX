import "server-only";
import { QuoteStatusCodes } from "xero-node";
import { getAuthenticatedClient } from "./client";
import { toXeroAppError } from "./errors";
import { normalizeContact, normalizeItem, normalizeQuote } from "./normalize";
import type { NormalizedContact, NormalizedItem, NormalizedQuote } from "./types";

const TEST_QUOTE_REFERENCE = "SCOPELOCK-INTEGRATION-TEST";

export async function fetchQuotes(status?: string): Promise<NormalizedQuote[]> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const res = await client.accountingApi.getQuotes(
      tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      status
    );
    return (res.body.quotes ?? []).map(normalizeQuote);
  } catch (err) {
    throw toXeroAppError(err);
  }
}

export async function fetchContacts(): Promise<NormalizedContact[]> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const res = await client.accountingApi.getContacts(tenantId);
    return (res.body.contacts ?? []).map(normalizeContact);
  } catch (err) {
    throw toXeroAppError(err);
  }
}

export async function fetchQuoteById(quoteId: string): Promise<NormalizedQuote> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const res = await client.accountingApi.getQuote(tenantId, quoteId);
    const quote = res.body.quotes?.[0];
    if (!quote) throw new Error("Xero did not return this quote.");
    return normalizeQuote(quote);
  } catch (err) {
    throw toXeroAppError(err);
  }
}

export async function fetchContactById(contactId: string): Promise<NormalizedContact> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const res = await client.accountingApi.getContact(tenantId, contactId);
    const contact = res.body.contacts?.[0];
    if (!contact) throw new Error("Xero did not return this contact.");
    return normalizeContact(contact);
  } catch (err) {
    throw toXeroAppError(err);
  }
}

export async function fetchItems(): Promise<NormalizedItem[]> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const res = await client.accountingApi.getItems(tenantId);
    return (res.body.items ?? []).map(normalizeItem);
  } catch (err) {
    throw toXeroAppError(err);
  }
}

// Creates exactly one DRAFT quote, never authorised/sent. Used only by the
// explicit "Create test draft quote" panel — never triggered automatically.
export async function createTestDraftQuote(contactId: string): Promise<NormalizedQuote> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const issueDate = new Date();
    const expiryDate = new Date(issueDate);
    expiryDate.setDate(expiryDate.getDate() + 14);
    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

    const res = await client.accountingApi.createQuotes(tenantId, {
      quotes: [
        {
          contact: { contactID: contactId },
          reference: TEST_QUOTE_REFERENCE,
          title: "ScopeLock Integration Test",
          summary: "ScopeLock Integration Test",
          date: toIsoDate(issueDate),
          expiryDate: toIsoDate(expiryDate),
          status: QuoteStatusCodes.DRAFT,
          lineItems: [
            {
              description: "ScopeLock integration test — do not send",
              quantity: 1,
              unitAmount: 1,
            },
          ],
        },
      ],
    });

    const created = res.body.quotes?.[0];
    if (!created) {
      throw new Error("Xero did not return the created quote.");
    }
    return normalizeQuote(created);
  } catch (err) {
    throw toXeroAppError(err);
  }
}
