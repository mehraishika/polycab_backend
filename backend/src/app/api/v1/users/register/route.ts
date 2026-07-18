import { type NextRequest } from 'next/server';

import { UserService } from '@/server/services/user.service';
import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { createSubUserSchema } from '@/server/validators/user.validator';

const userService = new UserService();

async function postRegisterSubUser(request: NextRequest): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const assignedByIdRaw = authenticatedRequest.auth?.userId;

	if (!assignedByIdRaw) {
		return errorResponse('Unauthorized', 401);
	}

	let assignedById: bigint;
	try {
		assignedById = BigInt(assignedByIdRaw);
	} catch {
		return errorResponse('Invalid token payload', 401);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsed = createSubUserSchema.safeParse(body);

	if (!parsed.success) {
		const firstIssue = parsed.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';

		return errorResponse(message, 400);
	}

	const result = await userService.createSubUser(parsed.data, assignedById);

	if (result.status !== 201) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data, 201);
}

export const POST = withRequestLogging(
	requireAuth(postRegisterSubUser),
	{ routeName: 'users.register' },
);
