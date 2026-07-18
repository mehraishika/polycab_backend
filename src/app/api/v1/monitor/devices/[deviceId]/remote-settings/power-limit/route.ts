import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import {
	getPowerLimit,
	submitPowerLimit,
} from '@/server/features/remote-settings/power-limit/power-limit.service';
import {
	powerLimitBodySchema,
	powerLimitQuerySchema,
} from '@/server/features/remote-settings/power-limit/power-limit.schema';
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

function parseScopeQuery(request: NextRequest) {
	const searchParams = new URL(request.url).searchParams;

	return powerLimitQuerySchema.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
	});
}

async function getPowerLimitRoute(request: NextRequest, context: RouteContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const parsedQuery = parseScopeQuery(request);
	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(
			issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters',
			400,
		);
	}

	const { deviceId } = await context.params;

	try {
		const settings = await getPowerLimit({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		return successResponse('Remote settings fetched successfully.', settings);
	} catch (error) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		console.error(error);
		return errorResponse('Failed to fetch remote settings', 500);
	}
}

async function postPowerLimitRoute(request: NextRequest, context: RouteContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const parsedQuery = parseScopeQuery(request);
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

	const parsedBody = powerLimitBodySchema.safeParse(body);
	if (!parsedBody.success) {
		const issue = parsedBody.error.issues[0];
		return errorResponse(
			issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body',
			400,
		);
	}

	const { deviceId } = await context.params;

	try {
		const result = await submitPowerLimit({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			settings: parsedBody.data.settings,
			sn: parsedBody.data.sn,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		return successResponse('Remote settings submitted successfully.', result);
	} catch (error) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		console.error(error);
		return errorResponse('Failed to submit remote settings', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPowerLimitRoute), {
	routeName: 'monitor.devices.remoteSettings.powerLimit.get',
});
export const POST = withRequestLogging(requireAuth(postPowerLimitRoute), {
	routeName: 'monitor.devices.remoteSettings.powerLimit.post',
});
