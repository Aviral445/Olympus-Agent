"use client";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "success";
type Size    = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: [
    "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700",
    "text-white shadow-lg shadow-indigo-600/20",
    "border border-indigo-500/50",
    "disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 disabled:shadow-none",
  ].join(" "),
  ghost: [
    "bg-transparent hover:bg-white/5 active:bg-white/10",
    "text-slate-300 hover:text-slate-100",
    "border border-slate-700/60 hover:border-slate-600",
  ].join(" "),
  danger: [
    "bg-rose-900/40 hover:bg-rose-800/60 active:bg-rose-900/80",
    "text-rose-400 hover:text-rose-300",
    "border border-rose-700/50 hover:border-rose-600/70",
  ].join(" "),
  success: [
    "bg-emerald-900/40 hover:bg-emerald-800/60",
    "text-emerald-400 hover:text-emerald-300",
    "border border-emerald-700/50",
  ].join(" "),
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3   text-base gap-2.5",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-lg",
        "transition-all duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
