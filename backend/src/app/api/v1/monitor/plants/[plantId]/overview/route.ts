import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantOverview } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantOverviewQueryValidator } from '@/server/validators/plant.validator';
import { UserRepository } from "@/server/repositories/user.repository";

const userRepository = new UserRepository();

type PlantOverviewContext = {
	params: Promise<{
		plantId: string;
	}>;
};

async function getPlantOverviewRoute(
	request: NextRequest,
	context: PlantOverviewContext,
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
	const parsedQuery = PlantOverviewQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
	});

	console.log("targetEndUserId", searchParams.get("targetEndUserId"));
	console.log("userid", searchParams.get("userid"));

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	// const baseScope = await resolveUserScope(user);
	// const hasServiceRole = user.role === 'service_admin' || user.role === 'service_super_admin';
	// const scope =
	// 	parsedQuery.data.fromService && hasServiceRole && parsedQuery.data.targetEndUserId
	// 		? [parsedQuery.data.targetEndUserId]
	// 		: baseScope;

	const baseScope = await resolveUserScope(user);

	const hasServiceRole =
		user.role === 'service_admin' ||
		user.role === 'service_super_admin';

	let scope = baseScope;

	if (
		parsedQuery.data.fromService &&
		hasServiceRole &&
		parsedQuery.data.targetEndUserId
	) {
		const accountScope =
			await userRepository.getAccountScopeByUserId(
				parsedQuery.data.targetEndUserId,
			);

		if (!accountScope) {
			return errorResponse(
				'Selected end user not found',
				404,
			);
		}

		scope = accountScope;
	}

	console.log({
		fromService: parsedQuery.data.fromService,
		hasServiceRole,
		targetEndUserId: parsedQuery.data.targetEndUserId,
		baseScope,
	});

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	const { plantId } = await context.params;

	try {
		const data = await getPlantOverview({
			scope,
			plantId,
		});
		return successResponse('Plant overview fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			if (error.statusCode === 403) {
				return errorResponse('You do not have access to this plant.', 403);
			}
			if (error.statusCode === 404) {
				return errorResponse('Plant not found.', 404);
			}
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch plant overview', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantOverviewRoute), {
	routeName: 'monitor.plants.overview',
});
