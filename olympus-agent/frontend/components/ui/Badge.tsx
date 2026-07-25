"use client";
import { clsx } from "clsx";

type Variant = "pass" | "fail" | "running" | "idle" | "warn" | "info";

const styles: Record<Variant, string> = {
  pass:    "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30",
  fail:    "bg-rose-950/60    text-rose-400    border border-rose-500/30",
  running: "bg-indigo-950/60  text-indigo-300  border border-indigo-500/30",
  idle:    "bg-slate-900/60   text-slate-400   border border-slate-700/40",
  warn:    "bg-amber-950/60   text-amber-400   border border-amber-500/30",
  info:    "bg-sky-950/60     text-sky-400     border border-sky-500/30",
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
