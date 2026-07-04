import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const STAT_CARDS = [
  { label: "Active projects", value: "—", tone: "cyan" as const },
  { label: "Scope requests to review", value: "—", tone: "orange" as const },
  { label: "Draft variations", value: "—", tone: "orange" as const },
  { label: "Confirmed in-scope", value: "—", tone: "green" as const },
];

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Catch scope creep before it becomes free work.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-500">{stat.label}</span>
                <Badge tone={stat.tone}>Phase 2</Badge>
              </div>
              <p className="mt-3 text-3xl font-semibold text-ink-900">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink-900">Phase 1: Xero foundation</h2>
          <p className="text-sm leading-relaxed text-ink-700">
            This build proves the Xero-connected foundation ScopeLock runs on: OAuth, encrypted
            token storage, and reading quotes, contacts and items straight from your organisation.
            Scope comparison, WhatsApp intake and AI-drafted variations arrive in later phases.
          </p>
          <div>
            <Link
              href="/xero"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
            >
              Go to Xero Connection
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
