import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { addPlantInverter, getPlantDeviceList } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { DeviceAddBodyValidator, DeviceListQueryValidator } from '@/server/validators/device.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();
type PlantDevicesContext = { params: Promise<{ plantId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

function resolveScope(user: User, fromService?: boolean, targetEndUserId?: string) {
	if (fromService && (user.role === 'service_admin' || user.role === 'service_super_admin') && targetEndUserId) {
		return [targetEndUserId];
	}

	return resolveUserScope(user);
}

async function getPlantDevicesRoute(request: NextRequest, context: PlantDevicesContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const user = buildUser(auth);
	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceListQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
		pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
		sortBy: (searchParams.get('sortBy') as 'name' | 'type' | 'sn' | 'power' | 'today' | 'total' | 'hours' | null) ?? undefined,
		sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? undefined,
	});

	if (!parsedQuery.success) {
		const issue = parsedQuery.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'query'}: ${issue.message}` : 'Invalid query parameters', 400);
	}

	// const scope = await resolveScope(user, parsedQuery.data.fromService, parsedQuery.data.targetEndUserId);
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

	console.log({
		fromService: parsedQuery.data.fromService,
		targetEndUserId: parsedQuery.data.targetEndUserId,
		baseScope,
		finalScope: scope,
	});
	const { plantId } = await context.params;

	try {
		const data = await getPlantDeviceList({
			scope,
			plantId,
			page: parsedQuery.data.page,
			pageSize: parsedQuery.data.pageSize,
			sortBy: parsedQuery.data.sortBy,
			sortOrder: parsedQuery.data.sortOrder,
		});
		return successResponse('Plant devices fetched successfully.', data);
	} catch (error) {
		console.error('FULL ERROR =>', error);

		throw error;
	}
}

async function postPlantDeviceRoute(request: NextRequest, context: PlantDevicesContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) return errorResponse('Unauthorized', 401);

	const user = buildUser(auth);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsedBody = DeviceAddBodyValidator.safeParse(body);
	if (!parsedBody.success) {
		const issue = parsedBody.error.issues[0];
		return errorResponse(issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body', 400);
	}
	const searchParams = new URL(request.url).searchParams;

	const fromService =
		searchParams.get('fromService') === 'true';

	const targetEndUserId =
		searchParams.get('targetEndUserId') ?? undefined;
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

		if (!accountScope) {
			return errorResponse(
				'Selected end user not found',
				404,
			);
		}

		scope = accountScope;
	}
	// const scope = await resolveScope(user, parsedBody.data.fromService, undefined);
	const { plantId } = await context.params;

	try {
		const data = await addPlantInverter({
			scope,
			plantId,
			serialNumber: parsedBody.data.serialNumber
			// type: parsedBody.data.type,
		});
		return successResponse('Inverter added successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) return errorResponse(error.message, error.statusCode);
		return errorResponse('Failed to add inverter', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantDevicesRoute), { routeName: 'monitor.plants.devices.list' });
export const POST = withRequestLogging(requireAuth(postPlantDeviceRoute), { routeName: 'monitor.plants.devices.add' });
