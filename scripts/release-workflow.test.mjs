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
  void it('uses only v-prefixed release tags', () => {
    const workflows = readAllWorkflows()

    assert.doesNotMatch(workflows, /ext-chrome-v\*/)
    assert.doesNotMatch(workflows, /ext-safari-v\*/)
  })

  void it('publishes browser extension assets from the main release workflow', () => {
    const workflow = readWorkflow('tag-and-release.yml')

    assert.match(workflow, /pnpm --filter @brijio\/chrome-extension build/)
    assert.match(workflow, /brijio-chrome-extension-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /safari-web-extension-converter/)
    assert.match(workflow, /continue-on-error: true/)
    assert.match(workflow, /brijio-safari-web-extension-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /brijio-safari-xcode-project-\$\{\{ needs\.release\.outputs\.version \}\}\.zip/)
    assert.match(workflow, /softprops\/action-gh-release@v2/)
    assert.match(workflow, /files:/)
  })

  void it('keeps npm publish preflight diagnostics actionable', () => {
    const workflow = readWorkflow('tag-and-release.yml')

    assert.match(workflow, /npm whoami/)
    assert.match(workflow, /NPM_TOKEN/)
    assert.match(workflow, /@brijio\/mcp/)
    assert.match(workflow, /publish access/)
  })

  void it('removes the split extension release workflow', () => {
    assert.equal(existsSync(join(workflowsDir, 'extension-release.yml')), false)
  })
})
