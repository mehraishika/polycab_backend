import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { successResponse } from '@/server/utils/api-response';

async function getMe(request: NextRequest): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const auth = authenticatedRequest.auth;

	return successResponse('User profile fetched successfully.', {
		userId: auth.userId,
		account: typeof auth.account === 'string' ? auth.account : auth.userId,
		role: auth.role ?? null,
		portal: typeof auth.portal === 'string' ? auth.portal : null,
	});
}

export const GET = withRequestLogging(requireAuth(getMe), {
	routeName: 'auth.me',
});
