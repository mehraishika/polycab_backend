import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/server/services/user.service";
import { searchMonitoringUserSchema } from "@/server/validators/user.validator";

const service = new UserService();

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { account } = searchMonitoringUserSchema.parse(body);

  const result = await service.searchMonitoringUser(account);

  return NextResponse.json(result, {
    status: result.status,
  });
}
