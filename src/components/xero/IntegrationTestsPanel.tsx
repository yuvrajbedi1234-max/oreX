import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { CheckResult, IntegrationCheck } from "./types";

const DEFAULT_CHECKS: IntegrationCheck[] = [
  { id: "quotes", label: "Quotes readable", result: "not_tested" },
  { id: "contacts", label: "Contacts readable", result: "not_tested" },
  { id: "items", label: "Items readable", result: "not_tested" },
  { id: "draftQuote", label: "Draft quote writable", result: "not_tested" },
];

function resultBadge(result: CheckResult) {
  if (result === "passed") return <Badge tone="green">Passed</Badge>;
  if (result === "failed") return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="neutral">Not tested</Badge>;
}

export function IntegrationTestsPanel({
  checks,
  running,
  disabled,
  onRun,
}: {
  checks: IntegrationCheck[] | null;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  const rows = checks ?? DEFAULT_CHECKS;

  return (
    <Card>
      <CardHeader
        title="Integration checks"
        subtitle="Reads a small amount of data. The write check only inspects permissions — it never creates a quote."
        action={
          <Button onClick={onRun} disabled={disabled || running}>
            {running ? "Running…" : "Run connection tests"}
          </Button>
        }
      />
      <CardBody className="flex flex-col divide-y divide-surface-border">
        {rows.map((check) => (
          <div key={check.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-900">{check.label}</span>
              {resultBadge(check.result)}
            </div>
            {check.message && <p className="text-xs text-ink-500">{check.message}</p>}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
