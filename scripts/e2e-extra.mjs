// 追加 E2E: ウィジェット（やること / ポモドーロ）・一時許可の管理・
// バックアップ（エクスポート / インポート）・popup のブロック中表示を実機 Chrome で検証する。
// 使い方: npm run build && CHROME_BIN=<Chrome for Testing> node scripts/e2e-extra.mjs
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
const WORK_DIR = mkdtempSync(join(tmpdir(), "msb-e2e-"));

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: cond });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

try {
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    { timeout: 15_000 },
  );
  const extId = new URL(swTarget.url()).host;
  const base = `chrome-extension://${extId}`;

  // youtube.com ルールをストレージへ直接投入（フォーム経由の追加は smoke 側で検証済み）
  const options = await browser.newPage();
  await options.goto(`${base}/options.html`, { waitUntil: "networkidle0" });
  await options.evaluate(async () => {
    await chrome.storage.local.set({
      settings: {
        rules: [
          {
            id: "r1",
            dnrId: 1,
            type: "domain",
            domain: "youtube.com",
            enabled: true,
            createdAt: Date.now(),
          },
        ],
        nextDnrId: 2,
        allowDurations: [10, 60, 300, 600],
        // このテストは許可フロー自体を検証するため摩擦はオフにする
        // （摩擦ゲートの挙動は e2e-smoke.mjs 側で検証）
        friction: { waitSec: 0, requireReason: false },
        widgets: {
          motivation: { enabled: true, messages: ["集中！"] },
          todo: { enabled: true },
          pomodoro: { enabled: true, workMin: 25, breakMin: 5, notify: true },
        },
      },
    });
  });
  await sleep(800);

  // --- 1. ブロック画面のやることリスト ---
  const blocked = await browser.newPage();
  await blocked.goto(`${base}/blocked.html#u=https://www.youtube.com/watch?v=abc`, {
    waitUntil: "networkidle0",
  });
  await blocked.type('input[aria-label="やることを追加"]', "テスト項目を書く");
  await blocked.keyboard.press("Enter");
  await blocked.waitForFunction(() =>
    document.body.textContent.includes("テスト項目を書く"),
  );
  const todosInStorage = await blocked.evaluate(async () => {
    const { todos } = await chrome.storage.local.get("todos");
    return todos;
  });
  check(
    "todo: 追加した項目が表示され storage.local に永続化される",
    todosInStorage?.length === 1 && todosInStorage[0].text === "テスト項目を書く",
  );

  // --- 2. ポモドーロ: 開始 → カウントダウン → 一時停止 → リセット ---
  const startBtn = await blocked.waitForSelector("xpath///button[contains(., '開始')]");
  await startBtn.click();
  await sleep(1600);
  const ticking = await blocked.evaluate(
    () => !document.body.textContent.includes("25:00"),
  );
  const phaseShown = await blocked.evaluate(() =>
    document.body.textContent.includes("作業中"),
  );
  check("pomodoro: 開始で作業中になりカウントダウンする", ticking && phaseShown);

  await (
    await blocked.waitForSelector("xpath///button[contains(., '一時停止')]")
  ).click();
  await sleep(300);
  const clockText = await blocked.evaluate(
    () => document.querySelector(".text-6xl")?.textContent,
  );
  await sleep(1200);
  const clockTextAfter = await blocked.evaluate(
    () => document.querySelector(".text-6xl")?.textContent,
  );
  check(
    "pomodoro: 一時停止中は残り時間が凍結される",
    clockText === clockTextAfter,
    `${clockText} → ${clockTextAfter}`,
  );

  // リロードしても状態が残る（endsAt/remainingMs 方式）
  await blocked.reload({ waitUntil: "networkidle0" });
  const persisted = await blocked.evaluate(
    (t) => document.querySelector(".text-6xl")?.textContent === t,
    clockText,
  );
  check("pomodoro: リロード後も残り時間が保持される", persisted);

  await (
    await blocked.waitForSelector("xpath///button[contains(., 'リセット')]")
  ).click();
  await blocked.waitForFunction(() => document.body.textContent.includes("25:00"));
  check("pomodoro: リセットで初期状態に戻る", true);

  // --- 3. 一時許可の管理（options）と即時解除によるタブ掃除 ---
  const allowBtn = await blocked.waitForSelector(
    "xpath///button[contains(., '1分だけ開く')]",
  );
  await Promise.all([
    blocked.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }),
    allowBtn.click(),
  ]);
  check(
    "temp-allow: 1分許可でサイトが開く",
    blocked.url() === "https://www.youtube.com/watch?v=abc",
    blocked.url(),
  );

  await options.bringToFront();
  await (
    await options.waitForSelector("xpath///button[contains(., '一時許可')]")
  ).click();
  await options.waitForFunction(() => document.body.textContent.includes("youtube.com"));
  check("options: 一時許可中のドメインが残り時間つきで一覧に出る", true);

  await (
    await options.waitForSelector("xpath///button[contains(., '今すぐ再ブロック')]")
  ).click();
  await sleep(1500);
  check(
    "options: 「今すぐ再ブロック」でタブがブロック画面へ戻される",
    blocked.url().startsWith(`${base}/blocked.html#u=`),
    blocked.url(),
  );

  // --- 4. popup: ブロック対象サイトを開いている想定での表示 ---
  const popup = await browser.newPage();
  await popup.evaluateOnNewDocument(() => {
    const original = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (info) =>
      info?.active === true
        ? Promise.resolve([{ id: 999, url: "https://m.youtube.com/feed", active: true }])
        : original(info);
  });
  await popup.goto(`${base}/popup.html`, { waitUntil: "networkidle0" });
  await popup.waitForFunction(() =>
    document.body.textContent.includes("このサイトはブロック対象です"),
  );
  check(
    "popup: ブロック対象サイトで「ブロック対象です」+ 一時許可ボタンが出る",
    await popup.evaluate(() => document.body.textContent.includes("10秒だけ開く")),
  );

  // --- 5. エクスポート（実ダウンロード） ---
  await options.bringToFront();
  await (
    await options.waitForSelector("xpath///button[contains(., 'バックアップ')]")
  ).click();
  const cdp = await options.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: WORK_DIR,
  });
  await (
    await options.waitForSelector("xpath///button[contains(., 'エクスポート')]")
  ).click();
  await sleep(1200);
  const downloaded = readdirSync(WORK_DIR).find((f) => f.endsWith(".json"));
  let exportOk = false;
  if (downloaded) {
    const parsed = JSON.parse(readFileSync(join(WORK_DIR, downloaded), "utf8"));
    exportOk =
      parsed.app === "motivase-site-blocker" &&
      parsed.settings.rules.length === 1 &&
      parsed.todos.length === 1;
  }
  check("backup: エクスポートで正しい JSON がダウンロードされる", exportOk, downloaded);

  // --- 6. インポート（ファイル選択 → 確認モーダル → DNR 反映） ---
  const importFile = join(WORK_DIR, "import.json");
  writeFileSync(
    importFile,
    JSON.stringify({
      app: "motivase-site-blocker",
      version: 1,
      exportedAt: "2026-07-12T00:00:00Z",
      settings: {
        rules: [{ type: "domain", domain: "reddit.com", enabled: true }],
        allowDurations: [30, 120],
      },
      todos: [{ text: "インポート後のタスク" }],
    }),
  );
  const fileInput = await options.waitForSelector('input[type="file"]');
  await fileInput.uploadFile(importFile);
  await (
    await options.waitForSelector("xpath///button[contains(., '上書きしてインポート')]")
  ).click();
  await options.waitForFunction(() =>
    document.body.textContent.includes("インポートが完了しました"),
  );
  await sleep(800);
  const dnrRules = await options.evaluate(() =>
    chrome.declarativeNetRequest.getDynamicRules(),
  );
  check(
    "backup: インポートで設定が置き換わり DNR ルールも再同期される",
    dnrRules.length === 1 && dnrRules[0].condition.requestDomains?.includes("reddit.com"),
    JSON.stringify(dnrRules.map((r) => r.condition.requestDomains)),
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
