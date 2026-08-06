"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Play, Square, Terminal, GitBranch, FileCode2,
  Repeat, ScrollText, CheckCircle2, History, Plus,
  ExternalLink, LogOut, Shield, ChevronRight, Trash2, Lock, Unlock,
} from "lucide-react";
import { AgentGraph } from "@/components/graph-flow/AgentGraph";
import { DependencyMap } from "@/components/DependencyMap";
import { DiffViewer } from "@/components/diff-viewer/DiffViewer";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LanguageBadge } from "@/components/ui/LanguageBadge";
import { triggerRun, streamRunLogs, fetchRuns, fetchDependencyGraph } from "@/lib/api";
import type { AuthSession, RunRecord, PipelineResult, RunTab, DependencyGraphData } from "@/lib/types";


// ─── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  ts: string;   // HH:MM:SS timestamp
  msg: string;
}

function nowHMS(): string {
  const d = new Date();
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join(":");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectStep(msg: string): number | null {
  if (/\[Language Detector\]/i.test(msg)) return 0;
  if (/Agent Router|Import Resolver Agent|Type Fix Agent|Logic Repair Agent|Patch Agent|LLM Engine|Tree-sitter RAG/i.test(msg)) return 1;
  if (/SAST Gate|Validation Agent|Docker sandbox|sandbox/i.test(msg)) return 2;
  if (/Git Diff|Committed patch|Attestation|Git Manager/i.test(msg)) return 3;
  if (/Pull Request|PR Delivery|GitHub PR/i.test(msg)) return 4;
  return null;
}


function detectRetry(msg: string): number | null {
  const m = msg.match(/attempt\s+(\d+)\s*\//i);
  return m ? parseInt(m[1], 10) : null;
}

function detectLlmTier(msg: string): string | null {
  if (/Groq/i.test(msg)) return "Groq";
  if (/OpenRouter/i.test(msg)) return "OpenRouter";
  if (/Gemini/i.test(msg)) return "Gemini";
  return null;
}

function detectLanguage(msg: string): string | null {
  const m = msg.match(/Primary language\s*[→>]\s*([a-z]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function detectSpecialist(msg: string): string | null {
  if (/ImportResolverAgent|\[Import Resolver Agent\]|\[Import Resolver\]/i.test(msg)) return "ImportResolverAgent";
  if (/TypeFixAgent|\[Type Fix Agent\]|\[Type Fixer\]/i.test(msg)) return "TypeFixAgent";
  if (/LogicRepairAgent|\[Logic Repair Agent\]|\[Logic Repairer\]/i.test(msg)) return "LogicRepairAgent";
  return null;
}

function detectErrorClass(msg: string): string | null {
  const m = msg.match(/Classified error as '([^']+)'/i);
  return m ? m[1] : null;
}

function detectCulprits(msg: string): string[] | null {
  const m = msg.match(/Retargeting \d+ file\(s\): \[([^\]]+)\]/i);
  if (m) {
    return m[1].split(",").map((s) => s.trim().replace(/['"]/g, ""));
  }
  return null;
}



function logColor(line: string): string {
  if (/✅|🎉/.test(line)) return "#34a853";
  if (/❌|🚨/.test(line)) return "#ea4335";
  if (/⚠️/.test(line)) return "#fbbc04";
  if (/🔍|📝|🌲/.test(line)) return "#26a69a";
  if (/🤖|📡|🧠/.test(line)) return "#5c85d6";
  if (/🛡️|🔐/.test(line)) return "#57bb8a";
  return "var(--text-secondary)";
}



// ─── Run History Tab ─────────────────────────────────────────────────────────

function RunHistoryTab() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PASS" | "FAIL">("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchRuns(100).then((r) => { setRuns(r); setLoading(false); });
  }, []);

  const filtered = runs.filter((r) => filter === "ALL" || r.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(["ALL", "PASS", "FAIL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-mono transition-all"
            style={{
              background: filter === f ? "var(--gold-glow)" : "transparent",
              border: `1px solid ${filter === f ? "rgba(200,169,107,0.5)" : "var(--border-muted)"}`,
              color: filter === f ? "var(--gold)" : "var(--text-muted)",
            }}

          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {filtered.length} run{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <History className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No runs recorded yet.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border-muted)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
                {["File", "Attempt", "Status", "Timestamp", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold"
                    style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((run, i) => (
                <React.Fragment key={run.id}>
                  <tr
                    className="transition-colors cursor-pointer"
                    style={{
                      background: expanded === run.id ? "var(--bg-elevated)" : i % 2 === 0 ? "var(--bg-surface)" : "transparent",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                    onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {run.target_file.split("/").pop() ?? run.target_file}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      #{run.attempt}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={run.status === "PASS" ? "pass" : "fail"}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {new Date(run.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight
                        className="w-4 h-4 transition-transform"
                        style={{
                          color: "var(--text-muted)",
                          transform: expanded === run.id ? "rotate(90deg)" : "none",
                        }}
                      />
                    </td>
                  </tr>
                  {expanded === run.id && run.git_diff && (
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <td colSpan={5} className="px-4 py-3">
                        <DiffViewer diffText={run.git_diff} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface DashboardProps {
  session: AuthSession;
}

export default function Dashboard({ session }: DashboardProps) {
  // Pipeline state
  const [repoUrl, setRepoUrl]           = useState("https://github.com/Aviral445/Imagex");
  const [targetFile, setTargetFile]     = useState("");
  const [maxAttempts, setMaxAttempts]   = useState(10);
  const [isExecuting, setIsExecuting]   = useState(false);
  const [currentStep, setCurrentStep]   = useState(0);
  const [pipelineFailed, setPipelineFailed] = useState(false);
  const [prUrl, setPrUrl]               = useState<string | null>(null);
  const [patchDiff, setPatchDiff]       = useState("");
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [runResult, setRunResult]       = useState<PipelineResult>(null);
  const [retryCount, setRetryCount]     = useState(0);
  const [elapsedSecs, setElapsedSecs]   = useState(0);
  const [llmTier, setLlmTier]           = useState("");
  const [activeTab, setActiveTab]       = useState<RunTab>("run");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [agentUsed, setAgentUsed]               = useState("");
  const [errorClass, setErrorClass]             = useState("");
  const [culpritFiles, setCulpritFiles]         = useState<string[]>([]);
  const [graphData, setGraphData]               = useState<DependencyGraphData>({ nodes: [], edges: [] });
  const [autoScroll, setAutoScroll]             = useState(true);


  const logEndRef  = useRef<HTMLDivElement>(null);
  const logBoxRef  = useRef<HTMLDivElement>(null);
  const esRef      = useRef<EventSource | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef   = useRef<number>(0);

  // Auto-scroll: scroll to bottom unless user manually scrolled up
  useEffect(() => {
    if (!autoScroll) return;
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  // Detect manual scroll-up to disable auto-scroll
  const handleLogScroll = useCallback(() => {
    const box = logBoxRef.current;
    if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);


  useEffect(() => () => { esRef.current?.close(); }, []);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleTrigger = async () => {
    setIsExecuting(true);
    setCurrentStep(0);
    setPipelineFailed(false);
    setPrUrl(null);
    setPatchDiff("");
    setLogs([]);
    setRunResult(null);
    setRetryCount(0);
    setElapsedSecs(0);
    setLlmTier("");
    setDetectedLanguage("");
    setAgentUsed("");
    setErrorClass("");
    setCulpritFiles([]);
    setGraphData({ nodes: [], edges: [] });
    setAutoScroll(true);
    esRef.current?.close();
    startTimer();

    try {
      const { run_id } = await triggerRun({ repo_url: repoUrl, target_file: targetFile, max_attempts: maxAttempts });

      // Fetch initial or workspace dependency graph
      fetchDependencyGraph(run_id).then((g) => {
        if (g && g.nodes && g.nodes.length > 0) setGraphData(g);
      });

      const es = streamRunLogs(run_id, {
        onLog: (msg) => {
          setLogs((prev) => [...prev, { ts: nowHMS(), msg }]);
          const step = detectStep(msg);
          if (step !== null) setCurrentStep((p) => Math.max(p, step));
          const retry = detectRetry(msg);
          if (retry !== null) setRetryCount(retry);
          const tier = detectLlmTier(msg);
          if (tier) setLlmTier(tier);
          const lang = detectLanguage(msg);
          if (lang) setDetectedLanguage(lang);

          const spec = detectSpecialist(msg);
          if (spec) setAgentUsed(spec);
          const errCls = detectErrorClass(msg);
          if (errCls) setErrorClass(errCls);
          const culprits = detectCulprits(msg);
          if (culprits) setCulpritFiles(culprits);

          // Re-fetch graph on step changes or log messages
          if (/Dependency Graph|Import Graph/i.test(msg)) {
            fetchDependencyGraph(run_id).then((g) => {
              if (g && g.nodes && g.nodes.length > 0) setGraphData(g);
            });
          }
        },

        onComplete: (result, diff) => {
          stopTimer();
          setRunResult(result);
          setCurrentStep((prev) => result === "PASS" ? 5 : prev);
          setPipelineFailed(result === "FAIL");
          if (result === "PASS") {
            setPatchDiff(diff);
            const repoPath = repoUrl.split("github.com/")[1] ?? "";
            setPrUrl(`https://github.com/${repoPath}/pulls`);
          }
          setIsExecuting(false);
          esRef.current = null;
        },
        onError: (msg) => {
          stopTimer();
          setLogs((prev) => [...prev, { ts: nowHMS(), msg: `⚠️ ${msg}` }]);
          setIsExecuting(false);
          esRef.current = null;
        },
      });
      esRef.current = es;
    } catch (err) {
      stopTimer();
      const msg = err instanceof Error ? err.message : "Unknown error";
      setLogs([{ ts: nowHMS(), msg: `❌ Failed to start pipeline: ${msg}` }]);
      setIsExecuting(false);
      setCurrentStep(0);
    }
  };

  const handleStop = () => {
    esRef.current?.close();
    esRef.current = null;
    stopTimer();
    setIsExecuting(false);
    setLogs((p) => [...p, { ts: nowHMS(), msg: "🛑 Run manually stopped by user." }]);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setAutoScroll(true);
  };


  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="w-[200px] shrink-0 flex flex-col border-r"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: "var(--gold-glow)", border: "1px solid rgba(200,169,107,0.4)" }}
            >
              <Image src="/olympus-logo.png" alt="Olympus" width={32} height={32} className="object-contain" />
            </div>

            <div>
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Olympus</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>SRE Engine v2.0</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "run" as RunTab,     icon: Plus,    label: "New Run" },
            { id: "history" as RunTab, icon: History, label: "History" },
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
              style={{
                background: activeTab === id ? "var(--gold-glow)" : "transparent",
                color: activeTab === id ? "var(--gold)" : "var(--text-muted)",
                border: `1px solid ${activeTab === id ? "rgba(200,169,107,0.4)" : "transparent"}`,
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}

        </nav>

        {/* User */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={session.avatar} alt={session.login} className="w-7 h-7 rounded-full" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {session.name}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                @{session.login}
              </p>
            </div>
          </div>
          {session.isAdmin && (
            <div className="flex items-center gap-1 mb-2">
              <Shield className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[10px] text-amber-400">Admin</span>
            </div>
          )}
          <a
            href="/api/auth/logout"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut className="w-3 h-3" /> Sign out
          </a>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <div>
            <h1 className="text-base font-bold gradient-text">Project Olympus</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Autonomous Code Repair · Tree-sitter RAG · Verified Git PR Automation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {detectedLanguage && <LanguageBadge lang={detectedLanguage} />}
            {isExecuting && <Badge variant="running" pulse>LIVE</Badge>}
            {runResult === "PASS" && <Badge variant="pass">PASSED</Badge>}
            {runResult === "FAIL" && <Badge variant="fail">FAILED</Badge>}

            <div
              className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
              style={{
                background: "var(--success-glow)",
                border: "1px solid rgba(90,138,94,0.35)",
                color: "var(--success)",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> System Online
            </div>
          </div>

        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden p-5">
          {activeTab === "history" ? (
            <div className="h-full overflow-y-auto">
              <RunHistoryTab />
            </div>
          ) : (
            /* ── New Run Layout ─────────────────────────────────────────── */
            <div className="flex gap-5 h-full">

              {/* Left column — Controls + Logs */}
              <div className="w-[320px] shrink-0 flex flex-col gap-4 overflow-y-auto">

                {/* Control Terminal */}
                <div
                  className="rounded-xl p-5 shadow-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-muted)" }}
                >
                  <h2 className="text-xs font-semibold mb-4 flex items-center gap-2"
                    style={{ color: "var(--text-secondary)" }}>
                    <Terminal className="w-3.5 h-3.5" style={{ color: "var(--gold)" }} />
                    Control Terminal
                  </h2>


                  <div className="space-y-3">
                    {/* Repo URL */}
                    <div>
                      <label className="block text-[10px] font-mono mb-1" style={{ color: "var(--text-muted)" }}>
                        GitHub Repository URL
                      </label>
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-muted)" }}
                      >
                        <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gold)" }} />

                        <input
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/user/repo"
                          className="bg-transparent border-none outline-none text-xs font-mono w-full"
                          style={{ color: "var(--text-primary)" }}
                        />
                      </div>
                    </div>

                    {/* Target file */}
                    <div>
                      <label className="block text-[10px] font-mono mb-1" style={{ color: "var(--text-muted)" }}>
                        Target File <span style={{ color: "var(--text-muted)", opacity: 0.6 }}>(optional)</span>
                      </label>
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-muted)" }}
                      >
                        <FileCode2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          value={targetFile}
                          onChange={(e) => setTargetFile(e.target.value)}
                          placeholder="src/app.py  (leave blank to auto-detect)"
                          className="bg-transparent border-none outline-none text-xs font-mono w-full"
                          style={{ color: "var(--text-primary)" }}
                        />
                      </div>
                    </div>

                    {/* Max attempts */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-mono flex items-center gap-1"
                            style={{ color: "var(--text-muted)" }}>
                            <Repeat className="w-3 h-3" style={{ color: "var(--gold)" }} />
                            Max Repair Attempts
                          </label>
                          <span
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                            style={{ color: "var(--gold)", background: "var(--gold-glow)" }}
                          >
                            {maxAttempts}
                          </span>
                      </div>
                      <input
                        type="range" min={1} max={200} value={maxAttempts}
                        onChange={(e) => setMaxAttempts(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full cursor-pointer accent-indigo-500"
                        style={{ accentColor: "var(--gold)" }}
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1"
                        loading={isExecuting}
                        disabled={isExecuting}
                        onClick={handleTrigger}
                        icon={<Play className="w-3.5 h-3.5 fill-current" />}
                      >
                        {isExecuting ? "Running…" : "Trigger Fix"}
                      </Button>
                      {isExecuting && (
                        <Button variant="danger" size="md" onClick={handleStop}
                          icon={<Square className="w-3.5 h-3.5 fill-current" />}>
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Log Console */}
                <div
                  className="rounded-xl overflow-hidden flex-1 flex flex-col min-h-0"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-muted)" }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-2.5 shrink-0"
                    style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <span className="flex items-center gap-2 text-xs font-mono"
                      style={{ color: "var(--text-muted)" }}>
                      <ScrollText className="w-3.5 h-3.5" style={{ color: "var(--gold)" }} />
                      Live Engine Logs
                    </span>

                    <div className="flex items-center gap-2">
                      {isExecuting && (
                        <span className="live-dot text-xs font-mono" style={{ color: "var(--success)" }}>
                          STREAMING
                        </span>
                      )}
                      {/* Auto-scroll toggle */}
                      <button
                        onClick={() => setAutoScroll((v) => !v)}
                        title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                        className="p-1 rounded transition-opacity hover:opacity-80"
                        style={{ color: autoScroll ? "var(--indigo-light)" : "var(--text-muted)" }}
                      >
                        {autoScroll ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      {/* Clear button */}
                      {logs.length > 0 && !isExecuting && (
                        <button
                          onClick={handleClearLogs}
                          title="Clear logs"
                          className="p-1 rounded transition-opacity hover:opacity-80"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    ref={logBoxRef}
                    onScroll={handleLogScroll}
                    className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-xs"
                    style={{ background: "var(--bg-input)", minHeight: 0 }}
                  >

                    {logs.length === 0 ? (
                      <p className="italic" style={{ color: "var(--text-muted)" }}>
                        Logs will appear here once the pipeline starts…
                      </p>
                    ) : (
                      logs.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 leading-relaxed animate-slide-in"
                        >
                          {/* Timestamp gutter */}
                          <span
                            className="shrink-0 select-none"
                            style={{ color: "var(--border-muted)", minWidth: "48px" }}
                          >

                            {entry.ts}
                          </span>
                          {/* Log message */}
                          <span
                            className="whitespace-pre-wrap"
                            style={{ color: logColor(entry.msg) }}
                          >
                            {entry.msg}
                          </span>
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>

              </div>

              {/* Right column — Graph + Dependency Map + Diff + Telemetry */}
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
                <AgentGraph
                  activeStep={currentStep}
                  failed={pipelineFailed}
                  retryCount={retryCount}
                  detectedLanguage={detectedLanguage}
                  agentUsed={agentUsed}
                  errorClass={errorClass}
                />

                <DependencyMap
                  graphData={graphData}
                  errorFile={targetFile}
                  culpritFiles={culpritFiles}
                  activeSpecialist={agentUsed}
                />

                <TelemetryPanel
                  isRunning={isExecuting}
                  result={runResult}
                  elapsedSeconds={elapsedSecs}
                  attemptCount={retryCount}
                  maxAttempts={maxAttempts}
                  llmTier={llmTier}
                  logCount={logs.length}
                />

                <DiffViewer diffText={patchDiff} />


                {/* PR Success */}
                {prUrl && runResult === "PASS" && (
                  <div
                    className="rounded-xl p-5 animate-slide-in"
                    style={{
                      background: "var(--success-glow)",
                      border: "1px solid rgba(16,185,129,0.35)",
                    }}
                  >
                    <h3 className="font-semibold flex items-center gap-2 mb-2"
                      style={{ color: "var(--success)", fontSize: "0.875rem" }}>
                      <CheckCircle2 className="w-4 h-4" /> Pull Request Created!
                    </h3>
                    <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                      Olympus cloned the repo, located failing tests, applied a verified patch, and opened a PR automatically.
                    </p>
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono transition-opacity hover:opacity-80"
                      style={{ color: "var(--indigo-light)" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Pull Requests on GitHub →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
