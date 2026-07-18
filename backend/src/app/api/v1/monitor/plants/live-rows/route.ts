import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getLiveRows } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantLiveRowsValidator } from '@/server/validators/plant.validator';

async function getPlantLiveRowsRoute(request: NextRequest): Promise<Response> {
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
	const plantIds = (searchParams.get('plantIds') ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	const parsedQuery = PlantLiveRowsValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		selectedEndUserId: searchParams.get('selectedEndUserId') ?? undefined,
		monitorUserId: searchParams.get('monitorUserId') ?? undefined,
		status: searchParams.get('status') ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
		plantIds,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	try {
		const data = await getLiveRows({
			user,
			scope,
			plantIds: parsedQuery.data.plantIds,
			status: parsedQuery.data.status,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
		});

		return successResponse('Live plant rows fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch live plant rows', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantLiveRowsRoute), {
	routeName: 'monitor.plants.live_rows',
});
