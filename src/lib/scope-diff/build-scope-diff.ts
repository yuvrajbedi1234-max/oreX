import "server-only";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { fetchQuoteById } from "@/lib/xero/queries";
import { normalizeItem } from "@/lib/xero/normalize";
import type { NormalizedItem, NormalizedQuote } from "@/lib/xero/types";
import { findItemByCode } from "@/lib/demo/xero-lookups";
import { analyseDemoMessage } from "./deterministic-analyser";
import { getDemoMessage } from "./demo-message";
import { calculateSubtotal, calculateVariationLine, findXeroItemByCode } from "./pricing";
import type { PricedVariationLine, ScopeDiffError, ScopeDiffResult } from "./types";

export type ScopeDiffBuildResult = { status: "ok"; result: ScopeDiffResult } | { status: "error"; error: ScopeDiffError };

const REQUIRED_ITEM_CODES = ["LED-PACK", "SOCKET-MOVE", "HANDLE-BLACK"];

// Orchestrates one Scope Diff run: load the project, load the fixed
// message, retrieve the real Xero quote and pricing items, run the
// analyser, price the result from Xero, and persist it. Every failure mode
// returns a typed error instead of throwing — callers (the API route)
// decide the HTTP status.
export async function buildScopeDiff(slug: string, messageId: string): Promise<ScopeDiffBuildResult> {
  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) {
    return {
      status: "error",
      error: { code: "project_not_found", message: `No project found for "${slug}". Seed the demo scenario first.` },
    };
  }

  const message = getDemoMessage(messageId);
  if (!message) {
    return { status: "error", error: { code: "invalid_message", message: `Unknown message id "${messageId}".` } };
  }

  let quote: NormalizedQuote;
  try {
    quote = await fetchQuoteById(project.xeroSourceQuoteId);
  } catch (err) {
    const appError = toXeroAppError(err);
    if (appError.code === "not_connected") {
      return { status: "error", error: { code: "not_connected", message: appError.message } };
    }
    if (appError.code === "insufficient_scope") {
      return { status: "error", error: { code: "insufficient_permissions", message: appError.message } };
    }
    return { status: "error", error: { code: "source_quote_missing", message: appError.message } };
  }

  if (quote.lineItems.length === 0) {
    return {
      status: "error",
      error: { code: "quote_lines_missing", message: "The agreed quote has no line items to compare against." },
    };
  }

  let items: NormalizedItem[];
  try {
    const { client, tenantId } = await getAuthenticatedClient();
    // Sequential, not Promise.all — Xero enforces a per-app concurrent-
    // request limit and rejects bursts with a 429 "concurrent" error.
    const found = [];
    for (const code of REQUIRED_ITEM_CODES) {
      found.push(await findItemByCode(client, tenantId, code));
    }
    items = found.filter((item): item is NonNullable<typeof item> => item != null).map(normalizeItem);
  } catch (err) {
    const appError = toXeroAppError(err);
    if (appError.code === "not_connected") {
      return { status: "error", error: { code: "not_connected", message: appError.message } };
    }
    if (appError.code === "insufficient_scope") {
      return { status: "error", error: { code: "insufficient_permissions", message: appError.message } };
    }
    return { status: "error", error: { code: "pricing_item_missing", message: appError.message } };
  }

  const requests = analyseDemoMessage({ quote, items });

  const variationLines: PricedVariationLine[] = [];
  for (const request of requests) {
    if (request.classification !== "LIKELY_VARIATION" || !request.matchedItemCode) continue;
    const item = findXeroItemByCode(items, request.matchedItemCode);
    if (!item) continue;
    const line = calculateVariationLine(request, item);
    if (line) variationLines.push(line);
  }

  const result: ScopeDiffResult = {
    projectId: project.slug,
    sourceQuoteId: project.xeroSourceQuoteId,
    messageId: message.id,
    requests,
    variationLines,
    subtotal: calculateSubtotal(variationLines),
    analysedAt: new Date().toISOString(),
    analyser: "DETERMINISTIC_DEMO",
  };

  await prisma.scopeAnalysis.upsert({
    where: { demoProjectId_messageId: { demoProjectId: project.id, messageId: message.id } },
    create: {
      demoProjectId: project.id,
      messageId: message.id,
      analyserType: result.analyser,
      resultJson: JSON.stringify(result),
    },
    update: {
      analyserType: result.analyser,
      resultJson: JSON.stringify(result),
    },
  });

  return { status: "ok", result };
}

export async function loadStoredScopeDiff(slug: string, messageId: string): Promise<ScopeDiffResult | null> {
  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) return null;
  const row = await prisma.scopeAnalysis.findUnique({
    where: { demoProjectId_messageId: { demoProjectId: project.id, messageId } },
  });
  if (!row) return null;
  return JSON.parse(row.resultJson) as ScopeDiffResult;
}

export async function resetScopeDiff(slug: string, messageId: string): Promise<void> {
  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) return;
  await prisma.scopeAnalysis.deleteMany({ where: { demoProjectId: project.id, messageId } });
}
