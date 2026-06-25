import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { deleteDevice } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { DeviceDeleteBodyValidator } from '@/server/validators/device.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();
type DeviceDeleteContext = { params: Promise<{ deviceId: string }> };

async function postDeviceDeleteRoute(request: NextRequest, context: DeviceDeleteContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const user: User = { userId: auth.userId, account: typeof auth.account === 'string' ? auth.account : auth.userId, role: auth.role };
	let body: unknown;
	try { body = await request.json(); } catch { return errorResponse('Invalid JSON payload', 400); }
	const parsedBody = DeviceDeleteBodyValidator.safeParse(body);
	if (!parsedBody.success) {
		const issue = parsedBody.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body', 400);
	}

	// const scope = await resolveUserScope(user);
	// console.log(scope);
	const searchParams = new URL(request.url).searchParams;
	const fromService = searchParams.get('fromService') === 'true';
	const targetEndUserId = searchParams.get('targetEndUserId') ?? undefined;

	const baseScope = await resolveUserScope(user);

	const hasServiceRole =
		user.role === 'service_admin' ||
		user.role === 'service_super_admin';

	let scope = baseScope;

	if (
		fromService &&
		hasServiceRole &&
		targetEndUserId
	) {
		const accountScope =
			await userRepository.getAccountScopeByUserId(
				targetEndUserId,
			);

		// console.log('accountScope =>', accountScope);


		if (!accountScope) {
			return errorResponse(
				'Selected end user not found',
				404,
			);
		}

		scope = accountScope;
	}

	console.log({
		fromService,
		targetEndUserId,
		baseScope,
		finalScope: scope,
		role: user.role,
	});

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}
	const { deviceId } = await context.params;
	console.log("devicid", deviceId)

	try {
		const data = await deleteDevice({ scope, plantId: parsedBody.data.plantId, deviceId, reason: parsedBody.data.reason });
		return successResponse('Device deleted successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		return errorResponse('Failed to delete device', 500);
	}
}

export const POST = withRequestLogging(requireAuth(postDeviceDeleteRoute), { routeName: 'monitor.devices.delete' });
