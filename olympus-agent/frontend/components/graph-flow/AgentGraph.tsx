"use client";

import React from "react";
import { clsx } from "clsx";
import {
  CheckCircle2, Circle, Loader2, XCircle,
  ShieldCheck, GitPullRequest, Code2, Cpu, RefreshCw,
} from "lucide-react";
import type { NodeStatus } from "@/lib/types";

interface Step {
  id: number;
  title: string;
  desc: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "RAG Indexing & Patch Agent",
    desc: "Tree-sitter AST chunking → semantic retrieval → LLM patch generation",
    icon: Cpu,
  },
  {
    id: 2,
    title: "SAST Gate & Sandbox Validation",
    desc: "Semgrep security scan → Docker pytest isolation → result parsing",
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

function nodeStatus(stepId: number, activeStep: number, failed: boolean): NodeStatus {
  if (stepId < activeStep) return "success";
  if (stepId === activeStep) return failed ? "failed" : "running";
  return "idle";
}

interface AgentGraphProps {
  activeStep: number;
  failed?: boolean;
  retryCount?: number;
}

export const AgentGraph: React.FC<AgentGraphProps> = ({
  activeStep,
  failed = false,
  retryCount = 0,
}) => {
  return (
    <div
      className="rounded-xl border p-5 shadow-xl"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-muted)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {activeStep > 0 && activeStep < 5 && !failed && (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </>
            )}
            {(activeStep === 0 || activeStep >= 5) && !failed && (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-600" />
            )}
            {failed && (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            )}
          </span>
          LangGraph Pipeline State
        </h2>
        {retryCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border"
            style={{ color: "var(--warning)", borderColor: "rgba(245,158,11,0.3)", background: "var(--warning-glow)" }}>
            <RefreshCw className="w-3 h-3" />
            Retry #{retryCount}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const status = nodeStatus(step.id, activeStep, failed);
          const Icon = step.icon;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Connector column */}
              <div className="flex flex-col items-center w-8 shrink-0">
                {/* Node dot */}
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                    status === "running" && "animate-pulse-ring ring-2 ring-indigo-500/40",
                    status === "success" && "animate-success-ring"
                  )}
                  style={{
                    background:
                      status === "running" ? "var(--indigo-glow)" :
                      status === "success" ? "var(--success-glow)" :
                      status === "failed"  ? "var(--error-glow)" :
                      "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      status === "running" ? "rgba(99,102,241,0.5)" :
                      status === "success" ? "rgba(16,185,129,0.4)" :
                      status === "failed"  ? "rgba(244,63,94,0.4)" :
                      "rgba(255,255,255,0.06)"
                    }`,
                  }}
                >
                  {status === "running" && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                  {status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {status === "failed"  && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                  {status === "idle"    && <Circle className="w-3.5 h-3.5 text-slate-600" />}
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
                  status === "running" && "border-indigo-500/30 bg-indigo-950/20",
                  status === "success" && "border-emerald-500/20 bg-emerald-950/10",
                  status === "failed"  && "border-rose-500/30 bg-rose-950/20",
                  status === "idle"    && "border-transparent bg-white/[0.02]"
                )}
              >
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
                {(status === "running" || status === "failed") && (
                  <p className="text-xs mt-1 ml-5.5"
                    style={{ color: status === "failed" ? "var(--error)" : "var(--text-muted)" }}>
                    {step.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};