# Brijio Security Guarantees

## Purpose

This document defines the guarantees Brijio is designed to provide.

These guarantees are part of the project's identity and should only change with extreme care.

---

## Brijio Does Not Export Cookies

Brijio does not export:

- authentication cookies
- session cookies
- browser storage

The browser session remains local.

---

## Brijio Does Not Clone Browser Sessions

Brijio operates on the browser session already controlled by the user.

It does not create duplicate authenticated environments.

---

## Brijio Is Not Remote Desktop Software

Brijio does not:

- mirror browser windows
- stream desktops
- provide remote desktop access

---

## Brijio Does Not Continuously Monitor Browsers

Brijio is reactive.

Information is exchanged only when explicitly requested.

---

## Brijio Does Not Collect Credentials

Brijio does not collect:

- passwords
- passkeys
- MFA codes

---

## Brijio Cloud Is Intended To Be A Relay

The hosted relay transports messages.

It is not intended to inspect browser content.

Future versions will strengthen this guarantee through end-to-end encryption.

---

## User Control Comes First

Users can disconnect Brijio at any time.

The browser remains under user control.
