"use client";

import React from "react";
import { CheckCircle2, Circle, Loader2, ShieldCheck, GitPullRequest, Code2, Cpu } from "lucide-react";

export type NodeStatus = "idle" | "running" | "success" | "failed";

interface AgentGraphProps {
  activeStep: number; // 0: Idle, 1: Patcher, 2: SAST & Validation, 3: Git & Attestation, 4: PR Generated
}

export const AgentGraph: React.FC<AgentGraphProps> = ({ activeStep }) => {
  const steps = [
    {
      id: 1,
      title: "Tree-sitter RAG & Patch Agent",
      desc: "Retrieves AST symbols & generates code fix via Groq/Llama",
      icon: Cpu,
    },
    {
      id: 2,
      title: "SAST Gate & Sandbox Validation",
      desc: "Runs Semgrep vulnerability scan & isolated unit tests",
      icon: ShieldCheck,
    },
    {
      id: 3,
      title: "Git Manager & Sigstore Attestation",
      desc: "Creates patch branch & signs artifact diff",
      icon: Code2,
    },
    {
      id: 4,
      title: "GitHub PR Delivery",
      desc: "Pushes branch and opens automated Pull Request on GitHub",
      icon: GitPullRequest,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        Live LangGraph Pipeline State
      </h2>

      <div className="space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          let status: NodeStatus = "idle";
          if (step.id < activeStep) status = "success";
          else if (step.id === activeStep) status = "running";

          return (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                status === "running"
                  ? "bg-indigo-950/40 border-indigo-500/50 text-slate-100"
                  : status === "success"
                  ? "bg-slate-900/60 border-emerald-500/30 text-slate-300"
                  : "bg-slate-950/40 border-slate-800/60 text-slate-500"
              }`}
            >
              <div className="mt-1">
                {status === "running" && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
                {status === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {status === "idle" && <Circle className="w-5 h-5 text-slate-600" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Icon className={`w-4 h-4 ${status === "running" ? "text-indigo-400" : status === "success" ? "text-emerald-400" : "text-slate-500"}`} />
                  <span>{step.title}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};