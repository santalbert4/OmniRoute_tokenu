import assert from "node:assert/strict";
import test from "node:test";

import type { ModelOffering } from "@/tokenu/contracts/offering";
import type { ApprovedExecutionRoute } from "@/tokenu/runtime/publicExecutionRouteRegistry";
import { PublicExecutionResolver } from "@/tokenu/runtime/publicExecutionResolver";
import { StaticPublicExecutionRouteRegistry } from "@/tokenu/runtime/staticPublicExecutionRouteRegistry";

const offering: ModelOffering = {
  id: "groq:openai/gpt-oss-20b",
  providerId: "groq",
  canonicalModelId: "gpt-oss-20b",
  upstreamModelId: "openai/gpt-oss-20b",
  technicalProfileId: "groq-gpt-oss-20b-profile",
  credentialModes: ["TOKENU_MANAGED"],
  commercialStatus: "production-approved",
  availability: "available",
  serviceRegions: [],
  pricing: null,
};

const route: ApprovedExecutionRoute = {
  publicModelId: "gpt-oss-20b",
  offering,
  credentialMode: "TOKENU_MANAGED",
  connectionId: "groq-managed",
  adapterId: "groq-official-openai-v1",
  endpointProfileId: "groq-official-chat-completions",
  serviceRegion: null,
};

test("public execution resolver creates one exact immutable execution target", () => {
  const resolver = new PublicExecutionResolver(new StaticPublicExecutionRouteRegistry([route]));

  assert.deepEqual(
    resolver.resolve({
      requestId: "request-public-1",
      publicModelId: "gpt-oss-20b",
    }),
    {
      requestId: "request-public-1",
      attempts: [
        {
          sequence: 1,
          target: {
            providerId: "groq",
            modelOfferingId: "groq:openai/gpt-oss-20b",
            upstreamModelId: "openai/gpt-oss-20b",
            connectionId: "groq-managed",
            credentialMode: "TOKENU_MANAGED",
            technicalProfileId: "groq-gpt-oss-20b-profile",
            adapterId: "groq-official-openai-v1",
            endpointProfileId: "groq-official-chat-completions",
            serviceRegion: null,
          },
        },
      ],
    }
  );
});

test("public execution resolver fails closed for an unknown public model", () => {
  const resolver = new PublicExecutionResolver(new StaticPublicExecutionRouteRegistry([route]));

  assert.equal(
    resolver.resolve({
      requestId: "request-public-2",
      publicModelId: "provider-looking/gpt-oss-20b",
    }),
    null
  );
});

test("public execution resolver performs exact public model lookup without case or whitespace inference", () => {
  const resolver = new PublicExecutionResolver(new StaticPublicExecutionRouteRegistry([route]));

  assert.equal(
    resolver.resolve({
      requestId: "request-public-3",
      publicModelId: "Gpt-Oss-20b",
    }),
    null
  );

  assert.equal(
    resolver.resolve({
      requestId: "request-public-4",
      publicModelId: " gpt-oss-20b ",
    }),
    null
  );
});

test("public execution resolver rejects blank request identity", () => {
  const resolver = new PublicExecutionResolver(new StaticPublicExecutionRouteRegistry([route]));

  assert.throws(
    () =>
      resolver.resolve({
        requestId: " ",
        publicModelId: "gpt-oss-20b",
      }),
    /request identity/
  );
});

test("static execution route registry rejects duplicate public model ids", () => {
  assert.throws(
    () => new StaticPublicExecutionRouteRegistry([route, route]),
    /Duplicate TokenU public model identity/
  );
});

test("static execution route registry rejects non-production offerings", () => {
  assert.throws(
    () =>
      new StaticPublicExecutionRouteRegistry([
        {
          ...route,
          offering: {
            ...offering,
            commercialStatus: "experimental",
          },
        },
      ]),
    /production-approved/
  );
});

test("static execution route registry rejects unavailable offerings", () => {
  assert.throws(
    () =>
      new StaticPublicExecutionRouteRegistry([
        {
          ...route,
          offering: {
            ...offering,
            availability: "degraded",
          },
        },
      ]),
    /available offering/
  );
});

test("static execution route registry rejects credential modes not approved by the offering", () => {
  assert.throws(
    () =>
      new StaticPublicExecutionRouteRegistry([
        {
          ...route,
          credentialMode: "HOSTED_BYOK",
        },
      ]),
    /Credential mode/
  );
});

test("static execution route registry rejects service regions not approved by the offering", () => {
  assert.throws(
    () =>
      new StaticPublicExecutionRouteRegistry([
        {
          ...route,
          serviceRegion: "eu-west",
        },
      ]),
    /Service region/
  );
});

test("technical execution identity comes only from reviewed route configuration", () => {
  const customRoute: ApprovedExecutionRoute = {
    ...route,
    publicModelId: "public-safe-name",
    connectionId: "internal-connection",
    adapterId: "internal-adapter",
    endpointProfileId: "internal-endpoint",
  };

  const resolver = new PublicExecutionResolver(
    new StaticPublicExecutionRouteRegistry([customRoute])
  );

  const plan = resolver.resolve({
    requestId: "request-public-5",
    publicModelId: "public-safe-name",
  });

  assert.ok(plan);

  assert.equal(plan.attempts[0]?.target.connectionId, "internal-connection");
  assert.equal(plan.attempts[0]?.target.adapterId, "internal-adapter");
  assert.equal(plan.attempts[0]?.target.endpointProfileId, "internal-endpoint");
  assert.equal(plan.attempts[0]?.target.technicalProfileId, offering.technicalProfileId);
});
