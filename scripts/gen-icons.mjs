// 拡張アイコン（PNG）を依存ライブラリなしで生成するスクリプト。
// アンバー系グラデーションの角丸スクエア + 白い稲妻（エネルギー/モチベーションの象徴）。
// 使い方: node scripts/gen-icons.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/icon");
mkdirSync(outDir, { recursive: true });

// ---- PNG エンコーダ（8bit RGBA・非インターレース） ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 各行の先頭にフィルタバイト 0 を付与
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 図形描画（128x128 基準の座標系、point-in-shape 判定） ----
const BASE = 128;
const CORNER_RADIUS = 28;

// 稲妻ポリゴン（128x128 基準）
const BOLT = [
  [70, 14],
  [36, 72],
  [58, 72],
  [50, 114],
  [92, 54],
  [68, 54],
  [86, 14],
];

function inPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inRoundedSquare(px, py) {
  const r = CORNER_RADIUS;
  const min = 4;
  const max = BASE - 4;
  if (px < min || px > max || py < min || py > max) return false;
  const cx = Math.max(min + r, Math.min(max - r, px));
  const cy = Math.max(min + r, Math.min(max - r, py));
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

// アンバー(#fbbf24)→オレンジ(#ea580c) の縦グラデーション
function bgColor(t) {
  const a = [0xfb, 0xbf, 0x24];
  const b = [0xea, 0x58, 0x0c];
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = BASE / size;
  const SS = 3; // 3x3 スーパーサンプリング
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHit = 0;
      let boltHit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * scale;
          const py = (y + (sy + 0.5) / SS) * scale;
          if (inRoundedSquare(px, py)) {
            bgHit++;
            if (inPolygon(px, py, BOLT)) boltHit++;
          }
        }
      }
      const total = SS * SS;
      if (bgHit === 0) continue; // 透明のまま
      const [br, bgc, bb] = bgColor(y / size);
      const boltRatio = boltHit / total;
      const r = Math.round(br * (1 - boltRatio) + 255 * boltRatio);
      const g = Math.round(bgc * (1 - boltRatio) + 255 * boltRatio);
      const b = Math.round(bb * (1 - boltRatio) + 255 * boltRatio);
      const i = (y * size + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = Math.round(255 * (bgHit / total));
    }
  }
  return encodePng(size, size, rgba);
}

for (const size of [16, 32, 48, 96, 128]) {
  const png = renderIcon(size);
  writeFileSync(join(outDir, `${size}.png`), png);
  console.log(`generated public/icon/${size}.png (${png.length} bytes)`);
}
