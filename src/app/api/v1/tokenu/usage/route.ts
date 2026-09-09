import { NextResponse } from "next/server";

/**
 * TokenU tenant usage endpoint.
 *
 * P4D establishes the HTTP boundary while keeping the public route
 * fail-closed. P4E will resolve:
 *
 * Bearer API key
 *   -> ApiKeyMetadata.id
 *   -> TokenU principal
 *   -> TokenU workspace
 *
 * before delegating to usageHandler.ts.
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      error: {
        code: "tokenu_tenant_auth_required",
        message: "TokenU tenant authentication is required",
      },
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
