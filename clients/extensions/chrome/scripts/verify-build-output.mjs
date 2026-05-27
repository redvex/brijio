import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const backgroundScript = await readFile(
  new URL('../dist/background.js', import.meta.url),
  'utf8'
)
const contentScript = await readFile(new URL('../dist/content.js', import.meta.url), 'utf8')

assert.doesNotMatch(
  backgroundScript,
  /@browserbridge\//,
  'dist/background.js must not contain workspace package imports.'
)

assert.doesNotMatch(
  backgroundScript,
  /node:/,
  'dist/background.js must not contain Node built-in imports.'
)

assert.doesNotMatch(
  contentScript,
  /^\s*import\s/m,
  'dist/content.js must be bundled before chrome.scripting.executeScript injects it.'
)

assert.doesNotMatch(
  contentScript,
  /^\s*export\s/m,
  'dist/content.js must not contain ES module exports.'
)
