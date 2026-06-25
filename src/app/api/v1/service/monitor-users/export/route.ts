import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { MonitorUserService } from '@/server/services/monitor-user.service';
import { errorResponse } from '@/server/utils/api-response';
import { monitorUserListQuerySchema } from '@/server/validators/monitor-user.validator';

const monitorUserService = new MonitorUserService();

async function exportMonitorUsers(request: NextRequest): Promise<Response> {
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

	const parsed = monitorUserListQuerySchema.safeParse({
		page: 1,
		pageSize: 100,
		status: searchParams.get('status') ?? undefined,
		sortBy: searchParams.get('sortBy') ?? undefined,
		sortOrder: searchParams.get('sortOrder') ?? undefined,
		searchUser: searchParams.get('searchUser') ?? undefined,
		searchSN: searchParams.get('searchSN') ?? undefined,
		searchInstallationDate:
			searchParams.get('searchInstallationDate') ?? undefined,
		searchAffiliation:
			searchParams.get('searchAffiliation') ?? undefined,
	});

	if (!parsed.success) {
		const firstIssue = parsed.error.issues[0];

		return errorResponse(
			firstIssue
				? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
				: 'Invalid query parameters',
			400,
		);
	}

	const result = await monitorUserService.exportMonitorUsers(
		actorId,
		actorRole,
		parsed.data,
	);

	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	return new Response(result.csv, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition':
				'attachment; filename="monitor-users.csv"',
		},
	});
}

export const GET = withRequestLogging(
	requireAuth(exportMonitorUsers),
	{
		routeName: 'service.monitor_users.export',
	},
);