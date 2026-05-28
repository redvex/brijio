---
name: using-browserbridge
description: Use when starting any BrowserBridge session — establishes how to discover and use skills, which tools are available, and when to invoke each skill before any browser interaction.
---

# Using BrowserBridge

BrowserBridge connects your AI agent to the user's real browser. The browser
extension is only active while the user explicitly starts it, so always check
for connected browsers first.

## Before You Do Anything

**Read the relevant skill BEFORE taking any browser action.** Even a 1% chance
a skill applies means you should read it. If the skill turns out to be
irrelevant, move on — but check first.

```mermaid
flowchart TD
    A[["User asks for browser action"]] --> B["Check connected browsers"]
    B --> C{"Might a skill apply?"}
    C -->|"yes, even 1%"| D["Read skill via read_resource"]
    C -->|"definitely not"| F[["Take browser action"]]
    D --> E["Follow skill instructions"]
    E --> F
```

## Available Skills

Skills are MCP resources. Read a skill's full instructions with
`read_resource` using the URI format:

```
skill://browserbridge/{skill_name}
```

| Skill Name            | URI                                         | When to Use                                              |
| --------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `using-browserbridge` | `skill://browserbridge/using-browserbridge` | Every session — orientation and tool reference           |
| `form-filling`        | `skill://browserbridge/form-filling`        | Any task involving filling out web forms                 |
| `data-extraction`     | `skill://browserbridge/data-extraction`     | Any task involving extracting data from web pages        |
| `web-qa`              | `skill://browserbridge/web-qa`              | Any task involving testing or verifying web app behavior |

## Available Tools

### Discovery

| Tool                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `list_browsers`     | Check which browsers are connected. **Always call this first.**   |
| `read_current_page` | Get the current page context (URL, title, forms, links, actions). |
| `read_resource`     | Read BrowserBridge content chunks for large pages (paginated).    |

### Interaction

| Tool             | Purpose                                | Key Parameters                                  |
| ---------------- | -------------------------------------- | ----------------------------------------------- |
| `click_element`  | Click a link or button-like action     | `kind` ("link" or "action"), `id` (short-lived) |
| `fill_input`     | Write text into a form control         | `formId`, `controlId`, `text`                   |
| `fill_editable`  | Write text into a contenteditable area | `id`, `text`                                    |
| `set_checked`    | Check/uncheck a checkbox or radio      | `formId`, `controlId`, `checked` (boolean)      |
| `select_options` | Select option values in a `<select>`   | `formId`, `controlId`, `values` (string array)  |
| `submit_form`    | Submit a form                          | `formId`                                        |

### Critical: Short-Lived IDs

Element IDs (`e5`, `f2`, `a1`, form IDs) are **ephemeral**. They expire when
the page changes — including after navigation, form submissions, or DOM updates.

**Always re-read the page with `read_current_page` before interacting with
elements if the page may have changed.**

## Step 1: Check Connection

Every BrowserBridge session starts with a connection check:

```
→ list_browsers
← { browsers: [{ browserInstanceId: "chrome-abc123", name: "Chrome" }] }
```

If no browsers are connected, tell the user and stop. If multiple browsers are
connected, specify `browserInstanceId` in all subsequent calls.

## Step 2: Read the Page

```
→ read_current_page(includeContent: true)
← { url, title, forms, links, actions, editables, ... }
```

This gives you the full page context with short-lived IDs you'll use in
subsequent tool calls.

## Step 3: Choose the Right Skill

| User intent                                         | Skill to read                                        |
| --------------------------------------------------- | ---------------------------------------------------- |
| "Fill in this form" / "Apply" / "Sign up"           | `skill://browserbridge/form-filling`                 |
| "Get this data" / "Extract the table" / "Scrape"    | `skill://browserbridge/data-extraction`              |
| "Test this page" / "Check if X works" / "Find bugs" | `skill://browserbridge/web-qa`                       |
| Any other browser task                              | Default to reading the page and using tools directly |

## Red Flags

These thoughts mean STOP — you're about to make a mistake:

| Thought                                       | Reality                                                              |
| --------------------------------------------- | -------------------------------------------------------------------- |
| "I'll just fill in the password field"        | `fill_input` returns `browser_error` for password fields. Skip them. |
| "The ID from the last page should still work" | IDs expire on navigation or DOM updates. Re-read the page.           |
| "I'll submit the form for the user"           | Never auto-submit. Always ask the user to confirm.                   |
| "I'll just click without checking"            | Radio buttons cannot be unchecked. Select carefully.                 |
| "I don't need to read a skill for this"       | If there's even a 1% chance a skill applies, read it.                |
| "I'll skip the connection check"              | No browser = no action. Always call `list_browsers` first.           |

## User Instructions Always Win

BrowserBridge skills override default system behavior, but **user instructions
always take precedence**. If the user explicitly says "skip the skill" or
"just click the button," follow the user's request.

## Multiple Browsers

When more than one browser instance is connected, **always** specify
`browserInstanceId` in tool calls. Omitting it when multiple browsers are
available will return an `ambiguous_browser_target` error.
