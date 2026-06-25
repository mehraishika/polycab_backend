import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { addPlantLogger } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { PlantAddLoggerBodyValidator } from '@/server/validators/plant.validator';

type PlantLoggersContext = {
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

async function addPlantLoggerRoute(
	request: NextRequest,
	context: PlantLoggersContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsedBody = PlantAddLoggerBodyValidator.safeParse(body);
	if (!parsedBody.success) {
		const firstIssue = parsedBody.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';
		return errorResponse(message, 400);
	}

	const { plantId } = await context.params;

	try {
		const data = await addPlantLogger({
			user: buildUser(auth),
			plantId,
			fromService: parsedBody.data.fromService,
			targetEndUserId: parsedBody.data.targetEndUserId,
			serialNumber: parsedBody.data.serialNumber,
		});

		return successResponse('Logger added successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}

		return errorResponse('Failed to add logger', 500);
	}
}

export const POST = withRequestLogging(requireAuth(addPlantLoggerRoute), {
	routeName: 'monitor.plants.loggers.add',
});
