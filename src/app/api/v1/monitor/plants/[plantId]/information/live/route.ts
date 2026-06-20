import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantInformationLive } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { PlantInformationLiveQueryValidator } from '@/server/validators/plant.validator';

type PlantInformationLiveContext = {
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

async function getPlantInformationLiveRoute(
	request: NextRequest,
	context: PlantInformationLiveContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantInformationLiveQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		since: searchParams.get('since') ?? undefined,
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
		const data = await getPlantInformationLive({
			user: buildUser(auth),
			plantId,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
			since: parsedQuery.data.since,
		});

		return successResponse('Plant live information stats fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}

		return errorResponse('Failed to fetch plant live information stats', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantInformationLiveRoute), {
	routeName: 'monitor.plants.information.live',
});
