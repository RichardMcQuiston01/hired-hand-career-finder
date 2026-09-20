import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceIcon = resolve(__dirname, '../src-assets/icon-source.webp');
const iconsDir = resolve(__dirname, '../public/icons');

mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const outFile = resolve(iconsDir, `icon-${size}.png`);
  await sharp(sourceIcon).resize(size, size, { fit: 'cover' }).png().toFile(outFile);
  console.log(`Generated icon-${size}.png`);
}
