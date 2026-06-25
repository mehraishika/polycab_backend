import { prisma, type PrismaClient } from '@/server/db/prisma';
import type { LoginInput } from '@/server/validators/auth.validator';

type Portal = LoginInput['portal'];

export interface AuthAccountRecord {
	portal: Portal;
	account: string;
	email?: string;
	timezone?: string;
	passwordHash?: string;
	userId: string;
	role: string;
}

type AuthUserRecord = Awaited<ReturnType<PrismaClient['user']['findFirst']>>;

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
					mode: 'insensitive',
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
					mode: 'insensitive',
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
	}): Promise<AuthAccountRecord> {
		const record = await this.dbClient.user.create({
			data: {
				portal: 'monitoring',
				role: 'monitoring_user',
				account: input.account,
				email: input.email,
				timezone: input.timezone,
				passwordHash: input.passwordHash,
			},
		});

		return mapRecord(record);
	}
}
