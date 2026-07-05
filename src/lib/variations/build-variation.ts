import "server-only";
import { prisma } from "@/lib/prisma";
import { XeroAppError } from "@/lib/xero/errors";
import { createVariationDraftQuote, type VariationDraftLine } from "@/lib/xero/queries";
import { loadProjectDetail } from "@/lib/demo/project-detail";
import { loadStoredScopeDiff } from "@/lib/scope-diff/build-scope-diff";
import type {
  ApprovedLine,
  CatalogueItem,
  VariationErrorCode,
  VariationRecord,
  VariationReviewData,
} from "@/components/variation-review/types";

export interface VariationError {
  code: VariationErrorCode;
  message: string;
}

export type LoadVariationReviewResult =
  | { status: "ok"; data: VariationReviewData }
  | { status: "error"; error: VariationError };

export type CreateVariationResult =
  | { status: "created"; variation: VariationRecord }
  | { status: "exists"; variation: VariationRecord }
  | { status: "error"; error: VariationError };

interface StoredVariationRow {
  revision: number;
  xeroQuoteId: string;
  xeroQuoteNumber: string;
  xeroQuoteStatus: string;
  title: string;
  reference: string;
  subtotal: number;
  totalTax: number;
  total: number;
  currencyCode: string | null;
  createdAt: Date;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function mapRecord(row: StoredVariationRow): VariationRecord {
  return {
    revision: row.revision,
    xeroQuoteId: row.xeroQuoteId,
    xeroQuoteNumber: row.xeroQuoteNumber,
    xeroQuoteStatus: row.xeroQuoteStatus,
    title: row.title,
    reference: row.reference,
    subtotal: row.subtotal,
    totalTax: row.totalTax,
    total: row.total,
    currencyCode: row.currencyCode,
    createdAt: row.createdAt.toISOString(),
  };
}

// Maps a Xero SDK failure onto our narrower variation error codes so nothing
// leaks and the UI can render a clear message.
function xeroErrorToVariationError(err: unknown): VariationError {
  if (err instanceof XeroAppError) {
    if (err.code === "not_connected") return { code: "not_connected", message: err.message };
    if (err.code === "insufficient_scope") return { code: "insufficient_permissions", message: err.message };
    if (err.code === "validation_error") return { code: "unknown", message: err.message };
    return { code: "source_quote_missing", message: err.message };
  }
  return { code: "unknown", message: "Something went wrong talking to Xero." };
}

async function latestVariationRow(demoProjectId: string, messageId: string) {
  return prisma.variation.findFirst({
    where: { demoProjectId, messageId },
    orderBy: { revision: "desc" },
  });
}

// Loads everything the review page renders: the stored scope diff, the live
// customer / original quote / pricing catalogue from Xero, and any variation
// that was already created for this message. Read-only — never writes to Xero.
export async function loadVariationReview(slug: string, messageId: string): Promise<LoadVariationReviewResult> {
  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) {
    return { status: "error", error: { code: "project_not_found", message: `No project found for "${slug}".` } };
  }

  const stored = await loadStoredScopeDiff(slug, messageId);
  if (!stored) {
    return {
      status: "error",
      error: { code: "analysis_missing", message: "No scope analysis found — run Scope Diff for this message first." },
    };
  }

  const detail = await loadProjectDetail(slug);
  if (detail.status === "not_found") {
    return { status: "error", error: { code: "project_not_found", message: "Project link not found." } };
  }
  if (detail.status === "error") {
    return { status: "error", error: { code: "source_quote_missing", message: detail.message } };
  }

  const catalogue: CatalogueItem[] = detail.detail.pricingCatalogue
    .filter((item) => Boolean(item.code))
    .map((item) => ({
      code: item.code as string,
      name: item.name ?? (item.code as string),
      description: item.salesDescription ?? item.description ?? null,
      unitPrice: item.salesUnitPrice,
      accountCode: item.salesAccountCode,
    }));

  const existing = await latestVariationRow(project.id, messageId);

  const data: VariationReviewData = {
    project: { slug: project.slug, name: project.name },
    customerName: detail.detail.customer.name ?? project.name,
    originalQuote: {
      id: detail.detail.quote.quoteId ?? stored.sourceQuoteId,
      number: detail.detail.quote.quoteNumber ?? "",
      currencyCode: detail.detail.quote.currencyCode,
      total: detail.detail.quote.total,
    },
    message: { id: stored.messageId, text: stored.messageText ?? "" },
    analyser: stored.analyser,
    requests: stored.requests,
    variationLines: stored.variationLines,
    catalogue,
    existingVariation: existing ? mapRecord(existing) : null,
  };

  return { status: "ok", data };
}

export interface CreateVariationParams {
  lines: ApprovedLine[];
  // Deliberately create a new revision even though one already exists.
  createAnother?: boolean;
}

// Creates one DRAFT variation quote in Xero from owner-approved lines and
// records the returned QuoteID. Duplicate protection: if a variation already
// exists for this message and the caller didn't explicitly ask for another
// revision, the existing one is returned instead of creating a second quote.
export async function createVariation(
  slug: string,
  messageId: string,
  params: CreateVariationParams
): Promise<CreateVariationResult> {
  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) {
    return { status: "error", error: { code: "project_not_found", message: `No project found for "${slug}".` } };
  }

  // Idempotency gate — do not create another quote when one already exists,
  // unless a new revision was explicitly requested.
  const existing = await latestVariationRow(project.id, messageId);
  if (existing && !params.createAnother) {
    return { status: "exists", variation: mapRecord(existing) };
  }

  const detail = await loadProjectDetail(slug);
  if (detail.status === "not_found") {
    return { status: "error", error: { code: "project_not_found", message: "Project link not found." } };
  }
  if (detail.status === "error") {
    return { status: "error", error: { code: "source_quote_missing", message: detail.message } };
  }

  const contactId = detail.detail.customer.contactId;
  if (!contactId) {
    return { status: "error", error: { code: "contact_missing", message: "The customer has no Xero contact id." } };
  }

  const quoteNumber = detail.detail.quote.quoteNumber || "QUOTE";
  const catalogue = detail.detail.pricingCatalogue;

  if (!Array.isArray(params.lines) || params.lines.length === 0) {
    return { status: "error", error: { code: "no_lines", message: "Add at least one line before creating the variation." } };
  }

  const draftLines: VariationDraftLine[] = [];
  let subtotal = 0;

  for (const line of params.lines) {
    const description = typeof line.description === "string" ? line.description.trim() : "";
    const quantity = typeof line.quantity === "number" ? line.quantity : NaN;
    if (!description || !Number.isFinite(quantity) || quantity <= 0) {
      return { status: "error", error: { code: "invalid_line", message: "Every line needs a description and a quantity above zero." } };
    }

    let unitAmount: number;
    let accountCode: string | undefined;
    let itemCode: string | undefined;

    if (line.priceSource === "XERO_ITEM") {
      // Catalogue lines are ALWAYS priced from the live Xero item — the
      // client-sent unit price is ignored on purpose.
      if (!line.itemCode) {
        return { status: "error", error: { code: "invalid_line", message: "A Xero-priced line must have an item selected." } };
      }
      const item = catalogue.find((i) => i.code === line.itemCode);
      if (!item || item.salesUnitPrice == null) {
        return {
          status: "error",
          error: { code: "pricing_item_missing", message: `Couldn't price "${line.itemCode}" from Xero.` },
        };
      }
      unitAmount = item.salesUnitPrice;
      accountCode = item.salesAccountCode ?? undefined;
      itemCode = item.code ?? undefined;
    } else {
      // MANUAL — the owner entered a price because no approved item exists.
      unitAmount = typeof line.unitAmount === "number" ? line.unitAmount : NaN;
      if (!Number.isFinite(unitAmount) || unitAmount < 0) {
        return { status: "error", error: { code: "invalid_line", message: "Manual prices must be zero or more." } };
      }
    }

    const lineAmount = round2(quantity * unitAmount);
    subtotal += lineAmount;
    draftLines.push({ description, quantity, unitAmount, accountCode, itemCode });
  }

  subtotal = round2(subtotal);
  const revision = (existing?.revision ?? 0) + 1;
  const reference = `SCOPELOCK-VARIATION-${quoteNumber}-${pad2(revision)}`;
  const title = `Variation ${pad2(revision)} — ${project.name}`;
  const summary = `Variation related to original quote ${quoteNumber}`;

  let created;
  try {
    created = await createVariationDraftQuote({ contactId, title, reference, summary, lineItems: draftLines });
  } catch (err) {
    return { status: "error", error: xeroErrorToVariationError(err) };
  }

  try {
    const row = await prisma.variation.create({
      data: {
        demoProjectId: project.id,
        messageId,
        revision,
        xeroQuoteId: created.quoteId,
        xeroQuoteNumber: created.quoteNumber,
        xeroQuoteStatus: created.status,
        title: created.title,
        reference: created.reference,
        subtotal,
        totalTax: created.totalTax,
        total: created.total,
        currencyCode: created.currencyCode,
        linesJson: JSON.stringify(draftLines),
      },
    });
    return { status: "created", variation: mapRecord(row) };
  } catch {
    // A concurrent create won the unique (project, message, revision) race —
    // the draft still exists in Xero; surface the stored record instead of
    // erroring so the UI stays consistent.
    const again = await latestVariationRow(project.id, messageId);
    if (again) return { status: "exists", variation: mapRecord(again) };
    return { status: "error", error: { code: "unknown", message: "The variation was created in Xero but couldn't be recorded locally." } };
  }
}
