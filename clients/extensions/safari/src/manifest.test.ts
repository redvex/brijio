import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface ExtensionManifest {
  background?: {
    scripts?: string[]
    persistent?: boolean
  }
}

async function readSafariManifest (): Promise<ExtensionManifest> {
  const manifestUrl = new URL('../manifest.json', import.meta.url)
  return JSON.parse(await readFile(manifestUrl, 'utf8')) as ExtensionManifest
}

void describe('Safari manifest', () => {
  void it('uses non-persistent background page for iOS and iPadOS support', async () => {
    const manifest = await readSafariManifest()

    assert.deepEqual(manifest.background?.scripts, ['background.js'])
    assert.equal(manifest.background?.persistent, false)
  })

  void it('generates platform-specific manifests for iOS and macOS', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'brijio-safari-manifest-'))
    const iosManifestPath = join(outputDir, 'manifest-ios.json')
    const macosManifestPath = join(outputDir, 'manifest-macos.json')
    const scriptPath = new URL('../scripts/create-platform-manifest.mjs', import.meta.url)

    await execFileAsync(process.execPath, [scriptPath.pathname, 'ios', iosManifestPath])
    await execFileAsync(process.execPath, [scriptPath.pathname, 'macos', macosManifestPath])

    const iosManifest = JSON.parse(await readFile(iosManifestPath, 'utf8')) as ExtensionManifest
    const macosManifest = JSON.parse(await readFile(macosManifestPath, 'utf8')) as ExtensionManifest

    assert.equal(iosManifest.background?.persistent, false)
    assert.equal(macosManifest.background?.persistent, true)
  })
})
