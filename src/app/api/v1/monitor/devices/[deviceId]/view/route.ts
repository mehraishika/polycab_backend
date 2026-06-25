import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getDeviceView } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { DeviceViewQueryValidator } from '@/server/validators/device.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

type DeviceViewContext = { params: Promise<{ deviceId: string }> };

async function getDeviceViewRoute(request: NextRequest, context: DeviceViewContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const user: User = { userId: auth.userId, account: typeof auth.account === 'string' ? auth.account : auth.userId, role: auth.role };
	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceViewQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		plantId: searchParams.get('plantId') ?? undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters', 400);
	}

	// const scope = await resolveUserScope(user);
	const baseScope = await resolveUserScope(user);

	const hasServiceRole =
		user.role === 'service_admin' ||
		user.role === 'service_super_admin';

	let scope = baseScope;

	if (
		parsedQuery.data.fromService &&
		hasServiceRole &&
		parsedQuery.data.targetEndUserId
	) {
		const accountScope =
			await userRepository.getAccountScopeByUserId(
				parsedQuery.data.targetEndUserId,
			);

		if (!accountScope) {
			return errorResponse(
				'Selected end user not found',
				404,
			);
		}

		scope = accountScope;
	}
	const { deviceId } = await context.params;

	try {
		const data = await getDeviceView({ scope, plantId: parsedQuery.data.plantId, deviceId });
		return successResponse('Device details fetched successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		return errorResponse('Failed to fetch device details', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getDeviceViewRoute), { routeName: 'monitor.devices.view' });
