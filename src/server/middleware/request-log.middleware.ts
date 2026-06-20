import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { inspect } from 'node:util';

import { getErrorDiagnostics } from '@/server/utils/api-error';
import {
	getCapturedDbQueries,
	runWithRequestContext,
	type DbQueryLog,
} from '@/server/utils/request-context';

type LogTransport = 'console' | 'file' | 'webhook';

type ApiRouteHandler<TRequest extends Request = Request, TContext = unknown> = (
	request: TRequest,
	context: TContext,
) => Promise<Response> | Response;

interface ResponseBody {
	success?: boolean;
	message?: string;
	data?: unknown;
	error?: string;
	[key: string]: unknown;
}

interface RequestLogEvent {
	timestamp: string;
	requestId: string;
	method: string;
	path: string;
	status: number;
	durationMs: number;
	ip: string;
	userAgent: string;
	routeName?: string;
	response?: ResponseBody;
	error?: string;
	errorCode?: string;
	errorLine?: number;
	databaseOutput?: string;
	isDatabaseError?: boolean;
	dbQueryCount: number;
	dbQueries: DbQueryLog[];
}

interface RequestLogOptions {
	routeName?: string;
}

async function readResponseBody(response: Response): Promise<ResponseBody | undefined> {
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

	if (!contentType.includes('application/json')) {
		return undefined;
	}

	try {
		return (await response.clone().json()) as ResponseBody;
	} catch {
		return undefined;
	}
}

function errorMessageFromBody(body: ResponseBody | undefined): string | undefined {
	if (!body) return undefined;
	if (typeof body.error === 'string' && body.error.length > 0) return body.error;
	if (typeof body.message === 'string' && body.message.length > 0) return body.message;
	return undefined;
}

function diagnosticsFromErrorMessage(errorMessage: string | undefined): {
	errorCode?: string;
	errorLine?: number;
	databaseOutput?: string;
	isDatabaseError?: boolean;
} {
	if (!errorMessage) {
		return {};
	}

	const code = errorMessage.match(/code=([A-Z0-9_]+)/)?.[1];
	const lineText = errorMessage.match(/line=(\d+)/)?.[1];
	const output = errorMessage.match(/\|\s*dbOutput=(.+)$/)?.[1]?.trim();

	return {
		errorCode: code,
		errorLine: lineText ? Number(lineText) : undefined,
		databaseOutput: output,
		isDatabaseError: errorMessage.toLowerCase().startsWith('database error'),
	};
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
	if (!value) {
		return defaultValue;
	}

	const normalized = value.trim().toLowerCase();
	return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function getTransports(): LogTransport[] {
	const rawTransports = process.env.API_LOG_TRANSPORTS?.trim();

	if (!rawTransports) {
		return ['console'];
	}

	const transports = rawTransports
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry): entry is LogTransport => {
			return entry === 'console' || entry === 'file' || entry === 'webhook';
		});

	return transports.length > 0 ? transports : ['console'];
}

function getRequestId(request: Request): string {
	return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function getClientIp(request: Request): string {
	const forwardedFor = request.headers.get('x-forwarded-for');

	if (forwardedFor) {
		const firstForwardedIp = forwardedFor.split(',')[0]?.trim();

		if (firstForwardedIp) {
			return firstForwardedIp;
		}
	}

	const realIp = request.headers.get('x-real-ip')?.trim();
	return realIp && realIp.length > 0 ? realIp : 'unknown';
}

function buildEvent(
	request: Request,
	status: number,
	durationMs: number,
	requestId: string,
	dbQueries: DbQueryLog[],
	options?: RequestLogOptions,
	responseBody?: ResponseBody,
	error?: string,
	errorDetails?: {
		errorCode?: string;
		errorLine?: number;
		databaseOutput?: string;
		isDatabaseError?: boolean;
	},
): RequestLogEvent {
	const url = new URL(request.url);

	return {
		timestamp: new Date().toISOString(),
		requestId,
		method: request.method,
		path: url.pathname,
		status,
		durationMs,
		ip: getClientIp(request),
		userAgent: request.headers.get('user-agent') ?? 'unknown',
		routeName: options?.routeName,
		response: responseBody,
		error,
		errorCode: errorDetails?.errorCode,
		errorLine: errorDetails?.errorLine,
		databaseOutput: errorDetails?.databaseOutput,
		isDatabaseError: errorDetails?.isDatabaseError,
		dbQueryCount: dbQueries.length,
		dbQueries,
	};
}

async function writeLogToFile(event: RequestLogEvent): Promise<void> {
	const filePath = process.env.API_LOG_FILE_PATH?.trim() || 'logs/api.log';
	const directoryPath = dirname(filePath);

	await mkdir(directoryPath, { recursive: true });
	await appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
}

async function sendLogToWebhook(event: RequestLogEvent): Promise<void> {
	const webhookUrl = process.env.API_LOG_WEBHOOK_URL?.trim();

	if (!webhookUrl) {
		return;
	}

	await fetch(webhookUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify(event),
	});
}

/**
 * Organizes database queries by type for better readability in logs
 */
function formatQueriesByType(queries: DbQueryLog[]): Record<string, DbQueryLog[]> {
	const grouped: Record<string, DbQueryLog[]> = {};

	for (const query of queries) {
		if (!grouped[query.type]) {
			grouped[query.type] = [];
		}
		grouped[query.type].push(query);
	}

	return grouped;
}

function dispatchRequestLog(event: RequestLogEvent): void {
	const loggingEnabled = parseBoolean(process.env.API_LOG_ENABLED, true);

	if (!loggingEnabled) {
		return;
	}

	const transports = getTransports();

	for (const transport of transports) {
		if (transport === 'console') {
			console.info(
				'[API_REQUEST_LOG]',
				inspect(event, {
					depth: null,
					colors: false,
				}),
			);
			// Log database queries organized by type if present
			if (event.dbQueryCount > 0) {
				const queriesByType = formatQueriesByType(event.dbQueries);
				const queriesOutput = Object.entries(queriesByType).reduce(
					(acc, [type, queries]) => {
						acc[type] = {
							count: queries.length,
							queries: queries.map((q) => ({
								query: q.query,
								params: q.params,
								durationMs: q.durationMs,
								target: q.target,
								type: q.type,
								result: q.result,
							})),
						};
						return acc;
					},
					{} as Record<string, { count: number; queries: DbQueryLog[] }>,
				);
				console.info(
					'[API_DB_QUERIES]',
					inspect(
						{
							total: event.dbQueryCount,
							byType: queriesOutput,
						},
						{ depth: null, colors: false },
					),
				);
			}
			continue;
		}

		if (transport === 'file') {
			void writeLogToFile(event).catch((error: unknown) => {
				console.error('[API_REQUEST_LOG_FILE_ERROR]', {
					message: error instanceof Error ? error.message : String(error),
				});
			});
			continue;
		}

		if (transport === 'webhook') {
			void sendLogToWebhook(event).catch((error: unknown) => {
				console.error('[API_REQUEST_LOG_WEBHOOK_ERROR]', {
					message: error instanceof Error ? error.message : String(error),
				});
			});
		}
	}
}

export function withRequestLogging<TRequest extends Request = Request, TContext = unknown>(
	handler: ApiRouteHandler<TRequest, TContext>,
	options?: RequestLogOptions,
): ApiRouteHandler<TRequest, TContext> {
	return async (request: TRequest, context: TContext): Promise<Response> => {
		const requestId = getRequestId(request);

		return runWithRequestContext(requestId, async (): Promise<Response> => {
			const startedAt = Date.now();

			try {
				const response = await handler(request, context);
				const responseBody = await readResponseBody(response);
				const errorMessage = response.status >= 400 ? errorMessageFromBody(responseBody) : undefined;
				const responseDiagnostics = diagnosticsFromErrorMessage(errorMessage);
				const event = buildEvent(
					request,
					response.status,
					Date.now() - startedAt,
					requestId,
					getCapturedDbQueries(),
					options,
					responseBody,
					errorMessage,
					responseDiagnostics,
				);

				dispatchRequestLog(event);
				return response;
			} catch (error: unknown) {
				const diagnostics = getErrorDiagnostics(error);
				const errorBody: ResponseBody = { success: false, message: diagnostics.message };
				const event = buildEvent(
					request,
					500,
					Date.now() - startedAt,
					requestId,
					getCapturedDbQueries(),
					options,
					errorBody,
					diagnostics.message,
					{
						errorCode: diagnostics.code,
						errorLine: diagnostics.line,
						databaseOutput: diagnostics.output,
						isDatabaseError: diagnostics.isDatabase,
					},
				);

				dispatchRequestLog(event);
				throw error;
			}
		});
	};
}
