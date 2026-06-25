const DATABASE_ERROR_KEYWORDS = [
	'prisma',
	'database',
	'db',
	'query',
	'sql',
	'connection',
	'constraint',
	'foreign key',
	'unique',
];

export interface ErrorDiagnostics {
	message: string;
	isDatabase: boolean;
	code?: string;
	line?: number;
	output?: string;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	return String(error);
}

function extractErrorCode(error: unknown): string | undefined {
	if (typeof error === 'object' && error !== null) {
		const withCode = error as { code?: unknown };

		if (typeof withCode.code === 'string' && withCode.code.trim().length > 0) {
			return withCode.code.trim().toUpperCase();
		}
	}

	const message = getErrorMessage(error);
	const prismaCode = message.match(/\bP\d{4}\b/i)?.[0];

	if (prismaCode) {
		return prismaCode.toUpperCase();
	}

	const sqlStateCode = message.match(/\bSQLSTATE\s*[:=]?\s*([0-9A-Z]{5})\b/i)?.[1];

	if (sqlStateCode) {
		return sqlStateCode.toUpperCase();
	}

	return undefined;
}

function extractErrorLine(error: unknown): number | undefined {
	if (!(error instanceof Error) || typeof error.stack !== 'string') {
		return undefined;
	}

	const sourceLineMatch = error.stack.match(/src\/[^\n:]+:(\d+):(\d+)/);

	if (sourceLineMatch?.[1]) {
		return Number(sourceLineMatch[1]);
	}

	const fallbackLineMatch = error.stack.match(/:(\d+):(\d+)\)?(?:\n|$)/);

	if (fallbackLineMatch?.[1]) {
		return Number(fallbackLineMatch[1]);
	}

	return undefined;
}

function extractDatabaseOutput(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null) {
		return undefined;
	}

	const withMeta = error as { meta?: unknown; detail?: unknown; details?: unknown };
	const candidate = withMeta.meta ?? withMeta.detail ?? withMeta.details;

	if (typeof candidate === 'string' && candidate.trim().length > 0) {
		return candidate.trim();
	}

	if (candidate && typeof candidate === 'object') {
		try {
			return JSON.stringify(candidate);
		} catch {
			return undefined;
		}
	}

	return undefined;
}

export function isDatabaseError(error: unknown): boolean {
	const message = getErrorMessage(error).toLowerCase();

	if (DATABASE_ERROR_KEYWORDS.some((keyword) => message.includes(keyword))) {
		return true;
	}

	if (typeof error === 'object' && error !== null) {
		const withCode = error as { code?: unknown; name?: unknown };

		if (typeof withCode.code === 'string' && /^p\d{4}$/i.test(withCode.code)) {
			return true;
		}

		if (
			typeof withCode.name === 'string' &&
			withCode.name.toLowerCase().includes('prisma')
		) {
			return true;
		}
	}

	return false;
}

export function getErrorDiagnostics(error: unknown): ErrorDiagnostics {
	return {
		message: getErrorMessage(error),
		isDatabase: isDatabaseError(error),
		code: extractErrorCode(error),
		line: extractErrorLine(error),
		output: extractDatabaseOutput(error),
	};
}

export function toErrorMessage(error: unknown): string {
	const diagnostics = getErrorDiagnostics(error);

	if (!diagnostics.isDatabase) {
		return diagnostics.message;
	}

	const fragments = ['Database error'];

	if (diagnostics.code) {
		fragments.push(`code=${diagnostics.code}`);
	}

	if (typeof diagnostics.line === 'number') {
		fragments.push(`line=${diagnostics.line}`);
	}

	const prefix = `${fragments.join(' | ')}: ${diagnostics.message}`;

	if (diagnostics.output) {
		return `${prefix} | dbOutput=${diagnostics.output}`;
	}

	return prefix;
}

export class ApiError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static handle(res: any, error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    res.status(statusCode).json({ success: false, message });
  }
}
