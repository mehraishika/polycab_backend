import { AsyncLocalStorage } from 'node:async_hooks';

export type DbQueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'TRUNCATE' | 'OTHER';

export interface DbQueryResult {
	affectedRows?: number;
	rowCount?: number;
	rows?: unknown[];
	data?: unknown;
	error?: string;
}

export interface DbQueryLog {
	query: string;
	params: string;
	durationMs: number;
	target: string;
	type: DbQueryType;
	result?: DbQueryResult;
}

interface RequestContextStore {
	requestId: string;
	dbQueries: DbQueryLog[];
}

const requestContext = new AsyncLocalStorage<RequestContextStore>();

const MAX_CAPTURED_DB_QUERIES = 25;
const MAX_QUERY_TEXT_LENGTH = 1200;
const MAX_PARAMS_TEXT_LENGTH = 1200;

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength)}...`;
}

/**
 * Detects the query type from a SQL statement
 * Returns the primary operation type (SELECT, INSERT, UPDATE, DELETE, etc.)
 */
export function detectQueryType(query: string): DbQueryType {
	const trimmed = query.trim().toUpperCase();
	
	// Handle common query patterns
	if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
		return 'SELECT';
	}
	if (trimmed.startsWith('INSERT')) {
		return 'INSERT';
	}
	if (trimmed.startsWith('UPDATE')) {
		return 'UPDATE';
	}
	if (trimmed.startsWith('DELETE')) {
		return 'DELETE';
	}
	if (trimmed.startsWith('CREATE')) {
		return 'CREATE';
	}
	if (trimmed.startsWith('DROP')) {
		return 'DROP';
	}
	if (trimmed.startsWith('ALTER')) {
		return 'ALTER';
	}
	if (trimmed.startsWith('TRUNCATE')) {
		return 'TRUNCATE';
	}
	
	return 'OTHER';
}

export function runWithRequestContext<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
	return requestContext.run({ requestId, dbQueries: [] }, fn);
}

export function trackDbQuery(query: DbQueryLog): void {
	const store = requestContext.getStore();

	if (!store) {
		return;
	}

	if (store.dbQueries.length >= MAX_CAPTURED_DB_QUERIES) {
		return;
	}

	store.dbQueries.push({
		query: truncate(query.query, MAX_QUERY_TEXT_LENGTH),
		params: truncate(query.params, MAX_PARAMS_TEXT_LENGTH),
		durationMs: query.durationMs,
		target: query.target,
		type: query.type,
		result: query.result,
	});
}

export function beginDbOperation(): number {
	const store = requestContext.getStore();

	if (!store) {
		return -1;
	}

	return store.dbQueries.length;
}

export function attachResultToOperation(startIndex: number, result: DbQueryResult): void {
	const store = requestContext.getStore();

	if (!store || startIndex < 0 || startIndex >= store.dbQueries.length) {
		return;
	}

	for (let i = startIndex; i < store.dbQueries.length; i += 1) {
		store.dbQueries[i].result = result;
	}
}

export function extractQueryResult(result: unknown): DbQueryResult {
	if (!result) {
		return { rowCount: 0 };
	}

	// Handle array result (SELECT query)
	if (Array.isArray(result)) {
		return {
			rowCount: result.length,
			rows: result.slice(0, 10), // Limit to first 10 rows for logging
		};
	}

	// Handle object with count property (INSERT/UPDATE/DELETE affected rows)
	if (typeof result === 'object' && result !== null) {
		const obj = result as Record<string, unknown>;

		if ('count' in obj && typeof obj.count === 'number') {
			return { affectedRows: obj.count };
		}

		if ('affectedRows' in obj && typeof obj.affectedRows === 'number') {
			return { affectedRows: obj.affectedRows };
		}

		if ('rowCount' in obj && typeof obj.rowCount === 'number') {
			return { rowCount: obj.rowCount };
		}

		return { data: result };
	}

	return { data: result };
}

export function getCapturedDbQueries(): DbQueryLog[] {
	const store = requestContext.getStore();
	return store ? [...store.dbQueries] : [];
}
