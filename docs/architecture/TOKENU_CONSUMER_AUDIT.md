# TokenU Consumer Audit

## Phase 2.5 — OmniRoute Runtime Classification

**Status:** Draft.

This document classifies existing OmniRoute runtime responsibilities against
the frozen TokenU contracts.

The goal is not file migration. The goal is responsibility separation.

Existing code remains an implementation source. TokenU contracts define the
future boundary.

---

# 1. Runtime size assessment

Current Open-SSE implementation contains:

- executors: 111 files
- services: 234 files

Total audited runtime surface:

- 345 top-level runtime files

The extraction strategy must therefore be incremental.

A direct directory migration would create excessive coupling.

---

# 2. Responsibility classification

| Area                 | Current location              | Future ownership         |
| -------------------- | ----------------------------- | ------------------------ |
| protocol translation | open-sse/translator           | TokenU Core translators  |
| upstream execution   | open-sse/executors            | TokenU adapters          |
| routing decisions    | open-sse/services routing     | TokenU Planner           |
| fallback decisions   | open-sse/services fallback    | TokenU Plan Runner       |
| retries              | open-sse/services retry       | TokenU Plan Runner       |
| credentials          | open-sse/services credential  | Secret/Identity runtime  |
| quotas               | open-sse/services quota       | TokenScore inputs        |
| usage tracking       | open-sse/services usage       | Billing Engine           |
| transport helpers    | open-sse/services network/tls | Provider transport layer |
| API handlers         | src/app                       | OmniRoute application    |

---

# 3. Extraction rule

TokenU extraction follows this direction:

OmniRoute runtime implementation

↓

TokenU-owned contract boundary

↓

TokenU execution model

Existing modules must become consumers of TokenU contracts.

They must not define:

- routing authority
- fallback authority
- retry authority
- commercial policy
- billing policy

---

# 4. Executors audit

Current:

open-sse/executors/

Responsibility:

Provider-specific execution implementations.

Migration target:

src/tokenu/adapters/

Adapter responsibilities:

- receive CoreExecutionRequest
- execute exactly one upstream attempt
- return CoreExecutionResult

Adapters must not:

- select providers
- select models
- retry
- fallback
- execute TokenScore
- evaluate commercial policy

---

# 5. Services audit

The services directory contains multiple future ownership domains.

Classification:

| Service category    | Future owner                       |
| ------------------- | ---------------------------------- |
| router / routing    | TokenU Planner                     |
| fallback            | TokenU Plan Runner                 |
| retry               | TokenU Plan Runner                 |
| quota               | Provider intelligence / TokenScore |
| credential          | Identity runtime                   |
| usage               | Billing Engine                     |
| provider metadata   | Provider Registry                  |
| translation helpers | TokenU Core                        |
| transport           | Adapter infrastructure             |

---

# 6. First extraction candidate

The first production migration should not move all providers.

Recommended first adapter:

One stable provider path behind:

SingleTargetAdapter

Example:

TokenU Plan Runner

↓

ExecutionTarget

↓

SingleTargetAdapter

↓

existing Open-SSE executor

↓

Provider

This validates the architecture before large-scale extraction.

---

# 7. Validation criteria

Before moving additional runtime code:

- contracts remain independent from Open-SSE
- adapters cannot route
- adapters cannot retry
- adapters cannot fallback
- credentials stay outside contracts
- billing stays outside execution
- provider-specific logic remains isolated
