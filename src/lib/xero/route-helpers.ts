import "server-only";
import { NextResponse } from "next/server";
import { toXeroAppError } from "./errors";

export function xeroErrorResponse(err: unknown): NextResponse {
  const appError = toXeroAppError(err);
  return NextResponse.json(appError.toJSON(), { status: appError.httpStatus });
}
