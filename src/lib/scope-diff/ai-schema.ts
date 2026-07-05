import "server-only";
import type { NormalizedItem, NormalizedQuote } from "@/lib/xero/types";
import type { DetectedRequest, ScopeClassification, ScopeEvidence, ScopeEvidenceType } from "./types";

// Phase 4 — the JSON contract the AI analyser is forced to return, plus a
// defensive validator. The model can classify and explain, but it is never
// trusted blindly: every field is re-checked here, matched item codes and
// quote-line ids must actually exist in the real Xero data, and low-
// confidence requests are downgraded to NEEDS_REVIEW. The AI never returns
// a price — only a *suggested* item code that pricing.ts later resolves
// against the live Xero item.

// Confidence below this is treated as "not sure enough to call a variation"
// and forced to NEEDS_REVIEW regardless of what the model labelled it.
export const AI_CONFIDENCE_REVIEW_THRESHOLD = 0.6;

const VALID_CLASSIFICATIONS: ScopeClassification[] = ["INCLUDED", "LIKELY_VARIATION", "NEEDS_REVIEW"];
const VALID_EVIDENCE_TYPES: ScopeEvidenceType[] = ["QUOTE_LINE", "XERO_ITEM", "BUSINESS_RULE", "NO_MATCH"];

const EVIDENCE_LABEL: Record<ScopeEvidenceType, string> = {
  QUOTE_LINE: "Compared against an agreed quote line",
  XERO_ITEM: "Matched to a Xero pricing item",
  BUSINESS_RULE: "Reasoning",
  NO_MATCH: "No matching agreed scope found",
};

// The tool input schema the model must fill in. Kept close to the shape in
// the phase brief (originalText / normalizedDescription / classification /
// confidence / quantity / matchedQuoteLineId / suggestedItemCode /
// explanation / evidence) so the prompt and the schema agree.
export const AI_ANALYSIS_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    requests: {
      type: "array",
      description: "One entry per distinct work request found in the client message.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          originalText: {
            type: "string",
            description: "The exact snippet of the client's message this request came from.",
          },
          normalizedDescription: {
            type: "string",
            description: "A short, neutral description of the work requested.",
          },
          classification: {
            type: "string",
            enum: VALID_CLASSIFICATIONS,
            description:
              "INCLUDED if the agreed quote already covers it; LIKELY_VARIATION if it appears to be extra work; NEEDS_REVIEW if you are not confident.",
          },
          confidence: {
            type: "number",
            description: "Your confidence in the classification, from 0 to 1.",
          },
          quantity: {
            type: "number",
            description: "How many units of this work were requested (default 1 if unspecified).",
          },
          matchedQuoteLineId: {
            type: ["string", "null"],
            description: "The lineItemId of the agreed quote line this relates to, or null if none applies.",
          },
          suggestedItemCode: {
            type: ["string", "null"],
            description:
              "The code of the most appropriate Available Xero Item to price this variation, chosen ONLY from the provided list, or null. Never invent a code.",
          },
          explanation: {
            type: "string",
            description: "A one or two sentence justification a business owner could read.",
          },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: VALID_EVIDENCE_TYPES },
                sourceText: {
                  type: ["string", "null"],
                  description: "Quoted text from the quote line or item that supports this, or null.",
                },
              },
              required: ["type", "sourceText"],
            },
          },
        },
        required: [
          "originalText",
          "normalizedDescription",
          "classification",
          "confidence",
          "quantity",
          "matchedQuoteLineId",
          "suggestedItemCode",
          "explanation",
          "evidence",
        ],
      },
    },
  },
  required: ["requests"],
} as const;

export type AiValidationResult =
  | { ok: true; requests: DetectedRequest[] }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "request"
  );
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 100) / 100;
}

function coerceQuantity(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return 1;
  // Whole units only — fractional sockets/lights make no sense here.
  return Math.max(1, Math.round(value));
}

function validateEvidence(raw: unknown): ScopeEvidence[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopeEvidence[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const type = entry.type;
    if (typeof type !== "string" || !VALID_EVIDENCE_TYPES.includes(type as ScopeEvidenceType)) continue;
    const evidenceType = type as ScopeEvidenceType;
    const sourceText = asString(entry.sourceText);
    out.push({
      type: evidenceType,
      label: EVIDENCE_LABEL[evidenceType],
      ...(sourceText ? { sourceText } : {}),
    });
  }
  return out;
}

// Validates the model's raw tool input against the real Xero quote/items and
// returns clean DetectedRequest[]. Rejects the whole payload only when it is
// structurally unusable; individual malformed requests are dropped.
export function validateAiAnalysis(
  raw: unknown,
  context: { quote: NormalizedQuote; items: NormalizedItem[] }
): AiValidationResult {
  if (!isRecord(raw) || !Array.isArray(raw.requests)) {
    return { ok: false, reason: "AI response was not an object with a 'requests' array." };
  }

  const validQuoteLineIds = new Set(
    context.quote.lineItems.map((line) => line.lineItemId).filter((id): id is string => Boolean(id))
  );
  // Map upper-cased code -> canonical code so we accept the model's casing
  // but always store the exact Xero code.
  const itemCodeByUpper = new Map<string, string>();
  for (const item of context.items) {
    if (item.code) itemCodeByUpper.set(item.code.toUpperCase(), item.code);
  }

  const usedIds = new Set<string>();
  const requests: DetectedRequest[] = [];

  raw.requests.forEach((entry, index) => {
    if (!isRecord(entry)) return;

    const originalText = asString(entry.originalText);
    const normalizedDescription = asString(entry.normalizedDescription);
    // A request with no text at all is unusable — drop it.
    if (!originalText && !normalizedDescription) return;

    const rawClassification = entry.classification;
    let classification: ScopeClassification = VALID_CLASSIFICATIONS.includes(
      rawClassification as ScopeClassification
    )
      ? (rawClassification as ScopeClassification)
      : "NEEDS_REVIEW";

    const confidence = clampConfidence(entry.confidence);

    // Only accept an item code the AI could not have invented.
    const suggested = asString(entry.suggestedItemCode);
    const matchedItemCode = suggested ? itemCodeByUpper.get(suggested.toUpperCase()) : undefined;

    const matchedQuoteLineRaw = asString(entry.matchedQuoteLineId);
    const matchedQuoteLineId =
      matchedQuoteLineRaw && validQuoteLineIds.has(matchedQuoteLineRaw) ? matchedQuoteLineRaw : undefined;

    // Business rule: uncertain requests are never presented as confident
    // variations. Low confidence always degrades to NEEDS_REVIEW.
    if (classification !== "NEEDS_REVIEW" && confidence < AI_CONFIDENCE_REVIEW_THRESHOLD) {
      classification = "NEEDS_REVIEW";
    }

    const evidence = validateEvidence(entry.evidence);
    if (matchedItemCode && !evidence.some((e) => e.type === "XERO_ITEM")) {
      evidence.push({ type: "XERO_ITEM", label: EVIDENCE_LABEL.XERO_ITEM, sourceText: matchedItemCode });
    }

    const base = normalizedDescription ?? originalText ?? "request";
    let id = `ai-${index}-${slugify(base)}`;
    while (usedIds.has(id)) id = `${id}-x`;
    usedIds.add(id);

    requests.push({
      id,
      originalText: originalText ?? normalizedDescription ?? "",
      normalizedDescription: normalizedDescription ?? originalText ?? "",
      classification,
      confidence,
      quantity: coerceQuantity(entry.quantity),
      explanation: asString(entry.explanation) ?? "No explanation was provided.",
      evidence,
      ...(matchedQuoteLineId ? { matchedQuoteLineId } : {}),
      ...(matchedItemCode ? { matchedItemCode } : {}),
    });
  });

  return { ok: true, requests };
}
