// UI 挙動の E2E: テーマ切替 / カテゴリ一括解除 / 削除の取り消し（ダイアログなし）/
// ブロック画面からのポモドーロ時間切り替え。
// 使い方: npm run build && CHROME_BIN=<Chrome for Testing> node scripts/e2e-ui.mjs
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

/**
 * ページ内で element.click() を直接呼ぶ。
 * puppeteer の page.click() は要素の可視判定に IntersectionObserver を使うため、
 * 描画フレームが出ない環境（ヘッドレスの一部・背面タブ）では返ってこない。
 * ここで見たいのは配線が正しいかどうかなので、DOM 経由で叩く。
 */
async function clickXPath(page, xpath) {
  const clicked = await page.evaluate((x) => {
    const node = document.evaluate(
      x,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue;
    if (node === null) return false;
    node.click();
    return true;
  }, xpath);
  if (!clicked) throw new Error(`要素が見つかりません: ${xpath}`);
  await sleep(400);
}

async function clickSelector(page, selector) {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) return false;
    el.click();
    return true;
  }, selector);
  if (!clicked) throw new Error(`要素が見つかりません: ${selector}`);
  await sleep(400);
}

/** page.waitForFunction は既定で raf ポーリングのため、描画が止まる環境では返らない */
async function waitUntil(fn, { timeout = 15_000, interval = 500 } = {}) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - start > timeout) return false;
    await sleep(interval);
  }
}

const hasXPath = (page, xpath) =>
  page.evaluate(
    (x) =>
      document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue !== null,
    xpath,
  );

const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: true,
  protocolTimeout: 60_000,
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
  ],
});

const settingsOf = (page) =>
  page.evaluate(async () => (await chrome.storage.local.get("settings")).settings);

try {
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    { timeout: 15_000 },
  );
  const base = `chrome-extension://${new URL(swTarget.url()).host}`;

  const options = await browser.newPage();
  await options.bringToFront();
  await options.goto(`${base}/options.html`, { waitUntil: "load" });
  await options.evaluate(() => chrome.storage.local.clear());
  await options.reload({ waitUntil: "load" });
  await sleep(400);

  // ---- テーマ切替 ----
  const themeXPath = (label) =>
    `//fieldset[@aria-label="配色テーマ"]//button[contains(., '${label}')]`;

  await clickXPath(options, themeXPath("ライト"));
  check(
    "テーマ「ライト」を選ぶと data-theme が light になる",
    (await options.evaluate(() => document.documentElement.dataset.theme)) === "light",
  );
  check(
    "テーマ設定が storage に保存される",
    (await settingsOf(options)).theme === "light",
  );

  await clickXPath(options, themeXPath("ダーク"));
  check(
    "テーマ「ダーク」に切り替わる",
    (await options.evaluate(() => document.documentElement.dataset.theme)) === "dark",
  );

  // 再読み込みしても（storage の読み込みを待たずに）ダークのまま
  await options.reload({ waitUntil: "load" });
  await sleep(400);
  check(
    "再読み込み後もダークが維持される",
    (await options.evaluate(() => document.documentElement.dataset.theme)) === "dark",
  );

  // 別サーフェス（ブロック画面）にも同じテーマが適用される
  const blocked = await browser.newPage();
  await blocked.bringToFront();
  await blocked.goto(`${base}/blocked.html#u=https://www.youtube.com/watch?v=abc`, {
    waitUntil: "load",
  });
  await sleep(600);
  check(
    "ブロック画面にも同じテーマが適用される",
    (await blocked.evaluate(() => document.documentElement.dataset.theme)) === "dark",
  );
  const bg = await blocked.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  check("ダーク時の背景が暗い色になっている", bg === "rgb(14, 17, 22)", bg);

  await options.bringToFront();
  await clickXPath(options, themeXPath("ライト"));
  await blocked.bringToFront();
  await sleep(400);
  const lightBg = await blocked.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  check(
    "ライトに切り替えると開いているブロック画面も追従する",
    lightBg === "rgb(255, 255, 255)",
    lightBg,
  );

  // ---- カテゴリの一括登録 → 一括解除 → 取り消し ----
  await options.bringToFront();
  await sleep(200);
  await clickXPath(options, "//li[contains(., 'SNS')]//button[contains(., '追加')]");
  const afterAdd = (await settingsOf(options)).rules.length;
  check("カテゴリ SNS を一括登録できる", afterAdd === 7, `${afterAdd} 件`);

  await clickXPath(
    options,
    "//li[contains(., 'SNS')]//button[contains(., 'まとめて解除')]",
  );
  const afterRemove = (await settingsOf(options)).rules.length;
  check("カテゴリ SNS をまとめて解除できる", afterRemove === 0, `${afterRemove} 件`);

  check(
    "一括解除の直後に「元に戻す」が出る",
    await hasXPath(options, "//button[contains(., '元に戻す')]"),
  );
  await clickXPath(options, "//button[contains(., '元に戻す')]");
  const afterUndo = (await settingsOf(options)).rules.length;
  check("「元に戻す」で 7 件が復活する", afterUndo === 7, `${afterUndo} 件`);

  // ---- 1 件削除: 確認ダイアログを出さず、取り消せる ----
  await clickSelector(options, '[aria-label="x.com を削除"]');
  const dialogCount = await options.evaluate(
    () => document.querySelectorAll('[role="dialog"]').length,
  );
  check("削除で確認ダイアログが出ない", dialogCount === 0, `${dialogCount} 個`);
  const afterDelete = (await settingsOf(options)).rules;
  check(
    "削除が即時反映される",
    afterDelete.length === 6 && !afterDelete.some((r) => r.domain === "x.com"),
    `${afterDelete.length} 件`,
  );

  check(
    "1 件削除にも「元に戻す」が出る",
    await hasXPath(options, "//button[contains(., '元に戻す')]"),
  );
  await clickXPath(options, "//button[contains(., '元に戻す')]");
  const restored = (await settingsOf(options)).rules;
  check(
    "削除を取り消すと元のルールが戻る",
    restored.length === 7 && restored.some((r) => r.domain === "x.com"),
    `${restored.length} 件`,
  );

  // ---- 理由の入力に明示的な保存がある ----
  await clickSelector(options, '[aria-label="x.com を編集"]');
  check(
    "編集を開くと保存ボタンが出る（未入力時は無効）",
    await options.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "保存",
      );
      return btn?.disabled === true;
    }),
  );

  // React の制御コンポーネントに値を入れる（ネイティブ setter + input イベント）
  await options.evaluate(() => {
    const input = document.querySelector('[aria-label="x.com をブロックする理由"]');
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "だらだら見てしまうから");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(300);
  check(
    "入力すると保存ボタンが有効になる",
    await options.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "保存",
      );
      return btn?.disabled === false;
    }),
  );

  await clickXPath(options, "//button[normalize-space(.)='保存']");
  const savedReason = (await settingsOf(options)).rules.find(
    (r) => r.domain === "x.com",
  )?.reason;
  check(
    "保存ボタンで理由が保存される",
    savedReason === "だらだら見てしまうから",
    String(savedReason),
  );
  check(
    "保存されたことが画面に出る",
    await options.evaluate(() => document.body.innerText.includes("保存しました")),
  );

  // ---- ルール追加時、すでに開いているタブもブロックされる ----
  const openTab = await browser.newPage();
  await openTab.bringToFront();
  await openTab
    .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => {});
  check(
    "未ブロックのサイトは普通に開ける",
    openTab.url() === "https://example.com/",
    openTab.url(),
  );

  // 開いたままの状態でルールを追加する（UI からの追加と同じく storage 経由）
  await options.bringToFront();
  await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get("settings");
    settings.rules.push({
      id: crypto.randomUUID(),
      dnrId: settings.nextDnrId,
      type: "domain",
      domain: "example.com",
      enabled: true,
      createdAt: Date.now(),
      timing: "always",
    });
    settings.nextDnrId += 1;
    await chrome.storage.local.set({ settings });
  });
  const swept = await waitUntil(async () => openTab.url().startsWith(base), {
    timeout: 15_000,
  });
  check("ルール追加でタブがブロック画面へ送り返される", swept, openTab.url());
  await openTab.close();

  // ---- ブロック画面でポモドーロの作業時間を切り替える ----
  await blocked.bringToFront();
  await blocked.reload({ waitUntil: "load" });
  await sleep(600);
  await clickXPath(
    blocked,
    "//fieldset[@aria-label='作業時間を選ぶ']//button[normalize-space(.)='45分']",
  );
  const workMin = (await settingsOf(blocked)).widgets.pomodoro.workMin;
  check("ブロック画面から作業時間を 45 分に変えられる", workMin === 45, `${workMin} 分`);
  const clock = await blocked.evaluate(() => document.body.textContent.includes("45:00"));
  check("タイマー表示が 45:00 に更新される", clock);
  const cycleText = await blocked.evaluate(() =>
    document.body.textContent.includes("45分 作業して 5分 休憩します"),
  );
  check("作業と休憩の組み合わせが説明される", cycleText);

  // ---- やること: 並べ替えと名前変更 ----
  const todosOf = (page) =>
    page.evaluate(async () => (await chrome.storage.local.get("todos")).todos ?? []);

  await blocked.bringToFront();
  await blocked.evaluate(async () => {
    await chrome.storage.local.set({
      todos: ["レポート", "経費精算", "メール返信", "資料作成", "打ち合わせ準備"].map(
        (text, i) => ({ id: `t${i}`, text, done: false, createdAt: i }),
      ),
    });
  });
  await blocked.reload({ waitUntil: "load" });
  await sleep(700);

  // HTML5 のドラッグ&ドロップ。dragstart で React の state が変わるので、
  // 再レンダーを挟まないと dragover のハンドラが古い state を見てしまう
  async function dragTodo(page, fromText, toText) {
    await page.evaluate((from) => {
      const src = [...document.querySelectorAll("main li")].find((el) =>
        el.textContent.includes(from),
      );
      window.__dt = new DataTransfer();
      src.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: window.__dt,
        }),
      );
    }, fromText);
    await sleep(200);
    await page.evaluate((to) => {
      const dst = [...document.querySelectorAll("main li")].find((el) =>
        el.textContent.includes(to),
      );
      dst.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: window.__dt,
        }),
      );
    }, toText);
    // dragover が並びを更新する。drop を同じタスクで撃つと、drop のハンドラが
    // 再レンダー前の古い並びを掴んでしまう（実ブラウザでは別タスクになる）
    await sleep(200);
    await page.evaluate((to) => {
      const dst = [...document.querySelectorAll("main li")].find((el) =>
        el.textContent.includes(to),
      );
      dst.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: window.__dt,
        }),
      );
    }, toText);
    await sleep(400);
  }

  await dragTodo(blocked, "打ち合わせ準備", "レポート");
  const dragged = (await todosOf(blocked)).map((t) => t.text);
  check(
    "ドラッグでやることを先頭へ並べ替えられる",
    dragged[0] === "打ち合わせ準備",
    dragged.join(" / "),
  );

  await dragTodo(blocked, "打ち合わせ準備", "メール返信");
  const dragged2 = (await todosOf(blocked)).map((t) => t.text);
  check(
    "ドラッグで途中の位置へも動かせる",
    dragged2.indexOf("打ち合わせ準備") === dragged2.indexOf("メール返信") + 1 ||
      dragged2.indexOf("打ち合わせ準備") === dragged2.indexOf("メール返信") - 1,
    dragged2.join(" / "),
  );

  // つまみにフォーカスした状態の ↑↓ キーでも動かせる（キーボード操作）
  const beforeKey = (await todosOf(blocked)).map((t) => t.text);
  await blocked.evaluate(() => {
    const items = [...document.querySelectorAll("main li")];
    const grip = items[2].querySelector('[aria-label$="を並べ替え"]');
    grip.focus();
    grip.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
    );
  });
  await sleep(400);
  const afterKey = (await todosOf(blocked)).map((t) => t.text);
  check(
    "↑ キーでも並べ替えられる",
    afterKey[1] === beforeKey[2] && afterKey[2] === beforeKey[1],
    `${beforeKey.slice(0, 3).join(" / ")} → ${afterKey.slice(0, 3).join(" / ")}`,
  );

  await clickSelector(blocked, 'button[aria-label="メール返信 の名前を変更"]');
  await sleep(200);
  check(
    "項目をクリックすると入力欄になる",
    await blocked.evaluate(
      () =>
        document.querySelector('input[aria-label="メール返信 の名前を変更"]') !== null,
    ),
  );
  await blocked.evaluate((newText) => {
    const input = document.querySelector('input[aria-label="メール返信 の名前を変更"]');
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, newText);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }, "メールを3件返す");
  await sleep(400);
  const renamed = (await todosOf(blocked)).map((t) => t.text);
  check(
    "Enter で名前を変更できる",
    renamed.includes("メールを3件返す") && !renamed.includes("メール返信"),
    renamed.join(" / "),
  );

  // ---- レイアウト: やることの行が左端で揃っている ----
  // 「いま最優先」の行だけ負のマージンでずらすと、他の行と字下げが合わず、
  // さらにスクロール領域（overflow-y-auto）が左にはみ出した罫線を切り落とす
  const rowLefts = await blocked.evaluate(() =>
    [...document.querySelectorAll('main li input[type="checkbox"]')].map((el) =>
      Math.round(el.getBoundingClientRect().left),
    ),
  );
  check(
    "やることの行が左端で揃っている",
    new Set(rowLefts).size === 1,
    `左端: ${[...new Set(rowLefts)].join(", ")}px`,
  );
  check(
    "「いま最優先」の目印がスクロール領域に切り取られていない",
    await blocked.evaluate(() => {
      const ul = document.querySelector("main li")?.parentElement;
      const top = ul?.children[0];
      if (ul === undefined || ul === null || top === undefined) return false;
      const style = getComputedStyle(top);
      const visible = style.borderLeftColor !== "rgba(0, 0, 0, 0)";
      return (
        visible && top.getBoundingClientRect().left >= ul.getBoundingClientRect().left - 1
      );
    }),
  );
  check(
    "やることリストが横にはみ出していない（罫線が切れない）",
    await blocked.evaluate(() => {
      const ul = document.querySelector("main li")?.parentElement;
      return ul !== null && ul !== undefined && ul.scrollWidth <= ul.clientWidth + 1;
    }),
  );

  // ---- レイアウト: やることが増えてもタイマーカードが引き伸ばされない ----
  const cardHeights = await blocked.evaluate(() => {
    const grid = document.querySelector("main div.grid");
    return [...(grid?.children ?? [])].map((el) =>
      Math.round(el.getBoundingClientRect().height),
    );
  });
  check(
    "やることが増えてもタイマーカードが縦に引き伸ばされない",
    cardHeights.length === 2 && cardHeights[0] > cardHeights[1],
    `やること ${cardHeights[0]}px / タイマー ${cardHeights[1]}px`,
  );

  // ---- レイアウト: ボタンのラベルが途中で折り返さない ----
  // 日本語は任意の文字位置で改行できるので、flex で縮むと「ライ／ト」のように割れる
  const wrappedLabels = await options.evaluate(() =>
    [...document.querySelectorAll("button")]
      .map((btn) => {
        const textNode = [...btn.childNodes].find(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "",
        );
        if (textNode === undefined) return null;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        return range.getClientRects().length > 1 ? textNode.textContent.trim() : null;
      })
      .filter((v) => v !== null),
  );
  check(
    "ボタンのラベルが途中で折り返していない",
    wrappedLabels.length === 0,
    wrappedLabels.join(" / "),
  );
  check(
    "サイドバーからはみ出していない",
    await options.evaluate(() => {
      const aside = document.querySelector("aside");
      return aside !== null && aside.scrollWidth <= aside.clientWidth + 1;
    }),
  );

  // ---- レイアウト: どの画面でも横スクロールが出ない ----
  const noOverflow = (page) =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
  check("ブロック画面が横にはみ出さない", await noOverflow(blocked));
  await options.bringToFront();
  await sleep(200);
  check("設定画面が横にはみ出さない", await noOverflow(options));

  // 長い URL のページを開いている状態を再現する（popup は実ポップアップとして
  // 開けないため、アクティブタブの照会だけ差し替える）
  const LONG_URL =
    "https://catalog.example.org/electronics/audio/headphones/wireless/model-x9000/reviews/";
  const popup = await browser.newPage();
  await popup.bringToFront();
  await popup.setViewport({ width: 400, height: 600 });
  await popup.evaluateOnNewDocument((tabUrl) => {
    const original = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (info) =>
      info?.active === true
        ? Promise.resolve([{ id: 999, url: tabUrl, active: true }])
        : original(info);
  }, LONG_URL);
  await popup.goto(`${base}/popup.html`, { waitUntil: "load" });
  await sleep(700);
  check(
    "ポップアップが描画されている",
    (await popup.evaluate(() => document.body.innerText.trim().length)) > 0,
  );
  check(
    "長い URL でもブロック範囲の選択肢が出る",
    await popup.evaluate(() => document.body.innerText.includes("ブロックする範囲")),
  );
  check("長い URL でもポップアップが横にはみ出さない", await noOverflow(popup));
  // fieldset は min-inline-size: min-content が既定なので、長いパスがあると
  // 親を押し広げて popup の幅を突き破る（実際に起きた不具合）
  const widest = await popup.evaluate(() => {
    const bodyWidth = document.body.clientWidth;
    const overflowing = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > bodyWidth + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 30)}`);
    return overflowing.slice(0, 3);
  });
  check(
    "ポップアップ内に幅を突き破る要素がない",
    widest.length === 0,
    widest.join(" / "),
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 件 成功`);
process.exit(failed.length === 0 ? 0 : 1);
