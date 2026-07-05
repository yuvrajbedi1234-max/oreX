import { NextRequest, NextResponse } from "next/server";
import { buildScopeDiff, loadStoredScopeDiff, resetScopeDiff } from "@/lib/scope-diff/build-scope-diff";
import { DEMO_MESSAGE_ID } from "@/lib/scope-diff/demo-message";
import type { ScopeAnalyserType, ScopeDiffErrorCode } from "@/lib/scope-diff/types";

const STATUS_BY_CODE: Record<ScopeDiffErrorCode, number> = {
  project_not_found: 404,
  not_connected: 409,
  source_quote_missing: 404,
  quote_lines_missing: 404,
  pricing_item_missing: 404,
  insufficient_permissions: 403,
  invalid_message: 400,
  // AI analysis isn't configured / the model call failed → treat as a
  // temporarily-unavailable dependency; the UI offers the deterministic
  // fallback. Bad AI output is an upstream (502) failure.
  ai_unavailable: 503,
  ai_invalid_output: 502,
  unknown: 502,
};

interface ScopeDiffRequestBody {
  messageId?: string;
  messageText?: string;
  analyser?: ScopeAnalyserType;
}

function normalizeAnalyser(value: unknown): ScopeAnalyserType | undefined {
  return value === "AI" || value === "DETERMINISTIC_DEMO" ? value : undefined;
}

// Runs the Scope Diff analysis: real Xero quote + real Xero pricing items +
// the selected analyser (AI by default, deterministic as a fallback). Never
// creates, sends, or authorises anything in Xero.
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let messageId: string | undefined = DEMO_MESSAGE_ID;
  let messageText: string | undefined;
  let analyser: ScopeAnalyserType | undefined;
  try {
    const body = (await request.json()) as ScopeDiffRequestBody;
    if (body.messageId) messageId = body.messageId;
    if (typeof body.messageText === "string" && body.messageText.trim()) messageText = body.messageText;
    analyser = normalizeAnalyser(body.analyser);
  } catch {
    // No/invalid JSON body — fall back to the default demo message id.
  }

  const outcome = await buildScopeDiff(slug, { messageId, messageText, analyser });
  if (outcome.status === "error") {
    return NextResponse.json(
      { error: outcome.error.message, code: outcome.error.code },
      { status: STATUS_BY_CODE[outcome.error.code] }
    );
  }
  return NextResponse.json(outcome.result);
}

// Loads the last stored analysis for this project/message, if any — never
// runs a new analysis or talks to Xero.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const messageId = request.nextUrl.searchParams.get("messageId") ?? DEMO_MESSAGE_ID;
  const result = await loadStoredScopeDiff(slug, messageId);
  return NextResponse.json({ result });
}

// Resets (deletes) only the stored local analysis — never touches Xero.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const messageId = request.nextUrl.searchParams.get("messageId") ?? DEMO_MESSAGE_ID;
  await resetScopeDiff(slug, messageId);
  return NextResponse.json({ success: true });
}
