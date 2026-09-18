import { requireAuth } from "@/server/middleware/auth.middleware";
import { AuthService } from "@/server/services/auth.service";
import { errorResponse, successResponse } from "@/server/utils/api-response";

const authService = new AuthService();

export const GET = requireAuth(async (request) => {
  const result = await authService.getTwoFactorStatus(request.auth.userId);

  if (result.status !== 200) {
    return errorResponse(result.message, result.status);
  }

  return successResponse(result.message, result.data);
});
