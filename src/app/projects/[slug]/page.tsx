import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { loadProjectDetail } from "@/lib/demo/project-detail";

// Reads live Xero data on every request — this must never be statically cached.
export const dynamic = "force-dynamic";

function statusTone(status: string | null) {
  if (status === "ACCEPTED" || status === "INVOICED") return "green" as const;
  if (status === "DECLINED" || status === "DELETED") return "danger" as const;
  if (status === "SENT") return "orange" as const;
  return "neutral" as const;
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadProjectDetail(slug);

  if (result.status === "not_found") {
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

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Couldn&apos;t load this project</h1>
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {result.message}
        </div>
        <Link href="/xero" className="text-sm text-cyan-400 underline">
          Check Xero Connection
        </Link>
      </div>
    );
  }

  const { project, customer, quote, pricingCatalogue, nextPhaseMessage } = result.detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
        <p className="mt-1 text-sm text-slate-400">{customer.name ?? "Unknown customer"}</p>
      </div>

      <Card>
        <CardHeader
          title="Source quote"
          subtitle={`Reference ${project.seedReference}`}
          action={<Badge tone={statusTone(quote.status)}>{quote.status ?? "—"}</Badge>}
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-500">Quote number</p>
              <p className="text-sm font-medium text-ink-900">{quote.quoteNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Issue date</p>
              <p className="text-sm font-medium text-ink-900">{quote.date ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Customer</p>
              <p className="text-sm font-medium text-ink-900">{customer.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total</p>
              <p className="text-sm font-medium text-ink-900">
                {quote.total != null ? `£${quote.total.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Agreed scope" subtitle="Read directly from the Xero quote — nothing here is AI-generated." />
        <CardBody>
          {quote.lineItems.length === 0 ? (
            <p className="text-sm text-ink-500">No line items on this quote.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-ink-500">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Item code</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit price</th>
                  <th className="pb-2 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {quote.lineItems.map((line, index) => (
                  <tr key={line.lineItemId ?? index}>
                    <td className="py-2 pr-2 text-ink-900">{line.description ?? "—"}</td>
                    <td className="py-2 pr-2 text-ink-500">{line.itemCode ?? "—"}</td>
                    <td className="py-2 text-right text-ink-900">{line.quantity ?? "—"}</td>
                    <td className="py-2 text-right text-ink-900">
                      {line.unitAmount != null ? `£${line.unitAmount.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 text-right font-medium text-ink-900">
                      {line.lineAmount != null ? `£${line.lineAmount.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Trusted pricing"
          subtitle="Prices retrieved from Xero — ScopeLock does not allow AI-generated pricing."
        />
        <CardBody>
          {pricingCatalogue.length === 0 ? (
            <p className="text-sm text-ink-500">No pricing items found — run the demo seed first.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-border">
              {pricingCatalogue.map((item) => (
                <li key={item.itemId ?? item.code} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{item.name ?? item.code}</p>
                    <p className="text-xs text-ink-500">
                      {item.salesDescription ?? "—"}
                      {item.salesAccountCode ? ` · Account ${item.salesAccountCode}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-ink-900">
                    {item.salesUnitPrice != null ? `£${item.salesUnitPrice.toFixed(2)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card muted>
        <CardHeader title="Client message" subtitle="Compare this request against the agreed scope above." />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm italic text-ink-700">&ldquo;{nextPhaseMessage}&rdquo;</p>
          <div>
            <Link
              href={`/projects/${project.slug}/scope-diff`}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
            >
              Open Scope Diff
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
