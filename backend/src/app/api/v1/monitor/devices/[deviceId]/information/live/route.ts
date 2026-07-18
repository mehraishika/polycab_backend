import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
// import { getDeviceInformationLive } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { DeviceInformationLiveQueryValidator } from '@/server/validators/device.validator';

type DeviceInformationLiveContext = { params: Promise<{ deviceId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getDeviceInformationLiveRoute(
	request: NextRequest,
	context: DeviceInformationLiveContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceInformationLiveQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
		since: searchParams.get('since') ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(
			issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters',
			400,
		);
	}

	const { deviceId } = await context.params;

	try {
		// const data = await getDeviceInformationLive({
		// 	user: buildUser(auth),
		// 	deviceId,
		// 	plantId: parsedQuery.data.plantId,
		// 	since: parsedQuery.data.since,
		// 	fromService: parsedQuery.data.fromService,
		// 	targetEndUserId: parsedQuery.data.targetEndUserId,
		// });

		// return successResponse('Device information live data fetched successfully.', data);
		return successResponse('success', []);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch device information live data', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getDeviceInformationLiveRoute), {
	routeName: 'monitor.devices.information.live',
});
