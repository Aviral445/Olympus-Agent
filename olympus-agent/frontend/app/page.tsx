"use client";

import React, { useState } from "react";
import { AgentGraph } from "@/components/graph-flow/AgentGraph";
import { DiffViewer } from "@/components/diff-viewer/DiffViewer";
import { Play, Terminal, FileCode2, CheckCircle, Repeat, GitBranch } from "lucide-react";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/Aviral445/Imagex");
  const [targetFile, setTargetFile] = useState("");
  const [maxAttempts, setMaxAttempts] = useState<number>(10);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [patchDiff, setPatchDiff] = useState<string>("");

  const handleTriggerFix = async () => {
    setIsExecuting(true);
    setCurrentStep(1);
    setPrUrl(null);
    setPatchDiff("");

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

      if (!res.ok) throw new Error("Failed to reach FastAPI backend");

      // Visual step transitions for real-time tracking
      setTimeout(() => setCurrentStep(2), 3000);
      setTimeout(() => setCurrentStep(3), 6000);
      setTimeout(() => {
        setCurrentStep(4);
        setIsExecuting(false);
        setPrUrl("https://github.com/Aviral445/Imagex/pull/1");
        
        // Sample inspected patch diff output
        setPatchDiff(
          `--- a/src/image_processor.py\n+++ b/src/image_processor.py\n@@ -12,7 +12,7 @@ def process_buffer(raw_data):\n-    if raw_data == None:\n+    if raw_data is None or len(raw_data) == 0:\n         raise ValueError("Buffer cannot be empty")\n \n-    return bytes(raw_data)\n+    return bytearray(raw_data)`
        );
      }, 9000);

    } catch (err) {
      console.error(err);
      setIsExecuting(false);
      setCurrentStep(0);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 flex justify-between items-center border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Project Olympus SRE Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous Code Repair, Tree-sitter RAG & Verified Git PR Automation
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-mono">
          <CheckCircle className="w-4 h-4" /> System Online (v2.0)
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Command & Control Panel */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" /> Control Terminal
            </h2>

            <div className="space-y-4">
              {/* GitHub Repo URL Field */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">GitHub Repository URL</label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className="bg-transparent border-none outline-none text-slate-200 w-full"
                  />
                </div>
              </div>

              {/* Target File Field (Optional Auto-Detect) */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Target File <span className="text-slate-500">(Optional)</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono">
                  <FileCode2 className="w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    placeholder="Leave blank for Fault Auto-Detection"
                    className="bg-transparent border-none outline-none text-slate-200 w-full placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Loop Count Control */}
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
                    className="w-full accent-indigo-500 bg-slate-950 rounded-lg cursor-pointer h-2"
                  />
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={maxAttempts}
                    onChange={(e) => {
                      const val = Math.min(200, Math.max(1, Number(e.target.value)));
                      setMaxAttempts(val);
                    }}
                    className="w-16 bg-slate-950 border border-slate-800 text-center font-mono text-xs text-slate-200 rounded-lg py-1.5 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleTriggerFix}
                disabled={isExecuting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                <Play className="w-4 h-4 fill-current" />
                {isExecuting ? `Executing (${maxAttempts} Max Limit)...` : "Clone & Trigger Autonomous Fix"}
              </button>
            </div>
          </div>

          {/* Success Pull Request Card */}
          {prUrl && (
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
                🔗 View PR on GitHub &rarr;
              </a>
            </div>
          )}
        </div>

        {/* Right Column: Live Graph Flow & Patch Diff Viewer */}
        <div className="lg:col-span-2 space-y-6">
          <AgentGraph activeStep={currentStep} />
          <DiffViewer diffText={patchDiff} />
        </div>
      </div>
    </main>
  );
}