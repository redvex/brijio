import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

await verifyDist('dist-ios', false)
await verifyDist('dist-macos', true)

async function verifyDist (distName, expectedPersistent) {
  const contentScript = await readFile(new URL(`../${distName}/content.js`, import.meta.url), 'utf8')
  const backgroundScript = await readFile(new URL(`../${distName}/background.js`, import.meta.url), 'utf8')
  const popupScript = await readFile(new URL(`../${distName}/popup.js`, import.meta.url), 'utf8')
  const manifest = JSON.parse(await readFile(new URL(`../${distName}/manifest.json`, import.meta.url), 'utf8'))

  assert.doesNotMatch(
    contentScript,
    /^\s*import\s/m,
    `${distName}/content.js must be bundled (no ES module imports).`
  )
  assert.doesNotMatch(
    contentScript,
    /^\s*export\s/m,
    `${distName}/content.js must not contain ES module exports.`
  )

  assert.doesNotMatch(
    backgroundScript,
    /^\s*import\s/m,
    `${distName}/background.js must be bundled (no ES module imports).`
  )
  assert.doesNotMatch(
    backgroundScript,
    /^\s*export\s/m,
    `${distName}/background.js must not contain ES module exports.`
  )

  assert.doesNotMatch(
    popupScript,
    /^\s*import\s/m,
    `${distName}/popup.js must be bundled (no ES module imports).`
  )
  assert.doesNotMatch(
    popupScript,
    /^\s*export\s/m,
    `${distName}/popup.js must not contain ES module exports.`
  )

  assert.equal(
    manifest.background?.persistent,
    expectedPersistent,
    `${distName}/manifest.json has unexpected background persistence.`
  )
}
