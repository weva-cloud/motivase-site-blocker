// ビルド済み拡張を実際の Chrome (for Testing) に読み込み、
// ブロック → 一時許可 → 自動再ブロック の一連の流れを検証するスモークテスト。
//
// 使い方:
//   npm run build
//   CHROME_BIN=<Chrome for Testing のパス> node scripts/e2e-smoke.mjs
//
// 注意: ブランド版 Chrome (137+) は --load-extension が無効のため、
//       Chrome for Testing か Chromium を使うこと。
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME_BIN = process.env.CHROME_BIN;
if (!CHROME_BIN) {
  console.error("CHROME_BIN 環境変数に Chrome for Testing のパスを指定してください");
  process.exit(2);
}
const EXT_DIR = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: cond });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

try {
  // 拡張 ID は service worker のターゲット URL から取得する
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    { timeout: 15_000 },
  );
  const extId = new URL(swTarget.url()).host;
  console.log(`extension id: ${extId}`);

  // --- 1. options ページの実 UI からルールを追加する ---
  const options = await browser.newPage();
  await options.goto(`chrome-extension://${extId}/options.html`, {
    waitUntil: "networkidle0",
  });
  await options.waitForSelector('input[aria-label="ブロックするサイトのパターン"]');
  await options.type('input[aria-label="ブロックするサイトのパターン"]', "example.com");
  // プレビューが出るのを確認
  await options.waitForFunction(() =>
    document.body.textContent.includes(
      "とそのサブドメインのすべてのページをブロックします",
    ),
  );
  check("options: 入力プレビューが表示される", true);
  await options.click('button[type="submit"]');
  await options.waitForFunction(() =>
    [...document.querySelectorAll("li")].some((li) =>
      li.textContent.includes("example.com"),
    ),
  );
  check("options: ルールが一覧に追加される", true);

  // テストを速くするため摩擦の待機を 1 秒に短縮（理由入力は必須のまま）
  await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get("settings");
    settings.friction = { waitSec: 1, requireReason: true };
    await chrome.storage.local.set({ settings });
  });

  // background の DNR 同期を待つ
  await new Promise((r) => setTimeout(r, 800));

  // --- 2. ブロックされるか ---
  const site = await browser.newPage();
  await site
    .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => {});
  await site
    .waitForFunction(() => location.href.startsWith("chrome-extension://"), {
      timeout: 10_000,
    })
    .catch(() => {});
  const blockedUrl = site.url();
  check(
    "block: example.com がブロック画面へリダイレクトされる",
    blockedUrl === `chrome-extension://${extId}/blocked.html#u=https://example.com/`,
    blockedUrl,
  );
  await site
    .waitForFunction(
      () => document.body.textContent.includes("このサイトはブロック中です"),
      { timeout: 5_000 },
    )
    .catch(() => {});
  check(
    "block: ブロック画面に日本語の見出しとウィジェットが出る",
    await site.evaluate(
      () =>
        document.body.textContent.includes("このサイトはブロック中です") &&
        document.body.textContent.includes("やることリスト"),
    ),
  );

  // --- 3. 一時許可（10秒）: 摩擦ゲート（理由 + 待機）を通ってサイトが開く ---
  const allowButton = await site.waitForSelector(
    "xpath///button[contains(., '10秒だけ開く')]",
  );
  await allowButton.click();
  // 摩擦ゲートが表示される
  await site.waitForFunction(() =>
    document.body.textContent.includes("本当にいま開く必要がありますか？"),
  );
  check("friction: 開く前に摩擦ゲート（理由 + 待機）が挟まる", true);
  await site.type('input[aria-label="開く理由"]', "仕事の資料を確認する");
  // 待機カウントダウン後に「開く」ボタンが有効になるのを待ってクリック
  const openButton = await site.waitForSelector(
    "xpath///button[normalize-space(.)='開く' and not(@disabled)]",
    { timeout: 10_000 },
  );
  await Promise.all([
    site.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }),
    openButton.click(),
  ]);
  check(
    "temp-allow: 10秒許可で元のサイトが開く",
    site.url() === "https://example.com/",
    site.url(),
  );

  // --- 4. 約10秒後に自動で再ブロックされる ---
  await site
    .waitForFunction(() => location.href.startsWith("chrome-extension://"), {
      timeout: 20_000,
    })
    .catch(() => {});
  check(
    "temp-allow: 失効後にタブがブロック画面へ戻される",
    site.url().startsWith(`chrome-extension://${extId}/blocked.html#u=`),
    site.url(),
  );

  // --- 5. ルールを無効化すると閲覧できる ---
  await options.bringToFront();
  const switchSel = 'button[role="switch"]';
  await options.waitForSelector(switchSel);
  await options.click(switchSel);
  await new Promise((r) => setTimeout(r, 800));
  await site.goto("https://example.com/", { waitUntil: "domcontentloaded" });
  check(
    "toggle: ルール無効化でサイトが閲覧できる",
    site.url() === "https://example.com/",
    site.url(),
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
