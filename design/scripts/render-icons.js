// Rendert de SVG-iconen naar PNG met Chromium.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const root = path.resolve(__dirname, "../..");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage();
  const jobs = [
    ["design/icon.svg", 512, "design/icon-512.png"], ["design/icon.svg", 256, "design/icon-256.png"],
    ["design/icon.svg", 128, "extension/icons/icon128.png"], ["design/icon.svg", 48, "extension/icons/icon48.png"],
    ["design/icon-small.svg", 32, "extension/icons/icon32.png"], ["design/icon-small.svg", 16, "extension/icons/icon16.png"]
  ];
  for (const [src, size, out] of jobs) {
    const svg = fs.readFileSync(`${root}/${src}`, "utf8");
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: `${root}/${out}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
})();
