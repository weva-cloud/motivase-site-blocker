// 3 サーフェス（blocked / options / popup）のスクリーンショットを撮るスクリプト。
// 使い方: npm run build && CHROME_BIN=<Chrome for Testing> node scripts/e2e-screenshots.mjs <出力dir>
//
// 出力は 1280x800 に固定している。Chrome ウェブストアが受け付けるのは
// 1280x800 か 640x400 ちょうどのみで、それ以外は掲載情報の入稿で弾かれるため。
// deviceScaleFactor は 1（2 にすると 2560x1600 になり要件から外れる）。
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME_BIN = process.env.CHROME_BIN;
const OUT_DIR = process.argv[2] ?? "screenshots";
if (!CHROME_BIN) {
  console.error("CHROME_BIN を指定してください");
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });
const EXT_DIR = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));

const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  args: [
    // GitHub Actions の Ubuntu ランナーは AppArmor が非特権ユーザー名前空間を
    // 禁じているため、Chrome のサンドボックスを起動できず即座に落ちる。
    // 使い捨てのテスト用ブラウザなので無効化してよい。
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
  ],
});

const swTarget = await browser.waitForTarget(
  (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
  { timeout: 15_000 },
);
const extId = new URL(swTarget.url()).host;
const base = `chrome-extension://${extId}`;

// テスト用のルール・やることを直接ストレージへ投入する
const seedPage = await browser.newPage();
await seedPage.goto(`${base}/options.html`, { waitUntil: "networkidle0" });
await seedPage.evaluate(async () => {
  const now = Date.now();
  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // ヒートマップ用に過去 60 日ぶんの統計を作る
  const days = {};
  for (let i = 0; i < 60; i++) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const pomodoros = (i * 7) % 5;
    days[dateKey(d)] = {
      blocks: (i * 3) % 8,
      blocksByDomain: { "youtube.com": (i * 2) % 5, "x.com": i % 4 },
      allowSec: (i % 3) * 120,
      allowSecByDomain: { "youtube.com": (i % 3) * 120 },
      pomodoros: i < 4 ? 2 : pomodoros, // 直近はストリークが続くように
    };
  }
  await chrome.storage.local.set({
    settings: {
      rules: [
        {
          id: "r1",
          dnrId: 1,
          type: "domain",
          domain: "youtube.com",
          enabled: true,
          createdAt: now,
          reason: "資格試験に集中するため",
          timing: "always",
        },
        {
          id: "r2",
          dnrId: 2,
          type: "prefix",
          domain: "x.com",
          path: "/home",
          enabled: true,
          createdAt: now - 1,
          timing: "schedule",
        },
        {
          id: "r3",
          dnrId: 3,
          type: "host",
          domain: "www.instagram.com",
          enabled: false,
          createdAt: now - 2,
          timing: "always",
        },
      ],
      nextDnrId: 4,
      allowDurations: [10, 60, 300, 600],
      friction: { waitSec: 10, requireReason: true },
      tempAllowBudgetMin: 30,
      dailyPomodoroGoal: 2,
      widgets: {
        motivation: {
          enabled: true,
          messages: ["今は集中の時間。未来の自分が感謝してくれます。"],
        },
        todo: { enabled: true },
        pomodoro: {
          enabled: true,
          workMin: 25,
          breakMin: 5,
          notify: true,
          focusMode: true,
          sound: true,
        },
      },
    },
    todos: [
      { id: "t1", text: "企画書の下書きを仕上げる", done: false, createdAt: now },
      { id: "t2", text: "メールの返信（3件）", done: true, createdAt: now },
    ],
    stats: { days },
    allowLog: [
      {
        at: now - 3600_000,
        domain: "youtube.com",
        durationSec: 300,
        reason: "会議動画の確認",
      },
      {
        at: now - 7200_000,
        domain: "x.com",
        durationSec: 60,
        reason: "取引先の告知チェック",
      },
    ],
  });
});
await new Promise((r) => setTimeout(r, 500));

const STORE_WIDTH = 1280;
const STORE_HEIGHT = 800;

/**
 * 出力した PNG が掲載サイズちょうどか確かめる。
 * viewport と deviceScaleFactor の掛け算を間違えると、提出時にストア側で
 * 弾かれるまで気づけないので、その場で落とす。
 * PNG は先頭が固定長ヘッダなので、幅と高さは追加ライブラリなしで読める。
 */
function assertStoreSize(file) {
  const buf = readFileSync(file);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== STORE_WIDTH || height !== STORE_HEIGHT) {
    throw new Error(
      `${file} は ${width}x${height}。Chrome ウェブストアは ${STORE_WIDTH}x${STORE_HEIGHT} ちょうどしか受け付けません`,
    );
  }
  return `${width}x${height}`;
}

async function shot(name, url, { scheme, setup } = {}) {
  const page = await browser.newPage();
  await page.setViewport({
    width: STORE_WIDTH,
    height: STORE_HEIGHT,
    deviceScaleFactor: 1,
  });
  if (scheme) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  }
  await page.bringToFront();
  await page.goto(url, { waitUntil: "networkidle0" });
  if (setup) await setup(page);
  await new Promise((r) => setTimeout(r, 400));
  const file = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`saved ${name}.png (${assertStoreSize(file)})`);
  await page.close();
}

/**
 * popup は実寸 360px 幅なので、そのまま撮ると掲載サイズに足りない。
 * 1280x800 のキャンバス中央に置いて撮る（UI 自体には手を入れない）。
 */
const centerPopup = (page) =>
  page.addStyleTag({
    content: `html, body { width: 100%; min-height: 100vh; }
      body { display: flex; align-items: center; justify-content: center; }`,
  });

// popup は実ポップアップとして開けないため、アクティブタブ照会だけ差し替えて再現する
const fakeActiveTab = (url) => (page) =>
  page.evaluateOnNewDocument((tabUrl) => {
    const original = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (info) =>
      info?.active === true
        ? Promise.resolve([{ id: 999, url: tabUrl, active: true }])
        : original(info);
  }, url);

await shot("blocked-dark", `${base}/blocked.html#u=https://www.youtube.com/watch?v=abc`, {
  scheme: "dark",
});
await shot(
  "blocked-light",
  `${base}/blocked.html#u=https://www.youtube.com/watch?v=abc`,
  { scheme: "light" },
);
// 摩擦ゲートを開いた状態（ライト / ダークの両方）
for (const scheme of ["dark", "light"]) {
  await shot(
    `blocked-friction-${scheme}`,
    `${base}/blocked.html#u=https://www.youtube.com/watch?v=abc`,
    {
      scheme,
      setup: async (page) => {
        const btn = await page.waitForSelector(
          "xpath///button[contains(., '1分だけ開く')]",
        );
        await btn.click();
        await page.waitForFunction(() =>
          document.body.textContent.includes("本当にいま開く必要がありますか？"),
        );
      },
    },
  );
}
await shot("options-dark", `${base}/options.html`, {
  scheme: "dark",
  setup: async (page) => {
    await page.type('input[aria-label="ブロックするサイトのパターン"]', "reddit.com");
    await new Promise((r) => setTimeout(r, 300));
  },
});
await shot("options-light", `${base}/options.html`, { scheme: "light" });
// 統計タブ（ライト / ダークの両方）
for (const scheme of ["dark", "light"]) {
  await shot(`options-stats-${scheme}`, `${base}/options.html`, {
    scheme,
    setup: async (page) => {
      const btn = await page.waitForSelector("xpath///button[contains(., '統計')]");
      await btn.click();
      await new Promise((r) => setTimeout(r, 400));
    },
  });
}
await shot("options-schedule-dark", `${base}/options.html`, {
  scheme: "dark",
  setup: async (page) => {
    const btn = await page.waitForSelector("xpath///button[contains(., 'スケジュール')]");
    await btn.click();
    await new Promise((r) => setTimeout(r, 400));
  },
});

for (const [name, scheme] of [
  ["popup-dark", "dark"],
  ["popup-light", "light"],
]) {
  const page = await browser.newPage();
  await page.setViewport({
    width: STORE_WIDTH,
    height: STORE_HEIGHT,
    deviceScaleFactor: 1,
  });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await fakeActiveTab("https://www.youtube.com/watch?v=abc")(page);
  await page.bringToFront();
  await page.goto(`${base}/popup.html`, { waitUntil: "networkidle0" });
  await centerPopup(page);
  await new Promise((r) => setTimeout(r, 400));
  const file = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`saved ${name}.png (${assertStoreSize(file)})`);
  await page.close();
}

// 未ブロックサイトでの QuickBlockForm（ライト / ダークの両方）
for (const scheme of ["dark", "light"]) {
  const page = await browser.newPage();
  await page.setViewport({
    width: STORE_WIDTH,
    height: STORE_HEIGHT,
    deviceScaleFactor: 1,
  });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await fakeActiveTab("https://news.example.jp/tech/ai-article")(page);
  await page.bringToFront();
  await page.goto(`${base}/popup.html`, { waitUntil: "networkidle0" });
  await centerPopup(page);
  await new Promise((r) => setTimeout(r, 400));
  const name = `popup-quickblock-${scheme}`;
  const file = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`saved ${name}.png (${assertStoreSize(file)})`);
  await page.close();
}

await browser.close();
