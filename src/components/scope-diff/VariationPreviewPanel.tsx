import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { PricedVariationLine, ProjectSummary } from "./types";

export function VariationPreviewPanel({
  project,
  messageId,
  variationLines,
  subtotal,
}: {
  project: ProjectSummary;
  messageId: string;
  variationLines: PricedVariationLine[];
  subtotal: number;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Variation preview" subtitle="Variation 01 — draft, not created in Xero" />
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-ink-500">Project</p>
            <p className="font-medium text-ink-900">{project.name}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Customer</p>
            <p className="font-medium text-ink-900">{project.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Source quote</p>
            <p className="font-medium text-ink-900">{project.quoteNumber || "—"}</p>
          </div>
        </div>

        {variationLines.length === 0 ? (
          <p className="text-sm text-ink-500">No out-of-scope work detected — nothing to price.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border">
            {variationLines.map((line) => (
              <li key={line.requestId} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{line.description}</p>
                  <p className="text-xs text-ink-500">
                    {line.itemCode} · {line.quantity} × £{line.unitAmount.toFixed(2)}
                  </p>
                </div>
                <span className="text-sm font-medium text-ink-900">£{line.lineAmount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-surface-border pt-3">
          <span className="text-sm font-semibold text-ink-900">Subtotal</span>
          <span className="text-sm font-semibold text-ink-900">£{subtotal.toFixed(2)}</span>
        </div>

        <p className="text-xs text-ink-500">
          Pricing retrieved from Xero. ScopeLock does not generate financial amounts.
        </p>

        <Link
          href={`/projects/${project.slug}/variation-review?messageId=${encodeURIComponent(messageId)}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
        >
          Review variation
        </Link>
      </CardBody>
    </Card>
  );
}
