import { NextResponse } from "next/server";
import { getConfiguredScopes } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { fetchContacts, fetchItems, fetchQuotes } from "@/lib/xero/queries";
import { getConnection } from "@/lib/xero/token-store";
import type { IntegrationCheck } from "@/lib/xero/types";

async function runReadCheck(
  id: IntegrationCheck["id"],
  label: string,
  fn: () => Promise<unknown>
): Promise<IntegrationCheck> {
  try {
    await fn();
    return { id, label, result: "passed" };
  } catch (err) {
    const appError = toXeroAppError(err);
    return { id, label, result: "failed", message: appError.message };
  }
}

// The 4th check never writes to Xero — it only confirms the granted scope
// that quote creation would require, so this test button stays side-effect free.
function checkDraftQuoteWritable(scopeGranted: Set<string>): IntegrationCheck {
  const hasScope = scopeGranted.has("accounting.invoices");
  return {
    id: "draftQuote",
    label: "Draft quote writable",
    result: hasScope ? "passed" : "failed",
    message: hasScope
      ? "accounting.invoices scope is granted (Xero covers Quotes under this granular scope), so creating a draft quote should be permitted. This check only inspects permissions — no quote was created."
      : "accounting.invoices scope is missing. Update Xero permissions to allow creating quotes.",
  };
}

export async function POST() {
  const stored = await getConnection();
  if (!stored) {
    return NextResponse.json({ error: "Not connected to Xero." }, { status: 409 });
  }

  const [quotesCheck, contactsCheck, itemsCheck] = await Promise.all([
    runReadCheck("quotes", "Quotes readable", () => fetchQuotes()),
    runReadCheck("contacts", "Contacts readable", () => fetchContacts()),
    runReadCheck("items", "Items readable", () => fetchItems()),
  ]);

  let draftQuoteCheck: IntegrationCheck;
  try {
    const granted = new Set((stored.tokenSet.scope ?? "").split(" ").filter(Boolean));
    getConfiguredScopes();
    draftQuoteCheck = checkDraftQuoteWritable(granted);
  } catch (err) {
    const appError = toXeroAppError(err);
    draftQuoteCheck = { id: "draftQuote", label: "Draft quote writable", result: "failed", message: appError.message };
  }

  const checks: IntegrationCheck[] = [quotesCheck, contactsCheck, itemsCheck, draftQuoteCheck];
  return NextResponse.json({ checks });
}
