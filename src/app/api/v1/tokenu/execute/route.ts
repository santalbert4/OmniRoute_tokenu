import { NextResponse } from "next/server";

import { resolveTokenUTenantAuthFromRuntime } from "../tenantAuthRuntime";
import type { TokenUTenantAuthResult } from "../tenantAuth";

import { handleResolvedTokenUExecute } from "./executeRuntime";

export interface TokenUExecuteRouteDependencies {
  readonly resolveTenantAuth: (request: Request) => Promise<TokenUTenantAuthResult>;

  readonly handleResolvedExecution: (request: Request, workspaceId: string) => Promise<Response>;
}

function authFailureResponse(
  result: Extract<TokenUTenantAuthResult, { readonly ok: false }>
): Response {
  return NextResponse.json(
    {
      error: {
        code: result.code,
        message: result.message,
      },
    },
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * Authenticated TokenU tenant execution route.
 *
 * Public request data never supplies workspace identity.
 */
export async function handleTokenUExecuteRoute(
  request: Request,
  dependencies: TokenUExecuteRouteDependencies
): Promise<Response> {
  const auth = await dependencies.resolveTenantAuth(request);

  if (!auth.ok) {
    return authFailureResponse(auth);
  }

  return dependencies.handleResolvedExecution(request, auth.workspaceId);
}

export async function POST(request: Request): Promise<Response> {
  return handleTokenUExecuteRoute(request, {
    resolveTenantAuth: resolveTokenUTenantAuthFromRuntime,

    handleResolvedExecution: handleResolvedTokenUExecute,
  });
}
