import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_SLUG } from "@/lib/demo/demo-types";

interface ResetLocalRequestBody {
  confirm?: boolean;
}

// Deletes only the local DemoProject link — never touches Xero. Requires
// an explicit confirm flag so this can't be triggered by an accidental click.
export async function POST(request: NextRequest) {
  let body: ResetLocalRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "You must confirm resetting the local demo state." },
      { status: 400 }
    );
  }

  await prisma.demoProject.deleteMany({ where: { slug: DEMO_SLUG } });
  return NextResponse.json({ success: true });
}
