import type { NextRequest } from 'next/server';

import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { requireAuth } from '@/server/middleware/auth.middleware';

import { withRequestLogging } from '@/server/middleware/request-log.middleware';

import { UserService } from '@/server/services/user.service';

import { ApiError } from '@/server/utils/api-error';
import {
	errorResponse,
	successResponse,
} from '@/server/utils/api-response';

const userService =
	new UserService();
async function deleteOwnAccountRoute(
	request: NextRequest
): Promise<Response> {
	const authenticatedRequest =
		request as AuthenticatedRequest;

	const auth =
		authenticatedRequest.auth;

	if (!auth?.userId) {
		return errorResponse(
			'Unauthorized',
			401
		);
	}

	try {
		const result =
			await userService.deleteById(
				BigInt(auth.userId)
			);

		if (result.status !== 200) {
			return errorResponse(
				result.message,
				result.status
			);
		}

		return successResponse(
			result.message,
			undefined,
			200
		);
	} catch {
		return errorResponse(
			'Failed to delete account',
			500
		);
	}
}

export const DELETE =
	withRequestLogging(
		requireAuth(
			deleteOwnAccountRoute
		),
		{
			routeName:
				'auth.delete-account',
		}
	);