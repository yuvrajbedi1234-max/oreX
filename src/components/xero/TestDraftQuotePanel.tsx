"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { ApiErrorBody, Contact, Quote } from "./types";

export function TestDraftQuotePanel({
  contacts,
  disabled,
  onCreated,
}: {
  contacts: Contact[];
  disabled: boolean;
  onCreated?: () => void;
}) {
  const [contactId, setContactId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !disabled && !submitting && confirmed && contactId.length > 0;

  async function handleCreate() {
    // Guards against double-clicks on top of the disabled attribute.
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/xero/test-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, confirmed }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error((body as ApiErrorBody).error ?? "Failed to create test quote.");
      }
      setResult(body.quote as Quote);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test quote.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Create test draft quote"
        subtitle="Creates exactly one DRAFT quote. It is never sent or authorised."
      />
      <CardBody className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-500">Contact</span>
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            disabled={disabled || submitting}
            className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-900 disabled:opacity-50"
          >
            <option value="">Select a contact…</option>
            {contacts.map((contact) => (
              <option key={contact.contactId ?? contact.name} value={contact.contactId ?? ""}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={disabled || submitting}
            className="mt-0.5 h-4 w-4 rounded border-surface-border"
          />
          I confirm I am using a Xero Demo Company or test organisation.
        </label>

        <div>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create test draft quote"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg bg-green-400/10 px-4 py-3 text-sm text-ink-900 ring-1 ring-inset ring-green-400/30">
            <p className="font-medium text-green-500">Draft quote created</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-ink-500">Quote ID</dt>
              <dd>{result.quoteId}</dd>
              <dt className="text-ink-500">Quote number</dt>
              <dd>{result.quoteNumber ?? "—"}</dd>
              <dt className="text-ink-500">Status</dt>
              <dd>{result.status}</dd>
              <dt className="text-ink-500">Contact</dt>
              <dd>{result.contactName ?? "—"}</dd>
              <dt className="text-ink-500">Total</dt>
              <dd>{result.total ?? "—"}</dd>
            </dl>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
