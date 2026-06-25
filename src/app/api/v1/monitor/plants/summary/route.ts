import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantSummary } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantSummaryValidator } from '@/server/validators/plant.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

async function getPlantSummaryRoute(request: NextRequest): Promise<Response> {
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

	// const scope = await resolveUserScope(user);
	// if (scope.length === 0) {
	// 	return errorResponse('Unauthorized access to plants', 403);
	// }

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantSummaryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		selectedEndUserId: searchParams.get('selectedEndUserId') ?? undefined,
		monitorUserId: searchParams.get('monitorUserId') ?? undefined,
		search: searchParams.get('search') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const baseScope = await resolveUserScope(user);
	// console.log('Base Scope:', baseScope);

	const hasServiceRole =
		user.role === 'service_admin' ||
		user.role === 'service_super_admin';

	let scope = baseScope;

	if (
		parsedQuery.data.fromService &&
		hasServiceRole &&
		parsedQuery.data.selectedEndUserId
	) {
		const accountScope =
			await userRepository.getAccountScopeByUserId(
				parsedQuery.data.selectedEndUserId,
			);
		// console.log('Selected End User Account Scope:', accountScope);

		if (!accountScope) {
			return errorResponse(
				'Selected end user not found',
				404,
			);
		}

		scope = accountScope;
	}
	// console.log('Final Scope Used:', scope);
	// console.log('Plant Summary Query:', {
	// 	fromService: parsedQuery.data.fromService,
	// 	selectedEndUserId: parsedQuery.data.selectedEndUserId,
	// 	role: user.role,
	// 	userId: user.userId,
	// });

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	try {
		const data = await getPlantSummary({
			user,
			scope,
			search: parsedQuery.data.search,
		});

		return successResponse('Plant live summary fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch plant summary', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantSummaryRoute), {
	routeName: 'monitor.plants.summary',
});
