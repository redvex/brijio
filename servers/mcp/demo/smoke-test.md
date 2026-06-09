# Smoke Test Checklist — `brijio demo`

This checklist verifies that the Brijio demo page exercises every MCP tool correctly.
Run these steps manually after starting `brijio demo`.

## Prerequisites

- [ ] `brijio demo` starts without errors
- [ ] Console output shows: WebSocket, MCP, and Demo page URLs
- [ ] Demo page is accessible at `http://localhost:8789`

## `read_current_page` — Paginated Content

- [ ] `read_current_page` returns the full page content
- [ ] Response is split into multiple chunks (page exceeds 128 KiB threshold)
- [ ] Story text ("The Adventure of the Speckled Band") is present in early chunks
- [ ] Supplementary passage ("A Scandal in Bohemia") is present in middle chunks
- [ ] Form section is present in a later chunk
- [ ] Cross-reference index and answer key appear near the end

## `fill_input` — Text Fields

- [ ] Fill `surname` with "Stoner"
- [ ] Fill `detective_street` with "Baker Street"
- [ ] Fill `county` with "Surrey"
- [ ] Fill `animal_one` with "cheetah"
- [ ] Fill `death_year` with "1881"
- [ ] Fill `doctor_rank` with "surgeon"
- [ ] Fill `email_contact` with "watson@bakerstreet.uk"
- [ ] Fill `secret_passphrase` with "speckled band"
- [ ] Fill `income_amount` with "750"
- [ ] Fill `motive_explanation` with free-text answer mentioning financial motive
- [ ] All filled values persist and are visible on the page

## `form_action` — Checkboxes

- [ ] Check `chk-ventilator` (ventilator)
- [ ] Check `chk-saucer` (saucer of milk)
- [ ] Check `chk-safe` (locked safe)
- [ ] Check `chk-bellrope` (false bell-rope)
- [ ] Check `chk-cigar` (Indian cigar butts)
- [ ] Verify checked state is correct
- [ ] Do NOT check decoy items (whistle, diary, medicine)

## `form_action` — Radio Buttons

- [ ] Select `radio-snake` (swamp adder) for "What was the speckled band?"
- [ ] Select `time-3am` for "What time did Holmes hear the whistle?"

## `form_action` — Dropdown Selects

- [ ] Select `calcutta` in `location-select`
- [ ] Select `train-cart` in `transport-select`
- [ ] Select multiple values in `methods-select` (observation, interview, stakeout, exterior)

## `click_element` — Buttons

- [ ] Click `btn-prefill` — all fields populate with correct answers
- [ ] Click `btn-clear` — all fields reset to empty
- [ ] Click `btn-submit` — form submits via GET, URL updates with query parameters

## `navigate` — Internal Links

- [ ] Navigate to `#story` — page scrolls to story section
- [ ] Navigate to `#table-data` — page scrolls to tables section
- [ ] Navigate to `#form` — page scrolls to form section
- [ ] Navigate to `#dynamic` — page scrolls to dynamic content section

## Dynamic Content

- [ ] `read_current_page` shows the dynamic timestamp ("Content loaded at ...")
- [ ] `read_current_page` shows the counter value ("Counter: N" where N ≥ 0)
- [ ] After waiting 3+ seconds, counter increments

## Self-Verification

- [ ] Fill all fields correctly (use Prefill button or manual entry)
- [ ] Submit the form
- [ ] URL updates to include query parameters
- [ ] Results section appears with pass/fail indicators
- [ ] All correct answers show ✅ Pass
- [ ] Unchecked decoy items show ✅ Pass (correctly unchecked)

## Disabled Controls

- [ ] `fill_input` on `disabled-text` returns an error or no-op (field is disabled)
- [ ] `click_element` on `disabled-button` returns an error or no-op

## Graceful Shutdown

- [ ] Ctrl+C stops the demo server
- [ ] No orphan processes remain