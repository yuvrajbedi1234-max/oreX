import "server-only";
import type { NormalizedItem } from "@/lib/xero/types";
import type { DetectedRequest, PricedVariationLine } from "./types";

// Looks up an already-fetched item by code — never re-queries Xero. Kept
// separate from src/lib/demo/xero-lookups.ts, which queries the live API;
// this one only searches data the caller already retrieved.
export function findXeroItemByCode(items: NormalizedItem[], code: string): NormalizedItem | null {
  return items.find((item) => item.code === code) ?? null;
}

// Builds one priced variation line from a LIKELY_VARIATION request and the
// Xero item it was matched to. The unit price always comes from the Xero
// item — never a hardcoded or AI-invented number.
export function calculateVariationLine(request: DetectedRequest, item: NormalizedItem): PricedVariationLine | null {
  if (item.salesUnitPrice == null || !item.code) return null;
  const quantity = request.quantity;
  const unitAmount = item.salesUnitPrice;
  return {
    requestId: request.id,
    itemCode: item.code,
    description: item.name ?? item.code,
    quantity,
    unitAmount,
    lineAmount: Math.round(quantity * unitAmount * 100) / 100,
    accountCode: item.salesAccountCode ?? undefined,
    priceSource: "XERO_ITEM",
  };
}

export function calculateSubtotal(lines: PricedVariationLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.lineAmount, 0) * 100) / 100;
}
