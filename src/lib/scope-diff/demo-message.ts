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
