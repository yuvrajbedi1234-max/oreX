"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectionStatusCard } from "./ConnectionStatusCard";
import { ContactsPreview } from "./ContactsPreview";
import { IntegrationTestsPanel } from "./IntegrationTestsPanel";
import { ItemsPreview } from "./ItemsPreview";
import { QuoteDrawer } from "./QuoteDrawer";
import { QuotesPreview } from "./QuotesPreview";
import { TestDraftQuotePanel } from "./TestDraftQuotePanel";
import type { ApiErrorBody, ConnectionStatus, Contact, IntegrationCheck, Item, Quote } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error((body as ApiErrorBody).error ?? `Request to ${url} failed.`);
  }
  return body as T;
}

export function XeroDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [checks, setChecks] = useState<IntegrationCheck[] | null>(null);
  const [runningChecks, setRunningChecks] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const banner = searchParams.get("connected") === "true"
    ? { tone: "success" as const, message: "Xero organisation connected." }
    : searchParams.get("xeroError")
      ? { tone: "error" as const, message: searchParams.get("xeroError") ?? "Connection failed." }
      : null;

  useEffect(() => {
    if (banner) {
      router.replace("/xero");
    }
    // Only run when the query params that produce a banner change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const data = await getJson<ConnectionStatus>("/api/xero/status");
      setStatus(data);
      setTokenExpired(!!data.tokenExpiresAt && new Date(data.tokenExpiresAt).getTime() < Date.now());
      if (data.connected) setLastCheckedAt(new Date());
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to load Xero connection status.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadPreviews = useCallback(async () => {
    setQuotes(null);
    setContacts(null);
    setItems(null);
    setQuotesError(null);
    setContactsError(null);
    setItemsError(null);

    await Promise.all([
      getJson<{ quotes: Quote[] }>("/api/xero/quotes")
        .then((data) => setQuotes(data.quotes))
        .catch((err) => setQuotesError(err.message)),
      getJson<{ contacts: Contact[] }>("/api/xero/contacts")
        .then((data) => setContacts(data.contacts))
        .catch((err) => setContactsError(err.message)),
      getJson<{ items: Item[] }>("/api/xero/items")
        .then((data) => setItems(data.items))
        .catch((err) => setItemsError(err.message)),
    ]);
  }, []);

  useEffect(() => {
    // Deferred a tick so the effect doesn't synchronously trigger setState.
    queueMicrotask(() => {
      refreshStatus();
    });
  }, [refreshStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    queueMicrotask(() => {
      loadPreviews();
    });
  }, [status?.connected, loadPreviews]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/xero/disconnect", { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to disconnect from Xero.");
      }
      setChecks(null);
      setQuotes(null);
      setContacts(null);
      setItems(null);
      await refreshStatus();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to disconnect from Xero.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRunTests() {
    setRunningChecks(true);
    setTestsError(null);
    try {
      const res = await fetch("/api/xero/test-connection", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error((body as ApiErrorBody).error ?? "Failed to run connection tests.");
      }
      setChecks(body.checks as IntegrationCheck[]);
      setLastCheckedAt(new Date());
    } catch (err) {
      setTestsError(err instanceof Error ? err.message : "Failed to run connection tests.");
    } finally {
      setRunningChecks(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Xero Connection</h1>
        <p className="mt-1 text-sm text-slate-400">
          The only screen with live functionality in Phase 1.
        </p>
      </div>

      {banner && (
        <div
          className={
            banner.tone === "success"
              ? "rounded-lg bg-green-400/10 px-4 py-3 text-sm text-green-500 ring-1 ring-inset ring-green-400/30"
              : "rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30"
          }
        >
          {banner.message}
        </div>
      )}

      {statusError && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {statusError}
        </div>
      )}

      <ConnectionStatusCard
        status={status}
        loading={statusLoading}
        tokenExpired={tokenExpired}
        lastCheckedAt={lastCheckedAt}
        disconnecting={disconnecting}
        onDisconnect={handleDisconnect}
      />

      <IntegrationTestsPanel
        checks={checks}
        running={runningChecks}
        disabled={!status?.connected}
        onRun={handleRunTests}
      />
      {testsError && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {testsError}
        </div>
      )}

      <TestDraftQuotePanel
        contacts={contacts ?? []}
        disabled={!status?.connected}
        onCreated={loadPreviews}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <QuotesPreview
          quotes={quotes}
          error={quotesError}
          connected={!!status?.connected}
          onSelect={setSelectedQuote}
        />
        <ContactsPreview contacts={contacts} error={contactsError} connected={!!status?.connected} />
        <ItemsPreview items={items} error={itemsError} connected={!!status?.connected} />
      </div>

      <QuoteDrawer quote={selectedQuote} onClose={() => setSelectedQuote(null)} />
    </div>
  );
}
