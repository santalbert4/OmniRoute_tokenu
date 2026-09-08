# TokenU Extraction Map

## Phase 2.4 — OmniRoute Consumer Audit

**Status:** Draft.

This document maps existing OmniRoute responsibilities into future TokenU boundaries.

The objective is not to move code blindly. Each existing subsystem must be classified as:

- TokenU Core
- TokenU orchestration
- TokenU adapters
- OmniRoute application layer
- Provider-specific implementation
- Deprecated responsibility

---

# 1. Migration principle

Existing OmniRoute code must not define TokenU architecture.

The migration direction is: OmniRoute implementation -> TokenU-owned contracts -> TokenU execution model.

TokenU contracts are the stable boundary.

---

# 2. High-level responsibility map

| Current area           | Future ownership      | Action              |
| ---------------------- | --------------------- | ------------------- |
| translators            | TokenU Core           | extract/adapt       |
| executors              | TokenU Adapter layer  | rewrite boundary    |
| routing                | TokenU Planner        | separate            |
| combos                 | TokenU Planner        | separate            |
| fallback               | Plan Runner           | remove from adapter |
| retries                | Plan Runner           | remove from adapter |
| provider configuration | Provider registry     | normalize           |
| billing                | Billing Engine        | isolate             |
| dashboard/API          | OmniRoute application | remain              |

---

# 3. Translation layer

## Current

open-sse/translator/

Contains provider protocol conversions.

## Target

src/tokenu/translators/

Must implement:

- RequestProtocolTranslator
- ResponseProtocolTranslator
- ProtocolTranslatorRegistry

Rules:

- no provider credentials
- no routing decisions
- no fallback
- no retry
- no hidden payload metadata

---

# 4. Execution adapters

## Current

open-sse/executors/

## Target

src/tokenu/adapters/

Each adapter receives:

CoreExecutionRequest
|
↓
SingleTargetAdapter
|
↓
CoreExecutionResult

The adapter performs exactly one upstream attempt.

The adapter does not:

- choose models
- choose providers
- retry
- fallback
- execute TokenScore
- evaluate commercial policy
- accept arbitrary upstream endpoints

---

# 5. Planner boundary

Current routing responsibilities:

- routing
- combo execution
- fallback selection
- candidate ordering

move to:

TokenU Planner

Planner responsibilities:

- evaluate eligible offerings
- apply TokenScore
- create ExecutionPlan
- assign attemptId
- decide retries
- decide fallback

---

# 6. Provider-specific code

Provider-specific behavior remains isolated.

Allowed:

- HTTP transport
- authentication mechanism
- upstream wire protocol handling
- streaming parsing

Not allowed:

- global routing
- commercial decisions
- cross-provider fallback
- hidden retry orchestration

---

# 7. Extraction order

Recommended migration sequence:

1. freeze contracts
2. create extraction map
3. extract translators
4. introduce adapter boundary
5. move planner responsibilities
6. migrate provider implementations
7. remove legacy execution coupling

---

# 8. Validation rules

Before moving production execution code, verify:

- TokenU contracts remain independent from OmniRoute application code
- adapters cannot perform routing decisions
- retries remain outside adapters
- fallback remains outside adapters
- provider credentials remain outside contracts
- billing remains outside execution contracts
