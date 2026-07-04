import "server-only";
import type { NormalizedItem, NormalizedLineItem, NormalizedQuote } from "@/lib/xero/types";
import { findXeroItemByCode } from "./pricing";
import type { DetectedRequest, ScopeEvidence } from "./types";

// Phase 3 fixes the extraction/classification step to a known demonstration
// message so UI, Xero, and pricing bugs can be found independently of AI
// output. Phase 4 replaces only this module — everything downstream
// (pricing, storage, the API route, the UI) consumes the same
// DetectedRequest[]/ScopeDiffResult shape regardless of how it was produced.

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

// Finds a quote line whose normalized description contains every given
// term. Returns null (never invents a match) if nothing qualifies.
export function findQuoteLineByTerms(quote: NormalizedQuote, terms: string[]): NormalizedLineItem | null {
  return (
    quote.lineItems.find((line) => {
      const normalized = normalizeText(line.description ?? "");
      return terms.every((term) => normalized.includes(term));
    }) ?? null
  );
}

interface RequestParams {
  id: string;
  originalText: string;
  normalizedDescription: string;
  quantity: number;
  confidence: number;
  explanation: string;
  evidence: ScopeEvidence[];
  matchedQuoteLineId?: string;
  matchedItemCode?: string;
}

export function buildIncludedRequest(params: RequestParams): DetectedRequest {
  return { ...params, classification: "INCLUDED" };
}

export function buildVariationRequest(params: RequestParams): DetectedRequest {
  return { ...params, classification: "LIKELY_VARIATION" };
}

export function buildNeedsReviewRequest(params: RequestParams): DetectedRequest {
  return { ...params, classification: "NEEDS_REVIEW" };
}

// The three fixed demo requests, derived from the fixed demonstration
// message. Each one validates that its expected quote line / Xero item
// actually exists before producing evidence or a classification — a
// missing dependency degrades that single request to NEEDS_REVIEW instead
// of inventing evidence or a price.
export function analyseDemoMessage(params: { quote: NormalizedQuote; items: NormalizedItem[] }): DetectedRequest[] {
  const { quote, items } = params;
  const requests: DetectedRequest[] = [];

  // --- 1. Under-cabinet LED lighting ---
  const ceilingLightingLine = findQuoteLineByTerms(quote, ["ceiling", "lighting"]);
  const ledItem = findXeroItemByCode(items, "LED-PACK");

  if (!ledItem) {
    requests.push(
      buildNeedsReviewRequest({
        id: "led-lighting",
        originalText: "add LED lights underneath the cabinets",
        normalizedDescription: "Under-cabinet LED lighting",
        quantity: 1,
        confidence: 0.4,
        explanation:
          "Could not verify pricing — the LED-PACK item was not found in Xero. Run the demo seed again, or check it hasn't been deleted.",
        evidence: [{ type: "NO_MATCH", label: "LED-PACK item not found in Xero" }],
      })
    );
  } else {
    const evidence: ScopeEvidence[] = [];
    if (ceilingLightingLine) {
      evidence.push({
        type: "QUOTE_LINE",
        label: "Agreed quote includes standard ceiling lighting only",
        sourceId: ceilingLightingLine.lineItemId ?? undefined,
        sourceText: ceilingLightingLine.description ?? undefined,
      });
    }
    evidence.push({ type: "NO_MATCH", label: "No under-cabinet or LED lighting line found in the agreed quote" });
    evidence.push({
      type: "XERO_ITEM",
      label: `Matched to Xero item ${ledItem.code}`,
      sourceId: ledItem.itemId ?? undefined,
      sourceText: ledItem.name ?? undefined,
    });

    requests.push(
      buildVariationRequest({
        id: "led-lighting",
        originalText: "add LED lights underneath the cabinets",
        normalizedDescription: "Under-cabinet LED lighting",
        quantity: 1,
        confidence: 0.92,
        explanation:
          "The accepted quote includes standard ceiling lighting but does not include under-cabinet LED lighting.",
        evidence,
        matchedItemCode: ledItem.code ?? undefined,
      })
    );
  }

  // --- 2. Relocate two sockets ---
  const socketLine = findQuoteLineByTerms(quote, ["existing", "socket"]);
  const socketItem = findXeroItemByCode(items, "SOCKET-MOVE");

  if (!socketLine || !socketItem) {
    requests.push(
      buildNeedsReviewRequest({
        id: "socket-relocation",
        originalText: "move the two sockets beside the fridge",
        normalizedDescription: "Relocate two electrical sockets",
        quantity: 2,
        confidence: 0.4,
        explanation: !socketLine
          ? "Could not find the expected 'electrical work at existing socket locations' line in the agreed quote."
          : "Could not verify pricing — the SOCKET-MOVE item was not found in Xero.",
        evidence: [
          {
            type: "NO_MATCH",
            label: !socketLine ? "Expected quote line not found" : "SOCKET-MOVE item not found in Xero",
          },
        ],
      })
    );
  } else {
    requests.push(
      buildVariationRequest({
        id: "socket-relocation",
        originalText: "move the two sockets beside the fridge",
        normalizedDescription: "Relocate two electrical sockets",
        quantity: 2,
        confidence: 0.88,
        explanation:
          "The accepted quote covers electrical work at existing socket locations, while the client is requesting two sockets to be moved.",
        evidence: [
          {
            type: "QUOTE_LINE",
            label: "Agreed quote covers electrical work at existing socket locations only",
            sourceId: socketLine.lineItemId ?? undefined,
            sourceText: socketLine.description ?? undefined,
          },
          {
            type: "XERO_ITEM",
            label: `Matched to Xero item ${socketItem.code}`,
            sourceId: socketItem.itemId ?? undefined,
            sourceText: socketItem.name ?? undefined,
          },
          { type: "BUSINESS_RULE", label: "Requested quantity: 2 sockets" },
        ],
        matchedQuoteLineId: socketLine.lineItemId ?? undefined,
        matchedItemCode: socketItem.code ?? undefined,
      })
    );
  }

  // --- 3. Matte-black handles ---
  const handleLine = findQuoteLineByTerms(quote, ["matte", "black", "handle"]);
  const handleItem = findXeroItemByCode(items, "HANDLE-BLACK");

  if (!handleLine) {
    requests.push(
      buildNeedsReviewRequest({
        id: "matte-black-handles",
        originalText: "make sure the handles are matte black like we agreed",
        normalizedDescription: "Matte-black cabinet handles",
        quantity: 1,
        confidence: 0.4,
        explanation: "Could not find a matching 'matte-black cabinet handles' line in the agreed quote.",
        evidence: [{ type: "NO_MATCH", label: "Expected quote line not found" }],
      })
    );
  } else {
    const evidence: ScopeEvidence[] = [
      {
        type: "QUOTE_LINE",
        label: "Matched to agreed quote line",
        sourceId: handleLine.lineItemId ?? undefined,
        sourceText: handleLine.description ?? undefined,
      },
    ];
    if (handleItem) {
      evidence.push({
        type: "XERO_ITEM",
        label: `Also matches Xero item ${handleItem.code} — for reference only, no additional charge`,
        sourceId: handleItem.itemId ?? undefined,
        sourceText: handleItem.name ?? undefined,
      });
    }

    requests.push(
      buildIncludedRequest({
        id: "matte-black-handles",
        originalText: "make sure the handles are matte black like we agreed",
        normalizedDescription: "Matte-black cabinet handles",
        quantity: 1,
        confidence: 0.97,
        explanation: "Matte-black cabinet handles are explicitly included in the accepted quote.",
        evidence,
        matchedQuoteLineId: handleLine.lineItemId ?? undefined,
        matchedItemCode: handleItem?.code ?? undefined,
      })
    );
  }

  return requests;
}
