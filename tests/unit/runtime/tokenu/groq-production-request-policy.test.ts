import assert from "node:assert/strict";
import test from "node:test";

import { prepareGroqRequest } from "@/tokenu/adapters/groq/groqRequest";
import {
  GROQ_GPT_OSS_20B_ROUTE,
  GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
} from "@/tokenu/runtime/productionGroqCatalog";
import { PublicExecutionResolver } from "@/tokenu/runtime/publicExecutionResolver";
import { StaticPublicExecutionRouteRegistry } from "@/tokenu/runtime/staticPublicExecutionRouteRegistry";

function target() {
  const resolver = new PublicExecutionResolver(
    new StaticPublicExecutionRouteRegistry([GROQ_GPT_OSS_20B_ROUTE])
  );

  const plan = resolver.resolve({
    requestId: "request-policy",
    publicModelId: "gpt-oss-20b",
  });

  assert.ok(plan);

  const resolved = plan.attempts[0]?.target;

  assert.ok(resolved);

  return resolved;
}

test("production Groq route allows ordinary function tools", () => {
  const result = prepareGroqRequest({
    payload: {
      messages: [
        {
          role: "user",
          content: "Use the tool",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "lookup",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
      ],
    },
    target: target(),
    technicalModelProfile: GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
  });

  assert.equal(result.ok, true);
});

test("production Groq route rejects provider-integrated tool types", () => {
  const result = prepareGroqRequest({
    payload: {
      messages: [
        {
          role: "user",
          content: "Run code",
        },
      ],
      tools: [
        {
          type: "code_interpreter",
        },
      ],
    },
    target: target(),
    technicalModelProfile: GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    assert.fail("Expected provider-integrated tool rejection");
  }

  assert.equal(result.code, "unsupported-tool-type");
});

test("production Groq route rejects structured outputs combined with tools", () => {
  const result = prepareGroqRequest({
    payload: {
      messages: [
        {
          role: "user",
          content: "Return structured data",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "lookup",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "answer",
          schema: {
            type: "object",
            properties: {},
          },
        },
      },
    },
    target: target(),
    technicalModelProfile: GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    assert.fail("Expected tools plus structured output rejection");
  }

  assert.equal(result.code, "structured-output-with-tools-not-supported");
});

test("production Groq route rejects unsupported or client-controlled provider parameters", () => {
  for (const parameter of [
    "frequency_penalty",
    "presence_penalty",
    "logprobs",
    "logit_bias",
    "top_logprobs",
    "metadata",
    "store",
    "service_tier",
    "documents",
    "search_settings",
    "citation_options",
    "compound_custom",
    "disable_tool_validation",
    "user",
  ] as const) {
    const result = prepareGroqRequest({
      payload: {
        messages: [
          {
            role: "user",
            content: "Hello",
          },
        ],
        [parameter]: true,
      },
      target: target(),
      technicalModelProfile: GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
    });

    assert.equal(result.ok, false, parameter);

    if (!result.ok) {
      assert.equal(result.code, "unsupported-parameter", parameter);
    }
  }
});
