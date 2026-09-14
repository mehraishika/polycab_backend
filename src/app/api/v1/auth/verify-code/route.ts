//auth\verify-code\route.ts
import { NextRequest, NextResponse } from "next/server";

import { AuthService } from "@/server/services/auth.service";
import { errorResponse, successResponse } from "@/server/utils/api-response";

const authService = new AuthService();

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (typeof body !== "object" || body === null) {
    return errorResponse("Invalid request body", 400);
  }

  const data = body as {
    verificationId?: unknown;
    code?: unknown;
  };

  if (
    typeof data.verificationId !== "string" ||
    typeof data.code !== "string"
  ) {
    return errorResponse("Verification ID and code are required", 400);
  }

  const result = await authService.verifyLoginCode({
    verificationId: data.verificationId,
    code: data.code,
  });

  if (result.status !== 200) {
    return errorResponse(result.message, result.status);
  }

  const response = successResponse(result.message, {
    requiresVerification: false,
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
    user: result.data.user,
    redirect: result.data.redirect,
  });

  const nextResponse = response as NextResponse;

  nextResponse.cookies.set("accessToken", result.data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: result.data.cookieMaxAge,
  });

  nextResponse.cookies.set("refreshToken", result.data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: result.data.refreshCookieMaxAge,
  });

  return nextResponse;
}