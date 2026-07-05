import "server-only";
import { DEMO_NEXT_PHASE_MESSAGE } from "@/lib/demo/demo-types";

// Server-side conversation fixture — deliberately not embedded in a React
// component. Phase 4 can add more messages/ids without touching the UI,
// which only ever receives a plain DemoMessage object as a prop.
export const DEMO_MESSAGE_ID = "demo-message-001";

export interface DemoMessage {
  id: string;
  fromName: string;
  text: string;
  sentAt: string;
}

const FIXED_MESSAGE: DemoMessage = {
  id: DEMO_MESSAGE_ID,
  fromName: "Baker & Co",
  text: DEMO_NEXT_PHASE_MESSAGE,
  sentAt: "2026-07-04T09:15:00.000Z",
};

export function getDemoMessage(messageId: string): DemoMessage | null {
  return messageId === DEMO_MESSAGE_ID ? FIXED_MESSAGE : null;
}

// Phase 4 — the AI analyser can run against an arbitrary client message,
// not just the fixed demo one. A custom message gets a stable id derived
// from its text so re-analysing the same message overwrites the same stored
// row (the ScopeAnalysis unique key is demoProjectId + messageId) instead of
// piling up duplicates.
const CUSTOM_MESSAGE_PREFIX = "custom-";

function stableHash(text: string): string {
  // djb2 — small, dependency-free, and stable across runs. Good enough to
  // key local storage; not used for anything security-sensitive.
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function isCustomMessageId(messageId: string): boolean {
  return messageId.startsWith(CUSTOM_MESSAGE_PREFIX);
}

// Builds a DemoMessage for arbitrary client text. If the text matches the
// fixed demo message, the canonical demo id/fixture is reused so both entry
// points resolve to the same stored analysis.
export function buildClientMessage(text: string, sentAt: string): DemoMessage {
  const trimmed = text.trim();
  if (trimmed === FIXED_MESSAGE.text) return FIXED_MESSAGE;
  return {
    id: `${CUSTOM_MESSAGE_PREFIX}${stableHash(trimmed)}`,
    fromName: FIXED_MESSAGE.fromName,
    text: trimmed,
    sentAt,
  };
}
