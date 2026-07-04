import { cn } from "@/lib/cn";
import { ClassificationBadge } from "./ClassificationBadge";
import type { DetectedRequest } from "./types";

const EVIDENCE_ICON: Record<string, string> = {
  QUOTE_LINE: "Quote line",
  XERO_ITEM: "Xero item",
  BUSINESS_RULE: "Rule",
  NO_MATCH: "No match",
};

export function RequestCard({
  request,
  selected,
  onSelect,
}: {
  request: DetectedRequest;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
        selected ? "border-cyan-400 bg-cyan-400/5" : "border-surface-border bg-surface hover:bg-surface-muted"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">{request.normalizedDescription}</p>
          <p className="text-xs italic text-ink-500">&ldquo;{request.originalText}&rdquo;</p>
        </div>
        <ClassificationBadge classification={request.classification} />
      </div>

      <p className="text-sm text-ink-700">{request.explanation}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        <span>Quantity: {request.quantity}</span>
        <span>Confidence: {Math.round(request.confidence * 100)}%</span>
        {request.matchedItemCode && <span>Xero item: {request.matchedItemCode}</span>}
      </div>

      {selected && request.evidence.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg bg-surface-muted p-3">
          <p className="text-xs font-medium text-ink-500">Evidence</p>
          {request.evidence.map((item, index) => (
            <div key={index} className="text-xs text-ink-700">
              <span className="font-medium text-ink-900">{EVIDENCE_ICON[item.type] ?? item.type}:</span>{" "}
              {item.label}
              {item.sourceText && <span className="text-ink-500"> — &ldquo;{item.sourceText}&rdquo;</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
