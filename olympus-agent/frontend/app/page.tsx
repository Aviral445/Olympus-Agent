import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

<<<<<<< HEAD
import React, { useState, useRef, useEffect } from "react";
import { AgentGraph } from "@/components/graph-flow/AgentGraph";
import { DiffViewer } from "@/components/diff-viewer/DiffViewer";
import {
  Play,
  Terminal,
  FileCode2,
  CheckCircle,
  Repeat,
  GitBranch,
  ScrollText,
  Square,
} from "lucide-react";

// ─── Step detection from live log messages ───────────────────────────────────
function detectStepFromLog(msg: string): number | null {
  if (/Patch Agent|LLM Engine|Generating patch/i.test(msg)) return 1;
  if (/SAST Gate|Validation Agent|Docker sandbox/i.test(msg)) return 2;
  if (/Git Diff|Committed patch|Attestation|Git Manager/i.test(msg)) return 3;
  if (/Pull Request|PR Delivery|GitHub PR/i.test(msg)) return 4;
  return null;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/Aviral445/Imagex");
  const [targetFile, setTargetFile] = useState("");
  const [maxAttempts, setMaxAttempts] = useState<number>(10);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [patchDiff, setPatchDiff] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<"PASS" | "FAIL" | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Auto-scroll log console to bottom on new entries
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  const handleTriggerFix = async () => {
    // Reset state
    setIsExecuting(true);
    setCurrentStep(1);
    setPrUrl(null);
    setPatchDiff("");
    setLogs([]);
    setRunResult(null);
    esRef.current?.close();

    try {
      const res = await fetch("http://localhost:8000/api/v1/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: repoUrl,
          target_file: targetFile,
          max_attempts: maxAttempts,
        }),
      });

      if (!res.ok) throw new Error(`Backend error: ${res.status}`);

      const data = await res.json();
      const runId: string = data.run_id;

      if (!runId) throw new Error("No run_id returned from backend");

      // ── Open SSE stream ────────────────────────────────────────────────────
      const es = new EventSource(`http://localhost:8000/api/v1/stream/${runId}`);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            type: string;
            message?: string;
            result?: string;
            diff?: string;
          };

          if (parsed.type === "log" && parsed.message) {
            const msg = parsed.message.trim();
            if (!msg) return;

            setLogs((prev) => [...prev, msg]);

            // Update pipeline step from log content
            const detectedStep = detectStepFromLog(msg);
            if (detectedStep !== null) {
              setCurrentStep((prev) => Math.max(prev, detectedStep));
            }
          }

          if (parsed.type === "complete") {
            const result = parsed.result as "PASS" | "FAIL";
            setRunResult(result);
            setCurrentStep(result === "PASS" ? 5 : 0); // 5 = all done

            if (result === "PASS") {
              setPatchDiff(parsed.diff || "");
              setPrUrl(`https://github.com/${repoUrl.split("github.com/")[1] ?? ""}/pulls`);
            }

            setIsExecuting(false);
            es.close();
            esRef.current = null;
          }
        } catch {
          // Ignore malformed SSE events
        }
      };

      es.onerror = () => {
        setLogs((prev) => [...prev, "⚠️ SSE connection lost. Check backend."]);
        setIsExecuting(false);
        es.close();
        esRef.current = null;
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setLogs([`❌ Failed to start pipeline: ${msg}`]);
      setIsExecuting(false);
      setCurrentStep(0);
    }
  };

  const handleStop = () => {
    esRef.current?.close();
    esRef.current = null;
    setIsExecuting(false);
    setLogs((prev) => [...prev, "🛑 Run manually stopped by user."]);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Project Olympus SRE Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous Code Repair · Tree-sitter RAG · Verified Git PR Automation
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-mono">
          <CheckCircle className="w-4 h-4" /> System Online (v2.0)
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left column: Control + Log Console ── */}
        <div className="space-y-6">
          {/* Control Terminal */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" /> Control Terminal
            </h2>

            <div className="space-y-4">
              {/* GitHub Repo URL */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  GitHub Repository URL
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono">
                  <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className="bg-transparent border-none outline-none text-slate-200 w-full"
                  />
                </div>
              </div>

              {/* Target File (optional) */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Target File <span className="text-slate-500">(Optional — leave blank to auto-detect)</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono">
                  <FileCode2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    placeholder="src/app.py"
                    className="bg-transparent border-none outline-none text-slate-200 w-full placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Max Attempts Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-indigo-400" /> Max Repair Loop Attempts
                  </label>
                  <span className="text-xs font-mono text-indigo-400 font-semibold bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded">
                    {maxAttempts} {maxAttempts === 1 ? "attempt" : "attempts"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer h-2"
                  />
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={maxAttempts}
                    onChange={(e) =>
                      setMaxAttempts(Math.min(200, Math.max(1, Number(e.target.value))))
                    }
                    className="w-16 bg-slate-950 border border-slate-800 text-center font-mono text-xs text-slate-200 rounded-lg py-1.5 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Trigger / Stop buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerFix}
                  disabled={isExecuting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {isExecuting ? "Running..." : "Clone & Trigger Autonomous Fix"}
                </button>
                {isExecuting && (
                  <button
                    onClick={handleStop}
                    className="bg-red-900/50 hover:bg-red-800/60 border border-red-700/50 text-red-400 font-medium py-2.5 px-3 rounded-lg flex items-center gap-1 transition-all"
                    title="Stop monitoring"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Live Log Console ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950/60">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <ScrollText className="w-3.5 h-3.5 text-indigo-400" />
                Live Engine Logs
              </span>
              {isExecuting && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  STREAMING
                </span>
              )}
              {runResult && (
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    runResult === "PASS"
                      ? "text-emerald-400 bg-emerald-950/60 border border-emerald-500/30"
                      : "text-red-400 bg-red-950/60 border border-red-500/30"
                  }`}
                >
                  {runResult}
                </span>
              )}
            </div>
            <div className="h-72 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-slate-950/40">
              {logs.length === 0 ? (
                <p className="text-slate-600 italic">Logs will appear here once the pipeline starts...</p>
              ) : (
                logs.map((line, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed whitespace-pre-wrap ${
                      line.includes("✅") || line.includes("🎉")
                        ? "text-emerald-400"
                        : line.includes("❌") || line.includes("🚨")
                        ? "text-red-400"
                        : line.includes("⚠️")
                        ? "text-yellow-400"
                        : line.includes("🔍") || line.includes("📝")
                        ? "text-sky-400"
                        : "text-slate-300"
                    }`}
                  >
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* PR Success Card */}
          {prUrl && runResult === "PASS" && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Pull Request Created!
              </h3>
              <p className="text-xs text-slate-300 mt-2">
                Olympus cloned the repo, located failing tracebacks, applied verified patches, and opened a PR.
              </p>
              <a
                href={prUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-4 text-xs font-mono text-indigo-400 hover:underline"
              >
                🔗 View PRs on GitHub &rarr;
              </a>
            </div>
          )}
        </div>

        {/* ── Right column: Pipeline Graph + Diff Viewer ── */}
        <div className="lg:col-span-2 space-y-6">
          <AgentGraph activeStep={currentStep} />
          <DiffViewer diffText={patchDiff} />
        </div>
      </div>
    </main>
  );
=======
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Dashboard session={session} />;
>>>>>>> 5660292 (feat(frontend/backend): complete frontend UI overhaul, OAuth auth, telemetry, and runs history API)
}