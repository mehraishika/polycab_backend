import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getDeviceCurrentAlerts } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { DeviceCurrentAlertsQueryValidator } from '@/server/validators/device.validator';

type DeviceCurrentAlertsContext = { params: Promise<{ deviceId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getDeviceCurrentAlertsRoute(
	request: NextRequest,
	context: DeviceCurrentAlertsContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceCurrentAlertsQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
		status: (searchParams.get('status') as 'active' | null) ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
		since: searchParams.get('since') ?? undefined,
		sortBy: (searchParams.get('sortBy') as 'name' | 'sn' | 'event' | 'severity' | 'startedAt' | 'lastUpdatedAt' | null) ?? undefined,
		sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(
			issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters',
			400,
		);
	}

	const { deviceId } = await context.params;

	try {
		const data = await getDeviceCurrentAlerts({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			status: parsedQuery.data.status,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			since: parsedQuery.data.since,
			sortBy: parsedQuery.data.sortBy,
			sortOrder: parsedQuery.data.sortOrder,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		if (Array.isArray(data.items) && data.items.length === 0) {
			return successResponse('No current alerts found.', data);
		}

		const message = parsedQuery.data.since
			? 'Device current alerts refreshed successfully.'
			: 'Device current alerts fetched successfully.';

		return successResponse(message, data);
		// return successResponse('success', []);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch device current alerts', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getDeviceCurrentAlertsRoute), {
	routeName: 'monitor.devices.alerts',
});
