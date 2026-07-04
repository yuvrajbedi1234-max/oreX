import "server-only";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { normalizeItem } from "@/lib/xero/normalize";
import { fetchContactById, fetchQuoteById } from "@/lib/xero/queries";
import type { NormalizedContact, NormalizedItem, NormalizedQuote } from "@/lib/xero/types";
import { findItemByCode } from "./xero-lookups";
import { DEMO_ITEMS, DEMO_NEXT_PHASE_MESSAGE } from "./demo-types";

export interface ProjectDetail {
  project: {
    slug: string;
    name: string;
    status: string;
    seedReference: string;
  };
  customer: NormalizedContact;
  quote: NormalizedQuote;
  pricingCatalogue: NormalizedItem[];
  nextPhaseMessage: string;
}

export type ProjectDetailResult =
  | { status: "ok"; detail: ProjectDetail }
  | { status: "not_found" }
  | { status: "error"; message: string };

// Loads everything a project page needs: the local link record, plus the
// live Xero quote/contact/pricing it points at. Always resolves — Xero
// failures come back as a normal result, never an uncaught throw, so the
// page can render a clear error state instead of crashing.
export async function loadProjectDetail(slug: string): Promise<ProjectDetailResult> {
  const project = await prisma.demoProject.findUnique({ where: { slug } });
  if (!project) return { status: "not_found" };

  try {
    const { client, tenantId } = await getAuthenticatedClient();

    // Xero enforces a per-app concurrent-request limit — run these
    // sequentially rather than with Promise.all, which was tripping a 429
    // "concurrent" rate-limit error under real testing.
    const customer = await fetchContactById(project.xeroContactId);
    const quote = await fetchQuoteById(project.xeroSourceQuoteId);
    const pricingItems = [];
    for (const spec of DEMO_ITEMS) {
      pricingItems.push(await findItemByCode(client, tenantId, spec.code));
    }

    const pricingCatalogue = pricingItems
      .filter((item): item is NonNullable<typeof item> => item != null)
      .map(normalizeItem);

    return {
      status: "ok",
      detail: {
        project: {
          slug: project.slug,
          name: project.name,
          status: project.status,
          seedReference: project.seedReference,
        },
        customer,
        quote,
        pricingCatalogue,
        nextPhaseMessage: DEMO_NEXT_PHASE_MESSAGE,
      },
    };
  } catch (err) {
    return { status: "error", message: toXeroAppError(err).message };
  }
}
