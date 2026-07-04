import { NextRequest, NextResponse } from "next/server";
import { xeroErrorResponse } from "@/lib/xero/route-helpers";
import { fetchQuotes } from "@/lib/xero/queries";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const quotes = await fetchQuotes(status);
    return NextResponse.json({ quotes });
  } catch (err) {
    return xeroErrorResponse(err);
  }
}
