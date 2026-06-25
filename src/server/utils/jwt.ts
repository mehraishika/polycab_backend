import jwt, { type JwtPayload } from 'jsonwebtoken';

export interface AccessTokenPayload {
	userId: string;
	role: string;
	portal: 'monitoring' | 'service';
	account: string;
}

export interface RefreshTokenPayload {
	userId: string;
	portal: 'monitoring' | 'service';
	account: string;
}

export function getAccessTokenSecret(): string | null {
	return process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? null;
}

export function getAccessTokenExpiry(remember: boolean): jwt.SignOptions['expiresIn'] {
	return remember
		? ((process.env.JWT_ACCESS_EXPIRES_IN_REMEMBER ?? '7d') as jwt.SignOptions['expiresIn'])
		: ((process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn']);
}

export function getRefreshTokenSecret(): string | null {
	return process.env.JWT_REFRESH_SECRET ?? getAccessTokenSecret();
}

export function getRefreshTokenExpiry(): jwt.SignOptions['expiresIn'] {
	return (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
}

export function signAccessToken(
	payload: AccessTokenPayload,
	secret: string,
	expiresIn: jwt.SignOptions['expiresIn'],
): string {
	return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(
	payload: RefreshTokenPayload,
	secret: string,
	expiresIn: jwt.SignOptions['expiresIn'],
): string {
	return jwt.sign(payload, secret, { expiresIn });
}

export function verifyAccessToken(token: string, secret: string): JwtPayload | null {
	try {
		const decoded = jwt.verify(token, secret);

		if (!decoded || typeof decoded !== 'object') {
			return null;
		}

		return decoded;
	} catch {
		return null;
	}
}

export function verifyRefreshToken(token: string, secret: string): JwtPayload | null {
	try {
		const decoded = jwt.verify(token, secret);

		if (!decoded || typeof decoded !== 'object') {
			return null;
		}

		return decoded;
	} catch {
		return null;
	}
}
