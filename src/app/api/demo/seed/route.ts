import { NextResponse } from "next/server";
import { runDemoSeed } from "@/lib/demo/seed-demo";

export async function POST() {
  const result = await runDemoSeed();
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
