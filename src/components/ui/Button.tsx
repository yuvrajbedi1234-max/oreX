import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-cyan-500 text-white hover:bg-cyan-400 disabled:bg-ink-500/40",
  secondary:
    "bg-transparent text-ink-900 ring-1 ring-inset ring-surface-border hover:bg-surface-muted disabled:text-ink-500",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-ink-500/40",
  ghost: "bg-transparent text-ink-700 hover:bg-surface-muted",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
