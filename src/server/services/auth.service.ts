import { AuthRepository } from "@/server/repositories/auth.repository";
import { TwoFactorService } from "@/server/services/two-factor.service";

import {
  getAccessTokenExpiry,
  getAccessTokenSecret,
  getRefreshTokenExpiry,
  getRefreshTokenSecret,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/server/utils/jwt";

import { toErrorMessage } from "@/server/utils/api-error";
import { hashPassword, verifyPassword } from "@/server/utils/password";

import type {
  LoginInput,
  RefreshInput,
  RegisterInput,
} from "@/server/validators/auth.validator";

type AuthPortal = LoginInput["portal"];

const TWO_FACTOR_CHALLENGE_EXPIRY_MS =
  5 * 60 * 1000;

const TWO_FACTOR_MAX_ATTEMPTS = 5;

export interface TwoFactorChoiceRequired {
  status: 200;
  message: string;
  data: {
    requiresVerification: false;
    requiresTwoFactorChoice: true;
    challengeId: string;
    twoFactorEnabled: boolean;
    account: string;
    user: {
      userId: string;
      account: string;
      portal: LoginInput["portal"];
      role: string;
    };
  };
}

export interface LoginServiceSuccess {
  status: 200;
  message: string;
  data: {
    requiresVerification: false;
    requiresTwoFactor: false;
    accessToken: string;
    refreshToken: string;
    user: {
      userId: string;
      account: string;
      portal: LoginInput["portal"];
      role: string;
    };
    redirect: string;
    cookieMaxAge: number;
    refreshCookieMaxAge: number;
    recoveryCodes?: string[];
  };
}

export interface LoginServiceError {
  status: 400 | 401 | 404 | 409 | 429 | 500;
  message: string;
  errorCode?:
    | "ACCOUNT_NOT_FOUND"
    | "INVALID_PASSWORD";
}

export interface RegisterServiceSuccess {
  status: 201;
  message: string;
  data: {
    user: {
      userId: string;
      account: string;
      email: string;
      timezone: string;
      portal: "monitoring";
      role: string;
    };
  };
}

export interface RegisterServiceError {
  status: 400 | 409 | 500;
  message: string;
}

export interface RefreshServiceSuccess {
  status: 200;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      userId: string;
      account: string;
      portal: LoginInput["portal"];
      role: string;
    };
    cookieMaxAge: number;
    refreshCookieMaxAge: number;
  };
}

export interface RefreshServiceError {
  status: 401 | 500;
  message: string;
}

export type LoginServiceResult =
  | LoginServiceSuccess
  | LoginServiceError
  | TwoFactorChoiceRequired;

export type RegisterServiceResult =
  | RegisterServiceSuccess
  | RegisterServiceError;

export type RefreshServiceResult =
  | RefreshServiceSuccess
  | RefreshServiceError;

function resolveRedirect(
  portal: AuthPortal,
): string {
  if (portal === "monitoring") {
    return "/monitor";
  }

  return "/services";
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository =
      new AuthRepository(),
    private readonly twoFactorService: TwoFactorService =
      new TwoFactorService(),
  ) {}

  /* ============================================================
     LOGIN
     ============================================================ */

  async login(
    input: LoginInput,
  ): Promise<LoginServiceResult> {
    const accessSecret = getAccessTokenSecret();
    const refreshSecret = getRefreshTokenSecret();

    if (!accessSecret || !refreshSecret) {
      return {
        status: 500,
        message: "JWT secret is not configured",
      };
    }

    const accountRecord =
      await this.authRepository.findByPortalAndAccount(
        input.portal,
        input.account,
      );

    if (!accountRecord) {
      return {
        status: 401,
        message: "Invalid account or password",
        errorCode: "ACCOUNT_NOT_FOUND",
      };
    }

    const isValidPassword =
      await verifyPassword({
        plainPassword: input.password,
        storedPasswordHash:
          accountRecord.passwordHash,
      });

    if (!isValidPassword) {
      return {
        status: 401,
        message: "Invalid account or password",
        errorCode: "INVALID_PASSWORD",
      };
    }

    const twoFactor =
      await this.authRepository.findTwoFactorByUserId(
        accountRecord.userId,
      );

    const challenge =
      await this.authRepository.createTwoFactorLoginChallenge({
        userId: accountRecord.userId,
        remember: input.remember,
        expiresAt: new Date(
          Date.now() +
            TWO_FACTOR_CHALLENGE_EXPIRY_MS,
        ),
      });

    /*
     * IMPORTANT:
     *
     * Password is correct, but JWT is NOT issued yet.
     *
     * We ALWAYS return the 2FA choice.
     *
     * Frontend decides:
     *
     * YES:
     *   check twoFactorEnabled
     *
     * NO:
     *   ignore twoFactorEnabled
     *   generate a fresh secret
     */
    return {
      status: 200,
      message:
        "Please choose your Google Authenticator setup status",
      data: {
        requiresVerification: false,
        requiresTwoFactorChoice: true,
        challengeId: challenge.id,
        twoFactorEnabled:
          twoFactor?.enabled === true,
        account: accountRecord.account,
        user: {
          userId: accountRecord.userId,
          account: accountRecord.account,
          portal: input.portal,
          role: accountRecord.role,
        },
      },
    };
  }

  /* ============================================================
     LEGACY LOGIN VERIFICATION
     ============================================================ */

  async verifyLoginCode(input: {
    verificationId: string;
    code: string;
  }): Promise<LoginServiceError> {
    return {
      status: 401,
      message:
        "The old 4-digit login verification flow is no longer supported",
    };
  }

  /* ============================================================
     NORMAL GOOGLE AUTHENTICATOR LOGIN
     ============================================================ */

  /**
   * This method is ONLY for:
   *
   * YES
   * +
   * User has enabled Google Authenticator.
   *
   * It NEVER enables a disabled 2FA record.
   */
  async verifyTwoFactor(
    input: {
      challengeId: string;
      method: "authenticator";
      code: string;
    },
  ): Promise<
    LoginServiceSuccess | LoginServiceError
  > {
    const challenge =
      await this.authRepository.findTwoFactorLoginChallenge(
        input.challengeId,
      );

    if (!challenge) {
      return {
        status: 401,
        message:
          "Invalid two-factor authentication request",
      };
    }

    if (challenge.usedAt) {
      return {
        status: 401,
        message:
          "Two-factor authentication request already used",
      };
    }

    if (
      challenge.expiresAt.getTime() <=
      Date.now()
    ) {
      await this.authRepository.deleteTwoFactorLoginChallenge(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Two-factor authentication request expired",
      };
    }

    if (
      challenge.attempts >=
      TWO_FACTOR_MAX_ATTEMPTS
    ) {
      await this.authRepository.consumeTwoFactorLoginChallenge(
        challenge.id,
      );

      return {
        status: 429,
        message:
          "Too many verification attempts",
      };
    }

    if (!/^\d{6}$/.test(input.code)) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 400,
        message:
          "Verification code must be 6 digits",
      };
    }

    const twoFactor =
      await this.authRepository.findTwoFactorByUserId(
        challenge.userId,
      );

    /*
     * CRITICAL:
     *
     * Normal login verification is allowed
     * ONLY when 2FA is already enabled.
     */
    if (!twoFactor?.enabled) {
      return {
        status: 400,
        message:
          "Google Authenticator is not enabled. Please enable it first.",
      };
    }

    if (!twoFactor.secretEncrypted) {
      return {
        status: 400,
        message:
          "Google Authenticator secret is not configured",
      };
    }

    const isValid =
      await this.twoFactorService.verifyCode(
        twoFactor.secretEncrypted,
        input.code,
      );

    if (!isValid) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Invalid Google Authenticator code",
      };
    }

    await this.authRepository.consumeTwoFactorLoginChallenge(
      challenge.id,
    );

    const accountRecord =
      await this.authRepository.findByUserId(
        challenge.userId,
      );

    if (!accountRecord) {
      return {
        status: 404,
        message: "User account not found",
      };
    }

    return this.issueTokens(
      accountRecord,
      challenge.remember,
    );
  }

  /* ============================================================
     NEW GOOGLE AUTHENTICATOR SETUP VERIFICATION
     ============================================================ */

  /**
   * This method is ONLY for:
   *
   * NO
   * +
   * Fresh QR generated
   * +
   * User entered the first 6-digit code.
   *
   * It verifies the newly generated secret,
   * enables 2FA and then logs the user in.
   */
  async verifyTwoFactorSetup(
    input: {
      challengeId: string;
      code: string;
    },
  ): Promise<
    LoginServiceSuccess | LoginServiceError
  > {
    const challenge =
      await this.authRepository.findTwoFactorLoginChallenge(
        input.challengeId,
      );

    if (!challenge) {
      return {
        status: 401,
        message:
          "Invalid two-factor setup request",
      };
    }

    if (challenge.usedAt) {
      return {
        status: 401,
        message:
          "Two-factor setup request already used",
      };
    }

    if (
      challenge.expiresAt.getTime() <=
      Date.now()
    ) {
      await this.authRepository.deleteTwoFactorLoginChallenge(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Two-factor setup request expired",
      };
    }

    if (
      challenge.attempts >=
      TWO_FACTOR_MAX_ATTEMPTS
    ) {
      await this.authRepository.consumeTwoFactorLoginChallenge(
        challenge.id,
      );

      return {
        status: 429,
        message:
          "Too many verification attempts",
      };
    }

    if (!/^\d{6}$/.test(input.code)) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 400,
        message:
          "Verification code must be 6 digits",
      };
    }

    const twoFactor =
      await this.authRepository.findTwoFactorByUserId(
        challenge.userId,
      );

    /*
     * Setup verification requires:
     *
     * enabled = false
     * secret exists
     */
    if (!twoFactor?.secretEncrypted) {
      return {
        status: 400,
        message:
          "Google Authenticator setup has not been initialized",
      };
    }

    /*
     * If already enabled, this request is no longer
     * a setup request.
     */
    if (twoFactor.enabled) {
      return {
        status: 409,
        message:
          "Google Authenticator is already enabled",
      };
    }

    const isValid =
      await this.twoFactorService.verifyCode(
        twoFactor.secretEncrypted,
        input.code,
      );

    if (!isValid) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Invalid Google Authenticator code",
      };
    }

    /*
     * Enable 2FA ONLY after successful TOTP verification.
     */
    await this.authRepository.enableTwoFactor(
      challenge.userId,
    );

    /*
     * Old recovery codes are no longer valid
     * after generating a completely new secret.
     */
    await this.authRepository.deleteUnusedTwoFactorRecoveryCodes(
      challenge.userId,
    );

    /*
     * Generate a fresh recovery-code set.
     *
     * UI can display these once after setup.
     */
    const recoveryCodes =
      await this.authRepository.createTwoFactorRecoveryCodes(
        challenge.userId,
        8,
      );

    await this.authRepository.consumeTwoFactorLoginChallenge(
      challenge.id,
    );

    const accountRecord =
      await this.authRepository.findByUserId(
        challenge.userId,
      );

    if (!accountRecord) {
      return {
        status: 404,
        message: "User account not found",
      };
    }

    return this.issueTokens(
      accountRecord,
      challenge.remember,
      recoveryCodes,
    );
  }

  /* ============================================================
     TWO FACTOR RECOVERY
     ============================================================ */

  async verifyTwoFactorRecovery(
    input: {
      challengeId: string;
      recoveryCode: string;
    },
  ): Promise<
    | {
        status: 200;
        message: string;
        data: {
          recoveryVerified: true;
          requiresTwoFactorSetup: true;
          challengeId: string;
        };
      }
    | LoginServiceError
  > {
    const challenge =
      await this.authRepository.findTwoFactorLoginChallenge(
        input.challengeId,
      );

    if (!challenge) {
      return {
        status: 401,
        message:
          "Two-factor authentication challenge not found",
      };
    }

    if (challenge.usedAt) {
      return {
        status: 401,
        message:
          "Two-factor authentication challenge has already been used",
      };
    }

    if (
      challenge.expiresAt.getTime() <=
      Date.now()
    ) {
      return {
        status: 401,
        message:
          "Two-factor authentication challenge has expired",
      };
    }

    if (
      challenge.attempts >=
      TWO_FACTOR_MAX_ATTEMPTS
    ) {
      await this.authRepository.consumeTwoFactorLoginChallenge(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Too many verification attempts",
      };
    }

    const normalizedRecoveryCode =
      input.recoveryCode
        .trim()
        .toUpperCase();

    if (!normalizedRecoveryCode) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 401,
        message: "Recovery code is required",
      };
    }

    const recoveryCode =
      await this.authRepository.findTwoFactorRecoveryCode(
        challenge.userId,
        normalizedRecoveryCode,
      );

    if (!recoveryCode) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Invalid or already used recovery code",
      };
    }

    const consumed =
      await this.authRepository.consumeTwoFactorRecoveryCode(
        recoveryCode.id,
      );

    if (!consumed) {
      await this.authRepository.updateTwoFactorLoginChallengeAttempts(
        challenge.id,
      );

      return {
        status: 401,
        message:
          "Invalid or already used recovery code",
      };
    }

    await this.authRepository.disableTwoFactor(
      challenge.userId,
    );

    await this.authRepository.deleteUnusedTwoFactorRecoveryCodes(
      challenge.userId,
    );

    return {
      status: 200,
      message:
        "Account recovery successful. Please set up Google Authenticator again.",
      data: {
        recoveryVerified: true,
        requiresTwoFactorSetup: true,
        challengeId: challenge.id,
      },
    };
  }

  /* ============================================================
     COMPLETE TWO FACTOR SETUP
     ============================================================ */

  async completeTwoFactorSetup(
    userId: string,
    remember: boolean,
  ): Promise<
    LoginServiceSuccess | LoginServiceError
  > {
    const accountRecord =
      await this.authRepository.findByUserId(
        userId,
      );

    if (!accountRecord) {
      return {
        status: 401,
        message: "User account not found",
      };
    }

    const twoFactor =
      await this.authRepository.findTwoFactorByUserId(
        userId,
      );

    if (!twoFactor?.enabled) {
      return {
        status: 401,
        message:
          "Two-factor authentication must be enabled before login",
      };
    }

    return this.issueTokens(
      accountRecord,
      remember,
    );
  }

  /* ============================================================
     ISSUE TOKENS
     ============================================================ */

  private async issueTokens(
    accountRecord: NonNullable<
      Awaited<
        ReturnType<AuthRepository["findByUserId"]>
      >
    >,
    remember = false,
    recoveryCodes?: string[],
  ): Promise<
    LoginServiceSuccess | LoginServiceError
  > {
    const twoFactor =
      await this.authRepository.findTwoFactorByUserId(
        accountRecord.userId,
      );

    if (!twoFactor?.enabled) {
      return {
        status: 401,
        message:
          "Two-factor authentication must be enabled before login",
      };
    }

    const accessSecret = getAccessTokenSecret();
    const refreshSecret = getRefreshTokenSecret();

    if (!accessSecret || !refreshSecret) {
      return {
        status: 500,
        message: "JWT secret is not configured",
      };
    }

    const expiresIn =
      getAccessTokenExpiry(remember);

    const accessToken = signAccessToken(
      {
        userId: accountRecord.userId,
        role: accountRecord.role,
        portal: accountRecord.portal,
        account: accountRecord.account,
      },
      accessSecret,
      expiresIn,
    );

    const refreshExpiresIn =
      getRefreshTokenExpiry();

    const refreshToken = signRefreshToken(
      {
        userId: accountRecord.userId,
        portal: accountRecord.portal,
        account: accountRecord.account,
      },
      refreshSecret,
      refreshExpiresIn,
    );

    const redirect =
      resolveRedirect(accountRecord.portal);

    return {
      status: 200,
      message: "Login successful",
      data: {
        requiresVerification: false,
        requiresTwoFactor: false,
        accessToken,
        refreshToken,
        user: {
          userId: accountRecord.userId,
          account: accountRecord.account,
          portal: accountRecord.portal,
          role: accountRecord.role,
        },
        redirect,
        cookieMaxAge: remember
          ? 60 * 60 * 24 * 7
          : 60 * 15,
        refreshCookieMaxAge:
          60 * 60 * 24 * 7,
        ...(recoveryCodes
          ? {
              recoveryCodes,
            }
          : {}),
      },
    };
  }

  /* ============================================================
     REGISTER
     ============================================================ */

  async register(
    input: RegisterInput,
  ): Promise<RegisterServiceResult> {
    const expectedVerificationCode =
      process.env.REGISTRATION_VERIFICATION_CODE;

    if (
      typeof expectedVerificationCode ===
        "string" &&
      expectedVerificationCode.length > 0 &&
      input.verificationCode !==
        expectedVerificationCode
    ) {
      return {
        status: 400,
        message: "Invalid verification code",
      };
    }

    const existingAccount =
      await this.authRepository.findByPortalAndAccount(
        "monitoring",
        input.account,
      );

    if (existingAccount) {
      return {
        status: 409,
        message: "Account already exists",
      };
    }

    const existingEmail =
      await this.authRepository.findByPortalAndEmail(
        "monitoring",
        input.email,
      );

    if (existingEmail) {
      return {
        status: 409,
        message: "Email already exists",
      };
    }

    try {
      const passwordHash =
        await hashPassword(input.password);

      const user =
        await this.authRepository.createMonitoringUser({
          account: input.account,
          email: input.email,
          timezone: input.timezone,
          passwordHash,
          epcCompany: input.epcCompany,
          epcInstaller: input.epcInstaller,
          epcMobile: input.epcMobile,
          epcEmail: input.epcEmail,
          epcAddress: input.epcAddress,
        });

      return {
        status: 201,
        message: "Registration successful",
        data: {
          user: {
            userId: user.userId,
            account: user.account,
            email:
              user.email ?? input.email,
            timezone:
              user.timezone ?? input.timezone,
            portal: "monitoring",
            role: user.role,
          },
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  /* ============================================================
     REFRESH TOKEN
     ============================================================ */

  async refresh(
    input: RefreshInput,
  ): Promise<RefreshServiceResult> {
    const accessSecret =
      getAccessTokenSecret();

    const refreshSecret =
      getRefreshTokenSecret();

    if (!accessSecret || !refreshSecret) {
      return {
        status: 500,
        message: "JWT secret is not configured",
      };
    }

    const payload = verifyRefreshToken(
      input.refreshToken,
      refreshSecret,
    );

    if (!payload) {
      return {
        status: 401,
        message:
          "Invalid or expired refresh token",
      };
    }

    const portal = payload.portal;
    const account = payload.account;
    const userId = payload.userId;

    if (
      typeof portal !== "string" ||
      (portal !== "monitoring" &&
        portal !== "service") ||
      typeof account !== "string" ||
      account.length === 0 ||
      typeof userId !== "string" ||
      userId.length === 0
    ) {
      return {
        status: 401,
        message:
          "Invalid refresh token payload",
      };
    }

    const accountRecord =
      await this.authRepository.findByPortalAndAccount(
        portal as AuthPortal,
        account,
      );

    if (
      !accountRecord ||
      accountRecord.userId !== userId
    ) {
      return {
        status: 401,
        message:
          "Refresh token user is invalid",
      };
    }

    const twoFactor =
      await this.authRepository.findTwoFactorByUserId(
        accountRecord.userId,
      );

    if (!twoFactor?.enabled) {
      return {
        status: 401,
        message:
          "Two-factor authentication must be enabled",
      };
    }

    const expiresIn =
      getAccessTokenExpiry(false);

    const accessToken = signAccessToken(
      {
        userId: accountRecord.userId,
        role: accountRecord.role,
        portal:
          portal as LoginInput["portal"],
        account,
      },
      accessSecret,
      expiresIn,
    );

    const refreshExpiresIn =
      getRefreshTokenExpiry();

    const refreshToken = signRefreshToken(
      {
        userId: accountRecord.userId,
        portal:
          portal as LoginInput["portal"],
        account,
      },
      refreshSecret,
      refreshExpiresIn,
    );

    return {
      status: 200,
      message:
        "Token refreshed successfully",
      data: {
        accessToken,
        refreshToken,
        user: {
          userId: accountRecord.userId,
          account,
          portal:
            portal as LoginInput["portal"],
          role: accountRecord.role,
        },
        cookieMaxAge: 60 * 15,
        refreshCookieMaxAge:
          60 * 60 * 24 * 7,
      },
    };
  }
}