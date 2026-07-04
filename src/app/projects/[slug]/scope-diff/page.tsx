import Link from "next/link";
import { loadProjectDetail } from "@/lib/demo/project-detail";
import { DEMO_MESSAGE_ID, getDemoMessage } from "@/lib/scope-diff/demo-message";
import { ScopeDiffPage } from "@/components/scope-diff/ScopeDiffPage";
import type { ProjectSummary } from "@/components/scope-diff/types";

// Reads live Xero data on every request — this must never be statically cached.
export const dynamic = "force-dynamic";

export default async function ScopeDiffRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadProjectDetail(slug);
  const message = getDemoMessage(DEMO_MESSAGE_ID);

  if (detail.status === "not_found") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Project not found</h1>
        <p className="text-sm text-slate-400">
          No local project is linked to &ldquo;{slug}&rdquo; yet.{" "}
          <Link href="/demo" className="text-cyan-400 underline">
            Set up the demo scenario
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  if (detail.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Couldn&apos;t load this project</h1>
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {detail.message}
        </div>
        <Link href="/xero" className="text-sm text-cyan-400 underline">
          Check Xero Connection
        </Link>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">No demo message configured</h1>
        <p className="text-sm text-slate-400">This shouldn&apos;t happen — the fixed demo message id is missing.</p>
      </div>
    );
  }

  const { project, customer, quote } = detail.detail;

  const projectSummary: ProjectSummary = {
    slug: project.slug,
    name: project.name,
    customerName: customer.name ?? "Unknown customer",
    quoteNumber: quote.quoteNumber ?? "",
    quoteStatus: quote.status,
    quoteTotal: quote.total,
    quoteDate: quote.date,
    lineItems: quote.lineItems.map((line) => ({
      lineItemId: line.lineItemId,
      description: line.description,
      quantity: line.quantity,
      unitAmount: line.unitAmount,
      lineAmount: line.lineAmount,
      itemCode: line.itemCode,
    })),
  };

  return <ScopeDiffPage project={projectSummary} message={message} messageId={message.id} />;
}
