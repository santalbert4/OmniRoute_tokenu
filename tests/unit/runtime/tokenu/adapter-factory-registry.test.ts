import assert from "node:assert/strict";
import test from "node:test";

import { GROQ_ADAPTER_ID } from "@/tokenu/adapters/groq/groqAdapterFactory";
import { DefaultAdapterFactoryRegistry } from "@/tokenu/runtime/defaultAdapterFactoryRegistry";

test("default registry resolves approved Groq adapter factory", () => {
  const registry = new DefaultAdapterFactoryRegistry();

  const factory = registry.resolve(GROQ_ADAPTER_ID);

  assert.ok(factory);
  assert.equal(factory?.id, GROQ_ADAPTER_ID);
});

test("default registry rejects unknown adapter ids", () => {
  const registry = new DefaultAdapterFactoryRegistry();

  const factory = registry.resolve("unknown-adapter");

  assert.equal(factory, null);
});
