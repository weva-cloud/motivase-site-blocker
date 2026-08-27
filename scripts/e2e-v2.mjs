// V2 機能の E2E: フォーカスロック / 日次予算 / スケジュールブロック /
// プリセット一括登録 / 厳格モード / ツールバーバッジ。
// 使い方: npm run build && CHROME_BIN=<Chrome for Testing> node scripts/e2e-v2.mjs
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME_BIN = process.env.CHROME_BIN;
if (!CHROME_BIN) {
  console.error("CHROME_BIN 環境変数を指定してください");
  process.exit(2);
}
const EXT_DIR = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: cond });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEBUG = process.env.E2E_DEBUG === "1";
const dbg = (s) => {
  if (DEBUG) console.log(`  [dbg ${new Date().toISOString().slice(11, 19)}] ${s}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  protocolTimeout: 60_000,
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

  const options = await browser.newPage();
  if (DEBUG) {
    options.on("console", (m) =>
      dbg(`options console[${m.type()}]: ${m.text().slice(0, 150)}`),
    );
    options.on("pageerror", (e) => dbg(`options pageerror: ${String(e).slice(0, 200)}`));
  }
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
            createdAt: 1,
            timing: "always",
          },
        ],
        nextDnrId: 2,
        allowDurations: [10, 60, 300],
        friction: { waitSec: 0, requireReason: false },
        tempAllowBudgetMin: 1, // 1日 1 分
        widgets: {
          motivation: { enabled: true, messages: ["集中"] },
          todo: { enabled: true },
          pomodoro: {
            enabled: true,
            workMin: 25,
            breakMin: 5,
            notify: false,
            focusMode: true,
            sound: false,
          },
        },
      },
    });
  });
  await sleep(800);

  // --- 1. バッジ: ブロック画面表示で今日のブロック数が出る ---
  const blocked = await browser.newPage();
  await blocked.goto(`${base}/blocked.html#u=https://www.youtube.com/watch?v=1`, {
    waitUntil: "networkidle0",
  });
  await sleep(800);
  const badge = await options.evaluate(() => chrome.action.getBadgeText({}));
  check("badge: ブロック回数がツールバーバッジに表示される", badge === "1", badge);

  // --- 2. 日次予算: 予算を超える延長は拒否される ---
  const grant1 = await blocked.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "TEMP_ALLOW",
      domain: "youtube.com",
      durationSec: 60,
    }),
  );
  check("budget: 予算内（60秒/1分）の許可は通る", grant1.ok === true);
  await sleep(300);
  const grant2 = await blocked.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "TEMP_ALLOW",
      domain: "youtube.com",
      durationSec: 300,
    }),
  );
  check(
    "budget: 予算を超える延長は日本語エラーで拒否される",
    grant2.ok === false && /許可時間/.test(grant2.error),
    grant2.error,
  );
  await blocked.evaluate(() =>
    chrome.runtime.sendMessage({ type: "TEMP_ALLOW_REVOKE", domain: "youtube.com" }),
  );

  // --- 3. フォーカスロック: 作業ポモドーロ中は一時許可を拒否 ---
  await blocked.evaluate(() =>
    chrome.runtime.sendMessage({ type: "POMODORO", cmd: "start" }),
  );
  await sleep(400);
  const lockRes = await blocked.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "TEMP_ALLOW",
      domain: "youtube.com",
      durationSec: 10,
    }),
  );
  check(
    "focus-lock: 作業中の一時許可は拒否される",
    lockRes.ok === false && lockRes.error.includes("フォーカスモード"),
    lockRes.error,
  );
  await blocked.reload({ waitUntil: "networkidle0" });
  check(
    "focus-lock: ブロック画面に 🔒 の案内が出る",
    await blocked.evaluate(() =>
      document.body.textContent.includes("フォーカスモード中は一時許可できません"),
    ),
  );
  await blocked.evaluate(() =>
    chrome.runtime.sendMessage({ type: "POMODORO", cmd: "reset" }),
  );
  await sleep(400);

  // --- 4. スケジュールブロック ---
  // 今を含むスケジュールにして example.com を schedule ルールで登録
  await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get("settings");
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    settings.schedule = {
      days: [true, true, true, true, true, true, true],
      startMin: Math.max(0, m - 60),
      endMin: Math.min(1440, m + 60),
    };
    settings.rules.push({
      id: "r2",
      dnrId: 2,
      type: "domain",
      domain: "example.com",
      enabled: true,
      createdAt: 2,
      timing: "schedule",
    });
    settings.nextDnrId = 3;
    await chrome.storage.local.set({ settings });
  });
  await sleep(800);
  const site = await browser.newPage();
  await site
    .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => {});
  await site
    .waitForFunction(() => location.href.startsWith("chrome-extension://"), {
      timeout: 8_000,
    })
    .catch(() => {});
  check(
    "schedule: 時間帯内はブロックされる",
    site.url().startsWith(`${base}/blocked.html#u=`),
    site.url(),
  );

  // スケジュールを今を含まない窓に変更 → ブロック解除される
  await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get("settings");
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    settings.schedule = {
      days: [true, true, true, true, true, true, true],
      startMin: (m + 120) % 1440,
      endMin: (m + 180) % 1440,
    };
    await chrome.storage.local.set({ settings });
  });
  await sleep(800);
  await site.goto("https://example.com/", { waitUntil: "domcontentloaded" });
  check(
    "schedule: 時間帯外はブロックされない",
    site.url() === "https://example.com/",
    site.url(),
  );

  // --- 5. プリセット一括登録 ---
  // 注: 背面タブは描画フレームが止まり puppeteer の click 前処理が
  // 進まなくなるため、options を前面に出してから操作する
  await options.bringToFront();
  dbg("reload options");
  await options.reload({ waitUntil: "load" });
  dbg("reload done, waitForSelector");
  const snsAdd = await options.waitForSelector(
    "xpath///li[contains(., 'SNS')]//button[contains(., '追加')]",
  );
  dbg("selector found, click");
  await snsAdd.click();
  dbg("clicked");
  await sleep(600);
  const { ruleCount, dnrDomains } = await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get("settings");
    const dnr = await chrome.declarativeNetRequest.getDynamicRules();
    return {
      ruleCount: settings.rules.length,
      dnrDomains: dnr.flatMap((r) => r.condition.requestDomains ?? []),
    };
  });
  check(
    "presets: SNS カテゴリの一括登録で DNR まで反映される",
    ruleCount >= 8 &&
      dnrDomains.includes("x.com") &&
      dnrDomains.includes("instagram.com"),
    `rules=${ruleCount}`,
  );

  // --- 6. 厳格モード: 削除が無効化され、解除にはタイプチャレンジが要る ---
  const safetyNav = await options.waitForSelector(
    "xpath///button[contains(., '厳格モード')]",
  );
  await safetyNav.click();
  const enableStrict = await options.waitForSelector(
    "xpath///button[contains(., '厳格モードを有効にする')]",
  );
  await enableStrict.click();
  await sleep(400);
  const rulesNav = await options.waitForSelector(
    "xpath///nav//button[contains(., 'ブロックルール')]",
  );
  await rulesNav.click();
  await options.waitForSelector('button[aria-label$="を削除"]');
  const deleteDisabled = await options.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-label$="を削除"]')];
    return buttons.length > 0 && buttons.every((b) => b.disabled);
  });
  check("strict: 厳格モード中は削除ボタンが無効", deleteDisabled);

  const safetyNav2 = await options.waitForSelector(
    "xpath///nav//button[contains(., '厳格モード')]",
  );
  await safetyNav2.click();
  const unlockBtn = await options.waitForSelector(
    "xpath///button[contains(., '厳格モードを解除する')]",
  );
  await unlockBtn.click();
  await options.waitForSelector('input[aria-label="解除の一文"]');
  await options.type(
    'input[aria-label="解除の一文"]',
    "私は一時の気晴らしより自分の目標を優先します",
  );
  // モーダル内の確定ボタンのみに一致させる（カード側の「厳格モードを解除する…」を除外）
  const confirmUnlock = await options.waitForSelector(
    "xpath///button[normalize-space(.)='解除する' and not(@disabled)]",
  );
  await confirmUnlock.click();
  await sleep(400);
  const strictOff = await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get("settings");
    return settings.strictMode === false;
  });
  check("strict: 決意の一文を入力すると解除できる", strictOff);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
