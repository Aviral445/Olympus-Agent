"use client";

import React from "react";
import { Activity, Clock, Zap, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import type { PipelineResult } from "@/lib/types";

interface TelemetryPanelProps {
  isRunning: boolean;
  result: PipelineResult;
  elapsedSeconds: number;
  attemptCount: number;
  maxAttempts: number;
  llmTier: string;        // "Groq" | "OpenRouter" | "Gemini" | ""
  logCount: number;
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const TIER_COLORS: Record<string, string> = {
  Groq:       "text-violet-400",
  OpenRouter: "text-amber-400",
  Gemini:     "text-sky-400",
};

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  isRunning,
  result,
  elapsedSeconds,
  attemptCount,
  maxAttempts,
  llmTier,
  logCount,
}) => {
  const progress = maxAttempts > 0 ? Math.min((attemptCount / maxAttempts) * 100, 100) : 0;

  return (
    <div
      className="rounded-xl border p-4 space-y-4"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-muted)" }}
    >
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4" style={{ color: "var(--indigo-light)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          Telemetry
        </span>
        {result && (
          <span className="ml-auto flex items-center gap-1 text-xs font-mono">
            {result === "PASS"
              ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">PASS</span></>
              : <><XCircle className="w-3.5 h-3.5 text-rose-400" /><span className="text-rose-400">FAIL</span></>
            }
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Elapsed */}
        <div className="rounded-lg p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Elapsed</span>
          </div>
          <p className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {isRunning || elapsedSeconds > 0 ? fmtTime(elapsedSeconds) : "—"}
          </p>
        </div>

        {/* Attempts */}
        <div className="rounded-lg p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <RefreshCw className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Attempts</span>
          </div>
          <p className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {attemptCount > 0 ? `${attemptCount} / ${maxAttempts}` : "—"}
          </p>
        </div>

        {/* LLM Tier */}
        <div className="rounded-lg p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>LLM Tier</span>
          </div>
          <p className={`text-sm font-mono font-bold ${TIER_COLORS[llmTier] ?? "text-slate-400"}`}>
            {llmTier || "—"}
          </p>
        </div>

        {/* Log Lines */}
        <div className="rounded-lg p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Log Lines</span>
          </div>
          <p className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {logCount > 0 ? logCount : "—"}
          </p>
        </div>
      </div>

      {/* Attempt progress bar */}
      {attemptCount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Repair Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: result === "PASS"
                  ? "var(--success)"
                  : result === "FAIL"
                  ? "var(--error)"
                  : "var(--indigo)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
