"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import type { ProjectSummary } from "./types";

export function OriginalAgreementDrawer({
  project,
  highlightedLineId,
  onClose,
}: {
  project: ProjectSummary;
  highlightedLineId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close original agreement" onClick={onClose} className="absolute inset-0 bg-navy-950/60" />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-surface-border px-6 py-4">
          <div>
            <p className="text-xs font-medium text-ink-500">Original agreement</p>
            <h2 className="text-lg font-semibold text-ink-900">{project.quoteNumber || "Quote"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-surface-border px-6 py-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Customer</p>
            <p className="font-medium text-ink-900">{project.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Status</p>
            <Badge tone={project.quoteStatus === "ACCEPTED" ? "green" : "neutral"}>{project.quoteStatus ?? "—"}</Badge>
          </div>
          <div>
            <p className="text-xs text-ink-500">Date</p>
            <p className="font-medium text-ink-900">{project.quoteDate ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Total</p>
            <p className="font-medium text-ink-900">
              {project.quoteTotal != null ? `£${project.quoteTotal.toFixed(2)}` : "—"}
            </p>
          </div>
        </div>

        <div className="flex-1 px-6 py-4">
          <p className="mb-2 text-xs font-medium text-ink-500">Agreed scope lines</p>
          <ul className="flex flex-col divide-y divide-surface-border">
            {project.lineItems.map((line, index) => {
              const isHighlighted = highlightedLineId != null && line.lineItemId === highlightedLineId;
              return (
                <li
                  key={line.lineItemId ?? index}
                  className={cn("rounded-lg px-2 py-3", isHighlighted && "bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/40")}
                >
                  <p className="text-sm font-medium text-ink-900">{line.description ?? "—"}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    Qty {line.quantity ?? "—"} × £{line.unitAmount?.toFixed(2) ?? "—"} = £
                    {line.lineAmount?.toFixed(2) ?? "—"}
                    {line.itemCode ? ` · ${line.itemCode}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
