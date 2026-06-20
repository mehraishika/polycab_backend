import { type NextRequest } from 'next/server';

import { AuthService } from '@/server/services/auth.service';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { errorResponse, successResponse } from '@/server/utils/api-response';
import { registerSchema } from '@/server/validators/auth.validator';

const authService = new AuthService();

async function postRegister(request: NextRequest): Promise<Response> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON payload', 400);
	}

	const parsed = registerSchema.safeParse(body);

	if (!parsed.success) {
		const firstIssue = parsed.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
			: 'Invalid request body';

		return errorResponse(message, 400);
	}

	const result = await authService.register(parsed.data);

	if (result.status !== 201) {
		return errorResponse(result.message, result.status);
	}

	return successResponse(result.message, result.data, 201);
}

export const POST = withRequestLogging(postRegister, {
	routeName: 'auth.register',
});
