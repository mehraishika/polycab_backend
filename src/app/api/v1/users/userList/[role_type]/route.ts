import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { UserService } from '@/server/services/user.service';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import {
	userListQuerySchema,
	userRoleTypeParamSchema,
} from '@/server/validators/user.validator';

const userService = new UserService();

type GetUserListRouteContext = {
	params: Promise<{
		role_type: string;
	}>;
};

async function getUserList(
	request: Request,
	context: GetUserListRouteContext,
): Promise<Response> {
	const params = await context.params;
	const parsedParams = userRoleTypeParamSchema.safeParse(params);

	if (!parsedParams.success) {
		return errorResponse('Invalid role type', 400);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = userListQuerySchema.safeParse({
		page: searchParams.get('page') ?? undefined,
		limit: searchParams.get('limit') ?? undefined,
		search: searchParams.get('search') ?? undefined,
		portal: searchParams.get('portal') ?? undefined,
		status: searchParams.get('status') ?? undefined,
		account: searchParams.get('account') ?? undefined,
		email: searchParams.get('email') ?? undefined,
		phone: searchParams.get('phone') ?? undefined,
		isDeleted: searchParams.get('isDeleted') ?? undefined,
	});

	if (!parsedQuery.success) {
		return errorResponse('Invalid query parameters', 400);
	}

	const result = await userService.getUserListByRole(
		parsedParams.data.role_type,
		parsedQuery.data,
	);

	return successResponse(result.message, result.data);
}

export const GET = withRequestLogging(getUserList, {
	routeName: 'users.list',
});