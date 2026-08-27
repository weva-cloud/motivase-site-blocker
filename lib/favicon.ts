// サイトの favicon 表示用 URL を組み立てる。
// "favicon" 権限による拡張内 _favicon API を使う（外部サービスに
// ブロックリストの内容を送らないため & オフラインでも動くため）。

export function faviconUrlForPage(pageUrl: string, size = 32): string {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString();
}

export function faviconUrlForDomain(domain: string, size = 32): string {
  return faviconUrlForPage(`https://${domain}/`, size);
}
