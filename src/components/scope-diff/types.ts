// Client-safe mirror of the JSON contracts used by the Scope Diff feature.
// Kept separate from src/lib/scope-diff/types.ts so no server-only code can
// ever be pulled into the browser bundle through a type import.

export type ScopeClassification = "INCLUDED" | "LIKELY_VARIATION" | "NEEDS_REVIEW";
export type ScopeEvidenceType = "QUOTE_LINE" | "XERO_ITEM" | "BUSINESS_RULE" | "NO_MATCH";

export interface ScopeEvidence {
  type: ScopeEvidenceType;
  label: string;
  sourceId?: string;
  sourceText?: string;
}

export interface DetectedRequest {
  id: string;
  originalText: string;
  normalizedDescription: string;
  classification: ScopeClassification;
  confidence: number;
  quantity: number;
  matchedQuoteLineId?: string;
  matchedItemCode?: string;
  evidence: ScopeEvidence[];
  explanation: string;
}

export interface PricedVariationLine {
  requestId: string;
  itemCode: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  accountCode?: string;
  taxType?: string;
  priceSource: "XERO_ITEM";
}

export interface ScopeDiffResult {
  projectId: string;
  sourceQuoteId: string;
  messageId: string;
  requests: DetectedRequest[];
  variationLines: PricedVariationLine[];
  subtotal: number;
  analysedAt: string;
  analyser: "DETERMINISTIC_DEMO" | "AI";
}

export interface DemoMessage {
  id: string;
  fromName: string;
  text: string;
  sentAt: string;
}

export interface ProjectQuoteLine {
  lineItemId: string | null;
  description: string | null;
  quantity: number | null;
  unitAmount: number | null;
  lineAmount: number | null;
  itemCode: string | null;
}

export interface ProjectSummary {
  slug: string;
  name: string;
  customerName: string;
  quoteNumber: string;
  quoteStatus: string | null;
  quoteTotal: number | null;
  quoteDate: string | null;
  lineItems: ProjectQuoteLine[];
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
