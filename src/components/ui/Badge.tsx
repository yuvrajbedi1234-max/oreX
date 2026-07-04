import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "cyan" | "orange" | "green" | "neutral" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  cyan: "bg-cyan-400/10 text-cyan-500 ring-1 ring-inset ring-cyan-400/30",
  orange: "bg-orange-400/10 text-orange-500 ring-1 ring-inset ring-orange-400/30",
  green: "bg-green-400/10 text-green-500 ring-1 ring-inset ring-green-400/30",
  neutral: "bg-ink-500/10 text-ink-700 ring-1 ring-inset ring-ink-500/20",
  danger: "bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/30",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}
