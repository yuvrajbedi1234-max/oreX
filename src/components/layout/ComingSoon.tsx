import { Card, CardBody } from "@/components/ui/Card";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <Card>
        <CardBody className="flex flex-col items-start gap-2 py-10">
          <span className="text-sm font-semibold text-ink-900">Coming in a later phase</span>
          <p className="max-w-xl text-sm text-ink-700">
            Phase 1 focuses on the Xero-connected foundation. This screen will come alive once
            scope comparison and messaging intake are built on top of it — see{" "}
            <span className="font-medium text-ink-900">Xero Connection</span> for what already works.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
