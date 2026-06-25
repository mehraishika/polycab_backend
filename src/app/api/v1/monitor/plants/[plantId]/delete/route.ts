import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { deletePlant } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantDeleteValidator } from '@/server/validators/plant.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

type PostPlantDeleteContext = {
	params: Promise<{
		plantId: string;
	}>;
};

async function postPlantDeleteRoute(
	request: NextRequest,
	context: PostPlantDeleteContext,
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
	const fromService = searchParams.get('fromService') === 'true';
	const targetEndUserId = searchParams.get('targetEndUserId') ?? undefined;

	const baseScope = await resolveUserScope(user);

	const hasServiceRole =
		user.role === 'service_admin' ||
		user.role === 'service_super_admin';

	let scope = baseScope;

	if (
		fromService &&
		hasServiceRole &&
		targetEndUserId
	) {
		const accountScope =
			await userRepository.getAccountScopeByUserId(
				targetEndUserId,
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
		fromService,
		targetEndUserId,
		baseScope,
		finalScope: scope,
		role: user.role,
	});

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	// const scope = await resolveUserScope(user);
	// if (scope.length === 0) {
	// 	return errorResponse('Unauthorized access to plants', 403);
	// }

	const { plantId } = await context.params;
	if (!/^\d+$/.test(plantId)) {
		return errorResponse('Invalid plant id', 400);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsedBody = PlantDeleteValidator.safeParse(body);
	if (!parsedBody.success) {
		const firstIssue = parsedBody.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';
		return errorResponse(message, 400);
	}

	try {
		const data = await deletePlant(user, scope, plantId);
		return successResponse('Plant deleted successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to delete plant', 500);
	}
}

export const POST = withRequestLogging(requireAuth(postPlantDeleteRoute), {
	routeName: 'monitor.plants.delete',
});
