import { type ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  /** フッターの操作ボタン列 */
  footer: ReactNode;
  onClose: () => void;
}

/**
 * 引き返せない操作（厳格モードの解除・バックアップの上書き）にだけ使う。
 * 取り消せる操作の確認には使わない（Toast の「元に戻す」を使う）。
 */
export const Modal = ({ open, title, children, footer, onClose }: Props) => {
  // キーボード操作は Escape で閉じられるようにする
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 背景クリックはマウス用の補助動線。キーボードは Escape で閉じられる
    // biome-ignore lint/a11y/noStaticElementInteractions: モーダルの背景オーバーレイ（装飾要素）に対する慣用的なパターン
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: クリックの伝播停止のみでインタラクションではない */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        <div className="text-sm text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
};
