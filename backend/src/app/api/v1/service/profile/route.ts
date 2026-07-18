import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth.middleware";
import { UserService } from "@/server/services/user.service";
import { UpdateProfileValidator } from "@/server/validators/user.validator";

const service = new UserService();

export const GET = requireAuth(async (req) => {
  const result = await service.getProfile(req.auth.userId);

  return NextResponse.json(result, {
    status: result.status,
  });
});

export const PUT = requireAuth(async (req) => {
  const body = await req.json();

  const payload = UpdateProfileValidator.parse(body);

  const result = await service.updateProfile(req.auth.userId, payload);

  return NextResponse.json(result, {
    status: result.status,
  });
});
