import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { AuthenticatedRequest } from '@/server/middleware/auth.middleware';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { MonitorUserService } from '@/server/services/monitor-user.service';
import { errorResponse } from '@/server/utils/api-response';
import { monitorUserStatusCountsQuerySchema } from '@/server/validators/monitor-user.validator';

const monitorUserService = new MonitorUserService();

function formatSSEEvent(event: string, payload: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

async function getLiveStatusCounts(request: NextRequest): Promise<Response> {
	const authenticatedRequest = request as AuthenticatedRequest;
	const actorIdRaw = authenticatedRequest.auth?.userId;
	const actorRole = authenticatedRequest.auth?.role;

	if (!actorIdRaw) {
		return errorResponse('Unauthorized', 401);
	}

	let actorId: bigint;
	try {
		actorId = BigInt(actorIdRaw);
	} catch {
		return errorResponse('Invalid token payload', 401);
	}

	const searchParams = new URL(request.url).searchParams;
	const parsedQuery = monitorUserStatusCountsQuerySchema.safeParse({
		searchUser: searchParams.get('searchUser') ?? undefined,
		searchSN: searchParams.get('searchSN') ?? undefined,
		searchInstallationDate: searchParams.get('searchInstallationDate') ?? undefined,
		searchAffiliation: searchParams.get('searchAffiliation') ?? undefined,
	});
	if (!parsedQuery.success) {
		const firstIssue = parsedQuery.error.issues[0];
		const message = firstIssue
			? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}`
			: 'Invalid query parameters';
		return errorResponse(message, 400);
	}

	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setInterval> | null = null;
	let lastPayload = '';

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const sendSnapshot = async () => {
				const result = await monitorUserService.getMonitorUserStatusCounts(
					actorId,
					actorRole,
					parsedQuery.data,
				);

				if (result.status !== 200) {
					controller.enqueue(
						encoder.encode(
							formatSSEEvent('monitor_user_status_counts_error', {
								message: result.message,
							}),
						),
					);
					return;
				}

				const payload = {
					loginUserId: result.data.loginUser.id,
					statusCounts: result.data.statusCounts,
					updatedAt: result.data.updatedAt,
				};
				const serialized = JSON.stringify(payload);

				if (serialized !== lastPayload) {
					lastPayload = serialized;
					controller.enqueue(
						encoder.encode(
							formatSSEEvent('monitor_user_status_counts_updated', payload),
						),
					);
				}
			};

			await sendSnapshot();

			timer = setInterval(async () => {
				try {
					await sendSnapshot();
					controller.enqueue(encoder.encode(formatSSEEvent('heartbeat', { ts: Date.now() })));
				} catch (error: unknown) {
					controller.enqueue(
						encoder.encode(
							formatSSEEvent('monitor_user_status_counts_error', {
								message: error instanceof Error ? error.message : String(error),
							}),
						),
					);
				}
			}, 15000);
		},
		cancel() {
			if (timer) {
				clearInterval(timer);
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	});
}

export const GET = withRequestLogging(requireAuth(getLiveStatusCounts), {
	routeName: 'service.monitor_users.status_counts.live',
});
