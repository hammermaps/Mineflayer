import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

// Fail before any write when an unreviewed package or different dataset is present.
export async function validateDataInstall (packageRoot, source, destination, inherited) {
  const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (!['3.113.0', '3.116.0'].includes(pkg.version)) {
    throw new Error(`Unreviewed minecraft-data ${pkg.version}; review native data before installing`)
  }
  if (!inherited) throw new Error('minecraft-data 26.1 paths are unavailable')
  let entries
  try { entries = await readdir(destination, { withFileTypes: true }) } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) throw new Error(`Unexpected native data entry: ${entry.name}`)
    const target = await readFile(join(destination, entry.name))
    let expected
    try { expected = await readFile(join(source, entry.name)) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      throw new Error(`Unrecognized native data: ${entry.name}`)
    }
    // Compare JSON semantics to tolerate formatting-only differences.
    if (JSON.stringify(JSON.parse(target)) !== JSON.stringify(JSON.parse(expected))) {
      const hash = createHash('sha256').update(JSON.stringify(JSON.parse(target))).digest('hex')
      // Exact reviewed historical datasets only; permit one-way migration.
      if (entry.name !== 'protocol.json' || !['d512c599f778c61f1effe99fd8f3db8d49f01dc5cc823c0b39ecf5acda05bd93', '07808c04b4c2379069e5d5ef84bf81b48d16f65d7c1092596ee78376b65782e4'].includes(hash)) {
        throw new Error(`Refusing to overwrite different native data: ${entry.name}`)
      }
    }
  }
}
