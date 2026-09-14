import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { changeUserInverterSchema } from '@/server/validators/user.validator';

const userService = new UserService();

async function changeUserInverter(
    request: NextRequest,
): Promise<Response> {
    const authenticatedRequest = request as AuthenticatedRequest;
    const actorIdRaw = authenticatedRequest.auth?.userId;

    if (!actorIdRaw) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        BigInt(actorIdRaw);
    } catch {
        return errorResponse('Invalid token payload', 401);
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid request body', 400);
    }

    const parsedBody = changeUserInverterSchema.safeParse(body);

    if (!parsedBody.success) {
        return errorResponse('Invalid request body', 400);
    }

    const result = await userService.changeUserInverter(
        parsedBody.data,
    );

    if (result.status !== 200) {
        return errorResponse(result.message, result.status);
    }

    return successResponse(result.message, null);
}

export const POST = withRequestLogging(
    requireAuth(changeUserInverter),
    {
        routeName: 'users.change-inverter-user',
    },
);