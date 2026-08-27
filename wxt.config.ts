import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "ja",
    minimum_chrome_version: "120",
    permissions: [
      "declarativeNetRequest",
      // popup がブロック画面（chrome-extension:// の自ページ）の URL を
      // 読むには host_permissions では足りず tabs 権限が必要
      "tabs",
      "storage",
      "alarms",
      "notifications",
      "contextMenus",
      "favicon",
    ],
    host_permissions: ["http://*/*", "https://*/*"],
    web_accessible_resources: [
      // DNR の redirect 先に指定するページは web_accessible でなければならない
      { resources: ["blocked.html"], matches: ["http://*/*", "https://*/*"] },
    ],
    commands: {
      "block-current-site": {
        // suggested_key はあえて指定しない。Chrome 本体や他の拡張機能と衝突すると
        // エラーも出さずに未割り当てになるうえ、インストール後にマニフェストを
        // 変更しても再割り当てされないため、黙って効かない状態が生まれる。
        // 宣言だけ残せば chrome://extensions/shortcuts に項目が出るので、
        // 必要な利用者が自分で好きなキーを設定できる。
        description: "このサイトをブロック",
      },
    },
  },
});
