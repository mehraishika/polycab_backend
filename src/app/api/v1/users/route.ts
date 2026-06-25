import type { NextRequest } from 'next/server';

import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { errorResponse } from '@/server/utils/api-response';

async function usersRootGet(_request: NextRequest): Promise<Response> {
	return errorResponse('Use /api/v1/users/register or /api/v1/users/userList/{role_type}', 404);
}

async function usersRootPost(_request: NextRequest): Promise<Response> {
	return errorResponse('Use /api/v1/users/register', 404);
}

export const GET = withRequestLogging(usersRootGet, {
	routeName: 'users.root.get',
});

export const POST = withRequestLogging(usersRootPost, {
	routeName: 'users.root.post',
});
