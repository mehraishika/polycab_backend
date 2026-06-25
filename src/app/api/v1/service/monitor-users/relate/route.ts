import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { MonitorUserService } from '@/server/services/monitor-user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { relateUserBodySchema } from '@/server/validators/monitor-user.validator';

const monitorUserService = new MonitorUserService();

async function postRelateMonitorUsers(request: NextRequest): Promise<Response> {
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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsed = relateUserBodySchema.safeParse(body);
	if (!parsed.success) {
		const firstIssue = parsed.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';
		return errorResponse(message, 400);
	}

	const result = await monitorUserService.relateMonitorUsers(
		actorId,
		actorRole,
		parsed.data,
	);
	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data);
}

export const POST = withRequestLogging(requireAuth(postRelateMonitorUsers), {
	routeName: 'service.monitor_users.relate',
});
