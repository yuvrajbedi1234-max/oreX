import { NextResponse } from "next/server";
import { runDemoVerify } from "@/lib/demo/verify-demo";

export async function GET() {
  const result = await runDemoVerify();
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
