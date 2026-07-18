import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { MonitorUserService } from '@/server/services/monitor-user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { monitorUserStatusCountsQuerySchema } from '@/server/validators/monitor-user.validator';

const monitorUserService = new MonitorUserService();

async function getMonitorUserStatusCounts(request: NextRequest): Promise<Response> {
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
	const parsedQuery = monitorUserStatusCountsQuerySchema.safeParse({
		searchUser: searchParams.get('searchUser') ?? undefined,
		searchSN: searchParams.get('searchSN') ?? undefined,
		searchInstallationDate: searchParams.get('searchInstallationDate') ?? undefined,
		searchAffiliation: searchParams.get('searchAffiliation') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const result = await monitorUserService.getMonitorUserStatusCounts(
		actorId,
		actorRole,
		parsedQuery.data,
	);

	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data);
}

export const GET = withRequestLogging(requireAuth(getMonitorUserStatusCounts), {
	routeName: 'service.monitor_users.status_counts',
});
