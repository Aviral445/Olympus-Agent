"use client";

import React, { useState } from "react";
import { GitCompare, Copy, Check, FileCode2 } from "lucide-react";

interface DiffViewerProps {
  diffText: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!diffText) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <FileCode2 className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          No patch diff yet. Run a fix pipeline to inspect changes.
        </p>
      </div>
    );
  }

  const lines = diffText.split("\n");

  // Parse file headers for display
  const fileHeader = lines.find((l) => l.startsWith("+++"))?.replace("+++ b/", "") ?? "patch.diff";

  // Count additions and deletions
  const additions = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const deletions = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  return (
    <div
      className="rounded-xl border shadow-xl overflow-hidden"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-muted)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
      >
        <div className="flex items-center gap-3">
          <GitCompare className="w-4 h-4" style={{ color: "var(--indigo-light)" }} />
          <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            {fileHeader}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <span className="text-xs font-mono text-emerald-400">+{additions}</span>
          <span className="text-xs font-mono text-rose-400">-{deletions}</span>
          {/* Copy */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors"
            style={{
              color: copied ? "var(--success)" : "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Diff body */}
      <div className="overflow-auto max-h-80" style={{ background: "#08111f" }}>
        <table className="w-full text-xs font-mono border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              let bg = "transparent";
              let color = "var(--text-muted)";
              let borderLeft = "none";

              if (line.startsWith("+") && !line.startsWith("+++")) {
                bg = "rgba(16,185,129,0.08)";
                color = "#6ee7b7";
                borderLeft = "2px solid rgba(16,185,129,0.5)";
              } else if (line.startsWith("-") && !line.startsWith("---")) {
                bg = "rgba(244,63,94,0.08)";
                color = "#fca5a5";
                borderLeft = "2px solid rgba(244,63,94,0.4)";
              } else if (line.startsWith("@@")) {
                bg = "rgba(99,102,241,0.08)";
                color = "var(--indigo-light)";
              } else if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff")) {
                color = "var(--text-secondary)";
              }

              return (
                <tr key={idx} style={{ background: bg }}>
                  <td
                    className="select-none text-right pr-3 pl-4 w-10 shrink-0"
                    style={{ color: "var(--text-muted)", borderLeft, userSelect: "none" }}
                  >
                    {idx + 1}
                  </td>
                  <td className="pl-2 pr-4 py-0.5 whitespace-pre" style={{ color }}>
                    {line || "\u00A0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};