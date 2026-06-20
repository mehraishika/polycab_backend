import { NextRequest } from 'next/server';

import { createOpenApiDocument } from '@/server/config/openapi';

export async function GET(request: NextRequest): Promise<Response> {
  const origin = request.nextUrl.origin;
  const openApi = createOpenApiDocument(origin);

  return Response.json(openApi, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
