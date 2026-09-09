import assert from "node:assert/strict";
import test from "node:test";

import {
  GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE,
  GROQ_GPT_OSS_20B_OFFERING,
  GROQ_GPT_OSS_20B_PROVIDER_PRICING,
  GROQ_GPT_OSS_20B_ROUTE,
  GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
  GROQ_GPT_OSS_20B_UPSTREAM_MODEL_ID,
  PRODUCTION_GROQ_ENDPOINT_PROFILES,
  PRODUCTION_GROQ_PUBLIC_EXECUTION_ROUTES,
  PRODUCTION_GROQ_TECHNICAL_MODEL_PROFILES,
} from "@/tokenu/runtime/productionGroqCatalog";
import { PublicExecutionResolver } from "@/tokenu/runtime/publicExecutionResolver";
import { StaticEndpointProfileRegistry } from "@/tokenu/runtime/staticEndpointProfileRegistry";
import { StaticPublicExecutionRouteRegistry } from "@/tokenu/runtime/staticPublicExecutionRouteRegistry";
import { StaticTechnicalModelProfileRegistry } from "@/tokenu/runtime/staticTechnicalModelProfileRegistry";

test("production Groq catalog pins one reviewed GPT-OSS 20B route", () => {
  assert.deepEqual(GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE, {
    id: "groq-official-chat-completions",
    url: "https://api.groq.com/openai/v1/chat/completions",
  });

  assert.equal(GROQ_GPT_OSS_20B_OFFERING.providerId, "groq");

  assert.equal(GROQ_GPT_OSS_20B_OFFERING.upstreamModelId, "openai/gpt-oss-20b");

  assert.equal(GROQ_GPT_OSS_20B_OFFERING.commercialStatus, "production-approved");

  assert.equal(GROQ_GPT_OSS_20B_OFFERING.availability, "available");

  assert.deepEqual(GROQ_GPT_OSS_20B_OFFERING.credentialModes, ["TOKENU_MANAGED"]);

  assert.deepEqual(GROQ_GPT_OSS_20B_OFFERING.pricing, {
    currency: "USD",
    unit: "per-million-tokens",
    input: 0.075,
    output: 0.3,
    cacheRead: 0.037,
    cacheWrite: null,
  });
});

test("production Groq technical profile pins reviewed model limits and capabilities", () => {
  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.contextWindowTokens, 131_072);

  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.maxOutputTokens, 65_536);

  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.upstreamProtocol, "openai");

  assert.deepEqual(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.reasoning.supportedEfforts, [
    "low",
    "medium",
    "high",
  ]);

  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.capabilities.toolCalling, "supported");

  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.capabilities.structuredOutput, "supported");

  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.capabilities.jsonSchema, "supported");

  assert.equal(GROQ_GPT_OSS_20B_TECHNICAL_PROFILE.capabilities.webSearch, "unknown");
});

test("production Groq billing price uses exact upstream model identity", () => {
  assert.equal(GROQ_GPT_OSS_20B_PROVIDER_PRICING.providerId, "groq");

  assert.equal(GROQ_GPT_OSS_20B_PROVIDER_PRICING.modelId, GROQ_GPT_OSS_20B_UPSTREAM_MODEL_ID);

  assert.equal(GROQ_GPT_OSS_20B_PROVIDER_PRICING.inputTokenPricePerMillion, 0.075);

  assert.equal(GROQ_GPT_OSS_20B_PROVIDER_PRICING.cacheReadTokenPricePerMillion, 0.037);

  assert.equal(GROQ_GPT_OSS_20B_PROVIDER_PRICING.cacheWriteTokenPricePerMillion, null);

  assert.equal(GROQ_GPT_OSS_20B_PROVIDER_PRICING.outputTokenPricePerMillion, 0.3);
});

test("production Groq registries resolve one exact immutable execution route", () => {
  const endpointRegistry = new StaticEndpointProfileRegistry(PRODUCTION_GROQ_ENDPOINT_PROFILES);

  const technicalRegistry = new StaticTechnicalModelProfileRegistry(
    PRODUCTION_GROQ_TECHNICAL_MODEL_PROFILES
  );

  const routeRegistry = new StaticPublicExecutionRouteRegistry(
    PRODUCTION_GROQ_PUBLIC_EXECUTION_ROUTES
  );

  assert.equal(
    endpointRegistry.resolve(GROQ_GPT_OSS_20B_ROUTE.endpointProfileId),
    GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE
  );

  assert.equal(
    technicalRegistry.resolve(GROQ_GPT_OSS_20B_ROUTE.offering.technicalProfileId),
    GROQ_GPT_OSS_20B_TECHNICAL_PROFILE
  );

  const resolver = new PublicExecutionResolver(routeRegistry);

  const plan = resolver.resolve({
    requestId: "request-production-groq",
    publicModelId: "gpt-oss-20b",
  });

  assert.ok(plan);

  assert.equal(plan.attempts.length, 1);

  assert.deepEqual(plan.attempts[0]?.target, {
    providerId: "groq",
    modelOfferingId: "groq:openai/gpt-oss-20b",
    upstreamModelId: "openai/gpt-oss-20b",
    connectionId: "groq-managed",
    credentialMode: "TOKENU_MANAGED",
    technicalProfileId: "groq-gpt-oss-20b-profile",
    adapterId: "groq-official-openai-v1",
    endpointProfileId: "groq-official-chat-completions",
    serviceRegion: null,
  });

  assert.equal(
    resolver.resolve({
      requestId: "request-unknown",
      publicModelId: "openai/gpt-oss-20b",
    }),
    null
  );
});

test("production Groq catalog contains no credential material", () => {
  const serialized = JSON.stringify({
    route: GROQ_GPT_OSS_20B_ROUTE,
    offering: GROQ_GPT_OSS_20B_OFFERING,
    endpoint: GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE,
  });

  assert.equal(serialized.includes("apiKey"), false);

  assert.equal(serialized.includes("credentialValue"), false);

  assert.equal(serialized.includes("Bearer "), false);
});
