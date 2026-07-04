"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { RequestCard } from "./RequestCard";
import type { DetectedRequest } from "./types";

type Filter = "all" | "INCLUDED" | "LIKELY_VARIATION" | "NEEDS_REVIEW";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "INCLUDED", label: "Included" },
  { id: "LIKELY_VARIATION", label: "Variations" },
  { id: "NEEDS_REVIEW", label: "Needs review" },
];

export function ScopeAnalysisPanel({
  requests,
  selectedRequestId,
  onSelect,
}: {
  requests: DetectedRequest[];
  selectedRequestId: string | null;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      total: requests.length,
      included: requests.filter((r) => r.classification === "INCLUDED").length,
      variations: requests.filter((r) => r.classification === "LIKELY_VARIATION").length,
      needsReview: requests.filter((r) => r.classification === "NEEDS_REVIEW").length,
    }),
    [requests]
  );

  const visible = filter === "all" ? requests : requests.filter((r) => r.classification === filter);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Scope analysis"
        subtitle={`${counts.total} requests · ${counts.included} included · ${counts.variations} likely variation · ${counts.needsReview} needs review`}
      />
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter requests by classification">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
                filter === f.id
                  ? "bg-ink-900 text-white ring-ink-900"
                  : "bg-transparent text-ink-700 ring-surface-border hover:bg-surface-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {visible.length === 0 ? (
            <p className="text-sm text-ink-500">No requests match this filter.</p>
          ) : (
            visible.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                selected={selectedRequestId === request.id}
                onSelect={() => onSelect(request.id)}
              />
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}
