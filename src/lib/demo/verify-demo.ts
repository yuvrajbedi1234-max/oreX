import "server-only";
import { getAuthenticatedClient } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { prisma } from "@/lib/prisma";
import {
  DEMO_CONTACT_EMAIL,
  DEMO_CONTACT_NAME,
  DEMO_ITEMS,
  DEMO_QUOTE_TITLE,
  DEMO_SEED_REFERENCE,
  DEMO_SLUG,
  type SeedResult,
  type SeedStepId,
  type SeedStepResult,
} from "./demo-types";
import { findContactByEmail, findItemByCode, findQuoteByReference } from "./xero-lookups";

const ITEM_STEP_IDS: Record<string, SeedStepId> = {
  "LED-PACK": "item:LED-PACK",
  "SOCKET-MOVE": "item:SOCKET-MOVE",
  "HANDLE-BLACK": "item:HANDLE-BLACK",
  "PAINT-HALL": "item:PAINT-HALL",
  "EXTRA-CAB": "item:EXTRA-CAB",
};

// Read-only counterpart to runDemoSeed — never creates or modifies
// anything, just reports what currently exists.
export async function runDemoVerify(): Promise<SeedResult> {
  const steps: SeedStepResult[] = [];

  let client: Awaited<ReturnType<typeof getAuthenticatedClient>>["client"];
  let tenantId: string;
  try {
    const auth = await getAuthenticatedClient();
    client = auth.client;
    tenantId = auth.tenantId;
    steps.push({ step: "xeroConnected", label: "Xero connected", status: "FOUND" });
  } catch (err) {
    steps.push({
      step: "xeroConnected",
      label: "Xero connected",
      status: "FAILED",
      message: toXeroAppError(err).message,
    });
    return { steps, success: false };
  }

  let contactId: string | null = null;
  try {
    const contact = await findContactByEmail(client, tenantId, DEMO_CONTACT_EMAIL);
    if (contact?.contactID) {
      contactId = contact.contactID;
      steps.push({
        step: "contact",
        label: `Demo customer (${DEMO_CONTACT_NAME})`,
        status: "FOUND",
        xeroId: contactId,
      });
    } else {
      steps.push({
        step: "contact",
        label: `Demo customer (${DEMO_CONTACT_NAME})`,
        status: "FAILED",
        message: "Not found in Xero yet — run Create demo scenario.",
      });
    }
  } catch (err) {
    steps.push({
      step: "contact",
      label: `Demo customer (${DEMO_CONTACT_NAME})`,
      status: "FAILED",
      message: toXeroAppError(err).message,
    });
  }

  for (const spec of DEMO_ITEMS) {
    const stepId = ITEM_STEP_IDS[spec.code];
    try {
      const existing = await findItemByCode(client, tenantId, spec.code);
      steps.push(
        existing?.itemID
          ? { step: stepId, label: spec.name, status: "FOUND", xeroId: existing.itemID }
          : { step: stepId, label: spec.name, status: "FAILED", message: "Not found in Xero yet." }
      );
    } catch (err) {
      steps.push({ step: stepId, label: spec.name, status: "FAILED", message: toXeroAppError(err).message });
    }
  }

  if (contactId) {
    try {
      const quote = await findQuoteByReference(client, tenantId, contactId, DEMO_SEED_REFERENCE);
      steps.push(
        quote?.quoteID
          ? {
              step: "quote",
              label: DEMO_QUOTE_TITLE,
              status: "FOUND",
              xeroId: quote.quoteID,
              message: `Status: ${quote.status}`,
            }
          : { step: "quote", label: DEMO_QUOTE_TITLE, status: "FAILED", message: "Not found in Xero yet." }
      );
    } catch (err) {
      steps.push({
        step: "quote",
        label: DEMO_QUOTE_TITLE,
        status: "FAILED",
        message: toXeroAppError(err).message,
      });
    }
  } else {
    steps.push({
      step: "quote",
      label: DEMO_QUOTE_TITLE,
      status: "FAILED",
      message: "Cannot check without the demo contact.",
    });
  }

  const project = await prisma.demoProject.findUnique({ where: { slug: DEMO_SLUG } });
  steps.push(
    project
      ? { step: "projectLink", label: "Project linked locally", status: "FOUND" }
      : {
          step: "projectLink",
          label: "Project linked locally",
          status: "FAILED",
          message: "No local project record yet — run Create demo scenario.",
        }
  );

  return { steps, success: steps.every((s) => s.status === "FOUND") };
}
