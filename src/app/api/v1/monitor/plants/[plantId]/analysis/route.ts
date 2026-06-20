import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantAnalysis } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantAnalysisQueryValidator } from '@/server/validators/plant.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

type PlantAnalysisContext = {
	params: Promise<{
		plantId: string;
	}>;
};

async function getPlantAnalysisRoute(
	request: NextRequest,
	context: PlantAnalysisContext,
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
	const parsedQuery = PlantAnalysisQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		deviceId: searchParams.get('deviceId') ?? undefined,
		date: searchParams.get('date') ?? undefined,
		parameters: searchParams.get('parameters') ?? undefined,
		interval: (searchParams.get('interval') as '5m' | '15m' | '30m' | '60m' | null) ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const selectedParameters = parsedQuery.data.parameters
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	if (selectedParameters.length === 0) {
		return errorResponse('At least one parameter is required', 400);
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
		targetEndUserId: parsedQuery.data.targetEndUserId,
		baseScope,
		finalScope: scope,
		role: user.role,
	});

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	const { plantId } = await context.params;

	try {
		const data = await getPlantAnalysis({
			scope,
			plantId,
			deviceId: parsedQuery.data.deviceId,
			date: parsedQuery.data.date,
			parameters: selectedParameters,
			interval: parsedQuery.data.interval,
		});

		return successResponse('Plant analysis fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch plant analysis', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantAnalysisRoute), {
	routeName: 'monitor.plants.analysis.data',
});
