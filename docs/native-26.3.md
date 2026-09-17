# Native Minecraft 26.3

The branch supports protocol 777 with vendored `minecraft-data` generated from
the official 26.3 server reports. `npm install` runs
`tools/install-minecraft-data-native.mjs`, which installs both native 26.2 and
26.3 data and applies two hash-guarded compatibility registrations for the
pinned chunk and physics dependencies.

The data source is an official 26.3 server started with OpenJDK 26. Its report
output and the `Extract26_3.java` extractor provide block states, collision
shapes and entity dimensions. Regenerate the vendored data with:

```sh
python3 tools/generate-minecraft-data-26.3.py /path/to/26.3-reports [protocol-codecs.json]
node tools/patch-native-26.3-protocol.mjs
node tools/install-minecraft-data-native.mjs
```

When the optional codec path is absent, the generator uses the reviewed codecs
already in `vendor/minecraft-data/pc/26.3/protocol.json`. The runtime handles
26.3 light-mask byte bitsets, accepts the expanded teleport confirmation, and
uses the official `VecDelta` entity movement codec. It keeps the new recipe-book holder-set payload framed as opaque data because the
legacy recipe API has no equivalent tagged holder-set representation.

Validation: `node --test tools/*regression.js tools/*regression.mjs`, lint,
and offline login/spawn tests against Vanilla 26.3 and Paper 26.3.
