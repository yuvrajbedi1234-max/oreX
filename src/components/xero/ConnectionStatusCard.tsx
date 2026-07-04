import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { ConnectionStatus } from "./types";

const CAPABILITIES = ["Quotes (read + draft create)", "Contacts (read)", "Items (read)"];

function formatTimestamp(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function ConnectionStatusCard({
  status,
  loading,
  tokenExpired,
  lastCheckedAt,
  disconnecting,
  onDisconnect,
}: {
  status: ConnectionStatus | null;
  loading: boolean;
  tokenExpired: boolean;
  lastCheckedAt: Date | null;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  const connected = status?.connected ?? false;

  return (
    <Card>
      <CardHeader
        title="Connection status"
        subtitle="Single Xero organisation, connected server-side. Tokens never reach the browser."
        action={
          connected ? (
            <Badge tone="green">Connected</Badge>
          ) : (
            <Badge tone="neutral">{loading ? "Checking…" : "Not connected"}</Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink-500">Connected organisation</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{status?.tenantName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-500">Token status</p>
            <p className="mt-1 text-sm font-medium text-ink-900">
              {!connected
                ? "—"
                : tokenExpired
                  ? "Expired (will refresh on next request)"
                  : `Active — expires ${formatTimestamp(status?.tokenExpiresAt)}`}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-ink-500">Configured capabilities</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {CAPABILITIES.map((capability) => (
                <Badge key={capability} tone="cyan">
                  {capability}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-500">Last successful check</p>
            <p className="mt-1 text-sm font-medium text-ink-900">
              {lastCheckedAt ? lastCheckedAt.toLocaleString() : "Not checked yet"}
            </p>
          </div>
        </div>

        {status?.permissionsNeedUpdate && (
          <div className="rounded-lg bg-orange-400/10 px-4 py-3 text-sm text-orange-500 ring-1 ring-inset ring-orange-400/30">
            The connected app is missing a permission that XERO_SCOPES now requires. Reconnect to
            grant it.
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          {!connected && (
            <a
              href="/api/xero/connect"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
            >
              Connect to Xero
            </a>
          )}
          {connected && status?.permissionsNeedUpdate && (
            <a
              href="/api/xero/connect"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400"
            >
              Update Xero permissions
            </a>
          )}
          {connected && (
            <Button variant="secondary" disabled={disconnecting} onClick={onDisconnect}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
