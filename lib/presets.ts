// 日本のユーザー向けカテゴリプリセット。
// ワンクリックで一括登録でき、グループ単位で ON/OFF できる。
export interface Preset {
  id: string;
  label: string;
  domains: string[];
}

export const PRESETS: Preset[] = [
  {
    id: "sns",
    label: "SNS",
    domains: [
      "x.com",
      "twitter.com",
      "instagram.com",
      "tiktok.com",
      "facebook.com",
      "threads.net",
      "bsky.app",
    ],
  },
  {
    id: "video",
    label: "動画",
    domains: ["youtube.com", "nicovideo.jp", "abema.tv", "twitch.tv", "netflix.com"],
  },
  {
    id: "matome",
    label: "まとめ・掲示板",
    domains: [
      "5ch.net",
      "open2ch.net",
      "togetter.com",
      "b.hatena.ne.jp",
      "girlschannel.net",
    ],
  },
  {
    id: "news",
    label: "ネットニュース",
    domains: ["news.yahoo.co.jp", "news.livedoor.com", "news.goo.ne.jp", "nordot.app"],
  },
  {
    id: "shopping",
    label: "ショッピング",
    domains: ["amazon.co.jp", "rakuten.co.jp", "mercari.com", "shopping.yahoo.co.jp"],
  },
];
