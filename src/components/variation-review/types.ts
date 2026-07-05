// Client-safe contracts for the Phase 5 variation review + write-back flow.
// No server-only imports here so these can be shared between the server
// loader/API and the client review component.

import type { DetectedRequest, PricedVariationLine, ScopeAnalyserType } from "@/components/scope-diff/types";

export type { DetectedRequest, PricedVariationLine, ScopeAnalyserType };

// A pricing item from Xero the owner can pick from when editing a line.
export interface CatalogueItem {
  code: string;
  name: string;
  description: string | null;
  unitPrice: number | null;
  accountCode: string | null;
}

// A DRAFT variation quote that was already created in Xero (idempotency
// record). Its presence blocks creating another for the same revision.
export interface VariationRecord {
  revision: number;
  xeroQuoteId: string;
  xeroQuoteNumber: string;
  xeroQuoteStatus: string;
  title: string;
  reference: string;
  subtotal: number;
  totalTax: number;
  total: number;
  currencyCode: string | null;
  createdAt: string;
}

// Everything the review page needs, loaded server-side.
export interface VariationReviewData {
  project: { slug: string; name: string };
  customerName: string;
  originalQuote: { id: string; number: string; currencyCode: string | null; total: number | null };
  message: { id: string; text: string };
  analyser: ScopeAnalyserType;
  requests: DetectedRequest[];
  variationLines: PricedVariationLine[];
  catalogue: CatalogueItem[];
  existingVariation: VariationRecord | null;
}

// One line the owner is submitting for approval. Sent to the create API,
// which re-prices XERO_ITEM lines from Xero and trusts MANUAL prices only.
export interface ApprovedLine {
  requestId: string;
  description: string;
  quantity: number;
  itemCode: string | null;
  unitAmount: number;
  priceSource: "XERO_ITEM" | "MANUAL";
}

export type VariationErrorCode =
  | "project_not_found"
  | "analysis_missing"
  | "not_connected"
  | "insufficient_permissions"
  | "source_quote_missing"
  | "contact_missing"
  | "pricing_item_missing"
  | "no_lines"
  | "invalid_line"
  | "already_exists"
  | "unknown";

export interface VariationApiError {
  error: string;
  code: VariationErrorCode;
}

// POST response: either the newly-created draft, or (idempotency) the one
// that already existed.
export interface CreateVariationResponse {
  status: "created" | "exists";
  variation: VariationRecord;
}
