import { NextResponse } from "next/server";
import { fetchItems } from "@/lib/xero/queries";
import { xeroErrorResponse } from "@/lib/xero/route-helpers";

export async function GET() {
  try {
    const items = await fetchItems();
    return NextResponse.json({ items });
  } catch (err) {
    return xeroErrorResponse(err);
  }
}
