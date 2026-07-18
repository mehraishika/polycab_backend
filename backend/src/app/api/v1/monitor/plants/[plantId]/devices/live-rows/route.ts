import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
// import { getPlantDeviceLiveRows } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { DeviceLiveRowsQueryValidator } from '@/server/validators/device.validator';

type PlantDeviceLiveRowsContext = { params: Promise<{ plantId: string }> };

async function getPlantDeviceLiveRowsRoute(request: NextRequest, context: PlantDeviceLiveRowsContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const user: User = {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceLiveRowsQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		deviceIds: searchParams.get('deviceIds') ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters', 400);
	}

	const scope = parsedQuery.data.fromService && (user.role === 'service_admin' || user.role === 'service_super_admin') && parsedQuery.data.targetEndUserId
		? [parsedQuery.data.targetEndUserId]
		: await resolveUserScope(user);
	const deviceIds = parsedQuery.data.deviceIds.split(',').map((value) => value.trim()).filter(Boolean);
	const { plantId } = await context.params;

	try {
		// const data = await getPlantDeviceLiveRows({ scope, plantId, deviceIds });
		// return successResponse('Device live rows fetched successfully.', data);
		return successResponse('success', []);
	} catch (error: unknown) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		return errorResponse('Failed to fetch device live rows', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantDeviceLiveRowsRoute), { routeName: 'monitor.plants.devices.live_rows' });
