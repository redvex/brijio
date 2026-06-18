# ADR-0036: Independent Extension Versioning and Releases

## Status

Superseded by ADR 0049.

## Context

BrowserBridge has two deployable surfaces:

1. **Server packages** (npm `@redvex/browserbridge`, Docker `redvex/browserbridge`) — versioned together with monorepo-level `v0.1.0` tags
2. **Browser extensions** (Chrome, Safari) — submitted to their respective stores with their own review cycles

Currently the Chrome extension `manifest.json` has `version: "0.0.0"`. Extensions have different release cadences than server packages:

- Store reviews take hours to days
- Users update on the store's schedule, not when we push a tag
- A server API change doesn't necessarily require an extension update
- An extension UI/UX fix doesn't require a server release

Using a single version tag (`v0.2.0`) across server + extensions forces:

- Coupling extension submissions to server releases
- No way to release extension fixes between server releases
- Tag history confused about what was released where

## Decision

**Extensions get their own independent version and tag prefix.**

### Version scheme

- Server packages continue with `vX.Y.Z` tags (e.g., `v0.2.0`)
- Chrome extension uses `ext-chrome-vX.Y.Z` tags (e.g., `ext-chrome-v0.1.0`)
- Safari extension uses `ext-safari-vX.Y.Z` tags (e.g., `ext-safari-v0.1.0`)

The version number in `clients/extensions/chrome/manifest.json` and `clients/extensions/chrome/package.json` is the Chrome extension's own version — independent of the server version in root `package.json`.

### Version bump is manual

Extension versions are bumped in `manifest.json` and `package.json` by developers when preparing a release, just like server versions. No auto-sync from monorepo root.

### Tag prefix

Git tags use the prefix to avoid collisions:

- `v0.2.0` → server release
- `ext-chrome-v0.1.0` → Chrome extension release
- `ext-safari-v0.1.0` → Safari extension release

### Release packaging

- `pnpm --filter @browserbridge/chrome-extension build && pnpm --filter @browserbridge/chrome-extension pack` creates `browserbridge-chrome-extension.zip` from `dist/`
- This ZIP is uploaded to Chrome Web Store Developer Dashboard
- The same ZIP can be attached to the GitHub release

### CI workflow

A new GitHub Actions workflow `extension-release.yml` fires on `ext-chrome-v*` tag pushes:

1. Checks out code
2. Installs dependencies
3. Builds the extension (`pnpm --filter @browserbridge/chrome-extension build`)
4. Validates the manifest
5. Creates a ZIP from `dist/`
6. Creates a GitHub Release with the ZIP attached
7. (Future) Auto-publish to Chrome Web Store via API

The existing `tag-and-release.yml` only handles `v*` tags (server releases). The new workflow only handles `ext-chrome-v*` tags (extension releases). No overlap, no confusion.

### CHANGELOG

Extension releases get their own CHANGELOG section, organised under a Chrome Extension heading:

```markdown
## [0.1.0] - 2026-06-03

### Added

**Chrome Extension** (`@browserbridge/chrome-extension`)

- Initial Chrome Web Store submission
- Popup UI for connection management
- Page context extraction and DOM actions
```

## Consequences

**Positive:**

- Extensions can be released independently from server packages
- Tag history clearly distinguishes server vs extension releases
- Store submission failures don't block server releases
- Extension hotfixes can ship without server version bumps
- Safari and Chrome can diverge in version number if needed

**Negative:**

- Two tag naming conventions to remember (`v*` vs `ext-chrome-v*`)
- Extension and server versions may drift — developers need to track compatibility in CHANGELOG
- Slightly more complex CI with two workflows

**Neutral:**

- The extension version in `manifest.json` is what Chrome Web Store displays — it's independent of any server package version
