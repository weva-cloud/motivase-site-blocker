// 長め（30秒以上）の一時許可が chrome.alarms 経由で失効し、
// 開いているタブがブロック画面へ戻されるかを検証する。
// e2e-smoke は 10 秒（SW 内 setTimeout が先に発火する経路）しか通らないため、
// alarm だけが頼りになる経路をここで押さえる。
// 使い方: npm run build && CHROME_BIN=<Chrome for Testing> node scripts/e2e-expiry.mjs
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME_BIN = process.env.CHROME_BIN;
if (!CHROME_BIN) {
  console.error("CHROME_BIN 環境変数を指定してください");
  process.exit(2);
}
const EXT_DIR = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));
const ALLOW_SEC = Number(process.env.ALLOW_SEC ?? 40);

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: cond });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** page.waitForFunction は既定で raf ポーリングのため、描画が止まる環境では返らない */
async function waitUntil(fn, { timeout = 30_000, interval = 500 } = {}) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - start > timeout) return false;
    await sleep(interval);
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  protocolTimeout: 120_000,
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

/** SW は idle で落ちるので、その都度ターゲットを取り直す */
async function swEval(fn) {
  const target = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    { timeout: 15_000 },
  );
  const worker = await target.worker();
  return worker.evaluate(fn);
}

try {
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    { timeout: 15_000 },
  );
  const extId = new URL(swTarget.url()).host;
  const base = `chrome-extension://${extId}`;

  const options = await browser.newPage();
  await options.bringToFront();
  await options.goto(`${base}/options.html`, { waitUntil: "load" });
  await options.evaluate(async (allowSec) => {
    await chrome.storage.local.set({
      settings: {
        rules: [
          {
            id: "r1",
            dnrId: 1,
            type: "domain",
            domain: "example.com",
            enabled: true,
            createdAt: 1,
            timing: "always",
          },
        ],
        nextDnrId: 2,
        allowDurations: [allowSec],
        friction: { waitSec: 0, requireReason: false },
        tempAllowBudgetMin: null,
      },
    });
  }, ALLOW_SEC);
  await sleep(1000);

  // --- ブロックされることを確認 ---
  const site = await browser.newPage();
  await site.bringToFront();
  await site
    .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => {});
  await waitUntil(async () => site.url().startsWith(base), { timeout: 10_000 });
  check("ブロック画面へリダイレクトされる", site.url().startsWith(base), site.url());

  // --- 一時許可（ALLOW_SEC 秒）を出してサイトを開く ---
  const granted = await site.evaluate(
    async (sec) =>
      await chrome.runtime.sendMessage({
        type: "TEMP_ALLOW",
        domain: "example.com",
        durationSec: sec,
      }),
    ALLOW_SEC,
  );
  check(
    `一時許可（${ALLOW_SEC}秒）が受理される`,
    granted?.ok === true,
    JSON.stringify(granted),
  );

  const grantedAt = Date.now();
  await site.goto("https://example.com/", {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  check("許可中はサイトが開ける", site.url() === "https://example.com/", site.url());

  // --- alarm が正しく仕掛かっているか ---
  const alarms = await swEval(() => chrome.alarms.getAll());
  const alarm = alarms.find((a) => a.name === "temp-allow:example.com");
  check(
    "失効用の alarm が登録されている",
    alarm !== undefined,
    JSON.stringify(alarms.map((a) => a.name)),
  );
  if (alarm !== undefined) {
    const deltaSec = Math.round((alarm.scheduledTime - grantedAt) / 1000);
    check(
      `alarm の発火予定が約 ${ALLOW_SEC} 秒後になっている`,
      Math.abs(deltaSec - ALLOW_SEC) <= 3,
      `${deltaSec} 秒後`,
    );
  }

  // --- 失効を待つ ---
  console.log(`\n${ALLOW_SEC} 秒の失効を待機中…`);
  const swAliveDuring = [];
  const backToBlocked = await waitUntil(
    async () => {
      swAliveDuring.push(
        browser
          .targets()
          .some(
            (t) =>
              t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
          ),
      );
      return site.url().startsWith(base);
    },
    { timeout: (ALLOW_SEC + 45) * 1000, interval: 1000 },
  );
  const elapsed = Math.round((Date.now() - grantedAt) / 1000);
  const swDied = swAliveDuring.includes(false);
  console.log(`  （待機中に SW が停止した: ${swDied ? "はい" : "いいえ"}）`);

  check(
    "失効後にタブが自動でブロック画面へ戻る",
    backToBlocked,
    backToBlocked
      ? `${elapsed} 秒後`
      : `${elapsed} 秒待っても戻らなかった（URL: ${site.url()}）`,
  );
  if (backToBlocked) {
    check(
      "戻るタイミングが許可時間とほぼ一致する",
      elapsed >= ALLOW_SEC - 2 && elapsed <= ALLOW_SEC + 20,
      `${elapsed} 秒（許可 ${ALLOW_SEC} 秒）`,
    );
  }

  // --- 失効後の状態: session ルールと storage が掃除されている ---
  const after = await swEval(async () => ({
    sessionRules: (await chrome.declarativeNetRequest.getSessionRules()).length,
    allows: Object.keys(
      (await chrome.storage.session.get("tempAllows")).tempAllows ?? {},
    ),
    alarms: (await chrome.alarms.getAll()).map((a) => a.name),
  }));
  check(
    "session の allow ルールが削除されている",
    after.sessionRules === 0,
    `${after.sessionRules} 件`,
  );
  check(
    "storage.session の一時許可が消えている",
    after.allows.length === 0,
    after.allows.join(","),
  );
  check(
    "失効した alarm が残っていない",
    !after.alarms.includes("temp-allow:example.com"),
    after.alarms.join(","),
  );

  // --- 再度アクセスするとブロックされる ---
  await site
    .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => {});
  await waitUntil(async () => site.url().startsWith(base), { timeout: 10_000 });
  check("失効後は再アクセスでブロックされる", site.url().startsWith(base), site.url());
} finally {
  await browser.close();
}

// ============================================================
// フェーズ 2: SW にデバッガを付けずに検証する。
// puppeteer は既定で service worker ターゲットにアタッチし、
// アタッチされた SW を Chrome は idle 終了させない。つまりフェーズ 1 は
// 「SW が生きたまま」の検証でしかなく、10 分の一時許可のように
// SW が必ず落ちる本番条件を再現できていない。
// targetFilter で SW を除外し、拡張 ID は未パッケージ拡張の規則
// （絶対パスの SHA-256 の先頭 16 バイトを a-p にマップ）から計算する。
// ============================================================
console.log("\n--- フェーズ 2: SW にデバッガを付けない条件 ---");

const extIdFromPath = (absPath) =>
  [...createHash("sha256").update(absPath).digest("hex").slice(0, 32)]
    .map((c) => String.fromCharCode(97 + Number.parseInt(c, 16)))
    .join("");

const browser2 = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  protocolTimeout: 120_000,
  targetFilter: (t) =>
    (typeof t.type === "function" ? t.type() : t.type) !== "service_worker",
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

try {
  const base2 = `chrome-extension://${extIdFromPath(EXT_DIR)}`;
  const options2 = await browser2.newPage();
  await options2.bringToFront();
  await options2.goto(`${base2}/options.html`, { waitUntil: "load" });
  check("拡張 ID をパスから計算して開けた（SW 非アタッチ）", true, base2);

  await options2.evaluate(async (allowSec) => {
    await chrome.storage.local.set({
      settings: {
        rules: [
          {
            id: "r1",
            dnrId: 1,
            type: "domain",
            domain: "example.com",
            enabled: true,
            createdAt: 1,
            timing: "always",
          },
        ],
        nextDnrId: 2,
        allowDurations: [allowSec],
        friction: { waitSec: 0, requireReason: false },
        tempAllowBudgetMin: null,
      },
    });
  }, ALLOW_SEC);
  await sleep(1000);

  const site2 = await browser2.newPage();
  await site2.bringToFront();
  await site2
    .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => {});
  await waitUntil(async () => site2.url().startsWith(base2), { timeout: 10_000 });
  check("（フェーズ2）ブロックされる", site2.url().startsWith(base2), site2.url());

  const granted2 = await site2.evaluate(
    async (sec) =>
      await chrome.runtime.sendMessage({
        type: "TEMP_ALLOW",
        domain: "example.com",
        durationSec: sec,
      }),
    ALLOW_SEC,
  );
  const grantedAt2 = Date.now();
  await site2.goto("https://example.com/", {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  check(
    `（フェーズ2）一時許可（${ALLOW_SEC}秒）でサイトが開ける`,
    granted2?.ok === true && site2.url() === "https://example.com/",
    site2.url(),
  );

  // 以後、SW には一切触らない（触ると idle タイマーが延びる）
  console.log(`\n${ALLOW_SEC} 秒の失効を待機中（SW は idle 終了しているはず）…`);
  const backToBlocked2 = await waitUntil(async () => site2.url().startsWith(base2), {
    timeout: (ALLOW_SEC + 60) * 1000,
    interval: 1000,
  });
  const elapsed2 = Math.round((Date.now() - grantedAt2) / 1000);
  check(
    "SW が落ちていても失効後にタブがブロック画面へ戻る",
    backToBlocked2,
    backToBlocked2
      ? `${elapsed2} 秒後`
      : `${elapsed2} 秒待っても戻らなかった（URL: ${site2.url()}）`,
  );
  if (backToBlocked2) {
    check(
      "（フェーズ2）戻るタイミングが許可時間とほぼ一致する",
      elapsed2 >= ALLOW_SEC - 2 && elapsed2 <= ALLOW_SEC + 25,
      `${elapsed2} 秒（許可 ${ALLOW_SEC} 秒）`,
    );
  }
} finally {
  await browser2.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 件 成功`);
process.exit(failed.length === 0 ? 0 : 1);
