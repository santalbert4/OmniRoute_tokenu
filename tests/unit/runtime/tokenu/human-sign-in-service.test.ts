import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

import type {
  AuthenticatedTokenUUser,
  ExternalHumanIdentity,
} from "@/tokenu/contracts/humanAuthenticationIdentity";
import type { CreatedHumanSession } from "@/tokenu/contracts/humanSession";
import type { CreateHumanSessionInput } from "@/tokenu/runtime/humanSessionService";
import { HumanSignInService, type HumanSignInInput } from "@/tokenu/runtime/humanSignInService";

class FakeIdentityResolver {
  readonly calls: ExternalHumanIdentity[] = [];
  result: AuthenticatedTokenUUser | null = {
    userId: "user-a",
  };
  error: Error | null = null;

  async resolve(externalIdentity: ExternalHumanIdentity): Promise<AuthenticatedTokenUUser | null> {
    this.calls.push(externalIdentity);

    if (this.error) {
      throw this.error;
    }

    return this.result;
  }
}

class FakeSessionCreator {
  readonly calls: CreateHumanSessionInput[] = [];
  error: Error | null = null;

  readonly result: CreatedHumanSession = {
    session: {
      id: "session-a",
      userId: "user-a",
      secretHash: "a".repeat(64),
      createdAt: "2026-09-10T18:00:00.000Z",
      expiresAt: "2026-09-11T18:00:00.000Z",
      revokedAt: null,
    },
    credential: `tks_session-a.${"S".repeat(43)}`,
  };

  async create(input: CreateHumanSessionInput): Promise<CreatedHumanSession> {
    this.calls.push(input);

    if (this.error) {
      throw this.error;
    }

    return this.result;
  }
}

function fixture(): {
  identityResolver: FakeIdentityResolver;
  sessionCreator: FakeSessionCreator;
  service: HumanSignInService;
} {
  const identityResolver = new FakeIdentityResolver();
  const sessionCreator = new FakeSessionCreator();

  return {
    identityResolver,
    sessionCreator,
    service: new HumanSignInService(identityResolver, sessionCreator),
  };
}

test("resolved external identity creates one session for the resolved TokenU user", async () => {
  const { identityResolver, sessionCreator, service } = fixture();

  const input: HumanSignInInput = {
    externalIdentity: {
      authority: "https://identity.example.test",
      subject: "external-subject-a",
    },
    createdAt: "2026-09-10T18:00:00.000Z",
    expiresAt: "2026-09-11T18:00:00.000Z",
  };

  const result = await service.signIn(input);

  assert.equal(result, sessionCreator.result);

  assert.equal(identityResolver.calls.length, 1);
  assert.equal(sessionCreator.calls.length, 1);

  assert.deepEqual(sessionCreator.calls[0], {
    userId: "user-a",
    createdAt: "2026-09-10T18:00:00.000Z",
    expiresAt: "2026-09-11T18:00:00.000Z",
  });
});

test("unknown external identity returns null and never creates a session", async () => {
  const { identityResolver, sessionCreator, service } = fixture();

  identityResolver.result = null;

  const result = await service.signIn({
    externalIdentity: {
      authority: "https://identity.example.test",
      subject: "unknown-subject",
    },
    expiresAt: "2026-09-11T18:00:00.000Z",
  });

  assert.equal(result, null);
  assert.equal(identityResolver.calls.length, 1);
  assert.equal(sessionCreator.calls.length, 0);
});

test("omitted createdAt remains omitted when P8D session creation is invoked", async () => {
  const { sessionCreator, service } = fixture();

  await service.signIn({
    externalIdentity: {
      authority: "https://identity.example.test",
      subject: "external-subject-a",
    },
    expiresAt: "2026-09-11T18:00:00.000Z",
  });

  assert.equal(sessionCreator.calls.length, 1);

  assert.deepEqual(sessionCreator.calls[0], {
    userId: "user-a",
    expiresAt: "2026-09-11T18:00:00.000Z",
  });

  assert.equal(Object.prototype.hasOwnProperty.call(sessionCreator.calls[0], "createdAt"), false);
});

test("P8C integrity errors propagate and prevent session creation", async () => {
  const { identityResolver, sessionCreator, service } = fixture();

  identityResolver.error = new Error("Human identity binding references missing TokenU user");

  await assert.rejects(
    service.signIn({
      externalIdentity: {
        authority: "https://identity.example.test",
        subject: "external-subject-a",
      },
      expiresAt: "2026-09-11T18:00:00.000Z",
    }),
    /missing TokenU user/
  );

  assert.equal(sessionCreator.calls.length, 0);
});

test("P8D session creation errors propagate fail closed", async () => {
  const { sessionCreator, service } = fixture();

  sessionCreator.error = new Error("Human session identity collision");

  await assert.rejects(
    service.signIn({
      externalIdentity: {
        authority: "https://identity.example.test",
        subject: "external-subject-a",
      },
      expiresAt: "2026-09-11T18:00:00.000Z",
    }),
    /identity collision/
  );

  assert.equal(sessionCreator.calls.length, 1);
});

test("external authority and subject are forwarded to P8C exactly unchanged", async () => {
  const { identityResolver, service } = fixture();

  const externalIdentity: ExternalHumanIdentity = {
    authority: "  https://issuer.example.test/tenant  ",
    subject: "  opaque-subject-001  ",
  };

  await service.signIn({
    externalIdentity,
    expiresAt: "2026-09-11T18:00:00.000Z",
  });

  assert.equal(identityResolver.calls.length, 1);
  assert.equal(identityResolver.calls[0], externalIdentity);

  assert.deepEqual(identityResolver.calls[0], {
    authority: "  https://issuer.example.test/tenant  ",
    subject: "  opaque-subject-001  ",
  });
});

test("human sign-in orchestrator imports only P8C/P8D service and contract surfaces", () => {
  const file = "src/tokenu/runtime/humanSignInService.ts";

  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const imports = source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => {
      assert.ok(ts.isStringLiteral(statement.moduleSpecifier));

      return statement.moduleSpecifier.text;
    })
    .sort();

  assert.deepEqual(imports, [
    "@/tokenu/contracts/humanAuthenticationIdentity",
    "@/tokenu/contracts/humanSession",
    "@/tokenu/runtime/humanAuthenticationIdentityService",
    "@/tokenu/runtime/humanSessionService",
  ]);

  for (const forbidden of ["Repository", "next/headers", "next/server", "jose", "bcryptjs"]) {
    assert.equal(
      imports.some((entry) => entry.includes(forbidden)),
      false
    );
  }
});
