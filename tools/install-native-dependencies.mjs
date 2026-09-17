import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const patches = [
  {
    package: 'prismarine-chunk',
    file: 'src/index.js',
    hash: '2b0b5b527bb4d5780d2bb52f7b30e5858f5f9d60be73d985677d0f2d8331f70a',
    apply: text => text.replace("26.2: require('./pc/1.18/chunk')", "26.2: require('./pc/1.18/chunk'),\n    26.3: require('./pc/1.18/chunk')")
  },
  {
    package: 'prismarine-physics',
    file: 'lib/features.json',
    hash: 'f4833947cd156b852a016f45f87f5cdaf020d310bcb2e611ad1450b7c8db6065',
    apply: text => text.replaceAll('"26.1", "26.2"', '"26.1", "26.2", "26.3"')
  }
]

// Pinned dependencies: allow exactly the reviewed input or its patched result.
for (const patch of patches) {
  const file = join(dirname(require.resolve(`${patch.package}/package.json`)), patch.file)
  const text = await readFile(file, 'utf8')
  const original = patch.package === 'prismarine-chunk'
    ? text.replace(",\n    26.3: require('./pc/1.18/chunk')", '')
    : text.replaceAll(', "26.3"', '')
  if (createHash('sha256').update(original).digest('hex') !== patch.hash) {
    throw new Error(`Unreviewed ${patch.package} source; refusing native compatibility patch`)
  }
  const expected = patch.apply(original)
  if (text !== expected && text !== original) throw new Error(`Different native compatibility patch: ${file}`)
  if (text !== expected) await writeFile(file, expected)
}
