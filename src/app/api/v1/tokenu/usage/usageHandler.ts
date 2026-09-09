import { NextResponse } from "next/server";

import type { WorkspaceUsageOverview } from "@/tokenu/contracts/workspaceUsageOverview";

export interface TokenUUsageQuery {
  getOverview(workspaceId: string, period: string): Promise<WorkspaceUsageOverview | null>;
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function handleTokenUUsageGet(
  request: Request,
  workspaceId: string,
  usageQuery: TokenUUsageQuery
): Promise<Response> {
  if (!workspaceId.trim()) {
    throw new Error("TokenU usage handler requires workspace identity");
  }

  const url = new URL(request.url);

  const unsupportedParameter = [...url.searchParams.keys()].find((key) => key !== "period");

  if (unsupportedParameter) {
    return errorResponse(
      400,
      "unsupported_query_parameter",
      `Unsupported query parameter: ${unsupportedParameter}`
    );
  }

  const periodValues = url.searchParams.getAll("period");
  const period = periodValues[0] ?? "";

  if (periodValues.length !== 1 || !PERIOD_PATTERN.test(period)) {
    return errorResponse(400, "invalid_period", "period must use YYYY-MM format");
  }

  const overview = await usageQuery.getOverview(workspaceId, period);

  if (!overview) {
    return errorResponse(
      404,
      "workspace_usage_not_available",
      "TokenU usage is not available for this workspace"
    );
  }

  return NextResponse.json(overview, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
