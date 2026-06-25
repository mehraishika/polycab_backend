import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
}

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

interface OpenApiParameter {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  schema: Record<string, unknown>;
}

const HTTP_METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

const METHOD_NAME_REGEX = new RegExp(
  [
    String.raw`export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b`,
    String.raw`export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b`,
  ].join('|'),
  'g',
);

const URL_QUERY_GET_REGEX = /(?:query|searchParams)\.get\(['"`]([^'"`]+)['"`]\)/g;
const REQUEST_QUERY_GET_REGEX = /request\.nextUrl\.searchParams\.get\(['"`]([^'"`]+)['"`]\)/g;

const COMMON_QUERY_PARAM_SCHEMAS: Record<string, Record<string, unknown>> = {
  page: { type: 'integer', minimum: 1, default: 1 },
  pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  since: { type: 'string', format: 'date-time' },
  date: { type: 'string', format: 'date' },
  dateFrom: { type: 'string', format: 'date' },
  dateTo: { type: 'string', format: 'date' },
  sortBy: { type: 'string' },
  sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  status: { type: 'string' },
  search: { type: 'string' },
  event: { type: 'string' },
  role: { type: 'string' },
  fromService: { type: 'boolean' },
  targetEndUserId: { type: 'string' },
  selectedEndUserId: { type: 'string' },
  monitorUserId: { type: 'string' },
  format: { type: 'string' },
  range: { type: 'string' },
  mode: { type: 'string' },
  parameters: { type: 'string' },
  interval: { type: 'string' },
  plantId: { type: 'string' },
  deviceIds: { type: 'string', description: 'Comma-separated list of device ids' },
  monitorUserIds: { type: 'string', description: 'Comma-separated list of monitor user ids' },
};

function toOpenApiPath(routeFilePath: string): string {
  const appDir = join(process.cwd(), 'src', 'app');
  const relativePath = relative(appDir, routeFilePath).split(sep).join('/');
  const withoutSuffix = relativePath.replace(/\/route\.ts$/, '');

  if (!withoutSuffix.startsWith('api')) {
    return '/';
  }

  const withDynamicSegments = withoutSuffix
    .replace(/\[\[\.\.\.(.+?)\]\]/g, '{$1}')
    .replace(/\[\.\.\.(.+?)\]/g, '{$1}')
    .replace(/\[(.+?)\]/g, '{$1}');

  return `/${withDynamicSegments}`;
}

function inferTags(path: string): string[] {
  if (path.startsWith('/api/v1/auth')) return ['Auth'];
  if (path.startsWith('/api/v1/monitor/plants')) return ['Plants'];
  if (path.startsWith('/api/v1/monitor/devices')) return ['Devices'];
  if (path.startsWith('/api/v1/service')) return ['Service'];
  if (path.startsWith('/api/v1/users')) return ['Users'];
  if (path.startsWith('/api/health')) return ['Health'];
  if (path.startsWith('/api/openapi')) return ['Docs'];
  return ['API'];
}

function inferSecurity(path: string): Array<Record<string, string[]>> | undefined {
  if (
    path.startsWith('/api/v1/auth/login') ||
    path.startsWith('/api/v1/auth/register') ||
    path.startsWith('/api/v1/auth/refresh')
  ) {
    return undefined;
  }

  if (path.startsWith('/api/v1/')) {
    return [{ bearerAuth: [] }];
  }

  return undefined;
}

function extractPathParameters(path: string): OpenApiParameter[] {
  const names = Array.from(path.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]);

  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function extractQueryParameters(source: string): OpenApiParameter[] {
  const names = new Set<string>();

  for (const match of source.matchAll(URL_QUERY_GET_REGEX)) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(REQUEST_QUERY_GET_REGEX)) {
    names.add(match[1]);
  }

  return Array.from(names)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      in: 'query',
      required: false,
      schema: COMMON_QUERY_PARAM_SCHEMAS[name] ?? { type: 'string' },
    }));
}

function shouldIncludeRequestBody(method: HttpMethod, source: string): boolean {
  if (method === 'get' || method === 'head' || method === 'options') {
    return false;
  }

  return source.includes('request.json(') || source.includes('await request.json(');
}

function inferSuccessStatusCode(method: HttpMethod): '200' | '201' {
  if (method === 'post') {
    return '201';
  }

  return '200';
}

function toOperationId(method: HttpMethod, path: string): string {
  const normalizedPath = path
    .replace(/^\/api\/?/, '')
    .replace(/[{}]/g, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_');

  return `${method}_${normalizedPath}`;
}

function buildAutoOperation(method: HttpMethod, path: string, source: string): Record<string, unknown> {
  const pathParameters = extractPathParameters(path);
  const queryParameters = extractQueryParameters(source);
  const parameters = [...pathParameters, ...queryParameters];
  const successStatus = inferSuccessStatusCode(method);

  return {
    operationId: toOperationId(method, path),
    tags: inferTags(path),
    summary: `${method.toUpperCase()} ${path}`,
    description: 'Auto-discovered endpoint. Request and response models may be generalized.',
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(shouldIncludeRequestBody(method, source)
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        }
      : {}),
    ...(inferSecurity(path) ? { security: inferSecurity(path) } : {}),
    responses: {
      [successStatus]: {
        description: successStatus === '201' ? 'Created' : 'Success',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiSuccess' },
          },
        },
      },
      '400': {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      '403': {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      '404': {
        description: 'Not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      '500': {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
  };
}

function createAutoDiscoveredPaths(): Record<string, unknown> {
  const apiRoot = join(process.cwd(), 'src', 'app', 'api');

  const routeFilePaths: string[] = [];

  const visit = (currentDir: string) => {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name === 'route.ts') {
        routeFilePaths.push(fullPath);
      }
    }
  };

  try {
    visit(apiRoot);
  } catch {
    return {};
  }

  const paths: Record<string, unknown> = {};

  for (const routeFilePath of routeFilePaths) {
    const source = readFileSync(routeFilePath, 'utf8');
    const path = toOpenApiPath(routeFilePath);
    const operations: Record<string, unknown> = {};
    for (const match of source.matchAll(METHOD_NAME_REGEX)) {
      const methodToken = (match[1] ?? match[2] ?? '').toLowerCase();
      if (!HTTP_METHODS.includes(methodToken as HttpMethod)) {
        continue;
      }

      const method = methodToken as HttpMethod;
      operations[method] = buildAutoOperation(method, path, source);
    }

    if (Object.keys(operations).length > 0) {
      paths[path] = operations;
    }
  }

  return paths;
}

export function createOpenApiDocument(baseUrl = "http://localhost:3000"): OpenApiDocument {
  const discoveredPaths = createAutoDiscoveredPaths();

  const detailedPaths: Record<string, unknown> = {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['portal', 'account', 'password'],
                properties: {
                  portal: { type: 'string', enum: ['monitoring', 'service'] },
                  account: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  remember: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiSuccess' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register monitoring user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'account',
                  'password',
                  'confirmPassword',
                  'email',
                  'timezone',
                  'verificationCode',
                ],
                properties: {
                  account: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  confirmPassword: { type: 'string', format: 'password' },
                  email: { type: 'string', format: 'email' },
                  timezone: { type: 'string', example: 'UTC+05:30' },
                  verificationCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Registered' },
          '400': { description: 'Validation failed' },
          '409': { description: 'Already exists' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Token refreshed' },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "Next Production REST API",
      version: "1.0.0",
      description:
        "Interactive API documentation for monitoring, auth, and management endpoints.",
    },
    servers: [
      {
        url: baseUrl,
        description: "Current environment",
      },
    ],
    tags: [
      { name: "Health", description: "Health and status endpoints" },
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Plants", description: "Plant management and monitoring endpoints" },
      { name: "Devices", description: "Device management and monitoring endpoints" },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Service', description: 'Service-side management endpoints' },
      { name: 'Docs', description: 'Documentation endpoints' },
      { name: 'API', description: 'Other API endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Request successful" },
            data: { type: "object" },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Invalid request" },
          },
        },
      },
    },
    paths: {
      ...discoveredPaths,
      ...detailedPaths,
    },
  };
}
