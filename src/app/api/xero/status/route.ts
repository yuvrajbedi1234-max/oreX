import { NextResponse } from "next/server";
import { getConfiguredScopes } from "@/lib/xero/client";
import { getConnection } from "@/lib/xero/token-store";
import type { XeroConnectionStatus } from "@/lib/xero/types";

export async function GET() {
  const stored = await getConnection();

  if (!stored) {
    const body: XeroConnectionStatus = { connected: false };
    return NextResponse.json(body);
  }

  const tokenExpiresAt =
    typeof stored.tokenSet.expires_at === "number"
      ? new Date(stored.tokenSet.expires_at * 1000).toISOString()
      : undefined;

  let permissionsNeedUpdate: boolean | undefined;
  try {
    const required = getConfiguredScopes();
    const granted = new Set((stored.tokenSet.scope ?? "").split(" ").filter(Boolean));
    permissionsNeedUpdate = required.some((scope) => !granted.has(scope));
  } catch {
    permissionsNeedUpdate = undefined;
  }

  const body: XeroConnectionStatus = {
    connected: true,
    tenantId: stored.tenantId,
    tenantName: stored.tenantName,
    tokenExpiresAt,
    permissionsNeedUpdate,
  };
  return NextResponse.json(body);
}
