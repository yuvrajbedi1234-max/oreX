import { NextResponse } from "next/server";
import { fetchContacts } from "@/lib/xero/queries";
import { xeroErrorResponse } from "@/lib/xero/route-helpers";

export async function GET() {
  try {
    const contacts = await fetchContacts();
    return NextResponse.json({ contacts });
  } catch (err) {
    return xeroErrorResponse(err);
  }
}
