# BrowserBridge Capability Matrix

## Purpose

This document describes what BrowserBridge can and cannot do.

It serves as a product contract, security reference, and implementation guide.

The goal is to make BrowserBridge capabilities explicit rather than implicit.

---

# Design Philosophy

BrowserBridge is designed around:

- Existing authenticated browser sessions
- Explicit user control
- Privacy by design
- Progressive disclosure
- Remote-agent compatibility

Capabilities are intentionally constrained to align with these principles.

---

# Current Capabilities

- Read page context ✅ — Structured page map, forms, actions, links, headings
- Read page content ✅ — Full text content via explicit request
- Read selected text ✅ — Access current selection
- Fill forms ✅ — Text inputs, textareas, editable fields
- Trigger actions ✅ — Buttons and interactive controls
- Read page metadata ✅ — URL, title, timestamps
- Structured page understanding ✅ — Forms, actions, editables, landmarks
- Remote agent access ✅ — Via MCP and relay architecture

---

# Planned Capabilities

- File uploads 🚧 — Chunked transfer protocol
- End-to-end encryption 🚧 — Relay cannot inspect payloads
- Multi-tab workflows 🚧 — Agent awareness across tabs
- Fine-grained permissions 🚧 — Per-capability approvals
- User approval workflows 🚧 — Explicit confirmation for sensitive actions
- File vault integration 🚧 — User-owned document repository
- Team relay support 🚧 — Shared infrastructure
- Audit trails 🚧 — Enterprise workflows

---

# Explicit Non-Capabilities

The following are intentionally outside the BrowserBridge design.

- Cookie export ❌ — Violates authenticated-session model
- Session cloning ❌ — Browser remains source of truth
- Browser mirroring ❌ — Not remote desktop software
- Continuous screenshots ❌ — Privacy and token efficiency
- Continuous DOM streaming ❌ — Privacy and efficiency
- Background surveillance ❌ — User control first
- Browser history collection ❌ — Outside project scope
- Credential extraction ❌ — Security boundary
- MFA interception ❌ — Security boundary
- Password collection ❌ — Security boundary

---

# Read Operations

## get_page_context

Returns:

- URL
- title
- headings
- links
- forms
- editables
- actions
- content preview

Purpose:

Allow an agent to understand a page without receiving the entire content.

## get_page_content

Returns:

- visible page text

Purpose:

Access full content only when needed.

---

# Write Operations

## Form Filling

Supported:

- text inputs
- textareas
- editable regions

Future:

- file inputs
- advanced workflows

## Actions

Supported:

- buttons
- interactive controls

Future:

- approval-gated actions
- permission-based controls

---

# Privacy Guarantees

BrowserBridge does not:

- export cookies
- replicate sessions
- continuously monitor pages
- continuously stream screenshots
- continuously stream DOM changes

BrowserBridge only exchanges information through explicit protocol requests.

---

# Security Boundaries

BrowserBridge assumes:

- the browser session belongs to the user
- the relay should not require trust
- the user remains in control

Future versions will strengthen these guarantees through end-to-end encryption and permission systems.

---

# Guiding Rule

When evaluating new features, ask:

"Does this help a remote AI agent collaborate with an existing authenticated browser session?"

If the answer is no, the feature likely does not belong in BrowserBridge.
