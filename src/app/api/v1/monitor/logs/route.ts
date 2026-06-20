import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getUserLogs } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { LogsQueryValidator } from '@/server/validators/plant.validator';

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getLogsRoute(request: NextRequest): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;

	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;

	const parsedQuery = LogsQueryValidator.safeParse({
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId:
			searchParams.get('targetEndUserId') ?? undefined,
		page: searchParams.get('page')
			? Number(searchParams.get('page'))
			: 1,
		pageSize: searchParams.get('pageSize')
			? Number(searchParams.get('pageSize'))
			: 10,
		search: searchParams.get('search') ?? '',
		event: searchParams.get('event') ?? 'All',
		dateFrom: searchParams.get('dateFrom') ?? undefined,
		dateTo: searchParams.get('dateTo') ?? undefined,
	});

	if (!parsedQuery.success) {
		return errorResponse('Invalid query parameters', 400);
	}

	try {
		const data = await getUserLogs({
			user: buildUser(auth),
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			search: parsedQuery.data.search,
			event: parsedQuery.data.event,
			dateFrom: parsedQuery.data.dateFrom,
			dateTo: parsedQuery.data.dateTo,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		return successResponse(
			'Logs fetched successfully.',
			data
		);
	} catch (error) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}

		return errorResponse(
			'Failed to fetch logs',
			500
		);
	}
}

export const GET = withRequestLogging(
	requireAuth(getLogsRoute),
	{
		routeName: 'monitor.logs',
	}
);