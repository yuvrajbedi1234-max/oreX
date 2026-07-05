import Link from "next/link";
import { DEMO_MESSAGE_ID } from "@/lib/scope-diff/demo-message";
import { loadVariationReview } from "@/lib/variations/build-variation";
import { VariationReview } from "@/components/variation-review/VariationReview";

// Reads live Xero data (customer, quote, pricing) on every request — must
// never be statically cached.
export const dynamic = "force-dynamic";

export default async function VariationReviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ messageId?: string }>;
}) {
  const { slug } = await params;
  const { messageId: rawMessageId } = await searchParams;
  const messageId = rawMessageId ?? DEMO_MESSAGE_ID;

  const result = await loadVariationReview(slug, messageId);

  if (result.status === "error") {
    const isMissingAnalysis = result.error.code === "analysis_missing";
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Variation review</h1>
          <p className="mt-1 text-sm text-slate-400">{slug}</p>
        </div>
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {result.error.message}
        </div>
        {isMissingAnalysis ? (
          <Link href={`/projects/${slug}/scope-diff`} className="text-sm text-cyan-400 underline">
            Go to Scope Diff and run an analysis first
          </Link>
        ) : (
          <Link href="/xero" className="text-sm text-cyan-400 underline">
            Check Xero Connection
          </Link>
        )}
      </div>
    );
  }

  return <VariationReview data={result.data} messageId={messageId} />;
}
