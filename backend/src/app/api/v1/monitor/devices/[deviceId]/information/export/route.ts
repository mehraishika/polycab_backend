import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { exportDeviceInformation } from '@/server/services/device.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { DeviceInformationExportQueryValidator } from '@/server/validators/device.validator';

type DeviceInformationExportContext = { params: Promise<{ deviceId: string }> };

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function exportDeviceInformationRoute(
	request: NextRequest,
	context: DeviceInformationExportContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;
	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = DeviceInformationExportQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService')
			? searchParams.get('fromService') === 'true'
			: undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		plantId: searchParams.get('plantId') ?? undefined,
		dateFrom: searchParams.get('dateFrom') ?? undefined,
		dateTo: searchParams.get('dateTo') ?? undefined,
		format: searchParams.get('format') ?? undefined,
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
		const data = await exportDeviceInformation({
			user: buildUser(auth),
			deviceId,
			plantId: parsedQuery.data.plantId,
			dateFrom: parsedQuery.data.dateFrom,
			dateTo: parsedQuery.data.dateTo,
			format: parsedQuery.data.format,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});

		// return successResponse('Device information export generated successfully.', {
		// 	fileName: data.fileName,
		// 	downloadUrl: data.downloadUrl,
		// 	expiresAt: data.expiresAt,
		// });

		return new Response(data.csv, {
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="${data.fileName}"`,
			},
		});
		// return successResponse('success', []);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}
		return errorResponse('Failed to export device information', 500);
	}
}

export const GET = withRequestLogging(requireAuth(exportDeviceInformationRoute), {
	routeName: 'monitor.devices.information.export',
});
