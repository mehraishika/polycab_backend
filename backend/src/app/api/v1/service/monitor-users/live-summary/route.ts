import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { MonitorUserService } from '@/server/services/monitor-user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { monitorUserLiveSummaryQuerySchema } from '@/server/validators/monitor-user.validator';

const monitorUserService = new MonitorUserService();

async function getLiveSummary(request: NextRequest): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const actorIdRaw = authenticatedRequest.auth?.userId;
	const actorRole = authenticatedRequest.auth?.role;

	if (!actorIdRaw) {
		return errorResponse('Unauthorized', 401);
	}

	let actorId: bigint;
	try {
		actorId = BigInt(actorIdRaw);
	} catch {
		return errorResponse('Invalid token payload', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = monitorUserLiveSummaryQuerySchema.safeParse({
		monitorUserIds: searchParams.get('monitorUserIds') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const monitorUserIds = parsedQuery.data.monitorUserIds
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	if (monitorUserIds.length === 0 || monitorUserIds.some((value) => !/^\d+$/.test(value))) {
		return errorResponse('monitorUserIds must be a comma separated list of positive integers', 400);
	}

	const result = await monitorUserService.getMonitorUserLiveSummary(
		actorId,
		actorRole,
		monitorUserIds.map((id) => BigInt(id)),
	);

	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data);
}

export const GET = withRequestLogging(requireAuth(getLiveSummary), {
	routeName: 'service.monitor_users.live_summary',
});
