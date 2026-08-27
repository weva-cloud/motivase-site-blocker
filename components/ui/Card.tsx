import type { HTMLAttributes, ReactNode } from "react";

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  /** タイトル行の右側に置く要素（トグル等） */
  action?: ReactNode;
}

/**
 * 面は 1 段まで。カードの中にカードを置かない（入れ子は罫線と余白で表現する）。
 */
export const Card = ({ title, action, className = "", children, ...props }: Props) => {
  return (
    <section className={`card p-5 ${className}`} {...props}>
      {(title !== undefined || action !== undefined) && (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          {title !== undefined && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
};

/** カードを使わない見出し（罫線で区切るセクション用） */
export const SectionLabel = ({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) => {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
};
