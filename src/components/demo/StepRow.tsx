import { StatusBadge } from "./StatusBadge";
import type { SeedStepResult } from "./types";

export function StepRow({ step }: { step: SeedStepResult }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-ink-900">{step.label}</span>
        <StatusBadge status={step.status} />
      </div>
      {step.message && <p className="text-xs text-ink-500">{step.message}</p>}
    </div>
  );
}
