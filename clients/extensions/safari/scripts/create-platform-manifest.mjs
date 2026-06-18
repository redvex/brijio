import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const [platform, outputPath] = process.argv.slice(2)

if (platform !== 'ios' && platform !== 'macos') {
  throw new Error('Usage: node scripts/create-platform-manifest.mjs <ios|macos> <output-path>')
}

if (typeof outputPath !== 'string' || outputPath.trim() === '') {
  throw new Error('Output path is required.')
}

const sourceManifestUrl = new URL('../manifest.json', import.meta.url)
const manifest = JSON.parse(await readFile(sourceManifestUrl, 'utf8'))

manifest.background = {
  ...manifest.background,
  persistent: platform === 'ios' ? false : true
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
