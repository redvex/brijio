import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const contentScript = await readFile(new URL('../dist/content.js', import.meta.url), 'utf8')
const backgroundScript = await readFile(new URL('../dist/background.js', import.meta.url), 'utf8')
const popupScript = await readFile(new URL('../dist/popup.js', import.meta.url), 'utf8')

assert.doesNotMatch(
  contentScript,
  /^\s*import\s/m,
  'dist/content.js must be bundled (no ES module imports).'
)

assert.doesNotMatch(
  contentScript,
  /^\s*export\s/m,
  'dist/content.js must not contain ES module exports.'
)

assert.doesNotMatch(
  backgroundScript,
  /^\s*import\s/m,
  'dist/background.js must be bundled (no ES module imports).'
)

assert.doesNotMatch(
  backgroundScript,
  /^\s*export\s/m,
  'dist/background.js must not contain ES module exports.'
)

assert.doesNotMatch(
  popupScript,
  /^\s*import\s/m,
  'dist/popup.js must be bundled (no ES module imports).'
)

assert.doesNotMatch(
  popupScript,
  /^\s*export\s/m,
  'dist/popup.js must not contain ES module exports.'
)