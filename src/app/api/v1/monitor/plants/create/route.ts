import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { createPlant } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantCreateValidator } from '@/server/validators/plant.validator';

async function postPlantCreateRoute(request: NextRequest): Promise<Response> {
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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsedBody = PlantCreateValidator.safeParse(body);
	if (!parsedBody.success) {
		const firstIssue = parsedBody.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';
		return errorResponse(message, 400);
	}

	try {
		const data = await createPlant(user, scope, parsedBody.data);
		return successResponse('Plant created successfully.', data, 201);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to create plant', 500);
	}
}

export const POST = withRequestLogging(requireAuth(postPlantCreateRoute), {
	routeName: 'monitor.plants.create',
});
