import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { AuthService } from "@/server/services/auth.service";
import { withRequestLogging } from "@/server/middleware/request-log.middleware";
import {
  errorResponse,
  successResponse,
} from "@/server/utils/api-response";
import { loginSchema } from "@/server/validators/auth.validator";

const authService = new AuthService();

function getClientIp(
  request: NextRequest,
): string {
  const forwardedFor =
    request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstForwardedIp =
      forwardedFor
        .split(",")[0]
        ?.trim();

    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  const realIp =
    request.headers
      .get("x-real-ip")
      ?.trim();

  return realIp &&
    realIp.length > 0
    ? realIp
    : "unknown";
}

async function postLogin(
  request: NextRequest,
): Promise<Response> {
  let body: unknown;

  /*
   * ============================================================
   * PARSE REQUEST
   * ============================================================
   */

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "Invalid JSON payload",
      400,
    );
  }

  /*
   * ============================================================
   * VALIDATE REQUEST
   * ============================================================
   */

  const parsed =
    loginSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      "Invalid request body",
      400,
    );
  }

  /*
   * ============================================================
   * AUTHENTICATE USER
   * ============================================================
   */

  const result =
    await authService.login(
      parsed.data,
    );

  /*
   * ============================================================
   * LOGIN ERROR
   * ============================================================
   */

  if (result.status !== 200) {
    if (result.status === 401) {
      console.warn(
        "[AUTH_LOGIN_401]",
        {
          path: "/api/v1/auth/login",
          method: "POST",
          message: result.message,
          reason:
            result.errorCode ??
            "UNKNOWN",
          portal:
            parsed.data.portal,
          account:
            parsed.data.account,
          remember:
            parsed.data.remember,
          ip: getClientIp(request),
          userAgent:
            request.headers.get(
              "user-agent",
            ) ?? "unknown",
          requestId:
            request.headers.get(
              "x-request-id",
            ) ?? null,
          occurredAt:
            new Date().toISOString(),
        },
      );
    }

    return errorResponse(
      result.message,
      result.status,
    );
  }

  /*
   * ============================================================
   * TWO-FACTOR CHOICE
   * ============================================================
   *
   * Password is correct.
   *
   * We DO NOT issue JWT here.
   *
   * Frontend will now show:
   *
   * "Have you already set up Google Authenticator?"
   *
   * YES
   *   -> check twoFactorEnabled
   *
   * NO
   *   -> ignore twoFactorEnabled
   *   -> generate fresh QR
   *
   * This is the permanent login flow.
   */

  if (
    "requiresTwoFactorChoice" in
      result.data &&
    result.data
      .requiresTwoFactorChoice ===
      true
  ) {
    return successResponse(
      result.message,
      {
        requiresTwoFactorChoice:
          true,

        challengeId:
          result.data.challengeId,

        twoFactorEnabled:
          result.data
            .twoFactorEnabled,

        account:
          result.data.account,

        user:
          result.data.user,
      },
    );
  }

  /*
   * ============================================================
   * SAFETY CHECK
   * ============================================================
   *
   * Normally login cannot reach this point
   * without either:
   *
   * 1. 2FA choice
   * 2. completed authentication
   *
   * If no tokens exist, do not accidentally
   * return a partially authenticated response.
   */

  if (
    !("accessToken" in result.data) ||
    !("refreshToken" in result.data) ||
    !("redirect" in result.data) ||
    !("cookieMaxAge" in result.data) ||
    !(
      "refreshCookieMaxAge" in
      result.data
    )
  ) {
    return errorResponse(
      "Authentication tokens were not generated",
      500,
    );
  }

  /*
   * ============================================================
   * SUCCESSFUL AUTHENTICATION
   * ============================================================
   */

  const accessToken =
    result.data.accessToken;

  const refreshToken =
    result.data.refreshToken;

  const response =
    successResponse(
      result.message,
      {
        accessToken,
        refreshToken,
        user:
          result.data.user,
        redirect:
          result.data.redirect,
      },
    );

  const nextResponse =
    response as NextResponse;

  /*
   * Access token cookie
   */

  nextResponse.cookies.set(
    "accessToken",
    accessToken,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge:
        result.data.cookieMaxAge,
    },
  );

  /*
   * Refresh token cookie
   */

  nextResponse.cookies.set(
    "refreshToken",
    refreshToken,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge:
        result.data
          .refreshCookieMaxAge,
    },
  );

  return nextResponse;
}

export const POST =
  withRequestLogging(
    postLogin,
    {
      routeName: "auth.login",
    },
  );