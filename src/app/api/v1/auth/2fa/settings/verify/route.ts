import { NextResponse } from "next/server";

import { requireAuth } from "@/server/middleware/auth.middleware";
import { AuthService } from "@/server/services/auth.service";
import { errorResponse, successResponse } from "@/server/utils/api-response";

const authService = new AuthService();

export const POST = requireAuth(async (request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const code =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code.trim()
      : "";

  const result = await authService.confirmTwoFactorSetup(
    request.auth.userId,
    code,
  );

  if (result.status !== 200) {
    return errorResponse(result.message, result.status);
  }

  return successResponse(result.message, result.data);
});
