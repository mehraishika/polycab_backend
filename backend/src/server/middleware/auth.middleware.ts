import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import jwt, { type JwtPayload } from 'jsonwebtoken';

const BEARER_PREFIX = 'Bearer ';
const DEFAULT_AUTH_COOKIE_NAME = 'accessToken';

export interface AuthenticatedUser extends JwtPayload {
	userId: string;
	role?: string;
}

export type AuthenticatedRequest = NextRequest & {
	auth: AuthenticatedUser;
};

type MaybePromise<T> = T | Promise<T>;

export type AuthenticatedRouteHandler<TContext = unknown> = (
	request: AuthenticatedRequest,
	context: TContext,
) => MaybePromise<Response>;

export interface AuthMiddlewareOptions {
	jwtSecret?: string;
	tokenCookieName?: string;
}

function resolveJwtSecret(options?: AuthMiddlewareOptions): string | null {
	if (options?.jwtSecret) {
		return options.jwtSecret;
	}

	return process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? null;
}

function getUserId(payload: JwtPayload): string | null {
	const candidate = payload.userId ?? payload.user_id ?? payload.sub;

	if (typeof candidate === 'string' && candidate.length > 0) {
		return candidate;
	}

	return null;
}

function normalizeRole(payload: JwtPayload): string | undefined {
	const roleCandidate = payload.role;

	if (typeof roleCandidate === 'string' && roleCandidate.length > 0) {
		return roleCandidate;
	}

	return undefined;
}

function buildUnauthorizedResponse(message = 'Unauthorized'): Response {
	return NextResponse.json(
		{
			success: false,
			message,
		},
		{ status: 401 },
	);
}

function buildServerErrorResponse(message: string): Response {
	return NextResponse.json(
		{
			success: false,
			message,
		},
		{ status: 500 },
	);
}

export function extractAuthToken(
	request: NextRequest,
	tokenCookieName = DEFAULT_AUTH_COOKIE_NAME,
): string | null {
	const headerValue = request.headers.get('authorization');

	if (headerValue?.startsWith(BEARER_PREFIX)) {
		const token = headerValue.slice(BEARER_PREFIX.length).trim();
		return token.length > 0 ? token : null;
	}

	const cookieToken = request.cookies.get(tokenCookieName)?.value?.trim();
	return cookieToken && cookieToken.length > 0 ? cookieToken : null;
}

export function verifyAuthToken(token: string, secret: string): JwtPayload | null {
	try {
		const decoded = jwt.verify(token, secret);

		if (typeof decoded !== 'object' || !decoded) {
			return null;
		}

		return decoded;
	} catch {
		return null;
	}
}

export function requireAuth<TContext = unknown>(
	handler: AuthenticatedRouteHandler<TContext>,
	options?: AuthMiddlewareOptions,
): (request: NextRequest, context: TContext) => Promise<Response> {
	return async (request: NextRequest, context: TContext): Promise<Response> => {
		const secret = resolveJwtSecret(options);

		if (!secret) {
			return buildServerErrorResponse('JWT secret is not configured');
		}

		const token = extractAuthToken(
			request,
			options?.tokenCookieName ?? DEFAULT_AUTH_COOKIE_NAME,
		);

		if (!token) {
			return buildUnauthorizedResponse('Missing or invalid authorization token');
		}

		const payload = verifyAuthToken(token, secret);

		if (!payload) {
			return buildUnauthorizedResponse('Invalid or expired token');
		}

		const userId = getUserId(payload);

		if (!userId) {
			return buildUnauthorizedResponse('Token payload is missing user identifier');
		}

		const authenticatedRequest = request as AuthenticatedRequest;
		authenticatedRequest.auth = {
			...payload,
			userId,
			role: normalizeRole(payload),
		};

		return handler(authenticatedRequest, context);
	};
}
