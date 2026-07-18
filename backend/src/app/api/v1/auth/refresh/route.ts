import { NextResponse, type NextRequest } from 'next/server';

import { AuthService } from '@/server/services/auth.service';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { refreshSchema } from '@/server/validators/auth.validator';

const authService = new AuthService();

function pickRefreshTokenFromCookie(request: NextRequest): string | null {
	const token = request.cookies.get('refreshToken')?.value?.trim();
	return token && token.length > 0 ? token : null;
}

async function postRefresh(request: NextRequest): Promise<Response> {
	let refreshToken = pickRefreshTokenFromCookie(request);

	if (!refreshToken) {
		let body: unknown;

		try {
			body = await request.json();
		} catch {
			return errorResponse('Missing refresh token', 401);
		}

		const parsed = refreshSchema.safeParse(body);

		if (!parsed.success) {
			return errorResponse('Missing refresh token', 401);
		}

		refreshToken = parsed.data.refreshToken;
	}

	const result = await authService.refresh({ refreshToken });

	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	const response = successResponse(result.message, {
		accessToken: result.data.accessToken,
		refreshToken: result.data.refreshToken,
		user: result.data.user,
	});

	const nextResponse = response as NextResponse;
	nextResponse.cookies.set('accessToken', result.data.accessToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: result.data.cookieMaxAge,
	});

	nextResponse.cookies.set('refreshToken', result.data.refreshToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: result.data.refreshCookieMaxAge,
	});

	return nextResponse;
}

export const POST = withRequestLogging(postRefresh, {
	routeName: 'auth.refresh',
});
