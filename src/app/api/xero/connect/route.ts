import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildConsentUrl } from "@/lib/xero/client";
import { xeroErrorResponse } from "@/lib/xero/route-helpers";

const STATE_COOKIE = "xero_oauth_state";

export async function GET() {
  try {
    const state = randomBytes(16).toString("hex");
    const consentUrl = await buildConsentUrl(state);

    const response = NextResponse.redirect(consentUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (err) {
    return xeroErrorResponse(err);
  }
}
