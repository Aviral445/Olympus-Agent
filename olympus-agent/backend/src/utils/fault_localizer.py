"""
Multi-strategy Fault Localizer for Project Olympus.

Phase 2 upgrade — Non-Python stack trace support:
  extract_all_culprits() now parses Node.js/Jest, JVM, Go panic, and Cargo/Rust
  tracebacks in addition to the existing Python/pytest patterns.

Replaces the single pytest-only `auto_discover_target_file()` with a
four-strategy cascade that works even when there are no tests at all.

Strategy order (stops at the first conclusive hit):
  1. pytest        — run tests, parse failure traceback
  2. Static SAST   — Bandit + Ruff to find the file with the most issues
  3. Import/Syntax — AST parse + subprocess import check per source file
  4. LLM review    — ask the LLM to identify the most likely bug (last resort)

Public API:
  discover_fault(workspace_dir) -> tuple[str, str]
      Returns (target_file_path, error_context)
      error_context is injected into initial_state so the patcher has richer input.

  extract_all_culprits(error_text, workspace_dir) -> list[str]
      Parse ALL non-test source file references from any stack trace.
      Used for multi-file patching in core_graph.py.
"""

import ast
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

# ─── Constants ────────────────────────────────────────────────────────────────

_SKIP_DIRS   = {"venv", ".venv", ".git", "__pycache__", "node_modules", ".tox", "dist", "build"}
_SKIP_FILES  = {"setup.py", "conf.py", "conftest.py"}
_TEST_PREFIX = "test_"


# ─── Public API ───────────────────────────────────────────────────────────────

def discover_fault(workspace_dir: str) -> tuple[str, str]:
    """
    Find the most likely buggy file in workspace_dir.

    Tries four strategies in order; stops as soon as one returns a result.

    Returns:
        (target_file_path, error_context)
        error_context is a string summary of the discovered error —
        inject it into initial_state["test_result"] so the patcher has
        a meaningful error signal even without a pytest run.
    """
    print(f"[Fault Localizer]: Analysing workspace at {workspace_dir}...")

    strategies = [
        ("pytest",          _strategy_pytest),
        ("static analysis", _strategy_static_analysis),
        ("import/syntax",   _strategy_import_check),
        ("LLM review",      _strategy_llm_review),
    ]

    for name, fn in strategies:
        print(f"[Fault Localizer]: Trying strategy: {name}...")
        try:
            result = fn(workspace_dir)
            if result:
                file_path, error_ctx = result
                if file_path and os.path.exists(file_path):
                    print(f"[Fault Localizer]: Strategy '{name}' identified culprit: {os.path.basename(file_path)}")
                    return file_path, error_ctx
        except Exception as exc:
            print(f"[Fault Localizer]: Strategy '{name}' raised an exception: {exc}")

    # Absolute fallback — pick the first non-test Python file alphabetically
    fallback = _first_source_file(workspace_dir)
    return fallback, "No specific error context detected — using first source file."


def extract_all_culprits(error_text: str, workspace_dir: str) -> list[str]:
    """
    Parse a traceback string and return ALL non-test source files referenced in it.

    Phase 2: now handles Python/pytest, Node.js/Jest, JVM, Go panic, and
    Cargo/Rust stack trace formats in addition to the original Python patterns.

    Args:
        error_text:    Stack trace / test output string.
        workspace_dir: Cloned repo root — used to verify file existence.

    Returns:
        Ordered list of absolute file paths (de-duplicated, test files excluded).
        Empty list if no files were found.
    """
    seen: set[str] = set()
    culprits: list[str] = []

    def _add(raw_path: str) -> None:
        """Normalise, validate, and append a path if it hasn't been seen."""
        basename = os.path.basename(raw_path)
        if basename.startswith(_TEST_PREFIX) or basename in _SKIP_FILES:
            return
        abs_path = (
            raw_path if os.path.isabs(raw_path)
            else os.path.normpath(os.path.join(workspace_dir, raw_path))
        )
        if abs_path in seen or not os.path.isfile(abs_path):
            return
        seen.add(abs_path)
        culprits.append(abs_path)

    # ── Python / pytest patterns ────────────────────────────────────────────────────────────────
    python_patterns = [
        r'File\s+"([^"]+\.py)"',          # pytest / CPython tracebacks
        r'([\w./\\-]+\.py):\d+',           # ruff/bandit/simple references
    ]
    for pat in python_patterns:
        for raw in re.findall(pat, error_text):
            _add(raw)

    # ── Node.js / Jest patterns ───────────────────────────────────────────────────────────────
    # e.g.: "  at Object.<anonymous> (src/index.js:42:10)"
    # e.g.: "  at src/utils.ts:15:8"
    node_patterns = [
        r'at\s+[\w.<>$]+\s+\(([^)]+\.(?:js|ts|jsx|tsx|mjs|cjs)):\d+:\d+\)',  # jest/node
        r'at\s+([\w./\\-]+\.(?:js|ts|jsx|tsx|mjs|cjs)):\d+:\d+',              # concise form
        r'FAIL\s+([\w./\\-]+\.(?:js|ts|jsx|tsx))',                              # jest FAIL header
    ]
    for pat in node_patterns:
        for raw in re.findall(pat, error_text):
            _add(raw.lstrip())

    # ── JVM (Java / Kotlin) patterns ───────────────────────────────────────────────────────────
    # e.g.: "  at com.example.App.main(App.java:15)"
    jvm_pattern = r'at\s+[\w.$]+\.(?:[\w$]+)\(([\w]+\.(?:java|kt)):(\d+)\)'
    for match in re.finditer(jvm_pattern, error_text):
        java_file = match.group(1)  # e.g. "App.java"
        # Search the workspace for this filename (JVM stack has no full path)
        for root, dirs, files in os.walk(workspace_dir):
            dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
            if java_file in files:
                _add(os.path.join(root, java_file))
                break

    # ── Go panic patterns ───────────────────────────────────────────────────────────────────────
    # e.g.: "goroutine 1 [running]: main.foo()\n\t/abs/path/main.go:23 +0x..."
    go_patterns = [
        r'\t([/\w./-]+\.go):\d+',           # absolute path form
        r'([\w./\\-]+\.go):\d+',            # relative path form
    ]
    for pat in go_patterns:
        for raw in re.findall(pat, error_text):
            _add(raw.strip())

    # ── Rust / Cargo patterns ──────────────────────────────────────────────────────────────────────
    # e.g.: "thread 'main' panicked at 'reason', src/lib.rs:10:5"
    # e.g.: "  --> src/main.rs:42:8"
    rust_patterns = [
        r"panicked at '.*?',\s+([\w./\\-]+\.rs):\d+",   # panic message
        r"panicked at\s+([\w./\\-]+\.rs):\d+",           # Rust 2021+ format
        r'-->\s+([\w./\\-]+\.rs):\d+:\d+',               # compiler error arrow
    ]
    for pat in rust_patterns:
        for raw in re.findall(pat, error_text):
            _add(raw.strip())

    return culprits



# ─── Strategy 1: pytest ───────────────────────────────────────────────────────

def _strategy_pytest(workspace_dir: str) -> Optional[tuple[str, str]]:
    """Run pytest and parse the failure traceback."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "--tb=short", "-q"],
            cwd=workspace_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout + "\n" + result.stderr

        # No tests collected → signal to try next strategy
        if "no tests ran" in output.lower() or "collected 0 items" in output.lower():
            print("[Fault Localizer/pytest]: No tests found in workspace.")
            return None

        # All tests passed → nothing to fix
        if result.returncode == 0:
            print("[Fault Localizer/pytest]: All tests passed — no fault to localise.")
            return None

        # Parse culprit files from traceback
        culprits = extract_all_culprits(output, workspace_dir)
        if culprits:
            return culprits[0], output

        # pytest ran but no file reference found — return first source file with full output
        fallback = _first_source_file(workspace_dir)
        return (fallback, output) if fallback else None

    except subprocess.TimeoutExpired:
        print("[Fault Localizer/pytest]: Timed out.")
        return None


# ─── Strategy 2: Static analysis (Bandit + Ruff) ─────────────────────────────

def _strategy_static_analysis(workspace_dir: str) -> Optional[tuple[str, str]]:
    """
    Run Bandit and Ruff across the workspace.
    Returns the file with the most combined findings.
    """
    findings_map: dict[str, list[str]] = {}  # file_path → [issue descriptions]

    # ── Bandit ────────────────────────────────────────────────────────────────
    try:
        bandit_result = subprocess.run(
            ["bandit", "-r", "--format", "json", "--quiet", workspace_dir],
            capture_output=True, text=True, timeout=60,
        )
        if bandit_result.stdout.strip():
            data = json.loads(bandit_result.stdout)
            for issue in data.get("results", []):
                fpath = os.path.normpath(issue.get("filename", ""))
                if not fpath or os.path.basename(fpath).startswith(_TEST_PREFIX):
                    continue
                severity = issue.get("issue_severity", "")
                text     = issue.get("issue_text", "unknown issue")
                line     = issue.get("line_number", 0)
                findings_map.setdefault(fpath, []).append(
                    f"[Bandit/{severity}] Line {line}: {text}"
                )
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        pass  # Bandit not installed — skip

    # ── Ruff ──────────────────────────────────────────────────────────────────
    try:
        ruff_result = subprocess.run(
            ["ruff", "check", "--output-format", "json", workspace_dir],
            capture_output=True, text=True, timeout=60,
        )
        if ruff_result.stdout.strip():
            for issue in json.loads(ruff_result.stdout):
                fpath = os.path.normpath(issue.get("filename", ""))
                if not fpath or os.path.basename(fpath).startswith(_TEST_PREFIX):
                    continue
                code    = issue.get("code", "?")
                message = issue.get("message", "")
                line    = issue.get("location", {}).get("row", 0)
                findings_map.setdefault(fpath, []).append(
                    f"[Ruff/{code}] Line {line}: {message}"
                )
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        pass  # Ruff not installed — skip

    if not findings_map:
        return None

    # Pick the file with the highest finding count
    worst_file = max(findings_map, key=lambda p: len(findings_map[p]))
    error_ctx  = f"Static analysis findings in {os.path.basename(worst_file)}:\n" + \
                 "\n".join(findings_map[worst_file][:20])
    return worst_file, error_ctx


# ─── Strategy 3: Import / Syntax check ───────────────────────────────────────

def _strategy_import_check(workspace_dir: str) -> Optional[tuple[str, str]]:
    """
    Walk source files and check for:
      a) SyntaxErrors via ast.parse()
      b) ImportErrors / RuntimeErrors via subprocess import attempt
    """
    source_files = list(_iter_source_files(workspace_dir))

    # ── Pass A: AST syntax check (fast, no subprocess) ────────────────────────
    for fpath in source_files:
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                source = fh.read()
            ast.parse(source, filename=fpath)
        except SyntaxError as syn_err:
            error_ctx = (
                f"SyntaxError in {os.path.basename(fpath)}:\n"
                f"  Line {syn_err.lineno}: {syn_err.msg}\n"
                f"  {syn_err.text or ''}"
            )
            print(f"[Fault Localizer/syntax]: SyntaxError in {os.path.basename(fpath)}")
            return fpath, error_ctx

    # ── Pass B: Import check (slower — subprocess per file) ───────────────────
    for fpath in source_files:
        try:
            imp_result = subprocess.run(
                [sys.executable, "-c", f"import ast, importlib.util; "
                 f"spec=importlib.util.spec_from_file_location('m', r'{fpath}'); "
                 f"mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)"],
                capture_output=True,
                text=True,
                timeout=8,
                cwd=workspace_dir,
            )
            if imp_result.returncode != 0 and imp_result.stderr.strip():
                stderr = imp_result.stderr.strip()
                # Filter out benign "no module named" for optional deps
                if any(x in stderr for x in ("ModuleNotFoundError", "ImportError", "NameError", "AttributeError")):
                    error_ctx = f"Import/runtime error in {os.path.basename(fpath)}:\n{stderr[:600]}"
                    print(f"[Fault Localizer/import]: Error importing {os.path.basename(fpath)}")
                    return fpath, error_ctx
        except subprocess.TimeoutExpired:
            continue  # File has an infinite loop or heavy startup — skip

    return None


# ─── Strategy 4: LLM static review (last resort) ─────────────────────────────

def _strategy_llm_review(workspace_dir: str) -> Optional[tuple[str, str]]:
    """
    Read the most likely entry-point file and ask the LLM to identify the bug.
    Only used when all previous strategies found nothing.
    """
    entry_file = _find_entry_point(workspace_dir)
    if not entry_file:
        return None

    try:
        with open(entry_file, "r", encoding="utf-8", errors="ignore") as fh:
            source = fh.read()
    except OSError:
        return None

    prompt = (
        "You are a code review tool. Read the following Python source file and "
        "identify the single most likely bug or code quality issue. "
        "Reply with exactly two lines:\n"
        "LINE: <line number>\n"
        "ISSUE: <one sentence describing the bug>\n\n"
        f"File: {os.path.basename(entry_file)}\n\n{source[:3000]}"
    )

    try:
        # Import lazily to avoid circular dependency issues at module load time
        from src.agents.core_graph import invoke_llm_with_fallback
        response = invoke_llm_with_fallback(prompt).strip()
        error_ctx = f"LLM static review of {os.path.basename(entry_file)}:\n{response}"
        print(f"[Fault Localizer/LLM]: Review complete for {os.path.basename(entry_file)}")
        return entry_file, error_ctx
    except Exception as exc:
        print(f"[Fault Localizer/LLM]: LLM review failed ({exc})")
        return None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _iter_source_files(workspace_dir: str):
    """Yield absolute paths to non-test .py source files in workspace."""
    for root, dirs, files in os.walk(workspace_dir):
        # Prune skip directories in-place so os.walk doesn't descend into them
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        for fname in sorted(files):
            if not fname.endswith(".py"):
                continue
            if fname.startswith(_TEST_PREFIX) or fname in _SKIP_FILES:
                continue
            yield os.path.join(root, fname)


def _first_source_file(workspace_dir: str) -> str:
    """Return the first non-test .py source file found (alphabetical walk)."""
    for fpath in _iter_source_files(workspace_dir):
        return fpath
    return ""


def _find_entry_point(workspace_dir: str) -> str:
    """Heuristically find the main entry-point file for the LLM review strategy."""
    candidates = ["app.py", "main.py", "__main__.py", "run.py", "manage.py", "server.py"]
    for candidate in candidates:
        path = os.path.join(workspace_dir, candidate)
        if os.path.exists(path):
            return path
    return _first_source_file(workspace_dir)
