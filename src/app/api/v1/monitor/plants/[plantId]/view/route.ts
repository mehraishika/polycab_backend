import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantDetails } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantViewValidator } from '@/server/validators/plant.validator';

type GetPlantViewContext = {
	params: Promise<{
		plantId: string;
	}>;
};

async function getPlantViewRoute(
	request: NextRequest,
	context: GetPlantViewContext,
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

	const scope = await resolveUserScope(user);
	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantViewValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const { plantId } = await context.params;
	if (!/^\d+$/.test(plantId)) {
		return errorResponse('Invalid plant id', 400);
	}

	try {
		const data = await getPlantDetails(user, scope, plantId);
		return successResponse('Plant details fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch plant details', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantViewRoute), {
	routeName: 'monitor.plants.view',
});
