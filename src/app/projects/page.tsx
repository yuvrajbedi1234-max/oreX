import Link from "next/link";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/lib/prisma";

// Reads live DB state on every request — without this, Next.js would
// statically prerender the list once at build time and never show newly
// seeded projects.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.demoProject.findMany({ orderBy: { createdAt: "asc" } });

  if (projects.length === 0) {
    return (
      <ComingSoon
        title="Projects"
        description="Linked Xero quotes and their scope boundaries will live here. Seed the demo scenario on the Demo page to see one."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Projects</h1>
        <p className="mt-1 text-sm text-slate-400">Projects linked to a Xero quote.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Link key={project.slug} href={`/projects/${project.slug}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink-900">{project.name}</h2>
                  <Badge tone={project.status === "ACTIVE" ? "green" : "neutral"}>{project.status}</Badge>
                </div>
                <p className="text-xs text-ink-500">Quote {project.xeroSourceQuoteNumber || "—"}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
