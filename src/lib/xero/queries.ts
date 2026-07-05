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

export interface VariationDraftLine {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode?: string;
  taxType?: string;
  itemCode?: string;
}

export interface VariationDraftQuoteInput {
  contactId: string;
  title: string;
  reference: string;
  summary: string;
  lineItems: VariationDraftLine[];
}

export interface CreatedVariationQuote {
  quoteId: string;
  quoteNumber: string;
  status: string;
  title: string;
  reference: string;
  subTotal: number;
  totalTax: number;
  total: number;
  currencyCode: string | null;
}

function toNum(value: unknown): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

// Phase 5 — creates exactly one DRAFT variation quote in Xero from reviewed,
// owner-approved lines. Status is always DRAFT: it is never authorised or
// sent. The original agreed quote is untouched — this only inserts a new
// draft. Callers must enforce duplicate protection before calling this.
export async function createVariationDraftQuote(input: VariationDraftQuoteInput): Promise<CreatedVariationQuote> {
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    const issueDate = new Date();
    const expiryDate = new Date(issueDate);
    expiryDate.setDate(expiryDate.getDate() + 30);
    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

    const res = await client.accountingApi.createQuotes(tenantId, {
      quotes: [
        {
          contact: { contactID: input.contactId },
          reference: input.reference,
          title: input.title,
          summary: input.summary,
          date: toIsoDate(issueDate),
          expiryDate: toIsoDate(expiryDate),
          status: QuoteStatusCodes.DRAFT,
          lineItems: input.lineItems.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitAmount: line.unitAmount,
            ...(line.accountCode ? { accountCode: line.accountCode } : {}),
            ...(line.taxType ? { taxType: line.taxType } : {}),
            ...(line.itemCode ? { itemCode: line.itemCode } : {}),
          })),
        },
      ],
    });

    const created = res.body.quotes?.[0];
    if (!created || !created.quoteID) {
      throw new Error("Xero did not return the created quote.");
    }

    return {
      quoteId: created.quoteID,
      quoteNumber: created.quoteNumber ?? "",
      status: created.status ? String(created.status) : "DRAFT",
      title: created.title ?? input.title,
      reference: created.reference ?? input.reference,
      subTotal: toNum(created.subTotal),
      totalTax: toNum(created.totalTax),
      total: toNum(created.total),
      currencyCode: created.currencyCode ? String(created.currencyCode) : null,
    };
  } catch (err) {
    throw toXeroAppError(err);
  }
}
