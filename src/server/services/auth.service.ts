import { AuthRepository } from "@/server/repositories/auth.repository";
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

const LOGIN_VERIFICATION_CODE = "1234";
const LOGIN_VERIFICATION_EXPIRY_MS = 5 * 60 * 1000;

export interface LoginVerificationRequired {
  status: 200;
  message: string;
  data: {
    requiresVerification: true;
    verificationId: string;
    email?: string;
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
  };
}

export interface LoginServiceError {
  status: 401 | 500;
  message: string;
  errorCode?: "ACCOUNT_NOT_FOUND" | "INVALID_PASSWORD";
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
  | LoginVerificationRequired;
export type RegisterServiceResult =
  | RegisterServiceSuccess
  | RegisterServiceError;
export type RefreshServiceResult = RefreshServiceSuccess | RefreshServiceError;

function resolveRedirect(portal: AuthPortal): string {
  if (portal === "monitoring") {
    return "/monitor";
  }

  return "/services";
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository = new AuthRepository(),
  ) {}

  async login(input: LoginInput): Promise<LoginServiceResult> {
    const accessSecret = getAccessTokenSecret();
    const refreshSecret = getRefreshTokenSecret();

    if (!accessSecret || !refreshSecret) {
      return {
        status: 500,
        message: "JWT secret is not configured",
      };
    }

    const accountRecord = await this.authRepository.findByPortalAndAccount(
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

    const isValidPassword = await verifyPassword({
      plainPassword: input.password,
      storedPasswordHash: accountRecord.passwordHash,
    });

    if (!isValidPassword) {
      return {
        status: 401,
        message: "Invalid account or password",
        errorCode: "INVALID_PASSWORD",
      };
    }
    const expiresAt = new Date(Date.now() + LOGIN_VERIFICATION_EXPIRY_MS);

    const verification = await this.authRepository.createLoginVerification({
      userId: accountRecord.userId,
      code: LOGIN_VERIFICATION_CODE,
      expiresAt,
    });

    return {
      status: 200,
      message: "Verification code required",
      data: {
        requiresVerification: true,
        verificationId: verification.id,
        email: accountRecord.email,
        user: {
          userId: accountRecord.userId,
          account: accountRecord.account,
          portal: input.portal,
          role: accountRecord.role,
        },
      },
    };
  }
  async verifyLoginCode(input: {
    verificationId: string;
    code: string;
  }): Promise<LoginServiceSuccess | LoginServiceError> {
    const accessSecret = getAccessTokenSecret();
    const refreshSecret = getRefreshTokenSecret();

    if (!accessSecret || !refreshSecret) {
      return {
        status: 500,
        message: "JWT secret is not configured",
      };
    }

    if (!/^\d{4}$/.test(input.code)) {
      return {
        status: 401,
        message: "Verification code must be 4 digits",
      };
    }

    const verification = await this.authRepository.findLoginVerification(
      input.verificationId,
    );

    if (!verification) {
      return {
        status: 401,
        message: "Invalid verification request",
      };
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      await this.authRepository.deleteLoginVerification(verification.id);

      return {
        status: 401,
        message: "Verification code expired",
      };
    }

    if (verification.code !== input.code) {
      return {
        status: 401,
        message: "Invalid verification code",
      };
    }

    const accountRecord = await this.authRepository.findByUserId(
      verification.userId,
    );

    if (!accountRecord) {
      return {
        status: 401,
        message: "User account not found",
      };
    }

    // Consume verification code
    await this.authRepository.deleteLoginVerification(verification.id);

    // --------------------------------
    // OTP VERIFIED
    // Generate JWT now
    // --------------------------------

    const expiresIn = getAccessTokenExpiry(false);

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

    const refreshExpiresIn = getRefreshTokenExpiry();

    const refreshToken = signRefreshToken(
      {
        userId: accountRecord.userId,
        portal: accountRecord.portal,
        account: accountRecord.account,
      },
      refreshSecret,
      refreshExpiresIn,
    );

    const redirect = resolveRedirect(accountRecord.portal);

    return {
      status: 200,
      message: "Login successful",
      data: {
        requiresVerification: false,
        accessToken,
        refreshToken,
        user: {
          userId: accountRecord.userId,
          account: accountRecord.account,
          portal: accountRecord.portal,
          role: accountRecord.role,
        },
        redirect,
        cookieMaxAge: 60 * 15,
        refreshCookieMaxAge: 60 * 60 * 24 * 7,
      },
    };
  }
  async register(input: RegisterInput): Promise<RegisterServiceResult> {
    const expectedVerificationCode = process.env.REGISTRATION_VERIFICATION_CODE;

    if (
      typeof expectedVerificationCode === "string" &&
      expectedVerificationCode.length > 0 &&
      input.verificationCode !== expectedVerificationCode
    ) {
      return {
        status: 400,
        message: "Invalid verification code",
      };
    }

    const existingAccount = await this.authRepository.findByPortalAndAccount(
      "monitoring",
      input.account,
    );

    if (existingAccount) {
      return {
        status: 409,
        message: "Account already exists",
      };
    }

    const existingEmail = await this.authRepository.findByPortalAndEmail(
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
      const passwordHash = await hashPassword(input.password);
      const user = await this.authRepository.createMonitoringUser({
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
            email: user.email ?? input.email,
            timezone: user.timezone ?? input.timezone,
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

  async refresh(input: RefreshInput): Promise<RefreshServiceResult> {
    const accessSecret = getAccessTokenSecret();
    const refreshSecret = getRefreshTokenSecret();

    if (!accessSecret || !refreshSecret) {
      return {
        status: 500,
        message: "JWT secret is not configured",
      };
    }

    const payload = verifyRefreshToken(input.refreshToken, refreshSecret);

    if (!payload) {
      return {
        status: 401,
        message: "Invalid or expired refresh token",
      };
    }

    const portal = payload.portal;
    const account = payload.account;
    const userId = payload.userId;

    if (
      typeof portal !== "string" ||
      (portal !== "monitoring" && portal !== "service") ||
      typeof account !== "string" ||
      account.length === 0 ||
      typeof userId !== "string" ||
      userId.length === 0
    ) {
      return {
        status: 401,
        message: "Invalid refresh token payload",
      };
    }

    const accountRecord = await this.authRepository.findByPortalAndAccount(
      portal as AuthPortal,
      account,
    );

    if (!accountRecord || accountRecord.userId !== userId) {
      return {
        status: 401,
        message: "Refresh token user is invalid",
      };
    }

    const expiresIn = getAccessTokenExpiry(false);
    const accessToken = signAccessToken(
      {
        userId: accountRecord.userId,
        role: accountRecord.role,
        portal: portal as LoginInput["portal"],
        account,
      },
      accessSecret,
      expiresIn,
    );

    const refreshExpiresIn = getRefreshTokenExpiry();
    const refreshToken = signRefreshToken(
      {
        userId: accountRecord.userId,
        portal: portal as LoginInput["portal"],
        account,
      },
      refreshSecret,
      refreshExpiresIn,
    );

    return {
      status: 200,
      message: "Token refreshed successfully",
      data: {
        accessToken,
        refreshToken,
        user: {
          userId: accountRecord.userId,
          account,
          portal: portal as LoginInput["portal"],
          role: accountRecord.role,
        },
        cookieMaxAge: 60 * 15,
        refreshCookieMaxAge: 60 * 60 * 24 * 7,
      },
    };
  }
}