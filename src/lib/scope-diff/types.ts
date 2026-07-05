import "server-only";

// This contract is intentionally independent of both the deterministic
// analyser (this phase) and any future AI analyser (Phase 4) — only the
// producer of a ScopeDiffResult changes; the API route, storage, and UI
// all consume this same shape regardless of how it was produced.

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

export type ScopeAnalyserType = "DETERMINISTIC_DEMO" | "AI";

export interface ScopeDiffResult {
  projectId: string;
  sourceQuoteId: string;
  messageId: string;
  // The exact client message that was analysed. Stored so Phase 5's
  // variation review can render it without re-deriving it from a fixture.
  messageText: string;
  requests: DetectedRequest[];
  variationLines: PricedVariationLine[];
  subtotal: number;
  analysedAt: string;
  analyser: ScopeAnalyserType;
}

export type ScopeDiffErrorCode =
  | "project_not_found"
  | "not_connected"
  | "source_quote_missing"
  | "quote_lines_missing"
  | "pricing_item_missing"
  | "insufficient_permissions"
  | "invalid_message"
  // Phase 4 — the AI analyser couldn't run (no API key configured, or the
  // model call failed) or it returned output that failed schema/business-
  // rule validation. Either way the caller can fall back to the
  // deterministic analyser.
  | "ai_unavailable"
  | "ai_invalid_output"
  | "unknown";

export interface ScopeDiffError {
  code: ScopeDiffErrorCode;
  message: string;
}
