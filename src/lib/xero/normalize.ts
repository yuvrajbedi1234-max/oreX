import "server-only";
import type { Contact, Item, LineItem, Quote } from "xero-node";
import type { NormalizedContact, NormalizedItem, NormalizedLineItem, NormalizedQuote } from "./types";

function toNumber(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Some endpoints (e.g. the singular getQuote) omit dateString and only
// return `date` as a full ISO timestamp — trim it to YYYY-MM-DD either way.
function toDateOnly(value: unknown): string | null {
  const str = toStringOrNull(value);
  return str ? str.slice(0, 10) : null;
}

export function normalizeLineItem(lineItem: LineItem): NormalizedLineItem {
  return {
    lineItemId: toStringOrNull(lineItem.lineItemID),
    itemCode: toStringOrNull(lineItem.itemCode),
    description: toStringOrNull(lineItem.description),
    quantity: toNumber(lineItem.quantity),
    unitAmount: toNumber(lineItem.unitAmount),
    accountCode: toStringOrNull(lineItem.accountCode),
    taxType: toStringOrNull(lineItem.taxType),
    lineAmount: toNumber(lineItem.lineAmount),
  };
}

export function normalizeQuote(quote: Quote): NormalizedQuote {
  return {
    quoteId: toStringOrNull(quote.quoteID),
    quoteNumber: toStringOrNull(quote.quoteNumber),
    contactId: toStringOrNull(quote.contact?.contactID),
    contactName: toStringOrNull(quote.contact?.name),
    status: quote.status ? String(quote.status) : null,
    date: toDateOnly(quote.dateString ?? quote.date),
    expiryDate: toDateOnly(quote.expiryDateString ?? quote.expiryDate),
    reference: toStringOrNull(quote.reference),
    currencyCode: quote.currencyCode ? String(quote.currencyCode) : null,
    total: toNumber(quote.total),
    lineItems: (quote.lineItems ?? []).map(normalizeLineItem),
  };
}

export function normalizeContact(contact: Contact): NormalizedContact {
  return {
    contactId: toStringOrNull(contact.contactID),
    name: toStringOrNull(contact.name),
    emailAddress: toStringOrNull(contact.emailAddress),
    contactStatus: contact.contactStatus ? String(contact.contactStatus) : null,
  };
}

export function normalizeItem(item: Item): NormalizedItem {
  return {
    itemId: toStringOrNull(item.itemID),
    code: toStringOrNull(item.code),
    name: toStringOrNull(item.name),
    description: toStringOrNull(item.description),
    salesDescription: toStringOrNull(item.description),
    salesUnitPrice: toNumber(item.salesDetails?.unitPrice),
    salesAccountCode: toStringOrNull(item.salesDetails?.accountCode),
  };
}
