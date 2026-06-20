import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { userIdParamSchema } from '@/server/validators/user.validator';

const userService = new UserService();

type GetUserViewRouteContext = {
	params: Promise<{
		id: string;
	}>;
};

async function getUserView(
	request: NextRequest,
	context: GetUserViewRouteContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const actorIdRaw = authenticatedRequest.auth?.userId;
	const actorRole = authenticatedRequest.auth?.role;

	if (!actorIdRaw) {
		return errorResponse('Unauthorized', 401);
	}

	let actorId: bigint;
	try {
		actorId = BigInt(actorIdRaw);
	} catch {
		return errorResponse('Invalid token payload', 401);
	}

	const params = await context.params;
	const parsedParams = userIdParamSchema.safeParse(params);

	if (!parsedParams.success) {
		return errorResponse('Invalid user id', 400);
	}

	const result = await userService.getServiceAdminViewById(
		parsedParams.data.id,
		actorId,
		actorRole,
	);

	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data);
}

export const GET = withRequestLogging(requireAuth(getUserView), {
	routeName: 'users.view',
});