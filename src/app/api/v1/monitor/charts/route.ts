import type { NextRequest } from "next/server";

import type { AuthenticatedRequest } from "@/server/middleware/auth.middleware";
import { requireAuth } from "@/server/middleware/auth.middleware";
import { withRequestLogging } from "@/server/middleware/request-log.middleware";
import { getAllPlantsChart } from "@/server/services/plant.service";
import { errorResponse, successResponse } from "@/server/utils/api-response";
import type { User } from "@/server/utils/auth-helper";
import { resolveUserScope } from "@/server/utils/scope-resolver";

type ChartRange = "day" | "month" | "year";

async function getAllPlantsChartRoute(
  request: NextRequest,
): Promise<Response> {
  const authenticatedRequest =
    request as AuthenticatedRequest;

  const auth = authenticatedRequest.auth;

  if (!auth?.userId) {
    return errorResponse(
      "Unauthorized",
      401,
    );
  }

  const user: User = {
    userId: auth.userId,
    account:
      typeof auth.account === "string"
        ? auth.account
        : auth.userId,
    role: auth.role,
  };

  const searchParams =
    new URL(request.url).searchParams;

  const range =
    searchParams.get("range");

  if (
    range !== "day" &&
    range !== "month" &&
    range !== "year"
  ) {
    return errorResponse(
      "Invalid range. Use day, month or year.",
      400,
    );
  }

  try {
    const scope =
      await resolveUserScope(user);

    if (scope.length === 0) {
      return errorResponse(
        "Unauthorized access to plants",
        403,
      );
    }

    const data =
      await getAllPlantsChart({
        scope,
        range: range as ChartRange,
      });

    return successResponse(
      "All plants chart fetched successfully.",
      data,
    );
  } catch (error: unknown) {
    console.error(
      "Failed to fetch all plants chart:",
      error,
    );

    return errorResponse(
      "Failed to fetch all plants chart",
      500,
    );
  }
}

export const GET = withRequestLogging(
  requireAuth(getAllPlantsChartRoute),
  {
    routeName:
      "monitor.plants.chart.all",
  },
);