"use client";

import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";

export const inputClass =
  "w-full rounded-lg border border-line bg-raised px-3 text-[14px] text-ink placeholder:text-ink-3/80 shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] outline-none transition-[border,box-shadow] hover:border-line-2 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] disabled:opacity-60 aria-[invalid=true]:border-danger";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; icon?: ReactNode };

export function Input({ className, icon, ref, ...props }: InputProps) {
  if (!icon) return <input ref={ref} className={cn(inputClass, "h-9.5", className)} {...props} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 [&_svg]:size-4">{icon}</span>
      <input ref={ref} className={cn(inputClass, "h-9.5 pl-9", className)} {...props} />
    </div>
  );
}

export function PasswordInput({ className, icon, ref, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 [&_svg]:size-4">{icon}</span>}
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(inputClass, "h-9.5 pr-10", icon && "pl-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Textarea({ className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(inputClass, "min-h-20 resize-y py-2", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  action,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}
