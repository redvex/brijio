# BrowserBridge Roadmap

**Time horizon:** 6 months (June 2026 – November 2026)  
**Purpose:** Internal planning document — prioritises what to build, why, and in what order.

---

## Where We Are Today

BrowserBridge has a working local MVP:

- **WebSocket relay** with pairing-token auth, session routing, and local presence
- **MCP server** with HTTP transport, 9 tools, skill resources/prompts, and plugin manifests
- **Chrome + Safari extensions** with full feature parity (page context, form actions)
- **Docker Compose** for local WS + MCP
- **27 ADRs** documenting every architectural decision
- **Source-available license** (PolyForm Noncommercial 1.0.0) with a commercial licensing policy in place

The current gap between "working prototype" and "viable product" is covered by [ADR 0028 (MVP Approach)](docs/architecture/decisions/0028-mvp-approach.md), which defines two phases before this roadmap picks up:

- **Phase 1 (DX Baseline):** `pnpm dev`, quick-start tutorial, extension UX improvements, health endpoints, integration tests, release v0.1.0
- **Phase 2 (Value Proof):** Agent-driven form-filling and data-extraction workflows, video walkthrough, Chrome Web Store preparation

This roadmap assumes Phase 1 and Phase 2 are completed or near-complete. Everything below builds on top of that foundation.

---

## Roadmap at a Glance

| Quarter           | Theme                | Key Deliverables                                                                          |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| Q2 2026 (Jun–Aug) | **Stabilise & Ship** | v0.1.0 release, CWS submission, integration test coverage, Firefox ADR                    |
| Q3 2026 (Sep–Nov) | **Expand & Capture** | Firefox extension, file upload MCP capability, canvas understanding, cloud hosting design |

---

## Q2 2026: Stabilise & Ship

The goal this quarter is to close the MVP gap, ship a version people can trust, and start building real distribution.

- **v0.1.0 release** — Tag, changelog, GitHub release, automated release workflow
- **Chrome Web Store submission** — Production CRX, privacy policy, proper manifest
- **Integration test coverage** — Full-stack automated tests running in CI
- **Firefox ADR** — Research and decide on Firefox implementation approach
- **Test coverage report** — Add a coverage tool and publish results in CI
- **Promotion basics** — README polish, quick-start video, first community post

### v0.1.0 Release and Distribution

This is the single most important deliverable of the quarter. A tagged, versioned release with proper packaging signals that BrowserBridge is real software, not a demo.

- Semantic versioning across all packages (`@browserbridge/shared`, `@browserbridge/websocket`, `@browserbridge/mcp`)
- CHANGELOG.md covering everything from ADR 0001 to present
- GitHub Actions workflow: push a tag → build → release → publish CRX artefact
- Extension builds: Chrome CRX + Safari XPI (or equivalent packaging)
- The tag `v0.1.0` exists in git and points to a commit you can check out and run

### Chrome Web Store Submission

Getting the extension into the CWS removes the "load unpacked" barrier for new users. This means real distribution becomes possible.

- Production CRX with proper `manifest.json` (icons, description, permissions justification)
- Privacy policy page (required by CWS) — can be a GitHub Pages site or a static doc
- Screenshots and store listing copy
- Submission-ready package (not submitted yet in Phase 2 of ADR 0028; this quarter we submit)
- Plan for handling CWS review feedback and updates

### Integration Test Coverage

The system works end-to-end today, but only because you've manually tested it. Automated integration tests make reliability undeniable and prevent regressions as complexity grows.

- Test suite that starts WS + MCP via Docker Compose, makes real tool calls, verifies responses
- Covers: auth, `list_browsers`, `read_current_page`, `click_element`, `fill_input`, form lifecycle
- Runs in CI (`docker compose --profile test`)
- Test coverage report published as a CI artefact or badge
- Target: ≥70% line coverage on `@browserbridge/mcp` and `@browserbridge/websocket`

### Test Coverage Report

- Integrate a coverage tool (e.g. `c8` or `vitest --coverage`) into the CI pipeline
- Publish coverage as a CI artefact; optionally add a badge to README
- Track coverage over time — this is a health metric, not a target number

### Firefox ADR

Firefox is the last major desktop browser without a working extension. Before writing code, we need a written decision that addresses the real differences.

- Research Firefox WebExtensions API deltas vs Chrome/Safari
- Decide: can we reuse `@browserbridge/shared` as-is, or does Firefox need its own adapter layer?
- Decide: Manifest V2 vs V3 for Firefox (MV3 is available but MV2 has wider API surface)
- Decide: permissions model and any Firefox-specific user-control behaviour
- Write the ADR, get it approved, then implementation begins in Q3

### Promotion Basics

No point shipping if nobody finds it.

- Polish the README: clear value proposition, architecture diagram, quick-start section
- Record a 2–3 minute demo video: "Watch an AI agent interact with a page you're logged into"
- Write one community post (Hacker News, Reddit r/selfhosted, or relevant Discord/server)
- Consider a GitHub topic/tag strategy for discoverability

---

## Q3 2026: Expand & Capture

With a stable, distributed extension and growing user base, the focus shifts to expanding what BrowserBridge can do and making it available beyond local-only setups.

- **Firefox extension** — full feature parity with Chrome/Safari
- **MCP file upload** — agents can upload files through the browser
- **MCP canvas understanding** — agents can read and interpret `<canvas>` content
- **Cloud hosting design ADR** — architecture for multi-tenant hosted BB
- **Cloud hosting prototype** — deployable hosted WS + MCP
- **Free / paid tier design** — feature gating, usage limits, billing integration

### Firefox Extension Implementation

This is the biggest new-feature work item. The ADR from Q2 defines the approach; this is the execution.

- Firefox WebExtension using `@browserbridge/shared` and Firefox-specific adapters
- Feature parity with Chrome/Safari: page context, form actions, presence, pairing
- Firefox-specific: test against Firefox's WebSocket API surface, popup behaviour, permissions model
- Add Firefox to the integration test matrix
- Publish to AMO (Add-ons Mozilla Organization) once stable

### MCP File Upload Capability

Right now, agents can read pages and interact with forms — but they can't upload files. This is a significant gap for workflows like "upload this document to the form I'm looking at."

- ADR first: decide the protocol (does the agent send a file path? base64? URL reference?)
- Agent sends file data through MCP → WS → extension
- Extension injects file data into `<input type="file">` or equivalent
- Handle size limits, MIME type validation, and progress feedback
- Security consideration: file uploads cross a trust boundary; the user must approve each upload

### MCP Canvas Understanding

Canvas elements are opaque to text-based page reading — agents see `<canvas>` but can't tell what's rendered. Understanding canvas content unlocks dashboards, charts, games, and drawing tools.

- ADR first: decide the approach (screenshot the canvas element? extract via `toDataURL`? use `getImageData` for pixel-level access?)
- Extension captures canvas content and returns it as an image or structured description
- MCP tool or resource: `get_canvas_content` or `read_canvas` — agents request canvas data from a specific element
- Consider performance implications (canvas can be large; provide resolution/thumbnail options)
- Consider accessibility: if a canvas has an ARIA label or role, include that metadata

### Cloud Hosting Design

Moving from local-only to a hosted service is a fundamental architecture change. This ADR must be thorough.

- Multi-tenant session routing: each user's browser connects to their own isolated channel
- Authentication beyond pairing tokens: OAuth or API keys for cloud users
- WebSocket server scaling: sticky sessions, load balancing, connection draining
- MCP server scaling: stateless design, connection pooling
- Data isolation: no cross-user data leakage, no storing page content unless explicitly approved
- TLS termination, domain management, DNS
- Consider managed WebSocket services (e.g. Pusher, Ably) vs self-hosted

### Cloud Hosting Prototype

Once the ADR is approved, build the smallest deployable version.

- Single-region cloud deployment (e.g. Fly.io, Railway, or AWS)
- Docker images for WS server and MCP server published to a registry
- CI pipeline: push to main → build → push image → deploy
- Basic multi-user routing: users get unique tokens, sessions are isolated
- Health checks, structured logging, error alerting

### Free and Paid Tier Design

The commercial licensing policy exists (COMMERCIAL-LICENSING.md). Now decide what the tiers look like.

- Free tier: local use + limited cloud use (e.g. 100 tool calls/day, 1 browser connection)
- Paid tier: higher limits, priority routing, advanced features (canvas understanding? file upload?)
- Decide: metered (per tool call) or flat monthly subscription or both
- Decide: self-serve signup vs invite-only during early cloud phase
- Payment integration: Stripe, Paddle, or Lemon Squeezy
- Landing page with pricing, docs with cloud setup instructions

---

## Explicitly Not in This 6-Month Window

These are real possibilities but they're deliberately deferred:

- **iOS/Android browser extension** — Mobile browsers have limited extension APIs. Safari on iOS supports some WebExtensions, but the UX model (no persistent popup, background processing constraints) is fundamentally different. Feasibility research can happen in Q3, but implementation is not committed.
- **Continuous monitoring / page-watch skill** — The current design is request-response only. A "watch this page for changes" skill is powerful but introduces stateful, long-lived subscriptions that conflict with the user-controlled philosophy. Needs a separate ADR with clear opt-in semantics.
- **Plugin/marketplace ecosystem** — Letting third parties write BB-compatible extensions or MCP tools is appealing but requires API stability, versioning, and governance that we don't have yet.
- **Multi-agent routing** — Allowing multiple agents to interact with the same browser session simultaneously. Interesting but complex (conflict resolution, action ordering, permission scoping).

---

## Success Metrics

| Metric                    | Target by End of Q2 | Target by End of Q3 |
| ------------------------- | ------------------- | ------------------- |
| GitHub stars              | 100                 | 300                 |
| Chrome Web Store installs | 50                  | 200                 |
| Firefox AMO installs      | —                   | 30                  |
| Integration test coverage | ≥70%                | ≥80%                |
| Cloud hosting             | Not started         | Prototype deployed  |
| Paying cloud users        | 0                   | 5 (beta)            |

These are aspirational targets, not hard commitments. They're meant to give direction, not create pressure.

---

## How to Use This Roadmap

1. **Every new feature starts with an ADR.** No exceptions. The roadmap describes _what_ and _why_; ADRs describe _how_.
2. **Check the roadmap before starting work.** If a task isn't listed here, it probably needs an ADR that explains why it should displace something that is.
3. **Reassess quarterly.** This is a living document. If Firefox takes longer than expected, or cloud hosting turns out to be simpler, adjust the plan.
4. **The "Not in This Window" list is as important as the committed items.** It's easy to scope-creep on interesting ideas. Keep coming back to this list when tempted.
