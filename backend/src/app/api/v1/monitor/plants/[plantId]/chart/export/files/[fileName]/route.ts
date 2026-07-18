import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { getPlantChart } from '@/server/services/plant.service';
import { errorResponse } from '@/server/utils/api-response';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { PlantChartExportQueryValidator } from '@/server/validators/plant.validator';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();
type PlantChartFileContext = {
	params: Promise<{
		plantId: string;
		fileName: string;
	}>;
};

async function getPlantChartFileRoute(
	request: NextRequest,
	context: PlantChartFileContext,
): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse('Unauthorized', 401);
	}

	const user: User = {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role,
	};

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = PlantChartExportQueryValidator.safeParse({
		role: searchParams.get('role') ?? undefined,
		fromService: searchParams.get('fromService') ? searchParams.get('fromService') === 'true' : undefined,
		targetEndUserId: searchParams.get('targetEndUserId') ?? undefined,
		date: searchParams.get('date') ?? undefined,
		range: searchParams.get('range') ?? undefined,
		mode: searchParams.get('mode') ?? undefined,
		format: searchParams.get('format') ?? undefined,
	});

	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	// const baseScope = await resolveUserScope(user);
	// const hasServiceRole = user.role === 'service_admin' || user.role === 'service_super_admin';
	// const scope =
	// 	parsedQuery.data.fromService && hasServiceRole && parsedQuery.data.targetEndUserId
	// 		? [parsedQuery.data.targetEndUserId]
	// 		: baseScope;
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
		role: user.role,
	});

	if (scope.length === 0) {
		return errorResponse('Unauthorized access to plants', 403);
	}

	const { plantId, fileName } = await context.params;
	if (fileName !== 'plant-chart.csv') {
		return errorResponse('File not found', 404);
	}

	const chart = await getPlantChart({
		scope,
		plantId,
		date: parsedQuery.data.date,
		range: parsedQuery.data.range,
		mode: parsedQuery.data.mode,
	});

	const headers = ['time', ...chart.series.map((item: any) => item.key)];
	const rows = [headers.join(',')];

	for (const point of chart.points as Array<Record<string, string | number>>) {
		rows.push(headers.map((header) => String(point[header] ?? '')).join(','));
	}

	return new Response(`${rows.join('\n')}\n`, {
		status: 200,
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="plant-chart.csv"',
		},
	});
	// return new Response('success')
}

export const GET = withRequestLogging(requireAuth(getPlantChartFileRoute), {
	routeName: 'monitor.plants.chart.export.file',
});
