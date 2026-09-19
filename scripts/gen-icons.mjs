import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SOURCE_ICON = 'src-assets/icon-source.webp';

mkdirSync('public/icons', { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(SOURCE_ICON)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(`public/icons/icon${size}.png`);
  console.log(`Generated icon${size}.png`);
}
