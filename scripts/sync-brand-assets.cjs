// Run with `node scripts/sync-brand-assets.cjs` on macOS. No network or installs.
// sips renders the canonical SVG; Expo's existing Jimp dependency only pads and
// composites the PNGs. The source paths, viewBox and fills are never rewritten.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const requireImageUtils = createRequire(require.resolve('@expo/image-utils'));
const Jimp = requireImageUtils('jimp-compact');

const root = path.resolve(__dirname, '..');
const paper = '#f3f5ff';
const catalog = 'ios/Expenzo/Images.xcassets';
const outputs = [
  { file: 'assets/logo.png', size: 1024, mark: 1024 },
  { file: 'assets/icon.png', size: 1024, mark: 704, background: paper },
  // All visible artwork fits inside Android's central 66/108 safe-zone circle.
  { file: 'assets/adaptive-icon.png', size: 1024, mark: 480 },
  { file: 'assets/favicon.png', size: 64, mark: 56, background: paper },
  { file: `${catalog}/AppIcon.appiconset/App-Icon-1024x1024@1x.png`, size: 1024, mark: 704, background: paper },
  ...[1, 2, 3].map(scale => ({
    file: `${catalog}/SplashScreenLogo.imageset/image${scale === 1 ? '' : `@${scale}x`}.png`,
    size: 160 * scale,
    mark: 160 * scale,
  })),
];

async function syncBrandAssets() {
  if (process.platform !== 'darwin') {
    throw new Error('Run this offline SVG renderer on macOS (it uses /usr/bin/sips).');
  }
  const source = fs.readFileSync(path.join(root, 'website/assets/expenzo-mark.svg'), 'utf8');
  if (!source.includes('viewBox="0 0 48 48"')) {
    throw new Error('Expected the canonical 48x48 Expenzo SVG viewBox.');
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'expenzo-brand-'));
  const rendered = new Map();
  try {
    for (const { file, size, mark, background } of outputs) {
      if (!rendered.has(mark)) {
        const svgFile = path.join(temporary, `${mark}.svg`);
        const pngFile = path.join(temporary, `${mark}.png`);
        // Change only the temporary viewport size, so sips rasterizes vectors
        // directly at the target resolution instead of scaling a small PNG.
        fs.writeFileSync(svgFile, source.replace('<svg ', `<svg width="${mark}" height="${mark}" `));
        execFileSync('/usr/bin/sips', ['-s', 'format', 'png', svgFile, '--out', pngFile], { stdio: 'pipe' });
        const image = await Jimp.read(pngFile);
        if (image.bitmap.width !== mark || image.bitmap.height !== mark) {
          throw new Error(`SVG renderer did not produce ${mark}x${mark} pixels.`);
        }
        rendered.set(mark, image);
      }
      const padding = (size - mark) / 2;
      const output = new Jimp(size, size, background || 0x00000000);
      output.composite(rendered.get(mark), padding, padding);
      // RGB icons have no alpha channel; logo/foreground/splash keep RGBA.
      output.colorType(background ? 2 : 6).deflateLevel(9);
      const destination = path.join(root, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, await output.getBufferAsync(Jimp.MIME_PNG));
      console.log(`${file}: ${size}x${size}, ${mark}px SVG viewport, ${padding}px padding, ${background || 'transparent'}`);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (require.main === module) {
  syncBrandAssets().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
