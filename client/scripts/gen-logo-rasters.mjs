// One-off asset generator: rasterizes the Paypr mark + an OG share image using
// the Playwright Chromium already installed for e2e. Re-run after the source
// brand SVGs change. Outputs land in client/public.
//
//   node scripts/gen-logo-rasters.mjs
//
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = resolve(__dirname, '../public');

// The on-ink mark is a rounded tile with transparent corners — perfect for the
// browser-tab favicon, but home-screen / maskable icons want a full-bleed
// square (the OS supplies its own rounding/mask). Derive a square variant by
// flattening the tile's corner radius to 0.
const onInk = readFileSync(resolve(pub, 'favicon.svg'), 'utf8');
const fullBleed = onInk.replace('rx="112"', 'rx="0"');

function svgToDataUri(svg) {
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const browser = await chromium.launch();

async function shoot(html, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(pub, out), omitBackground: true });
  await page.close();
  console.log('wrote', out);
}

const iconPage = (svg, size) => `<!doctype html><html><body style="margin:0">
  <img src="${svgToDataUri(svg)}" width="${size}" height="${size}" style="display:block" />
</body></html>`;

// Browser-tab PNG fallback (transparent rounded tile)
await shoot(iconPage(onInk, 96), 96, 96, 'favicon-96x96.png');
// Home-screen / maskable (full-bleed dark square)
await shoot(iconPage(fullBleed, 180), 180, 180, 'apple-touch-icon.png');
await shoot(iconPage(fullBleed, 192), 192, 192, 'web-app-manifest-192x192.png');
await shoot(iconPage(fullBleed, 512), 512, 512, 'web-app-manifest-512x512.png');

// ── OG / social share image (1200×630) ──────────────────────────────────────
const wordmarkDataUri =
  'data:image/png;base64,' +
  readFileSync(resolve(pub, 'paypr-wordmark.png')).toString('base64');

const og = `<!doctype html><html><head><style>
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&family=Space+Mono:wght@700&display=swap');
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#FAFAF8;color:#161616;
       font-family:'Archivo',sans-serif;position:relative;overflow:hidden}
  .frame{position:absolute;inset:48px;border:1px solid #CBC7C1}
  .cross{position:absolute;width:14px;height:14px}
  .cross::before,.cross::after{content:'';position:absolute;background:#E53D00}
  .cross::before{left:50%;top:0;width:1px;height:100%;transform:translateX(-50%)}
  .cross::after{top:50%;left:0;height:1px;width:100%;transform:translateY(-50%)}
  .tl{left:41px;top:41px}.tr{right:41px;top:41px}.bl{left:41px;bottom:41px}.br{right:41px;bottom:41px}
  .inner{position:absolute;inset:48px;display:flex;flex-direction:column;
         justify-content:center;padding:0 96px}
  .kicker{font-family:'Space Mono',monospace;font-size:18px;font-weight:700;
          letter-spacing:.22em;text-transform:uppercase;color:#82807B;margin-bottom:40px}
  img.wm{height:128px;width:auto;margin-bottom:40px}
  h1{font-size:60px;font-weight:800;letter-spacing:-.02em;line-height:1.05;max-width:880px}
  h1 .o{color:#E53D00}
</style></head><body>
  <div class="frame"></div>
  <span class="cross tl"></span><span class="cross tr"></span>
  <span class="cross bl"></span><span class="cross br"></span>
  <div class="inner">
    <p class="kicker">Paypr · Renewal radar</p>
    <img class="wm" src="${wordmarkDataUri}" />
    <h1>Every subscription, contract and renewal on <span class="o">one timeline.</span></h1>
  </div>
</body></html>`;

{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(og, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(pub, 'og-image.png') });
  await page.close();
  console.log('wrote og-image.png');
}

await browser.close();
