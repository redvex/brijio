---
name: navigation
description: "Navigate multi-step flows on authenticated pages: follow menu paths, click through breadcrumbs, handle SPA routing, wait for page loads, and backtrack safely."
---

# Guided Multi-Step Navigation

Navigate through web pages by clicking links and actions rather than constructing
URLs. This approach survives URL changes, handles SPAs, and works on authenticated
pages where direct URL access may fail.

## When to Use

- "Go to Settings → Privacy → Manage Data"
- "Navigate to the admin dashboard"
- "Click through to the order history page"
- Any task that requires clicking through menus, tabs, or breadcrumbs instead
  of visiting a URL directly.

## Workflow

### 1. Check Connection

Call `list_browsers` to confirm a browser is connected. If no browsers are
available, ask the user to connect the BrowserBridge extension.

### 2. Read the Current Page

Call `read_current_page` with `includeContent: true`. Examine the response for
navigable `links` and `actions`.

### 3. Find the Right Link

Look through the `links` array for a link whose `text` or `url` matches your
target. Example targets:

| User Request               | Look For                              |
| -------------------------- | ------------------------------------- |
| "Go to Settings"           | `text: "Settings"` or `text: "⚙"`     |
| "Open my orders"           | `text: "My Orders"`, `text: "Orders"` |
| "Click the dashboard link" | `text: "Dashboard"`                   |

If you find a matching link, call `click_element` with `kind: "link"` and the
link's `id`.

### 4. Wait and Re-Read

After clicking, the page will navigate. **You must re-read the page** to get
fresh element IDs:

```
1. click_element(kind: "link", id: "e12")  → navigates
2. read_current_page(includeContent: true)  → fresh page context
3. Continue with next navigation step
```

All element IDs from the previous page are now **invalid**. Never reuse IDs
after navigation.

### 5. Repeat Until Destination Reached

Continue the click → read → evaluate cycle until you reach the target page.
Verify you're on the right page by checking:

- The page `url` matches the expected pattern
- The page `title` contains expected keywords
- Expected content (a heading, form, or data table) is visible in the page

### 6. Breadcrumb Backtracking

If you need to go back to a previous level:

1. Look for breadcrumb links in the page content
2. Use `click_element` on the breadcrumb link
3. Re-read the page to get fresh IDs

Do **not** assume URLs are stable — always navigate by clicking, not by
constructing URLs.

## SPA and Dynamic Pages

### Hash Routing

Single-page applications often use hash URLs (`/app#/settings`). The page
doesn't fully reload — only parts of the DOM change. After clicking a link
in an SPA:

1. Re-read the page (the URL and content will update even though it's the same
   browser tab)
2. Look for new content in the `forms`, `links`, and `actions`
3. The `url` field will reflect the new hash route

### Lazy-Loaded Content

Some pages load content after the initial page load (infinite scroll, dynamic
tables). If expected content isn't in the initial `read_current_page` response:

1. Click any "Load more" or "Show all" actions on the page
2. Re-read the page to capture the newly loaded content
3. Repeat if needed

### Redirect Chains

Clicking a link may redirect through one or more intermediate pages. After each
click, always re-read the page — you may end up on a different URL than
expected. Verify the final destination before continuing.

## Pitfalls

### Short-Lived IDs

Element IDs (`e5`, `f2`, `a1`) expire when the page changes. After any click
that triggers navigation, you must call `read_current_page` again before
interacting with new elements.

### Links vs Actions

- **Links** are navigation elements (`<a>` tags). Use `click_element` with
  `kind: "link"`.
- **Actions** are button-like elements (`<button>`, role="button"). Use
  `click_element` with `kind: "action"`.

Clicking an action usually does not navigate — it triggers a form submission,
opens a modal, or performs an in-page action. Clicking a link usually
navigates.

### Duplicate Link Text

Pages may have multiple links with the same text but different URLs (e.g.,
"Learn more" appearing in several sections). Check the `url` field to
disambiguate, or ask the user which one they mean.

### Navigation Timing

After clicking a link, the browser may take time to load the new page. If
`read_current_page` returns stale content (same URL, same elements), wait a
moment and try again. The WebSocket connection will deliver fresh data once the
page finishes loading.

### Multiple Browsers

When multiple browsers are connected, always specify `browserInstanceId` in
your tool calls. Navigation on the wrong browser is disorienting and
potentially destructive.
