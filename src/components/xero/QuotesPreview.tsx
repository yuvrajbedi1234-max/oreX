import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Quote } from "./types";

function statusTone(status: string | null) {
  if (status === "ACCEPTED" || status === "INVOICED") return "green" as const;
  if (status === "DECLINED" || status === "DELETED") return "danger" as const;
  if (status === "SENT") return "orange" as const;
  return "neutral" as const;
}

export function QuotesPreview({
  quotes,
  error,
  connected,
  onSelect,
}: {
  quotes: Quote[] | null;
  error: string | null;
  connected: boolean;
  onSelect: (quote: Quote) => void;
}) {
  return (
    <Card>
      <CardHeader title="Recent quotes" subtitle="Straight from Xero, normalised for ScopeLock." />
      <CardBody>
        {!connected && <p className="text-sm text-ink-500">Connect to Xero to see quotes.</p>}
        {connected && error && <p className="text-sm text-red-600">{error}</p>}
        {connected && !error && quotes === null && <p className="text-sm text-ink-500">Loading quotes…</p>}
        {connected && !error && quotes !== null && quotes.length === 0 && (
          <p className="text-sm text-ink-500">No quotes found in this organisation.</p>
        )}
        {connected && !error && quotes !== null && quotes.length > 0 && (
          <ul className="flex flex-col divide-y divide-surface-border">
            {quotes.slice(0, 8).map((quote) => (
              <li key={quote.quoteId ?? quote.quoteNumber}>
                <button
                  type="button"
                  onClick={() => onSelect(quote)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">{quote.quoteNumber ?? "Untitled"}</p>
                    <p className="text-xs text-ink-500">
                      {quote.contactName ?? "Unknown contact"} · {quote.lineItems.length} line item
                      {quote.lineItems.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-ink-900">
                      {quote.total != null ? quote.total.toFixed(2) : "—"}
                    </span>
                    <Badge tone={statusTone(quote.status)}>{quote.status ?? "—"}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
