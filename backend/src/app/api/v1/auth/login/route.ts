import { NextResponse, type NextRequest } from 'next/server';

import { AuthService } from '@/server/services/auth.service';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { loginSchema } from '@/server/validators/auth.validator';

const authService = new AuthService();

function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for');

    if (forwardedFor) {
        const firstForwardedIp = forwardedFor.split(',')[0]?.trim();

        if (firstForwardedIp) {
            return firstForwardedIp;
        }
    }

    const realIp = request.headers.get('x-real-ip')?.trim();
    return realIp && realIp.length > 0 ? realIp : 'unknown';
}

async function postLogin(request: NextRequest): Promise<Response> {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON payload', 400);
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
        return errorResponse('Invalid request body', 400);
    }
    console.log("login>>", parsed);

    const result = await authService.login(parsed.data);
    console.log("login1>>", result);

    if (result.status !== 200) {
        if (result.status === 401) {
            console.warn('[AUTH_LOGIN_401]', {
                path: '/api/v1/auth/login',
                method: 'POST',
                message: result.message,
                reason: result.errorCode ?? 'UNKNOWN',
                portal: parsed.data.portal,
                account: parsed.data.account,
                remember: parsed.data.remember,
                ip: getClientIp(request),
                userAgent: request.headers.get('user-agent') ?? 'unknown',
                requestId: request.headers.get('x-request-id') ?? null,
                occurredAt: new Date().toISOString(),
            });
        }

        return errorResponse(result.message, result.status);
    }

    const response = successResponse(result.message, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
        redirect: result.data.redirect,
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

export const POST = withRequestLogging(postLogin, {
    routeName: 'auth.login',
});
