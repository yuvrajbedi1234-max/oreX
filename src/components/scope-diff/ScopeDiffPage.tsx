"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ConversationPanel } from "./ConversationPanel";
import { OriginalAgreementDrawer } from "./OriginalAgreementDrawer";
import { ScopeAnalysisPanel } from "./ScopeAnalysisPanel";
import { VariationPreviewPanel } from "./VariationPreviewPanel";
import type { ApiErrorBody, DemoMessage, ProjectSummary, ScopeAnalyserType, ScopeDiffResult } from "./types";

const ERROR_COPY: Record<string, string> = {
  project_not_found: "This project isn't set up yet. Go to the Demo page and create the demo scenario first.",
  not_connected: "Xero isn't connected. Go to Xero Connection and reconnect, then try again.",
  source_quote_missing: "The agreed quote couldn't be read from Xero — it may have been deleted or the connection lost access to it.",
  quote_lines_missing: "The agreed quote has no line items to compare against. Check the quote in Xero.",
  pricing_item_missing: "One or more pricing items couldn't be read from Xero. Try reseeding the demo scenario.",
  insufficient_permissions: "The connected Xero app is missing a permission this needs. Update Xero permissions and reconnect.",
  invalid_message: "Unknown message — analyse the demo message, or type a message and use AI Analysis.",
  ai_unavailable: "AI analysis isn't available right now (check ANTHROPIC_API_KEY). Switch to Deterministic Demo below to continue.",
  ai_invalid_output: "The AI returned output that failed validation and was rejected. Try again, or switch to Deterministic Demo.",
  unknown: "Something went wrong talking to Xero.",
};

const ANALYSERS: { id: ScopeAnalyserType; label: string; hint: string }[] = [
  { id: "AI", label: "AI Analysis", hint: "Understands arbitrary client messages" },
  { id: "DETERMINISTIC_DEMO", label: "Deterministic Demo", hint: "Fixed demo message, no AI" },
];

const ANALYSER_LABEL: Record<ScopeAnalyserType, string> = {
  AI: "AI Analysis",
  DETERMINISTIC_DEMO: "Deterministic Demo",
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

  // Phase 4 — analyser selection + an editable client message. Default to AI
  // Analysis (the final-demo path); Deterministic Demo stays as a fallback.
  const [analyser, setAnalyser] = useState<ScopeAnalyserType>("AI");
  const [messageText, setMessageText] = useState(message.text);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${project.slug}/scope-diff?messageId=${messageId}`);
        const body = await safeJson(res);
        if (!cancelled && body?.result) {
          const stored = body.result as ScopeDiffResult;
          setResult(stored);
          if (stored.messageText) setMessageText(stored.messageText);
          setAnalyser(stored.analyser);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The message the conversation panel shows always reflects what will be
  // analysed. Deterministic mode ignores the text and uses the fixed demo
  // message, so we don't offer editing there.
  const isCustomMessage = analyser === "AI" && messageText.trim() !== message.text;
  const displayMessage: DemoMessage = { ...message, text: analyser === "AI" ? messageText : message.text };

  async function runWith(chosen: ScopeAnalyserType) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.slug}/scope-diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          analyser: chosen,
          // Only send custom text for AI. Deterministic always runs against
          // the fixed demo message.
          messageText: chosen === "AI" ? messageText : undefined,
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setError((body as ApiErrorBody) ?? { error: "Failed to run Scope Diff.", code: "unknown" });
        return;
      }
      const next = body as ScopeDiffResult;
      setResult(next);
      setAnalyser(next.analyser);
      setEditing(false);
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
      const targetId = result?.messageId ?? messageId;
      await fetch(`/api/projects/${project.slug}/scope-diff?messageId=${targetId}`, { method: "DELETE" });
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
          <Button onClick={() => runWith(analyser)} disabled={running}>
            {running ? "Analysing…" : "Run Scope Diff"}
          </Button>
        </div>
      </div>

      {/* Phase 4 — analyser selector (development / demo control). */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium text-ink-500">Analyser</span>
          <div className="flex gap-2" role="group" aria-label="Choose scope analyser">
            {ANALYSERS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAnalyser(a.id)}
                aria-pressed={analyser === a.id}
                title={a.hint}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
                  analyser === a.id
                    ? "bg-ink-900 text-white ring-ink-900"
                    : "bg-transparent text-ink-700 ring-surface-border hover:bg-surface-muted"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          {analyser === "AI" && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-medium text-cyan-500 underline-offset-2 hover:underline"
            >
              {editing ? "Done editing" : "Edit client message"}
            </button>
          )}
          {analyser === "AI" && isCustomMessage && (
            <button
              type="button"
              onClick={() => setMessageText(message.text)}
              className="text-xs text-ink-500 underline-offset-2 hover:underline"
            >
              Reset to demo message
            </button>
          )}
          <span className="ml-auto text-xs text-ink-500">
            {analyser === "AI"
              ? "AI classifies scope and suggests item codes. Pricing still comes from Xero."
              : "Fixed deterministic analyser — the demo fallback."}
          </span>
        </CardBody>
      </Card>

      {editing && analyser === "AI" && (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <label htmlFor="client-message" className="text-xs font-medium text-ink-500">
              Client message to analyse
            </label>
            <textarea
              id="client-message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              placeholder="Type any client message to analyse against the agreed quote…"
            />
            <p className="text-xs text-ink-500">
              Try a different request (e.g. &ldquo;can you also paint the hallway?&rdquo;) and Run Scope Diff.
            </p>
          </CardBody>
        </Card>
      )}

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
          <ConversationPanel project={project} message={displayMessage} requestCount={result?.requests.length ?? null} />

          {error ? (
            <Card>
              <CardBody className="flex flex-col gap-3 py-8">
                <p className="text-sm font-medium text-red-600">{ERROR_COPY[error.code ?? "unknown"] ?? error.error}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => runWith(analyser)} disabled={running}>
                    Retry
                  </Button>
                  {/* AI failure → offer the deterministic fallback in one click. */}
                  {(error.code === "ai_unavailable" || error.code === "ai_invalid_output") && (
                    <Button
                      onClick={() => {
                        setAnalyser("DETERMINISTIC_DEMO");
                        runWith("DETERMINISTIC_DEMO");
                      }}
                      disabled={running}
                    >
                      Use Deterministic Demo
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : running ? (
            <Card>
              <CardBody className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-sm font-medium text-ink-900">Analysing the conversation…</p>
                <p className="text-xs text-ink-500">
                  {analyser === "AI"
                    ? "The AI is comparing the message against the agreed Xero quote."
                    : "Comparing requests against the agreed Xero quote."}
                </p>
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={result.analyser === "AI" ? "cyan" : "neutral"}>
                  Analysed by {ANALYSER_LABEL[result.analyser]}
                </Badge>
              </div>
              <ScopeAnalysisPanel
                requests={result.requests}
                selectedRequestId={selectedRequestId}
                onSelect={(id) => setSelectedRequestId(id === selectedRequestId ? null : id)}
              />
            </div>
          )}

          {result && !error ? (
            <VariationPreviewPanel
              project={project}
              messageId={result.messageId}
              variationLines={result.variationLines}
              subtotal={result.subtotal}
            />
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
