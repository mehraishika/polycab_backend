import { NextResponse, type NextRequest } from 'next/server';

import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { successResponse } from '@/server/utils/api-response';

async function postLogout(_request: NextRequest): Promise<Response> {
	const response = successResponse('Logout successful', {});
	const nextResponse = response as NextResponse;

	nextResponse.cookies.set('accessToken', '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	});

	nextResponse.cookies.set('refreshToken', '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	});

	return nextResponse;
}

export const POST = withRequestLogging(postLogout, {
	routeName: 'auth.logout',
});
