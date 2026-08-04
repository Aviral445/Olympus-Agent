"use client";

import React, { useRef } from "react";
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
  // Per-step start-time tracking for elapsed counters
  const stepStartTimes = useRef<Record<number, number>>({});
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  // When a step becomes "running", record its start time
  React.useEffect(() => {
    if (activeStep >= 0 && activeStep <= 4) {
      if (!stepStartTimes.current[activeStep]) {
        stepStartTimes.current[activeStep] = Date.now();
      }
    }
  }, [activeStep]);

  // Tick every second to update elapsed displays
  React.useEffect(() => {
    if (activeStep > 0 && activeStep < 5 && !failed) {
      const id = setInterval(() => forceUpdate(), 1000);
      return () => clearInterval(id);
    }
  }, [activeStep, failed]);

  const elapsedFor = (stepId: number): string => {
    const start = stepStartTimes.current[stepId];
    if (!start) return "";
    const secs = Math.floor((Date.now() - start) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m${secs % 60}s`;
  };

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
          const elapsed = status === "running" || status === "success" ? elapsedFor(step.id) : "";

          return (
            <div key={step.id} className="flex gap-3">
              {/* Connector column */}
              <div className="flex flex-col items-center w-8 shrink-0">
                {/* Node dot */}
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                    status === "running" && "animate-pulse-ring ring-2 ring-amber-400/40",
                    status === "success" && "animate-success-ring"
                  )}
                  style={{
                    background:
                      status === "running" ? "var(--gold-glow)"    :
                      status === "success" ? "var(--success-glow)" :
                      status === "failed"  ? "var(--error-glow)"   :
                      "rgba(143,162,138,0.08)",
                    border: `1px solid ${
                      status === "running" ? "rgba(200,169,107,0.5)" :
                      status === "success" ? "rgba(90,138,94,0.4)"   :
                      status === "failed"  ? "rgba(181,90,74,0.4)"   :
                      "rgba(143,162,138,0.2)"
                    }`,
                  }}
                >
                  {status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--gold)" }} />}
                  {status === "success" && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />}
                  {status === "failed"  && <XCircle className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />}
                  {status === "idle"    && <Circle className="w-3.5 h-3.5" style={{ color: "var(--border-muted)" }} />}

                </div>
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className="w-px flex-1 mt-1 transition-all duration-500"
                    style={{
                      background: status === "success"
                        ? "linear-gradient(to bottom, rgba(16,185,129,0.5), rgba(16,185,129,0.1))"
                        : "rgba(255,255,255,0.05)",
                      minHeight: "12px",
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={clsx(
                  "flex-1 p-3 rounded-lg border transition-all duration-300 mb-2",
                  status === "running" && "border-amber-400/30 bg-amber-50/40",
                  status === "success" && "border-green-400/20 bg-green-50/30",
                  status === "failed"  && "border-red-400/30 bg-red-50/30",
                  status === "idle"    && "border-transparent"
                )}
                style={{
                  background: status === "idle" ? "rgba(143,162,138,0.05)" : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={clsx("w-3.5 h-3.5 shrink-0",
                        status === "running" ? "text-indigo-400" :
                        status === "success" ? "text-emerald-400" :
                        status === "failed"  ? "text-rose-400"   : "text-slate-600"
                      )}
                    />
                    <span
                      className={clsx("text-xs font-semibold",
                        status === "running" ? "text-slate-100" :
                        status === "success" ? "text-slate-300" :
                        status === "failed"  ? "text-rose-300"  : "text-slate-600"
                      )}
                    >
                      {step.title}
                    </span>
                  </div>

                  {/* Elapsed timer */}
                  {elapsed && (
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: status === "success" ? "var(--success)" : "var(--text-muted)" }}
                    >
                      {elapsed}
                    </span>
                  )}
                </div>

                {(status === "running" || status === "failed") && (
                  <p className="text-xs mt-1 ml-5.5"
                    style={{ color: status === "failed" ? "var(--error)" : "var(--text-muted)" }}>
                    {step.desc}
                  </p>
                )}

                {/* Show language badge inline in the Language Detection step */}
                {step.id === 0 && status === "success" && detectedLanguage && (
                  <div className="mt-1 ml-5.5">
                    <LanguageBadge lang={detectedLanguage} compact />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};