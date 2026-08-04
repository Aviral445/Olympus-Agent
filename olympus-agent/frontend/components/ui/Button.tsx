"use client";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "success";
type Size    = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: [
    "bg-[#C9B59C] hover:bg-[#B8A287] active:bg-[#A89277]",
    "text-[#1F1A17] font-semibold shadow-md shadow-[#C9B59C]/25",
    "border border-[#B8A287]",
    "disabled:bg-[#E5DDD5] disabled:text-[#A89C90] disabled:border-[#D9CFC7] disabled:shadow-none",
  ].join(" "),
  ghost: [
    "bg-[#EFE9E3] hover:bg-[#E5DDD5] active:bg-[#D9CFC7]",
    "text-[#2C2621] hover:text-[#1F1A17]",
    "border border-[#D9CFC7] hover:border-[#C9B59C]",
  ].join(" "),
  danger: [
    "bg-[#FDF0EE] hover:bg-[#FBE0DC] active:bg-[#F7CFC8]",
    "text-[#B84A39] hover:text-[#993728]",
    "border border-[#F0B8B0]",
  ].join(" "),
  success: [
    "bg-[#F0F5F1] hover:bg-[#E1EDE4]",
    "text-[#4A7C59]",
    "border border-[#B5D6BE]",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B59C]",
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
