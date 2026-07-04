import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { DemoMessage, ProjectSummary } from "./types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function ConversationPanel({
  project,
  message,
  requestCount,
}: {
  project: ProjectSummary;
  message: DemoMessage;
  requestCount: number | null;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Client conversation"
        subtitle={project.name}
        action={
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-500">
            {initials(message.fromName)}
          </div>
        }
      />
      <CardBody className="flex flex-1 flex-col gap-3">
        <p className="text-xs font-medium text-ink-500">{message.fromName}</p>
        <div className="rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-3 text-sm text-ink-900 ring-1 ring-inset ring-surface-border">
          {message.text}
        </div>
        <p className="text-xs text-ink-500">
          {new Date(message.sentAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        {requestCount != null && (
          <div>
            <Badge tone="cyan">{requestCount} work request{requestCount === 1 ? "" : "s"} detected</Badge>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
