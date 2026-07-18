import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { editDevice } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { DeviceEditBodyValidator } from '@/server/validators/device.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

type DeviceEditContext = { params: Promise<{ deviceId: string }> };

async function postDeviceEditRoute(request: NextRequest, context: DeviceEditContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const user: User = { userId: auth.userId, account: typeof auth.account === 'string' ? auth.account : auth.userId, role: auth.role };
	let body: unknown;
	try { body = await request.json(); } catch { return errorResponse('Invalid JSON payload', 400); }
	const parsedBody = DeviceEditBodyValidator.safeParse(body);
	if (!parsedBody.success) {
		const issue = parsedBody.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body', 400);
	}

	// const scope = await resolveUserScope(user);
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

	try {
		const data = await editDevice({ scope, plantId: parsedBody.data.plantId, deviceId, name: parsedBody.data.name });
		return successResponse('Device updated successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		return errorResponse('Failed to update device', 500);
	}
}

export const POST = withRequestLogging(requireAuth(postDeviceEditRoute), { routeName: 'monitor.devices.edit' });
