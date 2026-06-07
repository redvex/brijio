# Brijio Architecture

## Overview

Brijio connects remote AI agents to the browser session users already control.

```text
Agent
  ↓
MCP Server
  ↓
Brijio Relay
  ↓
Browser Extension
  ↓
Browser Session
```

The browser remains the source of truth.

---

## Core Components

### Agent

The reasoning layer.

Examples:

- Claude
- Codex
- Gemini
- Hermes
- OpenClaw

### MCP Server

Exposes Brijio capabilities to agents.

### Brijio Relay

Routes messages between agents and browsers.

Future versions will support end-to-end encrypted payloads.

### Browser Extension

Executes protocol requests inside the user's browser.

---

## Progressive Disclosure

Agents first request page context.

Only if necessary do they request page content.

This reduces:

- privacy exposure
- token consumption
- latency

---

## Design Principles

- Authenticated Browser First
- Remote Agent Friendly
- Privacy by Design
- Human-in-the-Loop
- Transparent Relay Architecture
