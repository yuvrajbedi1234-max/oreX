import { Badge } from "@/components/ui/Badge";
import type { ScopeClassification } from "./types";

const LABELS: Record<ScopeClassification, string> = {
  INCLUDED: "Included",
  LIKELY_VARIATION: "Likely variation",
  NEEDS_REVIEW: "Needs review",
};

export function ClassificationBadge({ classification }: { classification: ScopeClassification }) {
  if (classification === "INCLUDED") return <Badge tone="green">{LABELS[classification]}</Badge>;
  if (classification === "LIKELY_VARIATION") return <Badge tone="orange">{LABELS[classification]}</Badge>;
  return <Badge tone="neutral">{LABELS[classification]}</Badge>;
}
