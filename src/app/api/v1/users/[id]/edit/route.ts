import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import {
	serviceAdminEditBodySchema,
	userIdParamSchema,
} from '@/server/validators/user.validator';

const userService = new UserService();

type GetUserEditRouteContext = {
	params: Promise<{
		id: string;
	}>;
};

async function getUserEdit(
	request: NextRequest,
	context: GetUserEditRouteContext,
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

export const GET = withRequestLogging(requireAuth(getUserEdit), {
	routeName: 'users.edit',
});

async function postUserEdit(
	request: NextRequest,
	context: GetUserEditRouteContext,
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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsedBody = serviceAdminEditBodySchema.safeParse(body);

	if (!parsedBody.success) {
		const firstIssue = parsedBody.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';

		return errorResponse(message, 400);
	}

	const result = await userService.editServiceAdminById(
		parsedParams.data.id,
		actorId,
		actorRole,
		parsedBody.data,
	);

	if (result.status !== 200) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data);
}

export const POST = withRequestLogging(requireAuth(postUserEdit), {
	routeName: 'users.edit.update',
});