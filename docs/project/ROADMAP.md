# Brijio Roadmap (2026–2027)

This roadmap references the canonical capability names defined in [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md).

## Vision

Brijio is a secure bridge between AI agents and the browser session users already control.

### Core Principles

1. Authenticated Browser First
2. Remote Agent Friendly
3. Privacy by Design
4. End-to-End Encryption
5. Progressive Disclosure
6. Human-in-the-Loop
7. Transparent Relay Architecture
8. Token-Efficient Communication

## Capability Status

See [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md) for the complete and current capability contract, including:

- ✅ **Implemented** capabilities with browser support status
- 🧪 **Experimental** capabilities available for testing
- 📋 **Planned** capabilities with roadmap ticket references
- 🚫 **Intentionally unsupported** boundaries (not bugs)

## Pre-Enterprise Milestones

| Milestone                            | Focus                                                                      | Key Capabilities                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A — Try it in 10 minutes             | Setup, onboarding, demo, capability contract                               | `list_browsers`, `read_current_page`, one-command runtime polish                                              |
| B — Real workflows on one tab        | Navigation, actions, stale-target handling, forms, keyboard                | `navigate_to_url`, `click_element`, `fill_input`, `set_checked`, `select_options`, `submit_form`, `press_key` |
| C — Multi-tab workflow assistant     | Tab listing, tab switching, workflow state, page-change signals            | Tab listing/selection, `wait_for_page_change`, session state                                                  |
| D — Developer/agency debugging wedge | Accessibility snapshot, screenshots, console logs, network, health, traces | Accessibility snapshot, `get_screenshot`, console/network inspection, local traces                            |
| E — Productization                   | Distribution, parity, versioning, reliability, docs, recipes               | Chrome Web Store, Safari parity, protocol versioning, error taxonomy, recipes                                 |
