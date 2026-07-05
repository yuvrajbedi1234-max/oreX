import { NextRequest, NextResponse } from "next/server";
import { createVariation } from "@/lib/variations/build-variation";
import type { ApprovedLine, VariationErrorCode } from "@/components/variation-review/types";

const STATUS_BY_CODE: Record<VariationErrorCode, number> = {
  project_not_found: 404,
  analysis_missing: 409,
  not_connected: 409,
  insufficient_permissions: 403,
  source_quote_missing: 404,
  contact_missing: 404,
  pricing_item_missing: 404,
  no_lines: 400,
  invalid_line: 400,
  already_exists: 409,
  unknown: 502,
};

interface CreateVariationBody {
  messageId?: string;
  lines?: ApprovedLine[];
  createAnother?: boolean;
}

// Creates a DRAFT variation quote in Xero from owner-approved lines. This is
// the ONLY endpoint that writes to Xero in this flow, and it only ever
// inserts a new DRAFT — it never authorises, sends, or edits the original
// quote. Duplicate protection lives in createVariation().
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: CreateVariationBody;
  try {
    body = (await request.json()) as CreateVariationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "invalid_line" }, { status: 400 });
  }

  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  if (!messageId) {
    return NextResponse.json({ error: "Missing messageId.", code: "invalid_line" }, { status: 400 });
  }

  const outcome = await createVariation(slug, messageId, {
    lines: Array.isArray(body.lines) ? body.lines : [],
    createAnother: body.createAnother === true,
  });

  if (outcome.status === "error") {
    return NextResponse.json(
      { error: outcome.error.message, code: outcome.error.code },
      { status: STATUS_BY_CODE[outcome.error.code] }
    );
  }

  // 201 for a fresh create, 200 when an existing draft was returned
  // (idempotent — a duplicate submit did not create a second quote).
  return NextResponse.json(
    { status: outcome.status, variation: outcome.variation },
    { status: outcome.status === "created" ? 201 : 200 }
  );
}
