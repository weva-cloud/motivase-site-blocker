// Chrome ウェブストアのプロモーションタイル（小）440x280 を生成する。
// 使い方: CHROME_BIN=<Chrome for Testing> node scripts/gen-promo-tile.mjs [出力先] [light|dark]
//
// ストアが受け付けるのは 440x280 ちょうどの JPEG か 24bit PNG（アルファなし）。
// 拡張本体の配色（--ui-* のダーク側）とフォントスタックに合わせてある。
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME_BIN = process.env.CHROME_BIN;
if (!CHROME_BIN) {
  console.error("CHROME_BIN を指定してください");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// 掲載に使うのはライト（スクリーンショットもライトで揃えているため）
const THEME = process.argv[3] === "dark" ? "dark" : "light";
const OUT = process.argv[2] ?? join(ROOT, `shots/promo-440x280-${THEME}.png`);
const WIDTH = 440;
const HEIGHT = 280;

// 拡張本体の --ui-* トークンと同じ値
const PALETTE = {
  dark: { bg: "#0e1116", text: "#e7eaee", muted: "#98a2b0" },
  light: { bg: "#ffffff", text: "#10151d", muted: "#5f6b7a" },
}[THEME];

mkdirSync(dirname(OUT), { recursive: true });

const iconDataUri = `data:image/png;base64,${readFileSync(join(ROOT, "public/icon/128.png")).toString("base64")}`;

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: ${PALETTE.bg};
    color: ${PALETTE.text};
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP",
      "Yu Gothic UI", Meiryo, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 18px; padding: 32px;
  }
  img { width: 56px; height: 56px; border-radius: 13px; }
  h1 { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }
  p { font-size: 13.5px; line-height: 1.75; color: ${PALETTE.muted}; text-align: center; }
</style>
<img src="${iconDataUri}" alt="">
<h1>Motivase Site Blocker</h1>
<p>気が散るサイトをブロックして、<br>そのぶんの時間を「やること」に戻す。</p>
`;

const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  protocolTimeout: 30_000,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-first-run"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.bringToFront();
  await page.setContent(html, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: OUT });
} finally {
  await browser.close();
}

// 寸法と形式をその場で検証する（提出時に弾かれてから気づくのを避ける）
const buf = readFileSync(OUT);
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const colorType = buf[25];
if (width !== WIDTH || height !== HEIGHT) {
  throw new Error(
    `${OUT} は ${width}x${height}。${WIDTH}x${HEIGHT} である必要があります`,
  );
}
if (colorType !== 2) {
  throw new Error(
    `${OUT} の PNG カラータイプが ${colorType}。24bit RGB（アルファなし）が必要です`,
  );
}
console.log(`saved ${OUT} (${width}x${height}, 24bit RGB, ${THEME})`);
