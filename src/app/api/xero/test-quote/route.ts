import { NextRequest, NextResponse } from "next/server";
import { createTestDraftQuote } from "@/lib/xero/queries";
import { xeroErrorResponse } from "@/lib/xero/route-helpers";

interface TestQuoteRequestBody {
  contactId?: string;
  confirmed?: boolean;
}

export async function POST(request: NextRequest) {
  let body: TestQuoteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.contactId) {
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }
  if (body.confirmed !== true) {
    return NextResponse.json(
      { error: "You must confirm this is a Xero Demo Company or test organisation before creating a test quote." },
      { status: 400 }
    );
  }

  try {
    const quote = await createTestDraftQuote(body.contactId);
    return NextResponse.json({ quote });
  } catch (err) {
    return xeroErrorResponse(err);
  }
}
