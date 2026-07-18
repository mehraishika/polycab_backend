import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantCurrentAlerts } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantCurrentAlertsQueryValidator } from '@/server/validators/plant.validator';

type PlantCurrentAlertsContext = {
	params: Promise<{
		plantId: string;
	}>;
};

async function getPlantCurrentAlertsRoute(
	request: NextRequest,
	context: PlantCurrentAlertsContext,
): Promise<Response> {
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

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantCurrentAlertsQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		status: (searchParams.get('status') as 'active' | null) ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
		since: searchParams.get('since') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const baseScope = await resolveUserScope(user);
	const hasServiceRole = user.role === 'service_admin' || user.role === 'service_super_admin';
	const scope =
		parsedQuery.data.fromService && hasServiceRole && parsedQuery.data.targetEndUserId
			? [parsedQuery.data.targetEndUserId]
			: baseScope;

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	const { plantId } = await context.params;

	try {
		const data = await getPlantCurrentAlerts({
			scope,
			plantId,
			status: parsedQuery.data.status,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			since: parsedQuery.data.since,
		});

		return successResponse(
			parsedQuery.data.since ? 'Current alerts refreshed successfully.' : 'Current alerts fetched successfully.',
			data,
		);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch current alerts', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantCurrentAlertsRoute), {
	routeName: 'monitor.plants.alerts',
});
