"use client";

import React from "react";
import * as Diff from "diff";
import { FileCode, GitCompare } from "lucide-react";

interface DiffViewerProps {
  diffText: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText }) => {
  if (!diffText) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500 font-mono text-sm">
        No patch diff available yet. Run a fix pipeline to inspect changes.
      </div>
    );
  }

  // Parse git diff output lines
  const lines = diffText.split("\n");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-indigo-400" /> Inspected Patch Diff
        </h3>
        <span className="text-xs font-mono bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 px-2.5 py-1 rounded">
          Unified Diff Format
        </span>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96">
        {lines.map((line, idx) => {
          let lineStyle = "text-slate-400";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineStyle = "bg-emerald-950/50 text-emerald-300 border-l-2 border-emerald-500 pl-2";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineStyle = "bg-rose-950/50 text-rose-300 border-l-2 border-rose-500 pl-2";
          } else if (line.startsWith("@@")) {
            lineStyle = "text-indigo-400 font-bold bg-indigo-950/30 py-1 px-2 my-1 rounded";
          }

          return (
            <div key={idx} className={`${lineStyle} whitespace-pre font-mono py-0.5`}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};