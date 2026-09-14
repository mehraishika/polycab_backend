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

type AuthUserRecord = Awaited<ReturnType<PrismaClient["user"]["findFirst"]>>;

function mapRecord(record: NonNullable<AuthUserRecord>): AuthAccountRecord {
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
  constructor(private readonly dbClient: PrismaClient = prisma) {}

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
  async createLoginVerification(input: {
    userId: string;
    code: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const verification = await this.dbClient.loginVerification.create({
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
  async findLoginVerification(id: string): Promise<{
    id: string;
    userId: string;
    code: string;
    expiresAt: Date;
  } | null> {
    const verification = await this.dbClient.loginVerification.findUnique({
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
  async deleteLoginVerification(id: string): Promise<void> {
    await this.dbClient.loginVerification.delete({
      where: {
        id,
      },
    });
  }
  async findByUserId(userId: string): Promise<AuthAccountRecord | null> {
    const record = await this.dbClient.user.findUnique({
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
