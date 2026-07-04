import { Suspense } from "react";
import { XeroDashboard } from "@/components/xero/XeroDashboard";

export default function XeroPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <XeroDashboard />
    </Suspense>
  );
}
