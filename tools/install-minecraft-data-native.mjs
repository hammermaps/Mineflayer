import { validateDataInstall } from './data-install-guard.mjs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import './install-native-dependencies.mjs'

const require = createRequire(import.meta.url)
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageRoot = dirname(require.resolve('minecraft-data/package.json'))
const dataRoot = join(packageRoot, 'minecraft-data', 'data')
const pathsFile = join(dataRoot, 'dataPaths.json')
const paths = JSON.parse(await readFile(pathsFile, 'utf8'))
const inherited = paths.pc['26.1']
if (!inherited) throw new Error('minecraft-data 26.1 paths are unavailable')
const versions = ['26.2', '26.3']
// Validate both datasets before changing either installation.
for (const version of versions) {
  await validateDataInstall(packageRoot, join(projectRoot, 'vendor/minecraft-data/pc', version), join(dataRoot, 'pc', version), inherited)
}
for (const version of versions) {
  const source = join(projectRoot, 'vendor/minecraft-data/pc', version)
  const destination = join(dataRoot, 'pc', version)
  await mkdir(destination, { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
  paths.pc[version] = Object.fromEntries(Object.entries(inherited).map(([key, value]) => [key, value === 'pc/26.1' ? `pc/${version}` : value]))
}
await writeFile(pathsFile, `${JSON.stringify(paths, null, 2)}\n`)
const versionsFile = join(dataRoot, 'pc/common/protocolVersions.json')
const protocolVersions = JSON.parse(await readFile(versionsFile, 'utf8'))
if (!protocolVersions.some(version => version.minecraftVersion === '26.3')) {
  protocolVersions.unshift({ minecraftVersion: '26.3', version: 777, dataVersion: 5023, usesNetty: true, majorVersion: '26.3', releaseType: 'release' })
  await writeFile(versionsFile, `${JSON.stringify(protocolVersions, null, 2)}\n`)
}
await import(pathToFileURL(join(packageRoot, 'bin/generate_data.js')).href)
for (const [index, version] of versions.entries()) {
  const installed = require('minecraft-data')(version)
  if (installed.version.version !== 776 + index || !installed.protocol || !installed.blocks || !installed.items) {
    throw new Error(`minecraft-data ${version} installation verification failed`)
  }
  console.log(`Installed native minecraft-data ${version} (protocol ${776 + index})`)
}
