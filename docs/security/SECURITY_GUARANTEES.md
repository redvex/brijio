# BrowserBridge Security Guarantees

## Purpose

This document defines the guarantees BrowserBridge is designed to provide.

These guarantees are part of the project's identity and should only change with extreme care.

---

## BrowserBridge Does Not Export Cookies

BrowserBridge does not export:

- authentication cookies
- session cookies
- browser storage

The browser session remains local.

---

## BrowserBridge Does Not Clone Browser Sessions

BrowserBridge operates on the browser session already controlled by the user.

It does not create duplicate authenticated environments.

---

## BrowserBridge Is Not Remote Desktop Software

BrowserBridge does not:

- mirror browser windows
- stream desktops
- provide remote desktop access

---

## BrowserBridge Does Not Continuously Monitor Browsers

BrowserBridge is reactive.

Information is exchanged only when explicitly requested.

---

## BrowserBridge Does Not Collect Credentials

BrowserBridge does not collect:

- passwords
- passkeys
- MFA codes

---

## BrowserBridge Cloud Is Intended To Be A Relay

The hosted relay transports messages.

It is not intended to inspect browser content.

Future versions will strengthen this guarantee through end-to-end encryption.

---

## User Control Comes First

Users can disconnect BrowserBridge at any time.

The browser remains under user control.
