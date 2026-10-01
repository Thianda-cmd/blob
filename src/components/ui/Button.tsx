import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, Ref } from "react";

type Variant = "primary" | "blob" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/88 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]",
  blob: "bg-blob text-white hover:bg-blob-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.1)]",
  secondary: "bg-raised text-ink border border-line hover:border-line-2 hover:bg-hover/60 shadow-card",
  ghost: "text-ink-2 hover:text-ink hover:bg-hover",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const sizes: Record<Size, string> = {
  xs: "h-6 px-2 text-[12px] gap-1 rounded-md",
  sm: "h-7 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-8.5 px-3.5 text-[13.5px] gap-2 rounded-lg",
  lg: "h-10 px-4.5 text-[14.5px] gap-2 rounded-xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({ variant = "secondary", size = "md", loading, className, children, disabled, ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,border,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-[inherit]", loading && "opacity-0")}>{children}</span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-current"
                style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }}
              />
            ))}
          </span>
        </span>
      )}
    </button>
  );
}

export function IconButton({
  className,
  label,
  size = "sm",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "xs" | "sm" | "md"; ref?: Ref<HTMLButtonElement> }) {
  const s = size === "xs" ? "size-6 rounded-md" : size === "sm" ? "size-7 rounded-lg" : "size-8.5 rounded-lg";
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid shrink-0 place-items-center text-ink-3 transition-colors hover:bg-hover hover:text-ink active:scale-95 disabled:opacity-40",
        s,
        className,
      )}
      {...props}
    />
  );
}
