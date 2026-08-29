import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePngIcons() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const svgPath = path.resolve(__dirname, '../public/favicon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const publicDir = path.resolve(__dirname, '../public');

  const targets = [
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of targets) {
    await page.setViewportSize({ width: size, height: size });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #faf8f5;
            border-radius: ${Math.round(size * 0.18)}px;
            overflow: hidden;
          }
          svg {
            width: ${Math.round(size * 0.78)}px;
            height: ${Math.round(size * 0.78)}px;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;
    await page.setContent(html);
    const dest = path.join(publicDir, name);
    await page.screenshot({ path: dest, omitBackground: false });
    console.log(`Generated ${name} (${size}x${size})`);
  }

  await browser.close();
}

generatePngIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
