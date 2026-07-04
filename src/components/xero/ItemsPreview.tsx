import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Item } from "./types";

export function ItemsPreview({
  items,
  error,
  connected,
}: {
  items: Item[] | null;
  error: string | null;
  connected: boolean;
}) {
  return (
    <Card>
      <CardHeader title="Xero items" subtitle="Approved pricing to pull into variation quotes." />
      <CardBody>
        {!connected && <p className="text-sm text-ink-500">Connect to Xero to see items.</p>}
        {connected && error && <p className="text-sm text-red-600">{error}</p>}
        {connected && !error && items === null && <p className="text-sm text-ink-500">Loading items…</p>}
        {connected && !error && items !== null && items.length === 0 && (
          <p className="text-sm text-ink-500">No items found in this organisation.</p>
        )}
        {connected && !error && items !== null && items.length > 0 && (
          <ul className="flex flex-col divide-y divide-surface-border">
            {items.slice(0, 8).map((item) => (
              <li key={item.itemId ?? item.code} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{item.name ?? item.code}</p>
                  <p className="text-xs text-ink-500">{item.code}</p>
                </div>
                <span className="text-sm font-medium text-ink-900">
                  {item.salesUnitPrice != null ? item.salesUnitPrice.toFixed(2) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
