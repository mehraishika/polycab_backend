import { UserService } from "@/server/services/user.service";
import { searchDeviceRequestSchema } from "@/server/validators/user.validator";
import { NextRequest, NextResponse } from "next/server";

const service = new UserService();
export async function POST(req: NextRequest) {
  const body = await req.json();

  const payload = searchDeviceRequestSchema.parse(body);

  const result = await service.searchDeviceBySN(payload.sno);

  return NextResponse.json(result, {
    status: result.status,
  });
}
