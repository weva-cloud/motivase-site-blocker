// ブラウザ再起動を跨いだ永続性の検証:
// - やること / 設定 (storage.local) は残る
// - 一時許可 (storage.session + DNR session rules) は消える
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME_BIN = process.env.CHROME_BIN;
if (!CHROME_BIN) {
  console.error("CHROME_BIN 環境変数を指定してください");
  process.exit(2);
}
const EXT_DIR = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));
const userDataDir = mkdtempSync(join(tmpdir(), "msb-profile-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launch = () =>
  puppeteer.launch({
    executablePath: CHROME_BIN,
    headless: true,
    userDataDir,
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

// --- セッション 1: ルール + やることを保存し、一時許可を発動 ---
let browser = await launch();
let swTarget = await browser.waitForTarget(
  (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
  { timeout: 15_000 },
);
const extId = new URL(swTarget.url()).host;
let page = await browser.newPage();
await page.goto(`chrome-extension://${extId}/options.html`, {
  waitUntil: "networkidle0",
});
await page.evaluate(async () => {
  await chrome.storage.local.set({
    settings: {
      rules: [
        {
          id: "r1",
          dnrId: 1,
          type: "domain",
          domain: "youtube.com",
          enabled: true,
          createdAt: 1,
        },
      ],
      nextDnrId: 2,
      allowDurations: [10, 600],
      widgets: {
        motivation: { enabled: true, messages: ["集中"] },
        todo: { enabled: true },
        pomodoro: { enabled: true, workMin: 25, breakMin: 5, notify: true },
      },
    },
    todos: [{ id: "t1", text: "再起動テスト", done: false, createdAt: 1 }],
  });
});
await sleep(600);
// 10分の一時許可を発動（メッセージ経由で session ルール + storage.session に入る）
const granted = await page.evaluate(() =>
  chrome.runtime.sendMessage({
    type: "TEMP_ALLOW",
    domain: "youtube.com",
    durationSec: 600,
  }),
);
const before = await page.evaluate(async () => ({
  session: await chrome.storage.session.get("tempAllows"),
  rules: await chrome.declarativeNetRequest.getSessionRules(),
}));
console.log(
  granted.ok && before.session.tempAllows["youtube.com"] && before.rules.length === 1
    ? "✅ session1: 一時許可が session ストレージ + session ルールに入った"
    : `❌ session1: ${JSON.stringify(before)}`,
);
await browser.close();

// --- セッション 2: 再起動後の状態を確認 ---
browser = await launch();
swTarget = await browser.waitForTarget(
  (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
  { timeout: 15_000 },
);
page = await browser.newPage();
await page.goto(`chrome-extension://${extId}/options.html`, {
  waitUntil: "networkidle0",
});
await sleep(600);
const after = await page.evaluate(async () => ({
  local: await chrome.storage.local.get(["settings", "todos"]),
  session: await chrome.storage.session.get("tempAllows"),
  sessionRules: await chrome.declarativeNetRequest.getSessionRules(),
  dynamicRules: await chrome.declarativeNetRequest.getDynamicRules(),
}));
console.log(
  after.local.todos?.[0]?.text === "再起動テスト" &&
    after.local.settings?.rules?.length === 1
    ? "✅ restart: やることと設定は再起動後も残る"
    : `❌ restart: local=${JSON.stringify(after.local)}`,
);
console.log(
  (after.session.tempAllows === undefined ||
    Object.keys(after.session.tempAllows).length === 0) &&
    after.sessionRules.length === 0
    ? "✅ restart: 一時許可は再起動で消える（storage.session / session ルールとも空）"
    : `❌ restart: session=${JSON.stringify(after.session)} rules=${after.sessionRules.length}`,
);
console.log(
  after.dynamicRules.length === 1
    ? "✅ restart: ブロックの DNR 動的ルールは維持される"
    : `❌ restart: dynamic=${after.dynamicRules.length}`,
);
await browser.close();
