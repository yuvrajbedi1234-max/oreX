import "server-only";
import type { TokenSet } from "xero-node";

export type { TokenSet };

// What we persist per connection, before/after encryption of the token set.
export interface StoredXeroConnection {
  tenantId: string;
  tenantName: string;
  tokenSet: TokenSet;
  connectionId: string;
  updatedAt: Date;
}

export interface XeroConnectionStatus {
  connected: boolean;
  tenantId?: string;
  tenantName?: string;
  tokenExpiresAt?: string;
  permissionsNeedUpdate?: boolean;
}

export interface NormalizedLineItem {
  lineItemId: string | null;
  itemCode: string | null;
  description: string | null;
  quantity: number | null;
  unitAmount: number | null;
  accountCode: string | null;
  taxType: string | null;
  lineAmount: number | null;
}

export interface NormalizedQuote {
  quoteId: string | null;
  quoteNumber: string | null;
  contactId: string | null;
  contactName: string | null;
  status: string | null;
  date: string | null;
  expiryDate: string | null;
  reference: string | null;
  currencyCode: string | null;
  total: number | null;
  lineItems: NormalizedLineItem[];
}

export interface NormalizedContact {
  contactId: string | null;
  name: string | null;
  emailAddress: string | null;
  contactStatus: string | null;
}

export interface NormalizedItem {
  itemId: string | null;
  code: string | null;
  name: string | null;
  description: string | null;
  salesDescription: string | null;
  salesUnitPrice: number | null;
  salesAccountCode: string | null;
}

export type IntegrationCheckId = "quotes" | "contacts" | "items" | "draftQuote";

export type IntegrationCheckResult = "not_tested" | "passed" | "failed";

export interface IntegrationCheck {
  id: IntegrationCheckId;
  label: string;
  result: IntegrationCheckResult;
  message?: string;
}
