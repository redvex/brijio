import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const workflowsDir = join(process.cwd(), '.github', 'workflows')

function readWorkflow (name) {
  return readFileSync(join(workflowsDir, name), 'utf8')
}

function readAllWorkflows () {
  return readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => readWorkflow(name))
    .join('\n')
}

void describe('release workflows', () => {
  void it('starts release automation from main branch merges', () => {
    const workflow = readWorkflow('tag-and-release.yml')

    assert.match(workflow, /branches:\s*\n\s+- main/)
    assert.doesNotMatch(workflow, /tags:\s*\n\s+- "v\*"/)
  })

  void it('uses only unified version tags', () => {
    const workflows = readAllWorkflows()

    assert.doesNotMatch(workflows, /ext-chrome-v\*/)
    assert.doesNotMatch(workflows, /ext-safari-v\*/)
  })

  void it('creates the release tag from the package version', () => {
    const workflow = readWorkflow('tag-and-release.yml')

    assert.match(workflow, /require\('\.\/package\.json'\)\.version/)
    assert.match(workflow, /git tag -a "v\$\{VERSION\}"/)
    assert.match(workflow, /git push origin "v\$\{VERSION\}"/)
    assert.match(workflow, /git ls-remote .*--tags origin "v\$\{VERSION\}"/)
  })

  void it('publishes browser extension assets from the main release workflow', () => {
    const workflow = readWorkflow('tag-and-release.yml')

    assert.match(workflow, /pnpm --filter @brijio\/chrome-extension build/)
    assert.match(workflow, /brijio-chrome-extension-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /safari-web-extension-converter/)
    assert.match(workflow, /continue-on-error: true/)
    assert.match(workflow, /brijio-safari-ios-web-extension-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /brijio-safari-macos-web-extension-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /brijio-safari-ios-xcode-project-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /brijio-safari-macos-xcode-project-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /softprops\/action-gh-release@v2/)
    assert.match(workflow, /files:/)
  })

  void it('publishes npm with trusted publishing instead of a long-lived token', () => {
    const workflow = readWorkflow('tag-and-release.yml')

    assert.match(workflow, /id-token: write/)
    assert.match(workflow, /actions\/setup-node@v6/)
    assert.match(workflow, /node-version: 24/)
    assert.match(workflow, /package-manager-cache: false/)
    assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN/)
    assert.doesNotMatch(workflow, /NPM_TOKEN/)
    assert.match(workflow, /@brijio\/mcp/)
    assert.match(workflow, /npm publish --access public --provenance --no-git-checks/)
  })

  void it('removes the split extension release workflow', () => {
    assert.equal(existsSync(join(workflowsDir, 'extension-release.yml')), false)
  })
})
