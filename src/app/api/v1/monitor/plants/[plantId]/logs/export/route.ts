import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { exportPlantLogs } from '@/server/services/plant.service';
import { ApiError } from '@/server/utils/api-error';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { PlantLogsExportQueryValidator } from '@/server/validators/plant.validator';

type PlantLogsExportContext = {
	params: Promise<{
		plantId: string;
	}>;
};

function buildUser(auth: AuthenticatedRequest['auth']): User {
	return {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};
}

async function getPlantLogsExportRoute(request: NextRequest, context: PlantLogsExportContext): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantLogsExportQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		search: searchParams.get('search') ?? '',
		event: searchParams.get('event') ?? 'All',
		dateFrom: searchParams.get('dateFrom') ?? undefined,
		dateTo: searchParams.get('dateTo') ?? undefined,
		format: (searchParams.get('format') as 'csv' | null) ?? 'csv',
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const { plantId } = await context.params;

	try {
		const data = await exportPlantLogs({
			user: buildUser(auth),
			plantId,
			search: parsedQuery.data.search,
			event: parsedQuery.data.event,
			dateFrom: parsedQuery.data.dateFrom,
			dateTo: parsedQuery.data.dateTo,
			format: parsedQuery.data.format,
			fromService: parsedQuery.data.fromService,
			targetEndUserId: parsedQuery.data.targetEndUserId,
		});
		console.log(data);

		return new Response(data.csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="${data.fileName}"`,
			},
		});

		// return successResponse('Logs export generated successfully.', data);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(error.message, error.statusCode);
		}

		return errorResponse('Failed to export plant logs', 500);
	}
}

export const GET = withRequestLogging(requireAuth(getPlantLogsExportRoute), { routeName: 'monitor.plants.logs.export' });
