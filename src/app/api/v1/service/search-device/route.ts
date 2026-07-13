import { UserService } from "@/server/services/user.service";
import { searchDeviceRequestSchema } from "@/server/validators/user.validator";
import { NextRequest, NextResponse } from "next/server";

const service = new UserService();
export async function POST(req: NextRequest) {
  const body = await req.json();

  const payload = searchDeviceRequestSchema.parse(body);
  console.log("Search SN payload:", payload);
  const result = await service.searchDeviceBySN(payload.sno, payload.plantId);
  console.log("Search SN result:", result);

  return NextResponse.json(result, {
    status: result.status,
  });
}
