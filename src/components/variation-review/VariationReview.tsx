"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type {
  ApprovedLine,
  CatalogueItem,
  CreateVariationResponse,
  DetectedRequest,
  VariationApiError,
  VariationRecord,
  VariationReviewData,
} from "./types";

type Bucket = "VARIATION" | "INCLUDED" | "NEEDS_REVIEW";

interface EditableRequest {
  requestId: string;
  originalText: string;
  bucket: Bucket;
  description: string;
  quantity: number;
  // The selected Xero item code, or null to use a manual price.
  itemCode: string | null;
  manualPrice: string;
  evidence: DetectedRequest["evidence"];
  originalClassification: DetectedRequest["classification"];
}

const MANUAL_OPTION = "__manual__";
const XERO_QUOTES_URL = "https://go.xero.com/app/quotes";

function money(value: number): string {
  return `£${value.toFixed(2)}`;
}

function bucketFor(classification: DetectedRequest["classification"]): Bucket {
  if (classification === "LIKELY_VARIATION") return "VARIATION";
  if (classification === "INCLUDED") return "INCLUDED";
  return "NEEDS_REVIEW";
}

function toEditable(requests: DetectedRequest[]): EditableRequest[] {
  return requests.map((r) => ({
    requestId: r.id,
    originalText: r.originalText,
    bucket: bucketFor(r.classification),
    description: r.normalizedDescription || r.originalText,
    quantity: r.quantity > 0 ? r.quantity : 1,
    itemCode: r.matchedItemCode ?? null,
    manualPrice: "",
    evidence: r.evidence,
    originalClassification: r.classification,
  }));
}

export function VariationReview({ data, messageId }: { data: VariationReviewData; messageId: string }) {
  const [rows, setRows] = useState<EditableRequest[]>(() => toEditable(data.requests));
  const [created, setCreated] = useState<VariationRecord | null>(data.existingVariation);
  // When a draft already exists, the owner must explicitly choose to create
  // another revision before the editor is shown again.
  const [revising, setRevising] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogueByCode = useMemo(() => {
    const map = new Map<string, CatalogueItem>();
    for (const item of data.catalogue) map.set(item.code, item);
    return map;
  }, [data.catalogue]);

  // Preview the revision the server will assign next: the highest we've seen
  // (either created this session, or already present at load) plus one.
  const nextRevision = (created?.revision ?? data.existingVariation?.revision ?? 0) + 1;
  const referencePreview = `SCOPELOCK-VARIATION-${data.originalQuote.number || "QUOTE"}-${String(nextRevision).padStart(2, "0")}`;
  const titlePreview = `Variation ${String(nextRevision).padStart(2, "0")} — ${data.project.name}`;

  function updateRow(requestId: string, patch: Partial<EditableRequest>) {
    setRows((prev) => prev.map((r) => (r.requestId === requestId ? { ...r, ...patch } : r)));
  }

  // The unit price for a line: from the live Xero item, or the owner's manual
  // entry. Returns null when the line isn't priceable yet.
  function unitPriceFor(row: EditableRequest): number | null {
    if (row.itemCode) {
      const item = catalogueByCode.get(row.itemCode);
      return item?.unitPrice ?? null;
    }
    const trimmed = row.manualPrice.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const variationRows = rows.filter((r) => r.bucket === "VARIATION");
  const includedRows = rows.filter((r) => r.bucket === "INCLUDED");
  const needsReviewRows = rows.filter((r) => r.bucket === "NEEDS_REVIEW");

  const subtotal = variationRows.reduce((sum, r) => {
    const unit = unitPriceFor(r);
    return unit == null ? sum : sum + Math.round(r.quantity * unit * 100) / 100;
  }, 0);

  const canApprove =
    variationRows.length > 0 &&
    variationRows.every((r) => r.description.trim() !== "" && r.quantity > 0 && unitPriceFor(r) != null);

  function buildApprovedLines(): ApprovedLine[] {
    return variationRows.map((r) => {
      const usesItem = Boolean(r.itemCode);
      return {
        requestId: r.requestId,
        description: r.description.trim(),
        quantity: r.quantity,
        itemCode: usesItem ? r.itemCode : null,
        unitAmount: unitPriceFor(r) ?? 0,
        priceSource: usesItem ? "XERO_ITEM" : "MANUAL",
      };
    });
  }

  async function handleConfirmCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${data.project.slug}/variation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          lines: buildApprovedLines(),
          // If a draft already exists we are deliberately creating a new
          // revision; otherwise this is the first draft.
          createAnother: created != null,
        }),
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok) {
        const apiError = body as VariationApiError | null;
        setError(apiError?.error ?? "Couldn't create the variation. Please try again.");
        return;
      }
      const ok = body as CreateVariationResponse;
      setCreated(ok.variation);
      setRevising(false);
      setConfirmOpen(false);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // A draft exists and we're not mid-revision → show the success screen.
  if (created && !revising) {
    return (
      <SuccessScreen
        data={data}
        variation={created}
        onCreateAnother={() => {
          setRevising(true);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Variation review</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data.project.name} · {data.customerName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${data.project.slug}/scope-diff`}
            className="inline-flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-ink-900 ring-1 ring-inset ring-surface-border transition-colors hover:bg-surface-muted"
          >
            Back to Scope Diff
          </Link>
          <Button onClick={() => setConfirmOpen(true)} disabled={!canApprove || submitting}>
            Approve and create draft variation
          </Button>
        </div>
      </div>

      {data.existingVariation && revising && (
        <div className="rounded-lg bg-orange-400/10 px-4 py-3 text-sm text-orange-600 ring-1 ring-inset ring-orange-400/30">
          A draft variation ({data.existingVariation.xeroQuoteNumber || data.existingVariation.reference}) already
          exists for this message. Approving will create a <strong>new revision</strong> ({referencePreview}) — the
          existing draft is left untouched.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      )}

      {/* Context header */}
      <Card>
        <CardHeader title="What the client asked for" subtitle={`Compared against ${data.originalQuote.number || "the agreed quote"}`} />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Field label="Customer" value={data.customerName} />
            <Field label="Original quote" value={data.originalQuote.number || "—"} />
            <Field label="Analysed by" value={data.analyser === "AI" ? "AI Analysis" : "Deterministic Demo"} />
            <Field label="Original quote total" value={data.originalQuote.total != null ? money(data.originalQuote.total) : "—"} />
          </div>
          {data.message.text && (
            <div className="rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-3 text-sm italic text-ink-900 ring-1 ring-inset ring-surface-border">
              &ldquo;{data.message.text}&rdquo;
            </div>
          )}
        </CardBody>
      </Card>

      {/* Proposed variation lines */}
      <Card>
        <CardHeader
          title="Proposed variation lines"
          subtitle="Edit anything before approving. Xero-priced lines always use the live Xero price."
        />
        <CardBody className="flex flex-col gap-4">
          {variationRows.length === 0 ? (
            <p className="text-sm text-ink-500">
              No variation lines. Move a request up from &ldquo;Already included&rdquo; or &ldquo;Needs review&rdquo;, or
              nothing will be created.
            </p>
          ) : (
            variationRows.map((row) => (
              <VariationLineEditor
                key={row.requestId}
                row={row}
                catalogue={data.catalogue}
                unitPrice={unitPriceFor(row)}
                onChange={(patch) => updateRow(row.requestId, patch)}
                onMove={(bucket) => updateRow(row.requestId, { bucket })}
              />
            ))
          )}

          <div className="flex flex-col gap-1 border-t border-surface-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Subtotal</span>
              <span className="font-medium text-ink-900">{money(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Applicable tax</span>
              <span className="text-ink-500">Calculated by Xero on the draft</span>
            </div>
            <div className="flex items-center justify-between border-t border-surface-border pt-2">
              <span className="font-semibold text-ink-900">Estimated total (excl. tax)</span>
              <span className="font-semibold text-ink-900">{money(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Pricing for Xero items comes from Xero. Manual prices are your own entry, used only when no approved item
              exists. Nothing is created in Xero until you approve.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Other requests the owner can pull into the variation */}
      {(includedRows.length > 0 || needsReviewRows.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OtherRequestsCard
            title="Already included"
            subtitle="Covered by the agreed quote — no charge"
            tone="green"
            rows={includedRows}
            onMoveToVariation={(id) => updateRow(id, { bucket: "VARIATION" })}
          />
          <OtherRequestsCard
            title="Needs review"
            subtitle="Not confident enough to bill automatically"
            tone="neutral"
            rows={needsReviewRows}
            onMoveToVariation={(id) => updateRow(id, { bucket: "VARIATION" })}
          />
        </div>
      )}

      {confirmOpen && (
        <ConfirmModal
          title={titlePreview}
          reference={referencePreview}
          customerName={data.customerName}
          originalQuoteNumber={data.originalQuote.number}
          lines={variationRows.map((r) => ({
            description: r.description.trim(),
            quantity: r.quantity,
            unit: unitPriceFor(r) ?? 0,
            source: r.itemCode ? "Xero" : "Manual",
          }))}
          subtotal={subtotal}
          submitting={submitting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmCreate}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="font-medium text-ink-900">{value}</p>
    </div>
  );
}

function VariationLineEditor({
  row,
  catalogue,
  unitPrice,
  onChange,
  onMove,
}: {
  row: EditableRequest;
  catalogue: CatalogueItem[];
  unitPrice: number | null;
  onChange: (patch: Partial<EditableRequest>) => void;
  onMove: (bucket: Bucket) => void;
}) {
  const lineTotal = unitPrice != null ? Math.round(row.quantity * unitPrice * 100) / 100 : null;
  const selectValue = row.itemCode ?? MANUAL_OPTION;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs italic text-ink-500">&ldquo;{row.originalText}&rdquo;</p>
        <div className="flex gap-2">
          <MoveButton label="→ Included" onClick={() => onMove("INCLUDED")} />
          <MoveButton label="→ Needs review" onClick={() => onMove("NEEDS_REVIEW")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <label className="flex flex-col gap-1 sm:col-span-5">
          <span className="text-xs text-ink-500">Description</span>
          <input
            type="text"
            value={row.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-ink-500">Qty</span>
          <input
            type="number"
            min={1}
            step={1}
            value={row.quantity}
            onChange={(e) => onChange({ quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
            className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-5">
          <span className="text-xs text-ink-500">Xero item</span>
          <select
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === MANUAL_OPTION ? { itemCode: null } : { itemCode: v });
            }}
            className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {catalogue.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.name}
                {item.unitPrice != null ? ` (${money(item.unitPrice)})` : ""}
              </option>
            ))}
            <option value={MANUAL_OPTION}>Manual price (no Xero item)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          {row.itemCode ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-500">Unit price</span>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-900">
                {unitPrice != null ? money(unitPrice) : "—"}
                <Badge tone="cyan">Xero</Badge>
              </span>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-500">Manual unit price (£)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.manualPrice}
                onChange={(e) => onChange({ manualPrice: e.target.value })}
                placeholder="0.00"
                className="w-40 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
            </label>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-500">Line total</p>
          <p className="text-sm font-semibold text-ink-900">{lineTotal != null ? money(lineTotal) : "—"}</p>
        </div>
      </div>

      {row.evidence.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-muted p-3">
          <p className="text-xs font-medium text-ink-500">Evidence for this decision</p>
          {row.evidence.map((e, i) => (
            <p key={i} className="text-xs text-ink-700">
              {e.label}
              {e.sourceText ? <span className="text-ink-500"> — &ldquo;{e.sourceText}&rdquo;</span> : null}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-surface-border transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      {label}
    </button>
  );
}

function OtherRequestsCard({
  title,
  subtitle,
  tone,
  rows,
  onMoveToVariation,
}: {
  title: string;
  subtitle: string;
  tone: "green" | "neutral";
  rows: EditableRequest[];
  onMoveToVariation: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={<Badge tone={tone}>{rows.length}</Badge>} />
      <CardBody className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing here.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.requestId}
              className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink-900">{row.description}</p>
                <p className="text-xs italic text-ink-500">&ldquo;{row.originalText}&rdquo;</p>
              </div>
              <MoveButton label="→ Add as variation" onClick={() => onMoveToVariation(row.requestId)} />
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function ConfirmModal({
  title,
  reference,
  customerName,
  originalQuoteNumber,
  lines,
  subtotal,
  submitting,
  onCancel,
  onConfirm,
}: {
  title: string;
  reference: string;
  customerName: string;
  originalQuoteNumber: string;
  lines: { description: string; quantity: number; unit: number; source: string }[];
  subtotal: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-navy-950/60" />
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-inset ring-surface-border">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Create this draft variation in Xero?</h2>
          <p className="mt-1 text-sm text-ink-500">
            A new <strong>DRAFT</strong> quote will be created in Xero. It is never sent or authorised, and your
            original quote {originalQuoteNumber ? `(${originalQuoteNumber})` : ""} is left unchanged.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-ink-500">Title</span>
            <span className="text-right font-medium text-ink-900">{title}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink-500">Reference</span>
            <span className="text-right font-medium text-ink-900">{reference}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink-500">Contact</span>
            <span className="text-right font-medium text-ink-900">{customerName}</span>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-surface-border">
          {lines.map((line, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink-900">
                {line.description}{" "}
                <span className="text-xs text-ink-500">
                  ({line.source}) {line.quantity} × {money(line.unit)}
                </span>
              </span>
              <span className="font-medium text-ink-900">{money(Math.round(line.quantity * line.unit * 100) / 100)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-surface-border pt-3 text-sm">
          <span className="font-semibold text-ink-900">Subtotal (excl. tax)</span>
          <span className="font-semibold text-ink-900">{money(subtotal)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? "Creating…" : "Yes, create draft variation"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({
  data,
  variation,
  onCreateAnother,
}: {
  data: VariationReviewData;
  variation: VariationRecord;
  onCreateAnother: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-400/15 text-green-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-white">Variation created successfully</h1>
      </div>

      <Card>
        <CardHeader title={variation.title} subtitle={variation.reference} action={<Badge tone="cyan">{variation.xeroQuoteStatus || "DRAFT"}</Badge>} />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Xero Quote" value={variation.xeroQuoteNumber || "—"} />
            <Field label="Status" value={variation.xeroQuoteStatus || "Draft"} />
            <Field label="Customer" value={data.customerName} />
            <Field label="Subtotal" value={money(variation.subtotal)} />
            <Field label="Tax" value={money(variation.totalTax)} />
            <Field label="Total" value={money(variation.total)} />
            <Field label="Related original quote" value={data.originalQuote.number || "—"} />
            <Field label="Revision" value={String(variation.revision).padStart(2, "0")} />
          </div>

          <p className="text-xs text-ink-500">
            This draft was created in Xero and never sent or authorised. Your original quote is unchanged.
          </p>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${data.project.slug}/scope-diff`}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
            >
              View in ScopeLock
            </Link>
            <a
              href={XERO_QUOTES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-ink-900 ring-1 ring-inset ring-surface-border transition-colors hover:bg-surface-muted"
            >
              Open Xero Quotes
            </a>
            {/* Deliberate action to create a further revision — the default is
                to NOT create another draft. */}
            <Button variant="secondary" onClick={onCreateAnother}>
              Create another revision
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
