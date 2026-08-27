import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

/**
 * アクセント（アンバー）を使うのは primary だけ。
 * 1 画面に primary は 1 つまで、が引き算ミニマルのルール。
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent-500 font-semibold text-night-950 hover:bg-accent-400 active:bg-accent-600",
  ghost: "border hairline hover:bg-black/[0.04] dark:hover:bg-white/[0.07]",
  danger: "text-red-600 hover:bg-red-500/10 dark:text-red-400",
  quiet: "text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.07]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg",
  md: "px-3.5 py-2 text-sm rounded-lg",
  lg: "px-5 py-2.5 text-sm rounded-xl",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = ({
  variant = "ghost",
  size = "md",
  className = "",
  type = "button",
  ...props
}: Props) => {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
};
