// Client-safe mirror of the JSON contracts returned by /api/xero/* routes.
// Kept separate from src/lib/xero/types.ts so no server-only code can ever
// be pulled into the browser bundle through a type import.

export interface ConnectionStatus {
  connected: boolean;
  tenantId?: string;
  tenantName?: string;
  tokenExpiresAt?: string;
  permissionsNeedUpdate?: boolean;
}

export interface LineItem {
  lineItemId: string | null;
  itemCode: string | null;
  description: string | null;
  quantity: number | null;
  unitAmount: number | null;
  accountCode: string | null;
  taxType: string | null;
  lineAmount: number | null;
}

export interface Quote {
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
  lineItems: LineItem[];
}

export interface Contact {
  contactId: string | null;
  name: string | null;
  emailAddress: string | null;
  contactStatus: string | null;
}

export interface Item {
  itemId: string | null;
  code: string | null;
  name: string | null;
  description: string | null;
  salesDescription: string | null;
  salesUnitPrice: number | null;
  salesAccountCode: string | null;
}

export type CheckResult = "not_tested" | "passed" | "failed";

export interface IntegrationCheck {
  id: "quotes" | "contacts" | "items" | "draftQuote";
  label: string;
  result: CheckResult;
  message?: string;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  actionHint?: string;
}
