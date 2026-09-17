import {
  generateSecret,
  generateURI,
  verify,
} from "otplib";

import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
} from "@/server/utils/two-factor-encryption";

export interface TwoFactorSetupData {
  secret: string;
  encryptedSecret: string;
  otpauthUrl: string;
}

export class TwoFactorService {
  generateSetup(
    account: string,
  ): TwoFactorSetupData {
    const secret = generateSecret();

    const otpauthUrl = generateURI({
      issuer: "Polycab",
      label: account,
      secret,
    });

    const encryptedSecret =
      encryptTwoFactorSecret(secret);

    return {
      secret,
      encryptedSecret,
      otpauthUrl,
    };
  }

  async verifyCode(
    encryptedSecret: string,
    code: string,
  ): Promise<boolean> {
    const normalizedCode =
      code.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      return false;
    }

    if (!encryptedSecret) {
      return false;
    }

    try {
      const secret =
        decryptTwoFactorSecret(
          encryptedSecret,
        );

      const result = await verify({
        secret,
        token: normalizedCode,
      });

      return result.valid;
    } catch {
      return false;
    }
  }
}