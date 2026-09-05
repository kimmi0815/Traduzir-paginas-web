// Run with sharp available on NODE_PATH: node scripts/render-icons.cjs
// SVG masters are the source of truth; PNGs are committed for browser actions.
const sharp = require('sharp');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/icons');
(async () => {
  for (const suffix of ['', '-translated']) {
    for (const size of [16, 32, 48, 64, 128]) {
      await sharp(path.join(root, `icon${suffix}.svg`), { density: 384 })
        .resize(size, size)
        .png()
        .toFile(path.join(root, `icon-${size}${suffix}.png`));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
