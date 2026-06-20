import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { userIdParamSchema } from '@/server/validators/user.validator';

const userService = new UserService();

type GetUserViewRouteContext = {
    params: Promise<{
        id: string;
    }>;
};

async function getServiceAdminList(
    request: NextRequest,
): Promise<Response> {
    const authenticatedRequest = request as AuthenticatedRequest;

    const actorIdRaw = authenticatedRequest.auth?.userId;
    const actorRole = authenticatedRequest.auth?.role;

    if (!actorIdRaw) {
        return errorResponse('Unauthorized', 401);
    }

    const actorId = BigInt(actorIdRaw);

    const result = await userService.getServiceAdminList(
        actorId,
        actorRole,
    );

    if (result.status !== 200) {
        return errorResponse(result.message, result.status);
    }

    return successResponse(result.message, result.data);
}

export const GET = withRequestLogging(
    requireAuth(getServiceAdminList),
    {
        routeName: 'users.admins.list',
    },
);