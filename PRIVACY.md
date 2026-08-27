# プライバシーポリシー — Motivase Site Blocker

最終更新: 2026-08-25

## 結論

**この拡張機能は、利用者のデータを一切収集・送信しません。** すべてのデータは
利用者自身の端末の Chrome 内にのみ保存されます。開発者を含め、第三者がその内容を
見ることはできません。

## 保存するデータと保存場所

| データ | 保存場所 | 消えるタイミング |
| --- | --- | --- |
| ブロックルール（ドメイン・パス・ブロックする理由） | `chrome.storage.local` | 拡張機能を削除したとき |
| やることリスト | `chrome.storage.local` | 同上 |
| 利用統計（日ごとのブロック回数・一時許可の合計時間・ポモドーロ完了数） | `chrome.storage.local` | 同上 |
| 一時許可の履歴（開いた理由として入力した文章・最大200件） | `chrome.storage.local` | 同上 |
| 各種設定（スケジュール・テーマ・ポモドーロの分数など） | `chrome.storage.local` | 同上 |
| 有効な一時許可 | `chrome.storage.session` | ブラウザを終了したとき |

これらはすべて利用者の端末内に留まります。同期ストレージ（`chrome.storage.sync`）は
使用していないため、他の端末へ送信されることもありません。

## 行わないこと

- 外部サーバーへの通信（送信・取得のいずれも行いません。拡張機能のコードに、外部の
  ホストへアクセスする処理は含まれていません。なお、バンドルにはビルドツールが生成した
  モジュール読み込み用の `fetch` が 1 箇所含まれますが、読み込み先は拡張機能自身の
  パッケージ内ファイルに限られます）
- アクセス解析・トラッキング・広告
- 閲覧履歴の記録（訪問したページの URL を保存することはありません。統計として
  記録するのは「ブロックが発生した回数」と、その対象として登録済みのドメイン名だけです）
- リモートコードの読み込み・実行（すべてのコードはパッケージに同梱されています）
- データの販売・第三者提供

## 権限を必要とする理由

| 権限 | 理由 |
| --- | --- |
| `declarativeNetRequest` | 登録されたサイトをネットワークレベルでブロックするため。ルールはブラウザ内で評価され、閲覧内容が拡張機能に渡されることはありません |
| `host_permissions` (`http://*/*`, `https://*/*`) | ブロック対象は利用者が任意に指定するため、対象サイトを事前に列挙できません。ページの内容の読み取りには使用しません |
| `tabs` | 一時許可の失効時やルール追加時に、開いているタブをブロック画面へ切り替えるため |
| `storage` | 上記のデータを端末内に保存するため |
| `alarms` | 一時許可の失効・スケジュールの境界・ポモドーロの計測に使用 |
| `notifications` | ポモドーロ完了と週次振り返りの通知に使用 |
| `contextMenus` | 右クリックメニューからのブロック登録に使用 |
| `favicon` | サイトのアイコン表示に使用。Chrome 内蔵のアイコンを参照するもので、外部サービスへ URL を送信しません |

## データの確認・持ち出し・削除

- **確認と持ち出し**: 設定画面の「バックアップ」から、保存されている内容を JSON
  ファイルとして書き出せます
- **削除**: Chrome の拡張機能管理画面（`chrome://extensions`）からこの拡張機能を
  削除すると、保存データもすべて削除されます

## 変更について

このポリシーを変更した場合は、本ファイルの更新履歴（Git のコミット履歴）に残ります。

## お問い合わせ

本ポリシーおよび本拡張機能に関するお問い合わせは、本リポジトリの Issues からお願いします。

---

# Privacy Policy — Motivase Site Blocker

**This extension does not collect or transmit any user data.** Everything it stores —
block rules, to-do items, usage statistics, and settings — is kept locally in Chrome on
the user's own device via `chrome.storage.local` (and `chrome.storage.session` for
temporary allowances, which is cleared when the browser closes). No synced storage, no
analytics, no remote code, and no requests to external servers. (The bundle contains one
build-tool-generated `fetch` for module preloading; it only loads files inside the
extension package.) Site icons come from Chrome's built-in favicon API, so no URLs are
sent to any external service.

Uninstalling the extension from `chrome://extensions` deletes all stored data. Users can
export their data as JSON from the Backup section of the options page.

Contact: please open an issue in this repository.
