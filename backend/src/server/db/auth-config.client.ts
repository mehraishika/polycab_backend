import type { LoginInput } from '@/server/validators/auth.validator';

type Portal = LoginInput['portal'];

export interface AuthConfigRecord {
	portal: Portal;
	account: string;
	password?: string;
	passwordHash?: string;
	userId: string;
	role: string;
}

export interface AuthConfigClient {
	getPortalAuthConfig(portal: Portal): Promise<AuthConfigRecord | null>;
}

function readPortalEnv(portal: Portal, suffix: string): string | undefined {
	return process.env[`${portal.toUpperCase()}_${suffix}`];
}

export const authConfigClient: AuthConfigClient = {
	async getPortalAuthConfig(portal: Portal): Promise<AuthConfigRecord | null> {
		const account =
			readPortalEnv(portal, 'LOGIN_ACCOUNT') ??
			process.env.LOGIN_ACCOUNT ??
			process.env.LOGIN_EMAIL;

		if (!account) {
			return null;
		}

		const userId =
			readPortalEnv(portal, 'LOGIN_USER_ID') ?? process.env.LOGIN_USER_ID ?? account.toLowerCase();
		const role = readPortalEnv(portal, 'LOGIN_ROLE') ?? process.env.LOGIN_ROLE ?? 'ADMIN';

		return {
			portal,
			account,
			password: readPortalEnv(portal, 'LOGIN_PASSWORD') ?? process.env.LOGIN_PASSWORD,
			passwordHash:
				readPortalEnv(portal, 'LOGIN_PASSWORD_HASH') ?? process.env.LOGIN_PASSWORD_HASH,
			userId,
			role,
		};
	},
};
