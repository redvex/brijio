#!/usr/bin/env bash
#
# release-chrome-extension.sh — Prepare and tag a Chrome extension release
#
# Usage: ./scripts/release-chrome-extension.sh <version>
# Example: ./scripts/release-chrome-extension.sh 0.1.0
#
# This script:
# 1. Validates the version format
# 2. Updates manifest.json and package.json with the new version
# 3. Runs build + test
# 4. Creates the submission ZIP
# 5. Creates the git tag (ext-chrome-v<version>)
#
# Push the tag to trigger the extension-release.yml CI workflow:
#   git push origin ext-chrome-v0.1.0
#

set -euo pipefail

# --- Config ---
EXT_DIR="clients/extensions/chrome"
MANIFEST="${EXT_DIR}/manifest.json"
PKG_JSON="${EXT_DIR}/package.json"
TAG_PREFIX="ext-chrome-v"

# --- Args ---
if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.0"
  exit 1
fi

VERSION="$1"

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: Invalid version format '$VERSION'. Expected semver (e.g., 0.1.0, 1.0.0-beta.1)"
  exit 1
fi

TAG="${TAG_PREFIX}${VERSION}"

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag $TAG already exists"
  exit 1
fi

echo "=== Chrome Extension Release: v${VERSION} ==="
echo ""

# --- Update versions ---
echo "Updating manifest.json..."
node -e "const f='${MANIFEST}'; const m=JSON.parse(require('fs').readFileSync(f,'utf8')); m.version='${VERSION}'; require('fs').writeFileSync(f, JSON.stringify(m, null, 2) + '\n');"

echo "Updating package.json..."
node -e "const f='${PKG_JSON}'; const m=JSON.parse(require('fs').readFileSync(f,'utf8')); m.version='${VERSION}'; require('fs').writeFileSync(f, JSON.stringify(m, null, 2) + '\n');"

# --- Build ---
echo ""
echo "Building shared package..."
pnpm --filter @brijio/shared build

echo "Building Chrome extension..."
pnpm --filter @brijio/chrome-extension build

# --- Verify ---
echo ""
echo "Verifying build output..."
DIST="${EXT_DIR}/dist"
for file in background.js content.js popup-entry.js popup.html manifest.json; do
  if [ ! -f "${DIST}/${file}" ]; then
    echo "Error: Missing ${file} in dist/"
    exit 1
  fi
done

if [ ! -d "${DIST}/icons" ]; then
  echo "Error: Missing icons/ in dist/"
  exit 1
fi

MANIFEST_VERSION=$(node -p "require('${DIST}/manifest.json').version")
if [ "$MANIFEST_VERSION" != "$VERSION" ]; then
  echo "Error: Manifest version ${MANIFEST_VERSION} does not match requested version ${VERSION}"
  exit 1
fi

echo "✓ Build verified — version ${MANIFEST_VERSION}"

# --- Create ZIP ---
echo ""
echo "Creating submission ZIP..."
cd "${DIST}"
ZIP_NAME="brijio-chrome-extension-v${VERSION}.zip"
rm -f "../${ZIP_NAME}"
zip -r "../${ZIP_NAME}" .
cd -
echo "✓ Created ${ZIP_NAME}"
ls -lh "${EXT_DIR}/${ZIP_NAME}"

# --- Tag ---
echo ""
echo "Creating tag ${TAG}..."
git add "${MANIFEST}" "${PKG_JSON}"
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "chrome-ext: set version ${VERSION} for Chrome Web Store release" || true
git tag -a "$TAG" -m "Chrome Extension v${VERSION}: Web Store submission"

echo ""
echo "=== Release ${TAG} ready ==="
echo ""
echo "Next steps:"
echo "  1. Review the commit and tag"
echo "  2. Push:  git push origin develop && git push origin ${TAG}"
echo "  3. Upload ${EXT_DIR}/${ZIP_NAME} to Chrome Web Store Developer Dashboard"
echo "  4. CI will create a GitHub Release with the ZIP attached"
echo ""