# Brijio Agent Instructions

Brijio is a user-controlled bridge between AI agents and browser sessions the
user already controls. Keep changes small, explicit, privacy-preserving, and
easy to review.

## Start Here

Before changing the repository:

1. Read [OpenWiki quickstart](openwiki/quickstart.md).
2. Follow only the architecture, workflow, domain, security, or testing links
   relevant to the task.
3. Inspect the working tree and preserve unrelated user changes.
4. Read the package manifest and tests for the area being changed.

Use `package.json` and workspace package manifests as the authority for runtime
versions, package-manager versions, and available commands. Do not copy mutable
tool inventories or repository trees into this file.

## Sources of Truth

Use these sources according to the question being answered:

- Executable behavior: source code and tests.
- Current product contract and support status:
  `docs/project/CAPABILITY_MATRIX.md`.
- Architectural decisions and design history:
  `docs/architecture/decisions`.
- Repository navigation and cross-component workflows: `openwiki`.
- Security intent and trust boundaries: `docs/security`.
- Public setup and usage: the root and package `README.md` files.

If these sources disagree, do not silently choose one. Determine whether the
code or documentation is stale, update the discrepancy when it is in scope,
and otherwise report it.

## Non-Negotiable Product Invariants

- The user explicitly starts and stops the browser bridge.
- Browser state is available only while the user-controlled extension is
  connected.
- Every browser read or action is initiated by an explicit MCP tool or resource
  request.
- Do not add continuous page, DOM, screenshot, history, or browser-state
  streaming.
- Do not implement silent background surveillance, cookie export, credential
  extraction, session cloning, or MFA interception.
- Do not persist page content unless an accepted ADR explicitly requires it.
- Preserve authenticated, private browser and tab routing with explicit request
  IDs, structured errors, and timeouts.
- Preserve user-visible connection state and configured client-side action
  approval. Do not bypass approval checks.
- Keep permissions minimal and document why each browser permission is needed.
- Prefer progressive disclosure: return structured context before larger page
  content or visual data.

The extension is reactive. It answers explicit requests and returns structured
results; it does not publish ambient browser state.

## Change Workflow

Classify the change before editing.

### ADR Required

Write an ADR before implementation when a change introduces or alters:

- a product capability or intentional user-visible behavior;
- a cross-package protocol or schema;
- an architectural boundary or ownership decision;
- authentication, authorization, privacy, storage, or a trust boundary;
- browser routing, targeting, or lifecycle semantics;
- a dependency or framework that materially changes the architecture.

Create the ADR as `Proposed`, include Mermaid diagrams when architecture or
message flow is relevant, and wait for explicit user approval before
implementing it. A request to implement a feature does not by itself approve
the ADR written for that feature.

Before assigning a number, list existing ADRs and use the next unused number.
Never reuse an ADR number. After approval, mark the ADR `Accepted`. If a
decision is replaced, record its superseding or superseded relationship. Do
not leave an implemented decision marked `Proposed`.

### ADR Usually Not Required

An ADR is normally unnecessary for:

- a bug fix that restores documented or tested behavior;
- tests for existing behavior;
- documentation-only corrections;
- a behavior-preserving refactor;
- narrowly scoped tooling or dependency maintenance;
- implementation already covered by an accepted ADR.

If a supposedly narrow change requires a new design decision, stop and follow
the ADR workflow.

### Implementation

For behavior changes, use TDD:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands.

For documentation, configuration, or tooling changes where a failing test is
not meaningful, validate with the narrowest applicable formatter, linter,
build, or direct inspection.

## Ownership and Cross-Layer Changes

- Shared protocol shapes and browser-agnostic behavior belong in
  `packages/shared`.
- Relay authentication, presence, and routing belong in `servers/websocket`.
- Agent-facing tools, resources, prompts, and skills belong in `servers/mcp`.
- Browser-specific integration belongs in `clients/extensions/chrome` and
  `clients/extensions/safari`; keep adapters thin and shared behavior shared.

When changing a protocol or browser capability, check the full path:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional rules:

- Keep protocol definitions in `packages/shared`; do not duplicate them.
- Preserve explicit per-call browser and `tabId` targeting. Do not introduce
  hidden selected-browser or selected-tab session state.
- When `tabId` is optional, preserve the documented active-tab fallback unless
  an accepted ADR changes it.
- Re-read page context after navigation or a mutation that can invalidate
  short-lived target IDs.
- When tool behavior changes, update its tests, MCP registration, relevant
  skills under `servers/mcp/skills`, the capability matrix, and relevant
  OpenWiki workflow pages.
- Consider both Chrome and Safari for shared browser behavior. Document and
  test intentional platform differences.

## Coding Standards

- Use TypeScript for JavaScript runtime code and follow the existing language
  and format of platform, build, and documentation files.
- Prefer readable, explicit code and structured parsers or schemas over ad hoc
  string handling.
- Avoid unnecessary frameworks, abstractions, and unrelated refactors.
- Return predictable structured results with explicit success data or error
  codes.
- Add tests around protocol handling, routing, tool behavior, browser adapters,
  and failure paths.
- Never commit secrets, real tokens, user data, generated credentials, or
  user-specific configuration.

## Verification

Run the smallest verification set that covers the change:

- Shared package:
  `pnpm --filter @brijio/shared test` and
  `pnpm --filter @brijio/shared check`.
- WebSocket relay:
  `pnpm --filter @brijio/websocket test` and
  `pnpm --filter @brijio/websocket check`.
- MCP server:
  `pnpm --filter @brijio/mcp test` and
  `pnpm --filter @brijio/mcp check`.
- Chrome extension:
  `pnpm --filter @brijio/chrome-extension test` and
  `pnpm --filter @brijio/chrome-extension check`.
- Safari extension:
  `pnpm --filter @brijio/safari-extension test` and
  `pnpm --filter @brijio/safari-extension check`.

For cross-package changes, run `pnpm test` and `pnpm check`. Before a PR is
ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and
derive the current profiles and commands from `docker-compose.yml`. Do not
assume a profile exists.

Before claiming completion, report exactly what passed and what could not be
run.

## Documentation

Update documentation according to what changed:

- Capability or support status: `docs/project/CAPABILITY_MATRIX.md`.
- Architectural decision: `docs/architecture/decisions`.
- Repository navigation or cross-layer workflow: `openwiki`.
- Public setup, commands, or configuration: root or package `README.md`.
- Completed feature or operational explanation: `docs/artifacts`.
- Security boundary or guarantee: `docs/security`.

Keep documentation linked rather than copying large mutable inventories between
files.

## Git and Pull Requests

- Preserve unrelated changes and never revert user work.
- Keep changes focused; do not mix cleanup, formatting, dependencies, or
  documentation rewrites into an unrelated behavior change.
- Use small, atomic commits with meaningful messages.
- Stage files explicitly. Avoid `git add .` and `git add -A` unless the entire
  working tree has been reviewed and confirmed as PR scope.
- A commit should represent one coherent step, such as an ADR, tests,
  implementation, documentation, or tooling.
- Use a PR title and description that match the actual goal and scope.
- Report verification results and any known limitations in the PR description.
