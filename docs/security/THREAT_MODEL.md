# Brijio Threat Model

## Overview

Brijio assumes that AI agents, networks, cloud infrastructure, and third-party services may be imperfect or untrusted.

## Security Goals

- Protect browser sessions
- Avoid credential exposure
- Minimize unnecessary data transfer
- Reduce trust in relay infrastructure
- Maintain user control

## Threat Actors

### Malicious Agent

An agent that attempts to access data beyond what was explicitly requested, exfiltrate browser state, or perform unauthorized actions.

Mitigations:

- Explicit request/response protocol
- No continuous streaming by design
- User-controlled browser connection
- Progressive disclosure limits data exposure

### Compromised Relay Server

A relay that attempts to inspect, modify, or log traffic between agents and browsers.

Mitigations:

- Future end-to-end encryption will prevent content inspection
- Relay routes messages without requiring content access
- User-controlled infrastructure allows self-hosting

### Network Attacker

An attacker on the network path between agent, relay, and browser.

Mitigations:

- TLS for all transports
- Authentication tokens for all connections
- Future E2E encryption will add defense in depth

### Malicious Website

A website that attempts to exploit the browser extension or inject content that misleads the agent.

Mitigations:

- Extension follows least-privilege permission model
- Structured protocol prevents arbitrary code execution
- Content is read, not evaluated

## Trust Assumptions

- The user explicitly starts and controls browser connections
- Authentication tokens are kept secret by authorized parties
- The browser session belongs to the user
- The relay transports messages without requiring content inspection
