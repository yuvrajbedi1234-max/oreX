import "server-only";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { fetchQuoteById } from "@/lib/xero/queries";
import { normalizeItem } from "@/lib/xero/normalize";
import type { NormalizedItem, NormalizedQuote } from "@/lib/xero/types";
import { findItemByCode } from "@/lib/demo/xero-lookups";
import { DEMO_ITEMS } from "@/lib/demo/demo-types";
import { analyseWithAI } from "./ai-analyser";
import { analyseDemoMessage } from "./deterministic-analyser";
import { buildClientMessage, DEMO_MESSAGE_ID, getDemoMessage } from "./demo-message";
import { calculateSubtotal, calculateVariationLine, findXeroItemByCode } from "./pricing";
import type { DetectedRequest, PricedVariationLine, ScopeAnalyserType, ScopeDiffError, ScopeDiffResult } from "./types";

export type ScopeDiffBuildResult = { status: "ok"; result: ScopeDiffResult } | { status: "error"; error: ScopeDiffError };

export interface BuildScopeDiffParams {
  // Which extraction/classification layer to run. Defaults to AI — the
  // deterministic analyser is kept as a fallback for development/demo.
  analyser?: ScopeAnalyserType;
  // Re-analyse a stored message by id (used for the fixed demo message).
  messageId?: string;
  // Analyse an arbitrary client message (AI only). Takes precedence over
  // messageId when provided.
  messageText?: string;
}

// The full seeded pricing catalogue. Phase 3 only needed the three codes the
// fixed message touched; the AI analyser can match any of them, so we load
// them all. Loading extra items never breaks the deterministic analyser,
// which still looks up just the codes it cares about.
const CATALOGUE_ITEM_CODES = DEMO_ITEMS.map((item) => item.code);

// Orchestrates one Scope Diff run: load the project, resolve the client
// message, retrieve the real Xero quote and pricing items, run the chosen
// analyser, price the result from Xero, and persist it. Every failure mode
// returns a typed error instead of throwing — callers (the API route)
// decide the HTTP status.
export async function buildScopeDiff(slug: string, params: BuildScopeDiffParams = {}): Promise<ScopeDiffBuildResult> {
  const analyser: ScopeAnalyserType = params.analyser ?? "AI";

  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) {
    return {
      status: "error",
      error: { code: "project_not_found", message: `No project found for "${slug}". Seed the demo scenario first.` },
    };
  }

  // Resolve the message. A custom messageText (AI only) is turned into a
  // message with a stable derived id; otherwise we use the fixed demo
  // fixture by id.
  const customText = params.messageText?.trim();
  const message = customText
    ? buildClientMessage(customText, new Date().toISOString())
    : getDemoMessage(params.messageId ?? DEMO_MESSAGE_ID);

  if (!message) {
    return { status: "error", error: { code: "invalid_message", message: `Unknown message id "${params.messageId}".` } };
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
    for (const code of CATALOGUE_ITEM_CODES) {
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

  // Run the chosen analyser. The AI analyser can fail (no key / bad output);
  // the deterministic analyser cannot. Both produce DetectedRequest[].
  let requests: DetectedRequest[];
  if (analyser === "AI") {
    const outcome = await analyseWithAI({
      message: message.text,
      quote,
      items,
      projectName: project.name,
      customerName: quote.contactName ?? project.name,
    });
    if (outcome.status === "error") {
      return { status: "error", error: outcome.error };
    }
    requests = outcome.requests;
  } else {
    requests = analyseDemoMessage({ quote, items });
  }

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
    messageText: message.text,
    requests,
    variationLines,
    subtotal: calculateSubtotal(variationLines),
    analysedAt: new Date().toISOString(),
    analyser,
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
