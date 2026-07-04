import { NextResponse } from "next/server";
import { tryDisconnectFromXero } from "@/lib/xero/client";
import { clearConnection, getConnection } from "@/lib/xero/token-store";

export async function POST() {
  const stored = await getConnection();

  if (stored) {
    try {
      await tryDisconnectFromXero(stored.connectionId);
    } catch (err) {
      console.error("Xero-side disconnect failed; clearing local connection anyway:", err);
    }
  }

  await clearConnection();
  return NextResponse.json({ success: true });
}
