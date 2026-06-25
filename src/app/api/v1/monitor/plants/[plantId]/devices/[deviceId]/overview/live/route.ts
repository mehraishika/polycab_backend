import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantDeviceOverviewLive } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { PlantDeviceOverviewLiveQueryValidator } from '@/server/validators/plant.validator';

type PlantDeviceOverviewLiveContext = {
	params: Promise<{
		plantId: string;
		deviceId: string;
	}>;
};

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

function accessDeniedResponse(plantId: string, deviceId: string): Response {
	return NextResponse.json(
		{
			success: false,
			message: 'You do not have access to this device.',
			error: {
				code: 'DEVICE_ACCESS_DENIED',
				plantId,
				deviceId,
			},
		},
		{ status: 403 },
	);
}

async function getPlantDeviceOverviewLiveRoute(
	request: NextRequest,
	context: PlantDeviceOverviewLiveContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantDeviceOverviewLiveQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		since: searchParams.get('since') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const { plantId, deviceId } = await context.params;

	try {
		const data = await getPlantDeviceOverviewLive({
			user: buildUser(auth),
			plantId,
			deviceId,
			since: parsedQuery.data.since,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		return successResponse('Device overview live data fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			if (error.statusCode === 403) {
				return accessDeniedResponse(plantId, deviceId);
			}
			if (error.statusCode === 404) {
				return errorResponse(error.message, 404);
			}
			return errorResponse(error.message, error.statusCode);
		}

		return errorResponse('Failed to fetch device overview live data', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantDeviceOverviewLiveRoute), {
	routeName: 'monitor.plants.devices.overview.live',
});
