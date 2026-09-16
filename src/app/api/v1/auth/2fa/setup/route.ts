import { NextRequest, NextResponse } from "next/server";

import { AuthRepository } from "@/server/repositories/auth.repository";
import { TwoFactorService } from "@/server/services/two-factor.service";

const authRepository = new AuthRepository();
const twoFactorService = new TwoFactorService();

const TWO_FACTOR_MAX_ATTEMPTS = 5;

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
    };

    const challengeId =
      typeof data.challengeId === "string"
        ? data.challengeId.trim()
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

    /*
     * The password has already been verified by /auth/login.
     *
     * The temporary challenge represents that
     * authenticated login attempt.
     */
    const challenge =
      await authRepository.findTwoFactorLoginChallenge(
        challengeId,
      );

    if (!challenge) {
      return NextResponse.json(
        {
          message:
            "Invalid two-factor setup challenge",
        },
        { status: 401 },
      );
    }

    if (challenge.usedAt) {
      return NextResponse.json(
        {
          message:
            "Two-factor setup challenge has already been used",
        },
        { status: 401 },
      );
    }

    if (
      challenge.expiresAt.getTime() <=
      Date.now()
    ) {
      await authRepository.deleteTwoFactorLoginChallenge(
        challengeId,
      );

      return NextResponse.json(
        {
          message:
            "Two-factor setup challenge has expired",
        },
        { status: 401 },
      );
    }

    if (
      challenge.attempts >=
      TWO_FACTOR_MAX_ATTEMPTS
    ) {
      await authRepository.consumeTwoFactorLoginChallenge(
        challengeId,
      );

      return NextResponse.json(
        {
          message:
            "Too many two-factor verification attempts",
        },
        { status: 429 },
      );
    }

    const user =
      await authRepository.findByUserId(
        challenge.userId,
      );

    if (!user) {
      return NextResponse.json(
        {
          message: "User account not found",
        },
        { status: 404 },
      );
    }

    /*
     * IMPORTANT:
     *
     * We DO NOT check existing enabled state here.
     *
     * User selected:
     *
     * "NO, I have not set up Google Authenticator"
     *
     * Therefore we intentionally create a completely
     * fresh secret.
     *
     * createOrResetTwoFactor() does:
     *
     * old secret -> replaced
     * enabled    -> false
     */
    const setup =
      twoFactorService.generateSetup(
        user.account,
      );

    await authRepository.createOrResetTwoFactor({
      userId: challenge.userId,
      secretEncrypted:
        setup.encryptedSecret,
    });

    /*
     * Old unused recovery codes belong to the
     * previous secret and must not remain valid.
     */
    await authRepository.deleteUnusedTwoFactorRecoveryCodes(
      challenge.userId,
    );

    return NextResponse.json(
      {
        message:
          "Two-factor authentication setup generated",
        data: {
          challengeId,
          secret: setup.secret,
          otpauthUrl: setup.otpauthUrl,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "2FA setup error:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Unable to setup two-factor authentication",
      },
      { status: 500 },
    );
  }
}