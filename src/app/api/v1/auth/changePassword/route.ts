import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';

import { ChangePasswordValidator } from '@/server/validators/user.validator';

const userService = new UserService();

async function postChangePasswordRoute(
    request: NextRequest
): Promise<Response> {
    const authenticatedRequest = request as AuthenticatedRequest;
    const auth = authenticatedRequest.auth;

    if (!auth?.userId) {
        return errorResponse('Unauthorized', 401);
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON payload', 400);
    }

    const parsedBody = ChangePasswordValidator.safeParse(body);

    if (!parsedBody.success) {
        const firstIssue = parsedBody.error.issues[0];

        return errorResponse(
            firstIssue
                ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
                : 'Invalid request body',
            400
        );
    }

    try {
        const result =
            await userService.changePassword(
                BigInt(auth.userId),
                parsedBody.data
            );

        if (result.status !== 200) {
            return errorResponse(
                result.message,
                result.status
            );
        }
        return successResponse(
            result.message,
            null
        );
    } catch (error) {
        if (error instanceof ApiError) {
            return errorResponse(
                error.message,
                error.statusCode
            );
        }

        return errorResponse(
            'Failed to change password',
            500
        );
    }
}

export const POST = withRequestLogging(
    requireAuth(postChangePasswordRoute),
    {
        routeName: 'auth.change-password',
    }
);