import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { MonitorUserService } from '@/server/services/monitor-user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { monitorUserLiveSummaryQuerySchema } from '@/server/validators/monitor-user.validator';

const monitorUserService = new MonitorUserService();
async function getDashboardSummary(
    request: NextRequest,
): Promise<Response> {
    const authenticatedRequest = request as AuthenticatedRequest;

    const actorIdRaw = authenticatedRequest.auth?.userId;
    const actorRole = authenticatedRequest.auth?.role;

    if (!actorIdRaw) {
        return errorResponse('Unauthorized', 401);
    }

    const actorId = BigInt(actorIdRaw);

    const result = await monitorUserService.getDashboardSummary(
        actorId,
        actorRole,
    );

    if (result.status !== 200) {
        return errorResponse(result.message, result.status);
    }

    return successResponse(result.message, result.data);
}

export const GET = withRequestLogging(
    requireAuth(getDashboardSummary),
    {
        routeName: 'service.dashboard.summary',
    },
);