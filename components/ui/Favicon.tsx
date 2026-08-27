import { useState } from "react";
import { faviconUrlForDomain, faviconUrlForPage } from "@/lib/favicon";

const AVATAR_COLORS = [
  "bg-amber-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

interface Props {
  domain: string;
  /** あればページ単位の favicon を引く（popup では tab.favIconUrl を渡す） */
  src?: string;
  size?: number;
  className?: string;
}

/** サイトの favicon。取得できないときは頭文字アバターにフォールバック */
export const Favicon = ({ domain, src, size = 24, className = "" }: Props) => {
  const [failed, setFailed] = useState(false);

  if (failed || domain === "") {
    const char = (domain[0] ?? "?").toUpperCase();
    const color =
      AVATAR_COLORS[
        [...domain].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
      ];
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white ${color} ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-hidden="true"
      >
        {char}
      </span>
    );
  }

  const url =
    src ??
    (domain.includes("/")
      ? faviconUrlForPage(`https://${domain}`, size * 2)
      : faviconUrlForDomain(domain, size * 2));

  return (
    <img
      src={url}
      width={size}
      height={size}
      alt=""
      className={`shrink-0 rounded-md ${className}`}
      onError={() => setFailed(true)}
    />
  );
};
