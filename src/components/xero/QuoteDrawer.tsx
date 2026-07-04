"use client";

import type { Quote } from "./types";

export function QuoteDrawer({ quote, onClose }: { quote: Quote | null; onClose: () => void }) {
  if (!quote) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close quote preview"
        onClick={onClose}
        className="absolute inset-0 bg-navy-950/60"
      />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-surface-border px-6 py-4">
          <div>
            <p className="text-xs font-medium text-ink-500">{quote.reference ?? "No reference"}</p>
            <h2 className="text-lg font-semibold text-ink-900">{quote.quoteNumber ?? "Untitled quote"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-surface-muted"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-surface-border px-6 py-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Contact</p>
            <p className="font-medium text-ink-900">{quote.contactName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Status</p>
            <p className="font-medium text-ink-900">{quote.status ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Date</p>
            <p className="font-medium text-ink-900">{quote.date ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Expiry</p>
            <p className="font-medium text-ink-900">{quote.expiryDate ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Currency</p>
            <p className="font-medium text-ink-900">{quote.currencyCode ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Total</p>
            <p className="font-medium text-ink-900">{quote.total != null ? quote.total.toFixed(2) : "—"}</p>
          </div>
        </div>

        <div className="flex-1 px-6 py-4">
          <p className="mb-2 text-xs font-medium text-ink-500">Line items</p>
          {quote.lineItems.length === 0 ? (
            <p className="text-sm text-ink-500">No line items on this quote.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-border">
              {quote.lineItems.map((lineItem) => (
                <li key={lineItem.lineItemId ?? lineItem.description} className="py-3">
                  <p className="text-sm font-medium text-ink-900">{lineItem.description ?? "—"}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    Qty {lineItem.quantity ?? "—"} × {lineItem.unitAmount ?? "—"} ={" "}
                    {lineItem.lineAmount ?? "—"}
                    {lineItem.accountCode ? ` · Account ${lineItem.accountCode}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
