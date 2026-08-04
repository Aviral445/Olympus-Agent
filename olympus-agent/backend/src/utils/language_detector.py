"""
Language Detector for Project Olympus — Phase 2.

Heuristically identifies the primary programming language of a cloned workspace
so the rest of the pipeline (RAG chunking, SAST, sandbox runner, LLM prompt)
can be tuned per language.

Public API:
    detect_repo_language(workspace_dir: str) -> str
        Returns a lowercase language string: "python" | "javascript" |
        "typescript" | "go" | "java" | "rust"  (falls back to "python")

    LANGUAGE_META: dict
        Per-language display metadata (label, emoji, colour) for the frontend
        badge component.
"""

import os
import sys
import io
from pathlib import Path
from collections import Counter
from typing import Optional

# Force UTF-8 output on Windows so emoji log lines don't crash
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# ─── Manifest-based detection (fast, highest confidence) ──────────────────────

_MANIFEST_RULES: list[tuple[str, str]] = [
    # filename → language  (checked in priority order)
    ("package.json",  "javascript"),   # JS / TS monorepos
    ("tsconfig.json", "typescript"),   # Pure TypeScript projects
    ("go.mod",        "go"),
    ("Cargo.toml",    "rust"),
    ("pom.xml",       "java"),
    ("build.gradle",  "java"),
    ("build.gradle.kts", "java"),
    ("requirements.txt", "python"),
    ("setup.py",      "python"),
    ("pyproject.toml","python"),
]

# ─── Extension-based fallback ─────────────────────────────────────────────────

_EXT_TO_LANG: dict[str, str] = {
    ".py":   "python",
    ".js":   "javascript",
    ".mjs":  "javascript",
    ".cjs":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".jsx":  "javascript",
    ".go":   "go",
    ".java": "java",
    ".rs":   "rust",
    ".rb":   "ruby",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".c":    "c",
}

_SKIP_DIRS = {"venv", ".venv", ".git", "__pycache__", "node_modules", ".tox", "dist", "build", "target"}

# ─── Language display metadata (used by the frontend LanguageBadge) ───────────

LANGUAGE_META: dict[str, dict] = {
    "python":     {"label": "Python",     "emoji": "🐍", "colour": "#3b82f6"},
    "javascript": {"label": "JavaScript", "emoji": "⚡", "colour": "#f59e0b"},
    "typescript": {"label": "TypeScript", "emoji": "🔷", "colour": "#3178c6"},
    "go":         {"label": "Go",         "emoji": "🐹", "colour": "#00add8"},
    "java":       {"label": "Java",       "emoji": "☕", "colour": "#f97316"},
    "rust":       {"label": "Rust",       "emoji": "🦀", "colour": "#ef4444"},
    "ruby":       {"label": "Ruby",       "emoji": "💎", "colour": "#dc2626"},
    "cpp":        {"label": "C++",        "emoji": "⚙️",  "colour": "#8b5cf6"},
    "c":          {"label": "C",          "emoji": "🔩", "colour": "#6b7280"},
}


# ─── Public API ───────────────────────────────────────────────────────────────

def detect_repo_language(workspace_dir: str) -> str:
    """
    Detect the primary language of the repository at workspace_dir.

    Strategy (stops at first conclusive hit):
      1. Manifest file scan (package.json, go.mod, Cargo.toml, pom.xml, ...)
      2. tsconfig.json presence → upgrade javascript → typescript
      3. File-extension frequency count across source files

    Returns a lowercase language string (falls back to "python").
    """
    root = Path(workspace_dir).resolve()
    if not root.exists():
        return "python"

    print(f"[Language Detector]: Analysing {root.name}...")

    # ── Strategy 1: manifest file ──────────────────────────────────────────────
    lang = _detect_from_manifest(root)
    if lang:
        # Refine JS → TS if tsconfig exists alongside package.json
        if lang == "javascript" and (root / "tsconfig.json").exists():
            lang = "typescript"
        meta = LANGUAGE_META.get(lang, {})
        print(f"[Language Detector]: Detected '{lang}' {meta.get('emoji', '')} via manifest.")
        return lang

    # ── Strategy 2: extension frequency ────────────────────────────────────────
    lang = _detect_from_extensions(root)
    meta = LANGUAGE_META.get(lang, {})
    print(f"[Language Detector]: Detected '{lang}' {meta.get('emoji', '')} via extension frequency.")
    return lang


def detect_file_language(file_path: str) -> str:
    """
    Detect language from a single file's extension.
    Used by code_rag.py for per-file chunking.
    """
    ext = Path(file_path).suffix.lower()
    return _EXT_TO_LANG.get(ext, "python")


# ─── Private helpers ──────────────────────────────────────────────────────────

def _detect_from_manifest(root: Path) -> Optional[str]:
    """Check well-known manifest filenames in the repo root."""
    for filename, language in _MANIFEST_RULES:
        if (root / filename).exists():
            return language
    return None


def _detect_from_extensions(root: Path) -> str:
    """Count source file extensions across the workspace and pick the most common language."""
    counts: Counter = Counter()

    for dirpath, dirnames, filenames in os.walk(root):
        # Prune skip dirs in-place
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for fname in filenames:
            ext = Path(fname).suffix.lower()
            lang = _EXT_TO_LANG.get(ext)
            if lang:
                counts[lang] += 1

    if not counts:
        return "python"

    return counts.most_common(1)[0][0]


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    detected = detect_repo_language(target)
    meta = LANGUAGE_META.get(detected, {})
    print(f"Result: {meta.get('emoji', '')} {detected} ({meta.get('label', detected)})")
