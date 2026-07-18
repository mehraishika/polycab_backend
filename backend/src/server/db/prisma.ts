import { PrismaPg } from '@prisma/adapter-pg';

import {
	PrismaClient as GeneratedPrismaClient,
	type Prisma,
} from '@/server/db/generated/prisma/client';
import {
	attachResultToOperation,
	beginDbOperation,
	detectQueryType,
	extractQueryResult,
	trackDbQuery,
} from '@/server/utils/request-context';

function createPrismaClient() {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		throw new Error('DATABASE_URL is not configured');
	}

	const client = new GeneratedPrismaClient({
		adapter: new PrismaPg({ connectionString }),
		log: [{ level: 'query', emit: 'event' }],
	});

	// Capture raw SQL query details (query text, params, duration)
	client.$on('query', (event: Prisma.QueryEvent) => {
		trackDbQuery({
			query: event.query,
			params: event.params,
			durationMs: event.duration,
			target: event.target,
			type: detectQueryType(event.query),
		});
	});

	// Capture ORM operation results (rows returned, affected count, etc.)
	return client.$extends({
		query: {
			$allModels: {
				async $allOperations({
					args,
					query,
				}: {
					args: unknown;
					query: (args: unknown) => Promise<unknown>;
				}) {
					const startIndex = beginDbOperation();

					try {
						const result = await query(args);
						attachResultToOperation(startIndex, extractQueryResult(result));
						return result;
					} catch (error: unknown) {
						attachResultToOperation(startIndex, {
							error: error instanceof Error ? error.message : String(error),
						});
						throw error;
					}
				},
			},
		},
	});
}

export type PrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
	var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.__prisma = prisma;
}
