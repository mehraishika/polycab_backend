import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantLogs } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { PlantLogsQueryValidator } from '@/server/validators/plant.validator';

type PlantLogsContext = {
	params: Promise<{
		plantId: string;
	}>;
};

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getPlantLogsRoute(request: NextRequest, context: PlantLogsContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantLogsQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 10,
		search: searchParams.get('search') ?? '',
		event: searchParams.get('event') ?? 'All',
		dateFrom: searchParams.get('dateFrom') ?? undefined,
		dateTo: searchParams.get('dateTo') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const { plantId } = await context.params;

	try {
		const data = await getPlantLogs({
			user: buildUser(auth),
			plantId,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			search: parsedQuery.data.search,
			event: parsedQuery.data.event,
			dateFrom: parsedQuery.data.dateFrom,
			dateTo: parsedQuery.data.dateTo,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		if (data.pagination.totalItems === 0) {
			return successResponse('No logs found.', data);
		}

		return successResponse('Plant logs fetched successfully.', data);
		// return successResponse('success', [])
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}

		return errorResponse('Failed to fetch plant logs', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantLogsRoute), { routeName: 'monitor.plants.logs' });
