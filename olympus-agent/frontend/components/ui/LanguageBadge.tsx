"use client";

import React from "react";

// Language metadata — contrast-tuned for light warm backgrounds
const LANG_META: Record<string, { label: string; emoji: string; bg: string; text: string; border: string }> = {
  python:     { label: "Python",     emoji: "🐍", bg: "rgba(37,99,235,0.12)",  text: "#1D4ED8", border: "rgba(37,99,235,0.3)"  },
  javascript: { label: "JavaScript", emoji: "⚡", bg: "rgba(217,119,6,0.12)",  text: "#B45309", border: "rgba(217,119,6,0.35)" },
  typescript: { label: "TypeScript", emoji: "🔷", bg: "rgba(29,78,216,0.12)",  text: "#1E40AF", border: "rgba(29,78,216,0.35)" },
  go:         { label: "Go",         emoji: "🐹", bg: "rgba(14,116,144,0.12)", text: "#0E7490", border: "rgba(14,116,144,0.35)" },
  java:       { label: "Java",       emoji: "☕", bg: "rgba(194,65,12,0.12)",  text: "#C2410C", border: "rgba(194,65,12,0.35)" },
  rust:       { label: "Rust",       emoji: "🦀", bg: "rgba(185,28,28,0.12)",  text: "#B91C1C", border: "rgba(185,28,28,0.35)"  },
  ruby:       { label: "Ruby",       emoji: "💎", bg: "rgba(190,18,60,0.12)",  text: "#BE123C", border: "rgba(190,18,60,0.3)"   },
  cpp:        { label: "C++",        emoji: "⚙️",  bg: "rgba(109,40,217,0.12)", text: "#6D28D9", border: "rgba(109,40,217,0.3)"  },
  c:          { label: "C",          emoji: "🔩", bg: "rgba(55,65,81,0.12)",   text: "#374151", border: "rgba(55,65,81,0.3)" },
};

const FALLBACK = { label: "Unknown", emoji: "📄", bg: "rgba(140,192,235,0.2)", text: "#1E40AF", border: "rgba(140,192,235,0.4)" };

interface LanguageBadgeProps {
  /** Language string as returned by the backend (e.g. "python", "go") */
  lang: string;
  /** Show full label + emoji (default) or emoji-only compact mode */
  compact?: boolean;
  className?: string;
}

export const LanguageBadge: React.FC<LanguageBadgeProps> = ({ lang, compact = false, className = "" }) => {
  const normalised = lang?.toLowerCase().trim() ?? "";
  const meta = LANG_META[normalised] ?? FALLBACK;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-mono text-[10px] font-semibold ${className}`}
      style={{
        background:   meta.bg,
        color:        meta.text,
        border:       `1px solid ${meta.border}`,
        padding:      compact ? "1px 6px" : "2px 8px",
        letterSpacing: "0.02em",
        whiteSpace:   "nowrap",
      }}
      title={meta.label}
    >
      <span>{meta.emoji}</span>
      {!compact && <span>{meta.label}</span>}
    </span>
  );
};
