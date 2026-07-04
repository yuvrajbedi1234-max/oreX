"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StepRow } from "./StepRow";
import type { SeedResult, SeedStepResult } from "./types";

function findStep(result: SeedResult | null, id: string): SeedStepResult | undefined {
  return result?.steps.find((s) => s.step === id);
}

function itemSteps(result: SeedResult | null): SeedStepResult[] {
  return result?.steps.filter((s) => s.step.startsWith("item:")) ?? [];
}

export function DemoSetupPage() {
  const [result, setResult] = useState<SeedResult | null>(null);
  const [running, setRunning] = useState<"seed" | "verify" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function handleSeed() {
    setRunning("seed");
    setError(null);
    setResetDone(false);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const body = await res.json();
      setResult(body as SeedResult);
    } catch {
      setError("Failed to reach the server while seeding the demo scenario.");
    } finally {
      setRunning(null);
    }
  }

  async function handleVerify() {
    setRunning("verify");
    setError(null);
    setResetDone(false);
    try {
      const res = await fetch("/api/demo/verify");
      const body = await res.json();
      setResult(body as SeedResult);
    } catch {
      setError("Failed to reach the server while verifying the demo scenario.");
    } finally {
      setRunning(null);
    }
  }

  async function handleReset() {
    if (!resetConfirmed || running) return;
    setRunning("reset");
    setError(null);
    try {
      const res = await fetch("/api/demo/reset-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to reset local demo state.");
      }
      setResult(null);
      setResetConfirmed(false);
      setResetDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset local demo state.");
    } finally {
      setRunning(null);
    }
  }

  const xeroConnected = findStep(result, "xeroConnected");
  const salesAccount = findStep(result, "salesAccount");
  const contact = findStep(result, "contact");
  const quote = findStep(result, "quote");
  const projectLink = findStep(result, "projectLink");
  const items = itemSteps(result);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Demo Environment</h1>
        <p className="mt-1 text-sm text-slate-400">
          Seeds one repeatable Xero demo scenario — Baker & Co, a kitchen refurbishment quote, and its pricing
          catalogue — so later phases have real financial data to work against.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      )}
      {resetDone && (
        <div className="rounded-lg bg-green-400/10 px-4 py-3 text-sm text-green-500 ring-1 ring-inset ring-green-400/30">
          Local demo state cleared. Xero records were not touched — click Create demo scenario to relink them.
        </div>
      )}

      <Card>
        <CardHeader
          title="Setup checklist"
          subtitle="Create finds-or-creates every record; Verify only reads, never creates."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleVerify} disabled={running !== null}>
                {running === "verify" ? "Verifying…" : "Verify demo scenario"}
              </Button>
              <Button onClick={handleSeed} disabled={running !== null}>
                {running === "seed" ? "Creating…" : "Create demo scenario"}
              </Button>
            </div>
          }
        />
        <CardBody>
          {!result && <p className="text-sm text-ink-500">Not run yet — click Create or Verify demo scenario.</p>}
          {result && (
            <div className="flex flex-col divide-y divide-surface-border">
              {xeroConnected && <StepRow step={xeroConnected} />}
              {salesAccount && <StepRow step={salesAccount} />}
              {contact && <StepRow step={contact} />}
              {items.length > 0 && (
                <div className="py-3">
                  <p className="mb-2 text-sm font-medium text-ink-900">Pricing items</p>
                  <div className="flex flex-col divide-y divide-surface-border rounded-lg bg-surface-muted px-3">
                    {items.map((item) => (
                      <StepRow key={item.step} step={item} />
                    ))}
                  </div>
                </div>
              )}
              {quote && <StepRow step={quote} />}
              {projectLink && <StepRow step={projectLink} />}
            </div>
          )}
        </CardBody>
      </Card>

      {result?.success && projectLink && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <p className="text-sm text-ink-700">Demo scenario is ready.</p>
            <Link
              href="/projects/demo-kitchen"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
            >
              Open Kitchen Refurbishment project
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Reset local state" subtitle="Clears only the local project link — Xero records are never deleted automatically." />
        <CardBody className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={resetConfirmed}
              onChange={(event) => setResetConfirmed(event.target.checked)}
              disabled={running !== null}
              className="mt-0.5 h-4 w-4 rounded border-surface-border"
            />
            I understand this only clears ScopeLock&apos;s local record — it will not delete anything in Xero.
          </label>
          <div>
            <Button variant="danger" onClick={handleReset} disabled={!resetConfirmed || running !== null}>
              {running === "reset" ? "Resetting…" : "Reset local state"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
