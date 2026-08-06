"use client";

import React, { useState } from "react";
import { GitFork, ArrowRight, FileCode2, Layers } from "lucide-react";
import type { DependencyGraphData } from "@/lib/types";

interface DependencyMapProps {
  graphData?: DependencyGraphData;
  errorFile?: string;
  culpritFiles?: string[];
  activeSpecialist?: string;
}

export const DependencyMap: React.FC<DependencyMapProps> = ({
  graphData = { nodes: [], edges: [] },
  errorFile = "",
  culpritFiles = [],
  activeSpecialist = "",
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes, edges } = graphData;

  // Classify node status relative to error file & culprits
  const classifiedNodes = nodes.map((node) => {
    const isError = errorFile && (node.id.endsWith(errorFile) || errorFile.endsWith(node.id) || node.file === errorFile);
    const isCulprit = culpritFiles.some((c) => node.id.endsWith(c) || c.endsWith(node.id) || node.file === c);
    
    // Check callers (who imports node or who node imports)
    const isCaller = edges.some((e) => e.target === node.id && isError);
    const isDependency = edges.some((e) => e.source === node.id && isError);

    let status: "error_origin" | "caller" | "dependency" | "normal" = "normal";
    if (isError) status = "error_origin";
    else if (isCaller || isCulprit) status = "caller";
    else if (isDependency) status = "dependency";

    return { ...node, status };
  });

  return (
    <div
      className="rounded-xl border p-5 shadow-xl flex flex-col gap-4"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-muted)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Import Dependency Graph
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {nodes.length} nodes · {edges.length} edges
          </span>
        </div>

        {activeSpecialist && (
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-semibold">
            {activeSpecialist}
          </span>
        )}
      </div>

      {/* Graph Legend */}
      <div className="flex items-center gap-3 text-[10px] font-mono pb-1 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="flex items-center gap-1 text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Error Origin
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Upstream Caller / Fault
        </span>
        <span className="flex items-center gap-1 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400" /> Downstream Dep
        </span>
      </div>

      {/* Nodes & Edges View */}
      {nodes.length === 0 ? (
        <div className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
          <Layers className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-mono">No import dependencies detected in workspace yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Nodes Grid */}
          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {classifiedNodes.map((n) => {
              const isSelected = selectedNodeId === n.id;
              let bg = "var(--bg-elevated)";
              let border = "var(--border-subtle)";
              let text = "var(--text-secondary)";
              let badge = null;

              if (n.status === "error_origin") {
                bg = "rgba(220, 38, 38, 0.12)";
                border = "rgba(239, 68, 68, 0.4)";
                text = "#FCA5A5";
                badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">FAULT ORIGIN</span>;
              } else if (n.status === "caller") {
                bg = "rgba(217, 119, 6, 0.12)";
                border = "rgba(245, 158, 11, 0.4)";
                text = "#FDE68A";
                badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">CALLER/CULPRIT</span>;
              } else if (n.status === "dependency") {
                bg = "rgba(14, 165, 233, 0.12)";
                border = "rgba(56, 189, 248, 0.4)";
                text = "#7DD3FC";
                badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">DEP</span>;
              }

              const nodeEdges = edges.filter((e) => e.source === n.id || e.target === n.id);

              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedNodeId(isSelected ? null : n.id)}
                  className="rounded-lg p-2.5 transition-all cursor-pointer border"
                  style={{ background: bg, borderColor: isSelected ? "var(--gold)" : border }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-xs truncate">
                      <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate font-semibold" style={{ color: text }}>
                        {n.id}
                      </span>
                    </div>
                    {badge}
                  </div>

                  {/* Expanded Edge Relationships */}
                  {isSelected && nodeEdges.length > 0 && (
                    <div className="mt-2 pt-2 border-t text-[11px] font-mono space-y-1" style={{ borderColor: "var(--border-subtle)" }}>
                      {nodeEdges.map((e, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-slate-500">{e.source === n.id ? "Imports →" : "Imported by ←"}</span>
                          <span className="text-slate-300 font-semibold">{e.source === n.id ? e.target : e.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Import Edges Flow Summary */}
          {edges.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[10px] font-mono uppercase mb-2 text-slate-400">Call Graph Edges ({edges.length})</p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {edges.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60"
                  >
                    <span className="text-slate-300">{e.source}</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                    <span className="text-amber-300">{e.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
