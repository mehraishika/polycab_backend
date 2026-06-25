import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantList } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantListValidator } from '@/server/validators/plant.validator';

async function getPlantListRoute(request: NextRequest): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const user: User = {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};

	const scope = await resolveUserScope(user);
	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}


	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantListValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		selectedEndUserId:
			searchParams.get('userid') ??
			searchParams.get('selectedEndUserId') ??
			undefined,
		monitorUserId: searchParams.get('monitorUserId') ?? undefined,
		status: searchParams.get('status') ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
		search: searchParams.get('search') ?? undefined,
		sortBy: searchParams.get('sortBy') ?? undefined,
		sortOrder: searchParams.get('sortOrder') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	try {
		const data = await getPlantList({
			user,
			scope,
			selectedEndUserId: parsedQuery.data.selectedEndUserId,
			search: parsedQuery.data.search,
			status: parsedQuery.data.status,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			sortBy: parsedQuery.data.sortBy,
			sortOrder: parsedQuery.data.sortOrder,
		});

		return successResponse('Plant list fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch plant list', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantListRoute), {
	routeName: 'monitor.plants.list',
});
