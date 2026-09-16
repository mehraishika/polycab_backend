import {
  NextRequest,
  NextResponse,
} from "next/server";

import { AuthService } from "@/server/services/auth.service";

const authService = new AuthService();

export async function POST(
  request: NextRequest,
): Promise<Response> {
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

    if (
      typeof body !== "object" ||
      body === null
    ) {
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
    };

    const challengeId =
      typeof data.challengeId === "string"
        ? data.challengeId.trim()
        : "";

    const code =
      typeof data.code === "string"
        ? data.code.trim()
        : "";

    if (!challengeId) {
      return NextResponse.json(
        {
          message:
            "Two-factor setup challenge ID is required",
        },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          message:
            "Verification code must be exactly 6 digits",
        },
        { status: 400 },
      );
    }

    /*
     * This endpoint is ONLY for:
     *
     * User selected NO
     *      ↓
     * Fresh QR generated
     *      ↓
     * User scanned QR
     *      ↓
     * User entered first 6-digit code
     */
    const result =
      await authService.verifyTwoFactorSetup({
        challengeId,
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
      recoveryCodes:
        result.data.recoveryCodes,
    };

    const response =
      NextResponse.json(
        {
          message: result.message,
          data: responseData,
        },
        { status: 200 },
      );

    /*
     * Access token
     */
    response.cookies.set(
      "accessToken",
      result.data.accessToken,
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
     * Refresh token
     */
    response.cookies.set(
      "refreshToken",
      result.data.refreshToken,
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

    return response;
  } catch (error) {
    console.error(
      "2FA setup verification error:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Unable to verify two-factor setup",
      },
      { status: 500 },
    );
  }
}