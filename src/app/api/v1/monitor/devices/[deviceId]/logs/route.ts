import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getDeviceLogs } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { DeviceLogsQueryValidator } from '@/server/validators/device.validator';

type DeviceLogsContext = { params: Promise<{ deviceId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getDeviceLogsRoute(request: NextRequest, context: DeviceLogsContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceLogsQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 10,
		search: searchParams.get('search') ?? '',
		event: searchParams.get('event') ?? 'All',
		dateFrom: searchParams.get('dateFrom') ?? undefined,
		dateTo: searchParams.get('dateTo') ?? undefined,
		sortBy: searchParams.get('sortBy') ?? 'time',
		sortOrder: searchParams.get('sortOrder') ?? 'desc',
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters', 400);
	}

	const { deviceId } = await context.params;

	try {
		const data = await getDeviceLogs({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			search: parsedQuery.data.search,
			event: parsedQuery.data.event,
			dateFrom: parsedQuery.data.dateFrom,
			dateTo: parsedQuery.data.dateTo,
			sortBy: parsedQuery.data.sortBy,
			sortOrder: parsedQuery.data.sortOrder,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		if (data.pagination.totalItems === 0) {
			return successResponse('No logs found.', data);
		}

		return successResponse('Device logs fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch device logs', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getDeviceLogsRoute), {
	routeName: 'monitor.devices.logs',
});
