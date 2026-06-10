---
name: form-filling
description: "Complete forms on authenticated pages: detect field types, handle multi-step forms, fill inputs, select options, and submit safely."
---

# Smart Form Filling

Complete forms on authenticated pages using the user's real browser session
through Brijio. Handles multi-step forms, field type detection, and
common pitfalls.

## When to Use

- Filling job applications, checkout forms, sign-up flows, and any web form
  on a page the user is already authenticated on.
- Any task where you need to fill multiple fields in sequence with
  verification between steps.

## Workflow

### 1. Check Connection

Call `list_browsers` to confirm a browser is connected. If the response is
empty or `data.browsers` is an empty array, ask the user to open their
browser and connect the Brijio extension before continuing.

When multiple browsers are connected, note the `browserInstanceId` values
and use the correct one for all subsequent calls.

### 2. Read the Page

Call `read_current_page` with `includeContent: true` to get the full page
context. The response contains:

- `links` — clickable navigation links (use `click_element` with
  `kind: "link"`)
- `actions` — button-like elements (use `click_element` with
  `kind: "action"`)
- `forms` — form structures with `controls` arrays (use `fill_input`,
  `fill_editable`, `set_checked`, `select_options`)
- `editables` — standalone contenteditable areas (use `fill_editable`)

Each element has a short-lived `id` (e.g. `e5`) that **expires when the page
changes**. Always re-read the page after any navigation, form submission, or
significant interaction.

### 3. Identify the Form

Locate the relevant form in the `forms` array. Each form has:

- `id` — use as `formId` in fill/set/select/submit calls
- `controls` — array of input fields, each with:
  - `id` — use as `controlId`
  - `label` — human-readable label (helps match data to fields)
  - `type` — `text`, `email`, `password`, `checkbox`, `radio`,
    `select-one`, `select-multiple`, `textarea`, `hidden`, etc.
  - `value` — current value (useful for pre-filled fields)
  - `options` — for select/radio controls, the available choices

### 4. Fill Fields

Fill fields in a logical order (top-to-bottom) using the appropriate tool:

| Field Type          | Tool                                          | Notes                                      |
| ------------------- | --------------------------------------------- | ------------------------------------------ |
| Text input / Search | `fill_input`                                  | Most common field type                     |
| Email / URL / Tel   | `fill_input`                                  | Same tool, different semantic type         |
| Textarea            | `fill_input`                                  | Use `controlId` from the form              |
| Contenteditable     | `fill_editable`                               | Standalone editable, not inside a `<form>` |
| Checkbox            | `set_checked(formId, controlId, true/false)`  | Toggle checked state                       |
| Radio button        | `set_checked(formId, controlId, true)`        | Select one option; cannot uncheck          |
| Select (single)     | `select_options(formId, controlId, [value])`  | Pass one value                             |
| Select (multiple)   | `select_options(formId, controlId, [v1, v2])` | Pass multiple values                       |

For several fields on the same stable page, prefer `perform_batch` over many
individual tool calls once you have read the page and matched all target IDs.
Keep batches small and same-page:

```json
{
  "actions": [
    {
      "type": "write_text",
      "target": { "formId": "f1", "controlId": "c1" },
      "text": "John"
    },
    {
      "type": "write_text",
      "target": { "formId": "f1", "controlId": "c2" },
      "text": "Smith"
    },
    {
      "type": "select_options",
      "target": { "formId": "f1", "controlId": "c5" },
      "values": ["us"]
    },
    {
      "type": "set_checked",
      "target": { "formId": "f1", "controlId": "c6" },
      "checked": true
    }
  ],
  "continueOnError": false,
  "readAfterActions": true
}
```

Use `readAfterActions: true` when you want the returned batch result to include
a fresh page context for verification. If `data.aborted` is true, the page
navigated during the batch; stop, call `read_current_page`, and continue with
fresh IDs.

### 5. Verify Before Submitting

After filling, call `read_current_page` again to verify:

- All fields show the expected values
- No validation errors are visible
- The form is ready for submission

**Never auto-submit forms.** Always ask the user to review and submit
manually, unless the user has explicitly asked you to submit.

### 6. Multi-Page Forms (Wizards)

For multi-step forms with "Next" / "Continue" buttons:

1. Fill all fields on the current page.
2. Verify fields are correct.
3. Click the "Next" / "Continue" action button.
4. Wait for the page to update (re-read with `read_current_page`).
5. Fill the next set of fields.
6. Repeat until the final review/submit page.

After each page navigation, all previous element `id` values are **invalid**.
You must re-read the page to get fresh IDs.

## Pitfalls

### Password Fields

`fill_input` returns `browser_error` for `type="password"` inputs. This is
correct browser security behavior. **Skip password fields** and let the
user fill them manually. Do not retry or attempt workarounds.

### Radio Buttons

You **cannot uncheck** a radio button. `set_checked(checked: false)` on a
radio returns `browser_error`. Instead, select a different radio option in
the same group.

### Readonly and Disabled Fields

`fill_input` returns `browser_error` for `readonly` or `disabled` inputs.
Skip these fields — they are not meant to be edited. Their values are often
auto-calculated or pre-populated by the page.

### Short-Lived IDs

Element IDs (`e5`, `f2`, `c3`) are **ephemeral**. They expire when:

- The page navigates (any navigation, including form submissions)
- The DOM changes significantly (dynamic content updates, SPA navigation)
- The page refreshes

Always re-read the page after any action that changes the DOM before
referencing new element IDs.

Do not run one `perform_batch` across wizard steps or navigation boundaries.
Navigation aborts remaining batch actions and invalidates IDs from the previous
page.

### React and SPA Forms

Brijio injects values via the DOM, which triggers React's synthetic
event system. This works for most modern inputs. If a React textarea or
input doesn't update after filling, it may be a hidden internal editor — look
for a named textarea with content content instead.

### Multiple Browsers

When both Chrome and Safari are connected, `list_browsers` returns multiple
instances. Always specify `browserInstanceId` to target the correct browser.
The IDs look like:

- `safari-d30265e2-04ad-4e44-907a-a79fe287ae46`
- `chrome-eaa9b8ca-1713-42a1-871a-e6747db5341b`

### Contenteditable Outside Forms

Standalone contenteditable elements (rich text editors, comment boxes) appear
in the `editables` list, **not** inside forms. Use `fill_editable` with the
editable's `id`, not `fill_input` with a form/control pair.

## Example: Job Application Form

```
1. list_browsers → Confirm browser connected
2. read_current_page → Get page context
3. Identify application form (id: "f1")
4. perform_batch(actions: [
     write_text(f1/c1, "John"),
     write_text(f1/c2, "Smith"),
     write_text(f1/c3, "john@example.com"),
     select_options(f1/c5, ["us"]),
     set_checked(f1/c6, true)
   ], readAfterActions: true)
5. Inspect batch results and returned page context.
6. If data.aborted is true, read_current_page and recover with fresh IDs.
7. Inform user: "Form is filled. Please review and submit when ready."
```
