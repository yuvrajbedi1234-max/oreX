import { Badge } from "@/components/ui/Badge";
import type { SeedStepStatus } from "./types";

export function StatusBadge({ status }: { status: SeedStepStatus }) {
  switch (status) {
    case "CREATED":
      return <Badge tone="cyan">Created</Badge>;
    case "FOUND":
      return <Badge tone="green">Found</Badge>;
    case "UPDATED":
      return <Badge tone="green">Updated</Badge>;
    case "MANUAL_ACTION_REQUIRED":
      return <Badge tone="orange">Manual action required</Badge>;
    case "FAILED":
      return <Badge tone="danger">Failed</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
