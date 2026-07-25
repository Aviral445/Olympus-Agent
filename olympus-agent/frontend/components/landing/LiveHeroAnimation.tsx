"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play, Pause, RefreshCw, CheckCircle2, ShieldCheck,
  Cpu, GitPullRequest, Code2, Sparkles, Layers, Zap, Copy, Check
} from "lucide-react";

interface Step {
  id: number;
  label: string;
  sub: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { id: 1, label: "Fault Localization", sub: "Pytest traceback analysis", icon: Cpu },
  { id: 2, label: "AST Tree-sitter RAG", sub: "ChromaDB semantic retrieval", icon: Layers },
  { id: 3, label: "Multi-LLM Synthesis", sub: "Groq Llama-3.3 70B generator", icon: Zap },
  { id: 4, label: "Semgrep SAST Gate", sub: "Security vulnerability scan", icon: ShieldCheck },
  { id: 5, label: "Docker Pytest Sandbox", sub: "Clean container validation", icon: Code2 },
  { id: 6, label: "GitHub PR Delivery", sub: "Sigstore keyless attestation", icon: GitPullRequest },
];

const SIMULATED_RUNS = [
  {
    repo: "Aviral445/Imagex",
    bug: "IndexError in stego_app.py:45 (Bitwise offset overflow)",
    file: "stego_app.py",
    diff: `--- a/stego_app.py
+++ b/stego_app.py
@@ -42,7 +42,7 @@ def embed_secret_bits(image_bytes: bytes, payload: bytes) -> bytes:
-    for i in range(len(payload) * 8 + 1):
+    for i in range(len(payload) * 8):
         byte_idx = i // 8
         bit_idx = i % 8
-        image_bytes[byte_idx] |= (payload[byte_idx] >> bit_idx) & 1
+        if byte_idx < len(image_bytes):
+            image_bytes[byte_idx] ^= (payload[byte_idx] >> (7 - bit_idx)) & 1`,
    logs: [
      "📡 [Trigger]: Autonomous repair initiated for repository 'Aviral445/Imagex'",
      "🔍 [Fault Localizer]: Running pytest on workspace... 1 failed in 0.42s",
      "🚨 [Traceback]: IndexError: list index out of range at stego_app.py:L45",
      "🌲 [Tree-sitter RAG]: Extracted AST context for 'embed_secret_bits' (14 symbols)",
      "🧠 [Patch Agent]: Groq (Llama-3.3 70B) generated candidate patch in 0.78s",
      "🛡️ [SAST Gate]: Semgrep scan completed — 0 security warnings detected",
      "🐳 [Docker Sandbox]: Executing pytest inside 'olympus-sandbox' container...",
      "✅ [Docker Sandbox]: 14 passed in 1.14s! All test assertions verified",
      "🔐 [Attestation]: Signed diff artifact with keyless Sigstore OIDC attestation",
      "🎉 [GitHub PR]: Created Pull Request #42: 'fix(stego): repair bitwise offset overflow'",
    ]
  },
  {
    repo: "facebook/react-router-demo",
    bug: "NullPointerException in route_matcher.py:102 (Missing params fallback)",
    file: "route_matcher.py",
    diff: `--- a/route_matcher.py
+++ b/route_matcher.py
@@ -100,3 +100,3 @@ def parse_route_params(url_path: str):
-    params = match.groupdict()
-    return params.to_dict()
+    params = match.groupdict() if match else {}
+    return {k: v for k, v in params.items() if v is not None}`,
    logs: [
      "📡 [Trigger]: Autonomous repair initiated for repository 'facebook/react-router-demo'",
      "🔍 [Fault Localizer]: Running pytest on workspace... 1 failed in 0.51s",
      "🚨 [Traceback]: AttributeError: 'NoneType' object has no attribute 'to_dict' at route_matcher.py:L102",
      "🌲 [Tree-sitter RAG]: Extracted AST context for 'parse_route_params' (8 symbols)",
      "🧠 [Patch Agent]: OpenRouter (GPT-4o) generated candidate patch in 1.05s",
      "🛡️ [SAST Gate]: Semgrep scan completed — 0 security warnings detected",
      "🐳 [Docker Sandbox]: Executing pytest inside 'olympus-sandbox' container...",
      "✅ [Docker Sandbox]: 28 passed in 1.84s! All test assertions verified",
      "🔐 [Attestation]: Signed diff artifact with keyless Sigstore OIDC attestation",
      "🎉 [GitHub PR]: Created Pull Request #108: 'fix(router): add null safety check for route params'",
    ]
  }
];

export const LiveHeroAnimation: React.FC = () => {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [logIndex, setLogIndex]       = useState(0);
  const [isPlaying, setIsPlaying]     = useState(true);
  const [activeTab, setActiveTab]     = useState<"terminal" | "diff" | "graph">("terminal");
  const [copied, setCopied]           = useState(false);

  const scenario = SIMULATED_RUNS[scenarioIdx];
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-advance logs step by step when playing
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setLogIndex((prevLog) => {
        if (prevLog < scenario.logs.length) {
          const next = prevLog + 1;
          if (next <= 3) setCurrentStep(1);
          else if (next <= 4) setCurrentStep(2);
          else if (next <= 5) setCurrentStep(3);
          else if (next <= 6) setCurrentStep(4);
          else if (next <= 8) setCurrentStep(5);
          else setCurrentStep(6);
          return next;
        } else {
          setTimeout(() => {
            setScenarioIdx((s) => (s + 1) % SIMULATED_RUNS.length);
            setLogIndex(0);
            setCurrentStep(1);
          }, 3500);
          return prevLog;
        }
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isPlaying, scenario.logs.length]);

  // Scroll ONLY internal container, NEVER window
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logIndex]);

  const handleCopyDiff = () => {
    navigator.clipboard.writeText(scenario.diff).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const visibleLogs = scenario.logs.slice(0, logIndex);
  const isDone = logIndex >= scenario.logs.length;

  return (
    <div className="relative w-full max-w-5xl mx-auto rounded-2xl border border-[#1e304e] bg-[#0d1b2e]/90 shadow-2xl overflow-hidden backdrop-blur-xl group">
      
      {/* Laser scanner animation line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-70 animate-pulse pointer-events-none z-20" />

      {/* Top Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-[#112240] border-b border-[#162035] gap-3">
        {/* Left window controls + live status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors" />
          </div>

          <span className="h-4 w-px bg-slate-700 mx-1" />

          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Target: <strong className="text-white">{scenario.repo}</strong></span>
          </div>
        </div>

        {/* Middle Tab switcher */}
        <div className="flex items-center bg-[#07111d] p-1 rounded-lg border border-[#162035] text-xs font-mono">
          {(["terminal", "diff", "graph"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1 rounded-md transition-all capitalize ${
                activeTab === t
                  ? "bg-indigo-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "terminal" ? "🖥️ Live Terminal" : t === "diff" ? "📝 Generated Diff" : "🗺️ Pipeline Graph"}
            </button>
          ))}
        </div>

        {/* Right Play/Pause + Switch Scenario buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all"
            style={{
              borderColor: isPlaying ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)",
              background: isPlaying ? "rgba(99,102,241,0.15)" : "transparent",
              color: isPlaying ? "#818cf8" : "#94a3b8",
            }}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>

          <button
            onClick={() => {
              setScenarioIdx((s) => (s + 1) % SIMULATED_RUNS.length);
              setLogIndex(0);
              setCurrentStep(1);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-slate-400 hover:text-white border border-slate-700/60 hover:border-slate-600 transition-all"
            title="Switch simulated bug scenario"
          >
            <RefreshCw className="w-3 h-3" />
            Next Scenario
          </button>
        </div>
      </div>

      {/* ── Step Progress Indicator Bar ── */}
      <div className="px-5 py-3 bg-[#0d1b2e]/60 border-b border-[#162035] overflow-x-auto">
        <div className="flex items-center justify-between gap-2 min-w-[600px]">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.id === currentStep;
            const isPassed = s.id < currentStep || isDone;

            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono transition-all duration-300 ${
                      isActive
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-500/30 scale-105"
                        : isPassed
                        ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-400"
                        : "bg-slate-900 border border-slate-800 text-slate-600"
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className={`font-medium transition-colors text-[11px] ${isActive ? "text-white" : isPassed ? "text-slate-300" : "text-slate-500"}`}>
                      {s.label}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono">{s.sub}</p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className="h-0.5 flex-1 mx-1 rounded-full transition-all duration-500 min-w-[20px]"
                    style={{
                      background: isPassed
                        ? "linear-gradient(90deg, #10b981, #6366f1)"
                        : "rgba(255,255,255,0.06)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Content Body (Switchable Tabs) ── */}
      <div
        ref={containerRef}
        className="p-5 font-mono text-xs min-h-[280px] max-h-[340px] overflow-y-auto bg-[#05080f]"
      >

        {/* Tab 1: Terminal Stream */}
        {activeTab === "terminal" && (
          <div className="space-y-2">
            <div className="text-slate-500 pb-1 border-b border-slate-800/60 flex items-center justify-between">
              <span># Bug Description: {scenario.bug}</span>
              <span className="text-[10px] text-indigo-400 animate-pulse">● LIVE EXECUTION STREAM</span>
            </div>

            {visibleLogs.map((log, idx) => {
              let color = "text-slate-300";
              if (log.includes("✅") || log.includes("🎉")) color = "text-emerald-400 font-semibold";
              else if (log.includes("🚨")) color = "text-rose-400";
              else if (log.includes("🧠")) color = "text-violet-300";
              else if (log.includes("🌲")) color = "text-sky-300";
              else if (log.includes("🛡️")) color = "text-teal-300";
              else if (log.includes("📡")) color = "text-indigo-300";

              return (
                <div key={idx} className={`leading-relaxed animate-slide-in ${color}`}>
                  {log}
                </div>
              );
            })}

            {!isDone && (
              <div className="inline-flex items-center gap-2 text-indigo-400 pt-1">
                <span className="w-2 h-4 bg-indigo-500 animate-pulse" />
                <span className="text-slate-500 italic">Processing pipeline step #{currentStep}...</span>
              </div>
            )}

            {isDone && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 animate-fade-in flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Fix loop finished! Pull Request opened on GitHub automatically.
                </span>
                <span className="text-[10px] text-slate-400">Looping next scenario in 3s...</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Generated Diff */}
        {activeTab === "diff" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">File: <strong className="text-slate-200">{scenario.file}</strong></span>
              <button
                onClick={handleCopyDiff}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Diff"}
              </button>
            </div>
            <div className="bg-[#08111f] rounded-lg p-4 font-mono whitespace-pre overflow-x-auto text-[11px] leading-relaxed">
              {scenario.diff.split("\n").map((line, idx) => {
                let style = "text-slate-400";
                if (line.startsWith("+") && !line.startsWith("+++")) style = "bg-emerald-950/60 text-emerald-300 pl-2 border-l-2 border-emerald-500";
                else if (line.startsWith("-") && !line.startsWith("---")) style = "bg-rose-950/60 text-rose-300 pl-2 border-l-2 border-rose-500";
                else if (line.startsWith("@@")) style = "text-indigo-400 font-bold bg-indigo-950/40 p-1 my-1 rounded";

                return <div key={idx} className={style}>{line}</div>;
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Graph State */}
        {activeTab === "graph" && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-slate-400 text-[11px] border-b border-slate-800 pb-2">
              StateGraph topology active node execution state:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {STEPS.map((s) => {
                const Icon = s.icon;
                const isActive = s.id === currentStep;
                const isPassed = s.id < currentStep || isDone;

                return (
                  <div
                    key={s.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-500/60 text-white"
                        : isPassed
                        ? "bg-emerald-950/20 border-emerald-500/30 text-slate-300"
                        : "bg-slate-900/40 border-slate-800 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400 animate-spin" : isPassed ? "text-emerald-400" : "text-slate-600"}`} />
                      <span>{s.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{s.sub}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
