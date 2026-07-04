import "server-only";
import { QuoteStatusCodes } from "xero-node";
import { getAuthenticatedClient } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { prisma } from "@/lib/prisma";
import {
  DEMO_CONTACT_EMAIL,
  DEMO_CONTACT_NAME,
  DEMO_ITEMS,
  DEMO_QUOTE_LINES,
  DEMO_QUOTE_TITLE,
  DEMO_SEED_REFERENCE,
  DEMO_SLUG,
  type SeedResult,
  type SeedStepId,
  type SeedStepResult,
} from "./demo-types";
import { findContactByEmail, findItemByCode, findQuoteByReference, findSalesAccountCode } from "./xero-lookups";

const ITEM_STEP_IDS: Record<string, SeedStepId> = {
  "LED-PACK": "item:LED-PACK",
  "SOCKET-MOVE": "item:SOCKET-MOVE",
  "HANDLE-BLACK": "item:HANDLE-BLACK",
  "PAINT-HALL": "item:PAINT-HALL",
  "EXTRA-CAB": "item:EXTRA-CAB",
};

// Finds-or-creates the whole demo scenario (Baker & Co, the 5 pricing
// items, the kitchen quote) and links it to a local DemoProject row. Safe
// to run repeatedly — every step looks for an existing record before
// creating one, so re-running never creates duplicates.
export async function runDemoSeed(): Promise<SeedResult> {
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

  let salesAccountCode: string;
  try {
    const account = await findSalesAccountCode(client, tenantId);
    if (!account?.code) {
      steps.push({
        step: "salesAccount",
        label: "Default sales account",
        status: "FAILED",
        message:
          "No active revenue account found in this Xero organisation. Create a sales/revenue account (Accounting > Chart of Accounts) and retry.",
      });
      return { steps, success: false };
    }
    salesAccountCode = account.code;
    steps.push({
      step: "salesAccount",
      label: "Default sales account",
      status: "FOUND",
      xeroId: account.accountID,
      message: `Using account ${account.code} (${account.name ?? "unnamed"})`,
    });
  } catch (err) {
    steps.push({
      step: "salesAccount",
      label: "Default sales account",
      status: "FAILED",
      message: toXeroAppError(err).message,
    });
    return { steps, success: false };
  }

  let contactId: string;
  try {
    const existing = await findContactByEmail(client, tenantId, DEMO_CONTACT_EMAIL);
    if (existing?.contactID) {
      contactId = existing.contactID;
      steps.push({
        step: "contact",
        label: `Demo customer (${DEMO_CONTACT_NAME})`,
        status: "FOUND",
        xeroId: contactId,
      });
    } else {
      const res = await client.accountingApi.createContacts(tenantId, {
        contacts: [{ name: DEMO_CONTACT_NAME, emailAddress: DEMO_CONTACT_EMAIL }],
      });
      const created = res.body.contacts?.[0];
      if (!created?.contactID) throw new Error("Xero did not return the created contact.");
      contactId = created.contactID;
      steps.push({
        step: "contact",
        label: `Demo customer (${DEMO_CONTACT_NAME})`,
        status: "CREATED",
        xeroId: contactId,
      });
    }
  } catch (err) {
    steps.push({
      step: "contact",
      label: `Demo customer (${DEMO_CONTACT_NAME})`,
      status: "FAILED",
      message: toXeroAppError(err).message,
    });
    return { steps, success: false };
  }

  let allItemsOk = true;
  for (const spec of DEMO_ITEMS) {
    const stepId = ITEM_STEP_IDS[spec.code];
    try {
      const existing = await findItemByCode(client, tenantId, spec.code);
      if (existing?.itemID) {
        steps.push({ step: stepId, label: spec.name, status: "FOUND", xeroId: existing.itemID });
        continue;
      }
      const res = await client.accountingApi.createItems(tenantId, {
        items: [
          {
            code: spec.code,
            name: spec.name,
            description: spec.salesDescription,
            salesDetails: {
              unitPrice: spec.salesUnitPrice,
              accountCode: salesAccountCode,
            },
          },
        ],
      });
      const created = res.body.items?.[0];
      if (!created?.itemID) throw new Error("Xero did not return the created item.");
      steps.push({ step: stepId, label: spec.name, status: "CREATED", xeroId: created.itemID });
    } catch (err) {
      allItemsOk = false;
      steps.push({ step: stepId, label: spec.name, status: "FAILED", message: toXeroAppError(err).message });
    }
  }
  if (!allItemsOk) {
    return { steps, success: false };
  }

  let quoteId: string;
  let quoteNumber: string;
  try {
    const existingQuote = await findQuoteByReference(client, tenantId, contactId, DEMO_SEED_REFERENCE);
    if (existingQuote?.quoteID) {
      quoteId = existingQuote.quoteID;
      quoteNumber = existingQuote.quoteNumber ?? "";
      steps.push({
        step: "quote",
        label: DEMO_QUOTE_TITLE,
        status: "FOUND",
        xeroId: quoteId,
        message: `Status: ${existingQuote.status}`,
      });
    } else {
      const issueDate = new Date().toISOString().slice(0, 10);
      const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const basePayload = {
        contact: { contactID: contactId },
        reference: DEMO_SEED_REFERENCE,
        title: DEMO_QUOTE_TITLE,
        summary: DEMO_QUOTE_TITLE,
        date: issueDate,
        expiryDate,
        lineItems: DEMO_QUOTE_LINES.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          accountCode: salesAccountCode,
          itemCode: line.itemCode,
          taxType: "NONE",
        })),
      };

      let manualActionNeeded = false;
      let created;
      try {
        const res = await client.accountingApi.createQuotes(tenantId, {
          quotes: [{ ...basePayload, status: QuoteStatusCodes.ACCEPTED }],
        });
        created = res.body.quotes?.[0];
        // Xero can accept the request without erroring but still silently
        // create the quote as DRAFT — check the actual returned status,
        // not just whether the call threw.
        if (created?.status !== QuoteStatusCodes.ACCEPTED) {
          manualActionNeeded = true;
        }
      } catch {
        // Xero rejected creating a quote directly in ACCEPTED status —
        // fall back to DRAFT and flag the one manual step this needs.
        const res = await client.accountingApi.createQuotes(tenantId, {
          quotes: [{ ...basePayload, status: QuoteStatusCodes.DRAFT }],
        });
        created = res.body.quotes?.[0];
        manualActionNeeded = true;
      }

      if (!created?.quoteID) throw new Error("Xero did not return the created quote.");
      quoteId = created.quoteID;
      quoteNumber = created.quoteNumber ?? "";

      steps.push({
        step: "quote",
        label: DEMO_QUOTE_TITLE,
        status: manualActionNeeded ? "MANUAL_ACTION_REQUIRED" : "CREATED",
        xeroId: quoteId,
        message: manualActionNeeded
          ? `Created as ${created.status} — Xero didn't create it as ACCEPTED directly. Open quote ${quoteNumber} in Xero and mark it Accepted to match the demo story.`
          : undefined,
      });
    }
  } catch (err) {
    steps.push({
      step: "quote",
      label: DEMO_QUOTE_TITLE,
      status: "FAILED",
      message: toXeroAppError(err).message,
    });
    return { steps, success: false };
  }

  try {
    await prisma.demoProject.upsert({
      where: { slug: DEMO_SLUG },
      create: {
        slug: DEMO_SLUG,
        name: DEMO_QUOTE_TITLE,
        status: "ACTIVE",
        xeroTenantId: tenantId,
        xeroContactId: contactId,
        xeroSourceQuoteId: quoteId,
        xeroSourceQuoteNumber: quoteNumber,
        seedReference: DEMO_SEED_REFERENCE,
      },
      update: {
        xeroTenantId: tenantId,
        xeroContactId: contactId,
        xeroSourceQuoteId: quoteId,
        xeroSourceQuoteNumber: quoteNumber,
      },
    });
    steps.push({ step: "projectLink", label: "Project linked locally", status: "UPDATED" });
  } catch (err) {
    steps.push({
      step: "projectLink",
      label: "Project linked locally",
      status: "FAILED",
      message: err instanceof Error ? err.message : "Failed to save the local project link.",
    });
    return { steps, success: false };
  }

  return { steps, success: steps.every((s) => s.status !== "FAILED") };
}
