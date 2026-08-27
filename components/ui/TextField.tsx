import type { InputHTMLAttributes } from "react";

export const TextField = ({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      className={`w-full rounded-lg border hairline bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent-500/70 ${className}`}
      {...props}
    />
  );
};
