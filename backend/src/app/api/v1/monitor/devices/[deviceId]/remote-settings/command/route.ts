import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { submitCommand } from '@/server/features/remote-settings/command/command.service';
import { commandBodySchema, commandQuerySchema } from '@/server/features/remote-settings/command/command.schema';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';

type RouteContext = { params: Promise<{ deviceId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function postCommandRoute(request: NextRequest, context: RouteContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = commandQuerySchema.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(
			issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters',
			400,
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsedBody = commandBodySchema.safeParse(body);
	if (!parsedBody.success) {
		const issue = parsedBody.error.issues[0];
		return errorResponse(
			issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body',
			400,
		);
	}

	const { deviceId } = await context.params;

	try {
		const result = await submitCommand({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			command: parsedBody.data.command,
			sn: parsedBody.data.sn,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		return successResponse('Remote setting command submitted successfully.', result);
	} catch (error) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		console.error(error);
		return errorResponse('Failed to submit remote setting command', 500);
	}
}

export const POST = withRequestLogging(requireAuth(postCommandRoute), {
	routeName: 'monitor.devices.remoteSettings.command.post',
});
