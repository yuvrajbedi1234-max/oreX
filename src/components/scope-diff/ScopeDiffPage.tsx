"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ConversationPanel } from "./ConversationPanel";
import { OriginalAgreementDrawer } from "./OriginalAgreementDrawer";
import { ScopeAnalysisPanel } from "./ScopeAnalysisPanel";
import { VariationPreviewPanel } from "./VariationPreviewPanel";
import type { ApiErrorBody, DemoMessage, ProjectSummary, ScopeDiffResult } from "./types";

const ERROR_COPY: Record<string, string> = {
  project_not_found: "This project isn't set up yet. Go to the Demo page and create the demo scenario first.",
  not_connected: "Xero isn't connected. Go to Xero Connection and reconnect, then try again.",
  source_quote_missing: "The agreed quote couldn't be read from Xero — it may have been deleted or the connection lost access to it.",
  quote_lines_missing: "The agreed quote has no line items to compare against. Check the quote in Xero.",
  pricing_item_missing: "One or more pricing items couldn't be read from Xero. Try reseeding the demo scenario.",
  insufficient_permissions: "The connected Xero app is missing a permission this needs. Update Xero permissions and reconnect.",
  invalid_message: "Unknown message — this demo only analyses the fixed client message.",
  unknown: "Something went wrong talking to Xero.",
};

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function ScopeDiffPage({
  project,
  message,
  messageId,
}: {
  project: ProjectSummary;
  message: DemoMessage;
  messageId: string;
}) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<ScopeDiffResult | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showAgreement, setShowAgreement] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${project.slug}/scope-diff?messageId=${messageId}`);
        const body = await safeJson(res);
        if (!cancelled && body?.result) setResult(body.result as ScopeDiffResult);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.slug}/scope-diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setError((body as ApiErrorBody) ?? { error: "Failed to run Scope Diff.", code: "unknown" });
        return;
      }
      setResult(body as ScopeDiffResult);
      setSelectedRequestId(null);
    } catch {
      setError({ error: "Failed to reach the server.", code: "unknown" });
    } finally {
      setRunning(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await fetch(`/api/projects/${project.slug}/scope-diff?messageId=${messageId}`, { method: "DELETE" });
      setResult(null);
      setError(null);
      setSelectedRequestId(null);
    } finally {
      setResetting(false);
    }
  }

  const selectedRequest = result?.requests.find((r) => r.id === selectedRequestId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Scope Diff</h1>
          <p className="mt-1 text-sm text-slate-400">
            {project.name} · {project.customerName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowAgreement(true)}>
            View original agreement
          </Button>
          <Button variant="secondary" onClick={handleReset} disabled={resetting || running || !result}>
            {resetting ? "Resetting…" : "Reset analysis"}
          </Button>
          <Button onClick={handleRun} disabled={running}>
            {running ? "Analysing…" : "Run Scope Diff"}
          </Button>
        </div>
      </div>

      {initialLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardBody className="flex flex-col gap-3 py-8">
                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-surface-muted" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ConversationPanel project={project} message={message} requestCount={result?.requests.length ?? null} />

          {error ? (
            <Card>
              <CardBody className="flex flex-col gap-3 py-8">
                <p className="text-sm font-medium text-red-600">{ERROR_COPY[error.code ?? "unknown"] ?? error.error}</p>
                <div>
                  <Button variant="secondary" onClick={handleRun} disabled={running}>
                    Retry
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : running ? (
            <Card>
              <CardBody className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-sm font-medium text-ink-900">Analysing the conversation…</p>
                <p className="text-xs text-ink-500">Comparing requests against the agreed Xero quote.</p>
              </CardBody>
            </Card>
          ) : !result ? (
            <Card>
              <CardBody className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <p className="text-sm font-medium text-ink-900">No analysis yet</p>
                <p className="text-xs text-ink-500">Click Run Scope Diff to compare this message against the agreed quote.</p>
              </CardBody>
            </Card>
          ) : (
            <ScopeAnalysisPanel
              requests={result.requests}
              selectedRequestId={selectedRequestId}
              onSelect={(id) => setSelectedRequestId(id === selectedRequestId ? null : id)}
            />
          )}

          {result && !error ? (
            <VariationPreviewPanel project={project} variationLines={result.variationLines} subtotal={result.subtotal} />
          ) : (
            <Card>
              <CardBody className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-sm text-ink-500">Run Scope Diff to see the variation preview.</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {showAgreement && (
        <OriginalAgreementDrawer
          project={project}
          highlightedLineId={selectedRequest?.matchedQuoteLineId ?? null}
          onClose={() => setShowAgreement(false)}
        />
      )}
    </div>
  );
}
