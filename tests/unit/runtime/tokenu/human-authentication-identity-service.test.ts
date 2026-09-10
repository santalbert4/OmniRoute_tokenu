import assert from "node:assert/strict";
import test from "node:test";

import type { HumanIdentityBinding } from "@/tokenu/contracts/humanAuthenticationIdentity";
import { HumanAuthenticationIdentityService } from "@/tokenu/runtime/humanAuthenticationIdentityService";
import type { HumanIdentityBindingRepository } from "@/tokenu/runtime/humanIdentityBindingRepository";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";

function bindingRepository(
  get: HumanIdentityBindingRepository["get"]
): HumanIdentityBindingRepository {
  return {
    get,
  };
}

function userRepository(get: TokenUUserRepository["get"]): TokenUUserRepository {
  return {
    get,

    async save(): Promise<void> {
      throw new Error("unexpected TokenU user provisioning");
    },
  };
}

const EXACT_BINDING: HumanIdentityBinding = {
  authority: "oidc:https://identity.example",
  subject: "opaque-subject-a",
  userId: "user-a",
  createdAt: "2026-09-10T12:00:00.000Z",
};

test("human authentication identity resolves exact external identity to internal TokenU user only", async () => {
  const bindings = bindingRepository(async (authority, subject) => {
    assert.equal(authority, EXACT_BINDING.authority);
    assert.equal(subject, EXACT_BINDING.subject);

    return EXACT_BINDING;
  });

  const users = userRepository(async (userId) => {
    assert.equal(userId, "user-a");

    return {
      id: "user-a",
      createdAt: "2026-09-10T11:00:00.000Z",
    };
  });

  const service = new HumanAuthenticationIdentityService(bindings, users);

  assert.deepEqual(
    await service.resolve({
      authority: EXACT_BINDING.authority,
      subject: EXACT_BINDING.subject,
    }),
    {
      userId: "user-a",
    }
  );
});

test("unknown external human identity resolves to null without provisioning", async () => {
  const service = new HumanAuthenticationIdentityService(
    bindingRepository(async () => null),
    userRepository(async () => {
      throw new Error("TokenU user lookup must not run");
    })
  );

  assert.equal(
    await service.resolve({
      authority: "oidc:https://identity.example",
      subject: "unknown-subject",
    }),
    null
  );
});

test("blank external authority or subject fails closed before repository lookup", async () => {
  let bindingLookups = 0;

  const service = new HumanAuthenticationIdentityService(
    bindingRepository(async () => {
      bindingLookups += 1;
      return null;
    }),
    userRepository(async () => null)
  );

  await assert.rejects(
    service.resolve({
      authority: " ",
      subject: "subject-a",
    }),
    /requires authority/
  );

  await assert.rejects(
    service.resolve({
      authority: "authority-a",
      subject: " ",
    }),
    /requires subject/
  );

  assert.equal(bindingLookups, 0);
});

test("dangling human identity binding fails closed", async () => {
  const service = new HumanAuthenticationIdentityService(
    bindingRepository(async () => EXACT_BINDING),
    userRepository(async () => null)
  );

  await assert.rejects(
    service.resolve({
      authority: EXACT_BINDING.authority,
      subject: EXACT_BINDING.subject,
    }),
    /references missing TokenU user/
  );
});

test("binding repository cannot silently return a different external identity", async () => {
  const service = new HumanAuthenticationIdentityService(
    bindingRepository(async () => ({
      ...EXACT_BINDING,
      subject: "retargeted-subject",
    })),
    userRepository(async () => {
      throw new Error("TokenU user lookup must not run");
    })
  );

  await assert.rejects(
    service.resolve({
      authority: EXACT_BINDING.authority,
      subject: EXACT_BINDING.subject,
    }),
    /different external identity/
  );
});

test("TokenU user repository cannot silently return a different user identity", async () => {
  const service = new HumanAuthenticationIdentityService(
    bindingRepository(async () => EXACT_BINDING),
    userRepository(async () => ({
      id: "user-b",
      createdAt: "2026-09-10T11:00:00.000Z",
    }))
  );

  await assert.rejects(
    service.resolve({
      authority: EXACT_BINDING.authority,
      subject: EXACT_BINDING.subject,
    }),
    /TokenU user lookup returned a different identity/
  );
});

test("malformed resolved binding fails closed", async () => {
  const service = new HumanAuthenticationIdentityService(
    bindingRepository(async () => ({
      ...EXACT_BINDING,
      userId: " ",
    })),
    userRepository(async () => {
      throw new Error("TokenU user lookup must not run");
    })
  );

  await assert.rejects(
    service.resolve({
      authority: EXACT_BINDING.authority,
      subject: EXACT_BINDING.subject,
    }),
    /bound TokenU user identity/
  );
});
