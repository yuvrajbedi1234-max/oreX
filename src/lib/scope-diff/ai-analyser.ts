import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedItem, NormalizedQuote } from "@/lib/xero/types";
import { AI_ANALYSIS_TOOL_SCHEMA, validateAiAnalysis } from "./ai-schema";
import type { DetectedRequest, ScopeDiffError } from "./types";

// Phase 4 — the AI extraction/classification layer. It replaces ONLY the
// deterministic analyser: given the real Xero quote, the available Xero
// items, and an arbitrary client message, it returns the same
// DetectedRequest[] shape everything downstream already consumes. It never
// prices anything, creates anything in Xero, or approves a variation.

const DEFAULT_MODEL = "claude-opus-4-8";
const TOOL_NAME = "report_scope_analysis";

export interface AiAnalyseInput {
  message: string;
  quote: NormalizedQuote;
  items: NormalizedItem[];
  projectName: string;
  customerName: string;
}

export type AiAnalyseResult =
  | { status: "ok"; requests: DetectedRequest[] }
  | { status: "error"; error: ScopeDiffError };

const SYSTEM_PROMPT = `You are ScopeLock's scope-comparison analyst for a small building/trades business.

You compare a client's message against an ALREADY ACCEPTED Xero quote and decide, for each distinct request, whether it is already covered by the quote (INCLUDED), appears to be extra work outside the quote (LIKELY_VARIATION), or you are not confident (NEEDS_REVIEW).

You MAY: extract distinct requests from the message, compare their meaning to the agreed quote lines, classify each one, explain your reasoning in plain language, and suggest the single most appropriate item code from the provided "Available Xero Items" list to price a variation.

You MUST NOT: invent prices, calculate totals, create or send Xero documents, approve variations, or invent an item code that is not in the provided list. Pricing is always retrieved from Xero later — you only ever suggest an item code.

Rules:
- Only mark something LIKELY_VARIATION when the agreed quote does not already cover it. If the quote clearly includes it, mark INCLUDED.
- If you are genuinely uncertain, use NEEDS_REVIEW with a lower confidence rather than guessing. Never claim something is definitely outside scope when uncertain.
- Set suggestedItemCode ONLY to a code that appears in "Available Xero Items", and only when that item genuinely matches the requested work. Otherwise use null.
- Set matchedQuoteLineId to the lineItemId of the most relevant agreed quote line, or null.
- Quote real snippets from the quote lines or items in the evidence.

Call the ${TOOL_NAME} tool exactly once with your full analysis.`;

function buildUserContent(input: AiAnalyseInput): string {
  const quoteLines = input.quote.lineItems
    .map((line, index) => {
      const parts = [
        `  ${index + 1}. lineItemId=${line.lineItemId ?? "unknown"}`,
        `description=${JSON.stringify(line.description ?? "")}`,
        `quantity=${line.quantity ?? "?"}`,
        line.itemCode ? `itemCode=${line.itemCode}` : null,
      ].filter(Boolean);
      return parts.join(" · ");
    })
    .join("\n");

  const itemLines = input.items
    .map(
      (item) =>
        `  - code=${item.code ?? "?"} · name=${JSON.stringify(item.name ?? "")} · description=${JSON.stringify(
          item.salesDescription ?? item.description ?? ""
        )}`
    )
    .join("\n");

  return [
    `PROJECT: ${input.projectName}`,
    `CUSTOMER: ${input.customerName}`,
    `AGREED QUOTE: ${input.quote.quoteNumber ?? "unknown"} (status ${input.quote.status ?? "unknown"})`,
    "",
    "AGREED QUOTE LINES (the accepted scope of work):",
    quoteLines || "  (none)",
    "",
    "AVAILABLE XERO ITEMS (the only codes you may suggest — prices are NOT shown because you never price anything):",
    itemLines || "  (none)",
    "",
    "CLIENT MESSAGE TO ANALYSE:",
    JSON.stringify(input.message),
  ].join("\n");
}

// Runs the AI analysis. Returns a typed error (never throws) so callers can
// fall back to the deterministic analyser or surface a clean message.
export async function analyseWithAI(input: AiAnalyseInput): Promise<AiAnalyseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      status: "error",
      error: {
        code: "ai_unavailable",
        message:
          "AI analysis isn't configured — set ANTHROPIC_API_KEY in your environment, or switch to the Deterministic Demo analyser.",
      },
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.SCOPELOCK_AI_MODEL?.trim() || DEFAULT_MODEL;

  // Cast through unknown to the SDK's Tool type: our schema is a readonly
  // `as const` literal, which isn't directly assignable to the mutable
  // InputSchema shape but is structurally correct at runtime.
  const tools = [
    {
      name: TOOL_NAME,
      description: "Report the structured scope analysis for the client message.",
      input_schema: AI_ANALYSIS_TOOL_SCHEMA,
    },
  ] as unknown as Anthropic.Tool[];

  let raw: unknown;
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: buildUserContent(input) }],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return {
        status: "error",
        error: { code: "ai_invalid_output", message: "The AI did not return a structured analysis." },
      };
    }
    raw = toolUse.input;
  } catch (err) {
    // Never leak the API key or raw SDK error to the client.
    console.error("AI analyser call failed:", err);
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return {
        status: "error",
        error: {
          code: "ai_unavailable",
          message: "The configured ANTHROPIC_API_KEY was rejected. Check it, or switch to the Deterministic Demo analyser.",
        },
      };
    }
    return {
      status: "error",
      error: {
        code: "ai_unavailable",
        message: "Couldn't reach the AI service. Try again, or switch to the Deterministic Demo analyser.",
      },
    };
  }

  const validated = validateAiAnalysis(raw, { quote: input.quote, items: input.items });
  if (!validated.ok) {
    return {
      status: "error",
      error: { code: "ai_invalid_output", message: `The AI returned invalid output and it was rejected. ${validated.reason}` },
    };
  }

  return { status: "ok", requests: validated.requests };
}
