"use client";

import React from "react";
import { clsx } from "clsx";
import {
  CheckCircle2, Circle, Loader2, XCircle,
  ShieldCheck, GitPullRequest, Code2, Cpu, RefreshCw, Globe2,
} from "lucide-react";
import { LanguageBadge } from "@/components/ui/LanguageBadge";
import type { NodeStatus } from "@/lib/types";

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  id: number;
  title: string;
  desc: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  {
    id: 0,
    title: "Language Detection",
    desc: "Heuristic manifest scan → extension frequency → primary language identified",
    icon: Globe2,
  },
  {
    id: 1,
    title: "RAG Indexing & Patch Agent",
    desc: "Tree-sitter AST chunking → semantic retrieval → LLM patch generation",
    icon: Cpu,
  },
  {
    id: 2,
    title: "SAST Gate & Sandbox Validation",
    desc: "Language-aware Semgrep scan → runner-specific Docker test isolation",
    icon: ShieldCheck,
  },
  {
    id: 3,
    title: "Git Manager & Sigstore Attestation",
    desc: "Branch creation → commit → cryptographic diff signing",
    icon: Code2,
  },
  {
    id: 4,
    title: "GitHub PR Delivery",
    desc: "Push verified patch branch → open Pull Request automatically",
    icon: GitPullRequest,
  },
];

// ─── Node status helper ───────────────────────────────────────────────────────

function nodeStatus(stepId: number, activeStep: number, failed: boolean): NodeStatus {
  if (stepId < activeStep) return "success";
  if (stepId === activeStep) return failed ? "failed" : "running";
  return "idle";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentGraphProps {
  /** 0 = language detection, 1 = patch, 2 = SAST/sandbox, 3 = git, 4 = PR, 5 = done */
  activeStep: number;
  failed?: boolean;
  retryCount?: number;
  /** Primary language detected by backend (e.g. "python", "go") */
  detectedLanguage?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AgentGraph: React.FC<AgentGraphProps> = ({
  activeStep,
  failed = false,
  retryCount = 0,
  detectedLanguage = "",
}) => {
  const startTimesRef = React.useRef<Record<number, number>>({});
  const [elapsedDisplay, setElapsedDisplay] = React.useState<Record<number, string>>({});

  // When a step becomes active, record start timestamp in ref
  React.useEffect(() => {
    if (activeStep >= 0 && activeStep <= 4 && !startTimesRef.current[activeStep]) {
      startTimesRef.current[activeStep] = Date.now();
    }
  }, [activeStep]);

  // Tick every second to update elapsed display state
  React.useEffect(() => {
    if (activeStep > 0 && activeStep < 5 && !failed) {
      const updateElapsed = () => {
        const now = Date.now();
        const next: Record<number, string> = {};
        for (const [stepIdStr, start] of Object.entries(startTimesRef.current)) {
          const stepId = Number(stepIdStr);
          const secs = Math.floor((now - start) / 1000);
          next[stepId] = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60}s`;
        }
        setElapsedDisplay(next);
      };

      updateElapsed();
      const id = setInterval(updateElapsed, 1000);
      return () => clearInterval(id);
    }
  }, [activeStep, failed]);

  const isPipelineActive = activeStep > 0 && activeStep < 5 && !failed;

  return (
    <div
      className="rounded-xl border p-5 shadow-xl"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-muted)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <span className="relative flex h-2 w-2">
            {isPipelineActive && (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </>
            )}
            {(activeStep === 0 || activeStep >= 5) && !failed && (
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--border-muted)" }} />
            )}
            {failed && (
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--error)" }} />
            )}
          </span>
          LangGraph Pipeline State
        </h2>

        <div className="flex items-center gap-2">
          {/* Language badge — shows once detected */}
          {detectedLanguage && (
            <LanguageBadge lang={detectedLanguage} />
          )}
          {/* Retry counter */}
          {retryCount > 0 && (
            <span
              className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border"
              style={{ color: "var(--warning)", borderColor: "rgba(200,145,43,0.3)", background: "var(--warning-glow)" }}
            >
              <RefreshCw className="w-3 h-3" />
              Retry #{retryCount}
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const status = nodeStatus(step.id, activeStep, failed);
          const Icon = step.icon;
          const isLast = idx === STEPS.length - 1;
          const elapsed = status === "running" || status === "success" ? (elapsedDisplay[step.id] ?? "") : "";

          return (
            <div key={step.id} className="flex gap-3">
              {/* Left timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                    status === "success" && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
                    status === "running" && "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse-ring",
                    status === "failed"  && "bg-red-500/20 text-red-400 border border-red-500/40",
                    status === "idle"    && "bg-slate-800/50 text-slate-500 border border-slate-700/50"
                  )}
                >
                  {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {status === "running" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                  {status === "failed"  && <XCircle className="w-4 h-4 text-red-400" />}
                  {status === "idle"    && <Circle className="w-3 h-3 text-slate-600" />}
                </div>

                {!isLast && (
                  <div
                    className={clsx(
                      "w-0.5 flex-1 my-1 transition-colors duration-300",
                      step.id < activeStep ? "bg-emerald-500/40" : "bg-slate-800"
                    )}
                    style={{ minHeight: "16px" }}
                  />
                )}
              </div>

              {/* Right step details */}
              <div className="pb-3 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>{step.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Elapsed time badge */}
                    {elapsed && (
                      <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                        ⏱ {elapsed}
                      </span>
                    )}

                    <span
                      className={clsx(
                        "font-mono text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold border",
                        status === "success" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                        status === "running" && "bg-amber-500/10 text-amber-400 border-amber-500/30",
                        status === "failed"  && "bg-red-500/10 text-red-400 border-red-500/30",
                        status === "idle"    && "bg-slate-800/40 text-slate-500 border-slate-700/30"
                      )}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};