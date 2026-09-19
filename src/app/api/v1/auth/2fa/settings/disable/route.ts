import { NextResponse } from "next/server";

import { requireAuth } from "@/server/middleware/auth.middleware";
import { AuthService } from "@/server/services/auth.service";
import { errorResponse, successResponse } from "@/server/utils/api-response";

const authService = new AuthService();

export const POST = requireAuth(async (request) => {
  let body: unknown = {};

  try {
    const text = await request.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  const code =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code.trim()
      : "";

  const result = await authService.disableTwoFactorFromSettings(
    request.auth.userId,
    code,
  );

  if (result.status !== 200) {
    return errorResponse(result.message, result.status);
  }

  return successResponse(result.message, result.data);
});
