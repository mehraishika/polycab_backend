// import { prisma, type PrismaClient } from '@/server/db/prisma';
// import type { LoginInput } from '@/server/validators/auth.validator';

// type Portal = LoginInput['portal'];

// export interface AuthAccountRecord {
// 	portal: Portal;
// 	account: string;
// 	email?: string;
// 	timezone?: string;
// 	passwordHash?: string;
// 	userId: string;
// 	role: string;
// }

// type AuthUserRecord = Awaited<ReturnType<PrismaClient['user']['findFirst']>>;

// function mapRecord(record: NonNullable<AuthUserRecord>): AuthAccountRecord {
// 	return {
// 		portal: record.portal as Portal,
// 		account: record.account,
// 		email: record.email ?? undefined,
// 		timezone: record.timezone ?? undefined,
// 		passwordHash: record.passwordHash,
// 		userId: String(record.id),
// 		role: record.role,
// 	};
// }

// export class AuthRepository {
// 	constructor(private readonly dbClient: PrismaClient = prisma) { }

// 	async findByPortalAndAccount(
// 		portal: Portal,
// 		account: string,
// 	): Promise<AuthAccountRecord | null> {
// 		const record = await this.dbClient.user.findFirst({
// 			where: {
// 				portal,
// 				account: {
// 					equals: account,
// 				},
// 			},
// 		});

// 		if (!record) {
// 			return null;
// 		}

// 		return mapRecord(record);
// 	}

// 	async findByPortalAndEmail(
// 		portal: Portal,
// 		email: string,
// 	): Promise<AuthAccountRecord | null> {
// 		const record = await this.dbClient.user.findFirst({
// 			where: {
// 				portal,
// 				email: {
// 					equals: email,
// 					mode: 'insensitive',
// 				},
// 			},
// 		});

// 		if (!record) {
// 			return null;
// 		}

// 		return mapRecord(record);
// 	}

// 	async createMonitoringUser(input: {
// 		account: string;
// 		email: string;
// 		timezone: string;
// 		passwordHash: string;

// 		epcCompany: string;
// 		epcInstaller: string;
// 		epcMobile: string;
// 		epcEmail: string;
// 		epcAddress: string;
// 	}): Promise<AuthAccountRecord> {
// 		const record = await this.dbClient.user.create({
// 			data: {
// 				portal: 'monitoring',
// 				role: 'monitoring_user',
// 				account: input.account,
// 				email: input.email,
// 				timezone: input.timezone,
// 				passwordHash: input.passwordHash,

// 				epcCompany: input.epcCompany,
// 				epcInstaller: input.epcInstaller,
// 				epcMobile: input.epcMobile,
// 				epcEmail: input.epcEmail,
// 				epcAddress: input.epcAddress,

// 			},
// 		});

// 		return mapRecord(record);
// 	}
// }


import { prisma, type PrismaClient } from "@/server/db/prisma";
import type { LoginInput } from "@/server/validators/auth.validator";
import { createHash, randomBytes } from "node:crypto";

type Portal = LoginInput["portal"];

export interface AuthAccountRecord {
  portal: Portal;
  account: string;
  email?: string;
  timezone?: string;
  passwordHash?: string;
  userId: string;
  role: string;
}

type AuthUserRecord = Awaited<
  ReturnType<PrismaClient["user"]["findFirst"]>
>;

function mapRecord(
  record: NonNullable<AuthUserRecord>,
): AuthAccountRecord {
  return {
    portal: record.portal as Portal,
    account: record.account,
    email: record.email ?? undefined,
    timezone: record.timezone ?? undefined,
    passwordHash: record.passwordHash,
    userId: String(record.id),
    role: record.role,
  };
}

export class AuthRepository {
  constructor(
    private readonly dbClient: PrismaClient = prisma,
  ) {}

  async findByPortalAndAccount(
    portal: Portal,
    account: string,
  ): Promise<AuthAccountRecord | null> {
    const record = await this.dbClient.user.findFirst({
      where: {
        portal,
        account: {
          equals: account,
        },
      },
    });

    if (!record) {
      return null;
    }

    return mapRecord(record);
  }

  async findByPortalAndEmail(
    portal: Portal,
    email: string,
  ): Promise<AuthAccountRecord | null> {
    const record = await this.dbClient.user.findFirst({
      where: {
        portal,
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (!record) {
      return null;
    }

    return mapRecord(record);
  }

  async createMonitoringUser(input: {
    account: string;
    email: string;
    timezone: string;
    passwordHash: string;
    epcCompany: string;
    epcInstaller: string;
    epcMobile: string;
    epcEmail: string;
    epcAddress: string;
  }): Promise<AuthAccountRecord> {
    const record = await this.dbClient.user.create({
      data: {
        portal: "monitoring",
        role: "monitoring_user",
        account: input.account,
        email: input.email,
        timezone: input.timezone,
        passwordHash: input.passwordHash,
        epcCompany: input.epcCompany,
        epcInstaller: input.epcInstaller,
        epcMobile: input.epcMobile,
        epcEmail: input.epcEmail,
        epcAddress: input.epcAddress,
      },
    });

    return mapRecord(record);
  }

  /* ============================
     LEGACY LOGIN VERIFICATION
     ============================ */

  async createLoginVerification(input: {
    userId: string;
    code: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const verification =
      await this.dbClient.loginVerification.create({
        data: {
          userId: BigInt(input.userId),
          code: input.code,
          expiresAt: input.expiresAt,
        },
        select: {
          id: true,
        },
      });

    return verification;
  }

  async findLoginVerification(
    id: string,
  ): Promise<{
    id: string;
    userId: string;
    code: string;
    expiresAt: Date;
  } | null> {
    const verification =
      await this.dbClient.loginVerification.findUnique({
        where: {
          id,
        },
      });

    if (!verification) {
      return null;
    }

    return {
      id: verification.id,
      userId: verification.userId.toString(),
      code: verification.code,
      expiresAt: verification.expiresAt,
    };
  }

  async deleteLoginVerification(
    id: string,
  ): Promise<void> {
    await this.dbClient.loginVerification.delete({
      where: {
        id,
      },
    });
  }

  /* ============================
     TWO FACTOR
     ============================ */

  async findTwoFactorByUserId(
    userId: string,
  ): Promise<{
    userId: string;
    secretEncrypted: string | null;
    enabled: boolean;
  } | null> {
    const record =
      await this.dbClient.userTwoFactor.findUnique({
        where: {
          userId: BigInt(userId),
        },
      });

    if (!record) {
      return null;
    }

    return {
      userId: record.userId.toString(),
      secretEncrypted: record.secretEncrypted,
      enabled: record.enabled,
    };
  }

  /**
   * Creates a new 2FA record or completely replaces
   * the existing secret.
   *
   * This is intentionally used by the "NO" setup flow.
   *
   * Every time setup starts:
   * - old secret is replaced
   * - enabled becomes false
   */
  async createOrResetTwoFactor(input: {
    userId: string;
    secretEncrypted: string;
  }): Promise<{
    userId: string;
    secretEncrypted: string | null;
    enabled: boolean;
  }> {
    const record =
      await this.dbClient.userTwoFactor.upsert({
        where: {
          userId: BigInt(input.userId),
        },
        create: {
          userId: BigInt(input.userId),
          secretEncrypted: input.secretEncrypted,
          enabled: false,
        },
        update: {
          secretEncrypted: input.secretEncrypted,
          enabled: false,
        },
      });

    return {
      userId: record.userId.toString(),
      secretEncrypted: record.secretEncrypted,
      enabled: record.enabled,
    };
  }

  async enableTwoFactor(
    userId: string,
  ): Promise<void> {
    await this.dbClient.userTwoFactor.update({
      where: {
        userId: BigInt(userId),
      },
      data: {
        enabled: true,
      },
    });
  }

  async disableTwoFactor(
    userId: string,
  ): Promise<void> {
    await this.dbClient.userTwoFactor.updateMany({
      where: {
        userId: BigInt(userId),
      },
      data: {
        enabled: false,
        secretEncrypted: null,
      },
    });
  }

  /* ============================
     TWO FACTOR LOGIN CHALLENGE
     ============================ */

  async createTwoFactorLoginChallenge(input: {
    userId: string;
    remember: boolean;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const challenge =
      await this.dbClient.twoFactorLoginChallenge.create({
        data: {
          userId: BigInt(input.userId),
          remember: input.remember,
          expiresAt: input.expiresAt,
        },
        select: {
          id: true,
        },
      });

    return challenge;
  }

  async findTwoFactorLoginChallenge(
    id: string,
  ): Promise<{
    id: string;
    userId: string;
    remember: boolean;
    expiresAt: Date;
    attempts: number;
    usedAt: Date | null;
  } | null> {
    const challenge =
      await this.dbClient.twoFactorLoginChallenge.findUnique({
        where: {
          id,
        },
      });

    if (!challenge) {
      return null;
    }

    return {
      id: challenge.id,
      userId: challenge.userId.toString(),
      remember: challenge.remember,
      expiresAt: challenge.expiresAt,
      attempts: challenge.attempts,
      usedAt: challenge.usedAt,
    };
  }

  async updateTwoFactorLoginChallengeAttempts(
    id: string,
  ): Promise<void> {
    await this.dbClient.twoFactorLoginChallenge.update({
      where: {
        id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  async consumeTwoFactorLoginChallenge(
    id: string,
  ): Promise<void> {
    await this.dbClient.twoFactorLoginChallenge.update({
      where: {
        id,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  async deleteTwoFactorLoginChallenge(
    id: string,
  ): Promise<void> {
    await this.dbClient.twoFactorLoginChallenge.delete({
      where: {
        id,
      },
    });
  }

  /* ============================
     TWO FACTOR RECOVERY CODES
     ============================ */

  private hashRecoveryCode(
    code: string,
  ): string {
    return createHash("sha256")
      .update(code.trim().toUpperCase())
      .digest("hex");
  }

  async createTwoFactorRecoveryCodes(
    userId: string,
    count = 8,
  ): Promise<string[]> {
    const recoveryCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const raw = randomBytes(6)
        .toString("hex")
        .toUpperCase();

      const formatted =
        `${raw.slice(0, 4)}-` +
        `${raw.slice(4, 8)}-` +
        `${raw.slice(8, 12)}`;

      recoveryCodes.push(formatted);
    }

    await this.dbClient.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        userId: BigInt(userId),
        codeHash: this.hashRecoveryCode(code),
      })),
    });

    return recoveryCodes;
  }

  async findTwoFactorRecoveryCode(
    userId: string,
    code: string,
  ): Promise<{ id: string } | null> {
    const codeHash = this.hashRecoveryCode(code);

    const recoveryCode =
      await this.dbClient.twoFactorRecoveryCode.findFirst({
        where: {
          userId: BigInt(userId),
          codeHash,
          usedAt: null,
        },
        select: {
          id: true,
        },
      });

    if (!recoveryCode) {
      return null;
    }

    return {
      id: recoveryCode.id.toString(),
    };
  }

  async consumeTwoFactorRecoveryCode(
    recoveryCodeId: string,
  ): Promise<boolean> {
    const result =
      await this.dbClient.twoFactorRecoveryCode.updateMany({
        where: {
          id: BigInt(recoveryCodeId),
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

    return result.count === 1;
  }

  async deleteUnusedTwoFactorRecoveryCodes(
    userId: string,
  ): Promise<void> {
    await this.dbClient.twoFactorRecoveryCode.deleteMany({
      where: {
        userId: BigInt(userId),
        usedAt: null,
      },
    });
  }

  /* ============================
     USER
     ============================ */

  async findByUserId(
    userId: string,
  ): Promise<AuthAccountRecord | null> {
    const record =
      await this.dbClient.user.findUnique({
        where: {
          id: BigInt(userId),
        },
      });

    if (!record) {
      return null;
    }

    return mapRecord(record);
  }
}