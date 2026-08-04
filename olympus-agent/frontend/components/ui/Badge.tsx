"use client";
import { clsx } from "clsx";

type Variant = "pass" | "fail" | "running" | "idle" | "warn" | "info";

const styles: Record<Variant, string> = {
  pass:    "bg-[#F0F5F1] text-[#4A7C59] border border-[#B5D6BE]",
  fail:    "bg-[#FDF0EE] text-[#B84A39] border border-[#F0B8B0]",
  running: "bg-[#EFE9E3] text-[#8A6D47] border border-[#C9B59C]",
  idle:    "bg-[#EFE9E3] text-[#5C5248] border border-[#D9CFC7]",
  warn:    "bg-[#FFF8EE] text-[#C48228] border border-[#EACD9B]",
  info:    "bg-[#F5F2EE] text-[#5C5248] border border-[#D9CFC7]",
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export function Badge({ variant = "idle", children, className, pulse }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold",
        styles[variant],
        pulse && variant === "running" && "animate-pulse",
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
