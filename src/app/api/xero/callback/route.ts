import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/xero/client";
import { toXeroAppError } from "@/lib/xero/errors";
import { saveConnection } from "@/lib/xero/token-store";

const STATE_COOKIE = "xero_oauth_state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const redirectWithError = (message: string, code: string) => {
    const target = new URL("/xero", url.origin);
    target.searchParams.set("xeroError", message);
    target.searchParams.set("errorCode", code);
    const response = NextResponse.redirect(target);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const returnedState = url.searchParams.get("state");

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return redirectWithError("OAuth state did not match — please try connecting again.", "invalid_state");
  }

  try {
    const { tokenSet, tenantId, tenantName, connectionId } = await exchangeCodeForTokens(
      request.url,
      expectedState
    );
    await saveConnection({ tenantId, tenantName, connectionId, tokenSet });

    const target = new URL("/xero", url.origin);
    target.searchParams.set("connected", "true");
    const response = NextResponse.redirect(target);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    const appError = toXeroAppError(err);
    return redirectWithError(appError.message, appError.code);
  }
}
