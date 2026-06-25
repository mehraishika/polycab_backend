import type { NextRequest } from 'next/server';

import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { ApiError } from '@/server/utils/api-error';
import {
    errorResponse,
    successResponse,
} from '@/server/utils/api-response';
import {
    ForgotPasswordValidator,
} from '@/server/validators/user.validator';

const userService = new UserService();

async function postForgotPasswordRoute(
    request: NextRequest,
): Promise<Response> {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return errorResponse(
            'Invalid JSON payload',
            400,
        );
    }

    const parsedBody =
        ForgotPasswordValidator.safeParse(
            body,
        );

    if (!parsedBody.success) {
        const firstIssue =
            parsedBody.error.issues[0];

        return errorResponse(
            firstIssue
                ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
                : 'Invalid request body',
            400,
        );
    }

    try {
        const result =
            await userService.forgotPassword(
                parsedBody.data,
            );

        if (result.status !== 200) {
            return errorResponse(
                result.message,
                result.status,
            );
        }

        return successResponse(
            result.message,
            null,
        );
    } catch (error) {
        if (error instanceof ApiError) {
            return errorResponse(
                error.message,
                error.statusCode,
            );
        }

        return errorResponse(
            'Failed to reset password',
            500,
        );
    }
}

export const POST = withRequestLogging(
    postForgotPasswordRoute,
    {
        routeName: 'auth.forgot-password',
    },
);