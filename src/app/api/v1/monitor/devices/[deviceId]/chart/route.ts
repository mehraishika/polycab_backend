import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getDeviceChart } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { DeviceChartQueryValidator } from '@/server/validators/device.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

type DeviceChartContext = { params: Promise<{ deviceId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getDeviceChartRoute(request: NextRequest, context: DeviceChartContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceChartQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
		date: searchParams.get('date') ?? undefined,
		range: searchParams.get('range') ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters', 400);
	}

	const { deviceId } = await context.params;

	try {
		const data = await getDeviceChart({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			date: parsedQuery.data.date,
			range: parsedQuery.data.range,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		if (Array.isArray(data.points) && data.points.length === 0) {
			return successResponse('No device chart data found.', data);
		}

		const message = data.range === 'month'
			? 'Device monthly chart data fetched successfully.'
			: data.range === 'year'
				? 'Device yearly chart data fetched successfully.'
				: 'Device chart data fetched successfully.';

		return successResponse(message, data);
		return successResponse('success', []);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to fetch device chart data', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getDeviceChartRoute), {
	routeName: 'monitor.devices.chart',
});
