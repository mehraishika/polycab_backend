import { NextRequest, NextResponse } from "next/server";

import { AuthService } from "@/server/services/auth.service";

const authService = new AuthService();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: "Invalid JSON payload",
        },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        {
          message: "Invalid request body",
        },
        { status: 400 },
      );
    }

    const data = body as {
      challengeId?: unknown;
      code?: unknown;
      method?: unknown;
    };

    const challengeId =
      typeof data.challengeId === "string" ? data.challengeId.trim() : "";

    const code = typeof data.code === "string" ? data.code.trim() : "";
    const requestedMethod =
      data.method === "recovery" || data.method === "authenticator"
        ? data.method
        : undefined;
    const method =
      requestedMethod ??
      (/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/i.test(code)
        ? "recovery"
        : "authenticator");

    if (!challengeId) {
      return NextResponse.json(
        {
          message: "Two-factor authentication challenge ID is required",
        },
        { status: 400 },
      );
    }

    const isValidCodeFormat =
      method === "authenticator"
        ? /^\d{6}$/.test(code)
        : /^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/i.test(code);

    if (!isValidCodeFormat) {
      return NextResponse.json(
        {
          message:
            method === "authenticator"
              ? "Verification code must be exactly 6 digits"
              : "Recovery code must be in the format XXXX-XXXX-XXXX",
        },
        { status: 400 },
      );
    }

    const result = await authService.verifyTwoFactor({
      challengeId,
      method,
      code,
    });

    if (result.status !== 200) {
      return NextResponse.json(
        {
          message: result.message,
        },
        { status: result.status },
      );
    }

    const responseData = {
      requiresVerification: false,
      requiresTwoFactor: false,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      user: result.data.user,
      redirect: result.data.redirect,
      recoveryCodes: result.data.recoveryCodes,
    };

    const response = NextResponse.json(
      {
        message: result.message,
        data: responseData,
      },
      { status: 200 },
    );

    /*
     * Access token
     */
    response.cookies.set("accessToken", result.data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: result.data.cookieMaxAge,
    });

    /*
     * Refresh token
     */
    response.cookies.set("refreshToken", result.data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: result.data.refreshCookieMaxAge,
    });

    return response;
  } catch (error) {
    console.error("2FA login verification error:", error);

    return NextResponse.json(
      {
        message: "Unable to verify two-factor authentication",
      },
      { status: 500 },
    );
  }
}
