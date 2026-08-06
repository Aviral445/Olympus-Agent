"""
code_graph.py — Multi-Language Import Graph Engine (Phase 3)

Phase 3 upgrades over the original AST symbol scanner:
  - build_import_graph()       : Parses import statements across Python, JS/TS, Go,
                                 and Java source files to build a directed dependency
                                 graph {file -> [imported_files]}.
  - get_call_chain()           : Given the error-origin file, walks the graph backwards
                                 to find all upstream callers (who imports this file?).
  - rank_by_fault_proximity()  : Re-ranks an existing culprit list by graph distance
                                 to the error site so the patcher targets root causes first.
  - graph_to_serializable()    : Converts the raw graph to a JSON-safe {nodes, edges} dict
                                 for the frontend DependencyMap component and API endpoint.
  - parse_file_structure()     : (Phase 1) unchanged — extracts classes/functions from .py.
  - build_repository_map()     : (Phase 1) unchanged — flat AST symbol map.
"""

import os
import sys
import io
import re
import ast

# Force UTF-8 output on Windows for emojis
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from pathlib import Path
from collections import deque
from typing import Optional

# ─── Constants ────────────────────────────────────────────────────────────────

_SKIP_DIRS = {
    "venv", ".venv", ".git", "__pycache__", "node_modules",
    ".tox", "dist", "build", "target", ".next", "out",
}

_SOURCE_EXTENSIONS = {
    ".py", ".js", ".mjs", ".cjs", ".jsx",
    ".ts", ".tsx", ".go", ".java", ".rs",
}


# ─── Phase 1 API (unchanged) ──────────────────────────────────────────────────

def parse_file_structure(file_path: str) -> dict:
    """
    Parses a single Python file into an AST and extracts class/function signatures.
    Phase 1 API — preserved unchanged.
    """
    clean_path = Path(file_path).as_posix()
    if not os.path.exists(clean_path):
        return {"error": f"File not found: {clean_path}"}

    try:
        with open(clean_path, "r", encoding="utf-8") as f:
            code_content = f.read()

        tree = ast.parse(code_content)
        functions, classes = [], []

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                args = [arg.arg for arg in node.args.args]
                functions.append({"name": node.name, "args": args, "line": node.lineno})
            elif isinstance(node, ast.ClassDef):
                classes.append({"name": node.name, "line": node.lineno})

        return {
            "file": os.path.basename(clean_path),
            "functions": functions,
            "classes": classes,
        }
    except Exception as e:
        return {"file": os.path.basename(clean_path), "error": str(e)}


def build_repository_map(target_dir: str = "backend/target_app") -> list:
    """
    Scans a directory and builds an AST symbol map of all Python files.
    Phase 1 API — preserved unchanged.
    """
    repo_map = []
    clean_dir = Path(target_dir).as_posix()
    if not os.path.exists(clean_dir):
        return repo_map

    print(f"🌳 [Code Graph]: Building AST Symbol Map for directory '{target_dir}'...")
    for root, _, files in os.walk(clean_dir):
        for file in files:
            if file.endswith(".py"):
                full_path = os.path.join(root, file)
                parsed = parse_file_structure(full_path)
                repo_map.append(parsed)

    return repo_map


# ─── Phase 3 — Import Parsers per Language ────────────────────────────────────

def _extract_imports_python(source: str, file_path: str, workspace_dir: str) -> list:
    """Parse Python import statements via AST. Returns resolved absolute paths."""
    resolved = []
    try:
        tree = ast.parse(source, filename=file_path)
    except SyntaxError:
        return resolved

    file_dir = os.path.dirname(file_path)

    for node in ast.walk(tree):
        module_parts = []
        level = 0
        if isinstance(node, ast.Import):
            for alias in node.names:
                module_parts = alias.name.split(".")
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module_parts = node.module.split(".")
            level = node.level or 0

        if not module_parts:
            continue

        search_bases = ([file_dir] * level + [workspace_dir]) if level else [workspace_dir, file_dir]
        for base in search_bases:
            candidate = os.path.join(base, *module_parts) + ".py"
            if os.path.isfile(candidate):
                resolved.append(os.path.normpath(candidate))
                break
            pkg = os.path.join(base, *module_parts, "__init__.py")
            if os.path.isfile(pkg):
                resolved.append(os.path.normpath(pkg))
                break

    return resolved


def _extract_imports_js(source: str, file_path: str, workspace_dir: str) -> list:
    """Parse JS/TS relative import/require paths. Returns resolved absolute paths."""
    resolved = []
    file_dir = os.path.dirname(file_path)
    patterns = [
        r"""(?:import\s+.*?from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]""",
        r"""(?:export\s+.*?from\s+)['"](\.[^'"]+)['"]""",
    ]
    for pat in patterns:
        for raw_path in re.findall(pat, source):
            for ext in ("", ".ts", ".tsx", ".js", ".jsx", ".mjs"):
                cand = os.path.normpath(os.path.join(file_dir, raw_path + ext))
                if os.path.isfile(cand):
                    resolved.append(cand)
                    break
            for ext in ("/index.ts", "/index.tsx", "/index.js"):
                cand = os.path.normpath(os.path.join(file_dir, raw_path + ext))
                if os.path.isfile(cand):
                    resolved.append(cand)
                    break
    return resolved


def _extract_imports_go(source: str, file_path: str, workspace_dir: str) -> list:
    """Parse Go import blocks. Resolves local package dirs to representative .go files."""
    resolved = []
    for match in re.finditer(r'"([^"]+)"', source):
        pkg_path = match.group(1)
        pkg_dir = os.path.join(workspace_dir, *pkg_path.split("/"))
        if os.path.isdir(pkg_dir):
            for f in sorted(os.listdir(pkg_dir)):
                if f.endswith(".go") and not f.endswith("_test.go"):
                    resolved.append(os.path.normpath(os.path.join(pkg_dir, f)))
                    break
    return resolved


def _extract_imports_java(source: str, file_path: str, workspace_dir: str) -> list:
    """Parse Java import statements. Resolves FQCN to .java files in workspace."""
    resolved = []
    for match in re.finditer(r'^\s*import\s+([\w.]+)\s*;', source, re.MULTILINE):
        parts = match.group(1).split(".")
        cand = os.path.join(workspace_dir, *parts) + ".java"
        if os.path.isfile(cand):
            resolved.append(os.path.normpath(cand))
    return resolved


def _get_importer(file_path: str):
    """Return the correct import extractor for a given file extension."""
    ext = Path(file_path).suffix.lower()
    return {
        ".py":  _extract_imports_python,
        ".js":  _extract_imports_js, ".mjs": _extract_imports_js,
        ".cjs": _extract_imports_js, ".jsx": _extract_imports_js,
        ".ts":  _extract_imports_js, ".tsx": _extract_imports_js,
        ".go":  _extract_imports_go,
        ".java":_extract_imports_java,
    }.get(ext)


# ─── Phase 3 — Graph Builder ──────────────────────────────────────────────────

def build_import_graph(workspace_dir: str) -> dict:
    """
    Walk all source files in workspace_dir and build a directed import graph.

    Returns:
        dict mapping each source file (absolute path) to the list of files
        it imports (absolute paths that exist in the workspace).

    Example:
        {
          "/repo/app.py":    ["/repo/models.py", "/repo/utils.py"],
          "/repo/models.py": ["/repo/db.py"],
          "/repo/db.py":     [],
        }
    """
    graph: dict = {}
    print(f"🕸️  [Import Graph]: Building import graph for {workspace_dir}...")

    for root, dirs, files in os.walk(workspace_dir):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        for fname in files:
            ext = Path(fname).suffix.lower()
            if ext not in _SOURCE_EXTENSIONS:
                continue

            full_path = os.path.normpath(os.path.join(root, fname))
            importer_fn = _get_importer(full_path)
            if importer_fn is None:
                graph[full_path] = []
                continue
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                    source = fh.read()
                imports = importer_fn(source, full_path, workspace_dir)
                graph[full_path] = list(dict.fromkeys(imports))  # de-duplicate
            except Exception as e:
                print(f"⚠️  [Import Graph]: Could not parse {fname} — {e}")
                graph[full_path] = []

    edge_count = sum(len(v) for v in graph.values())
    print(f"🕸️  [Import Graph]: {len(graph)} nodes, {edge_count} edges discovered.")
    return graph


def get_call_chain(
    error_file: str,
    graph: dict,
    max_depth: int = 4,
) -> list:
    """
    Given the file that raised the error, find all files that import it
    (directly or transitively) — i.e. upstream callers — via reverse BFS.

    Returns ordered list of caller paths (closest callers first).
    Does not include error_file itself.
    """
    # Build reverse graph: tgt -> [srcs that import tgt]
    reverse: dict = {f: [] for f in graph}
    for src, targets in graph.items():
        for tgt in targets:
            tgt_norm = os.path.normpath(tgt)
            if tgt_norm in reverse:
                reverse[tgt_norm].append(src)
            else:
                reverse[tgt_norm] = [src]

    error_norm = os.path.normpath(error_file)
    visited: set = {error_norm}
    result:  list = []
    queue = deque([(error_norm, 0)])

    while queue:
        current, depth = queue.popleft()
        if depth >= max_depth:
            continue
        for caller in reverse.get(current, []):
            c_norm = os.path.normpath(caller)
            if c_norm not in visited:
                visited.add(c_norm)
                result.append(c_norm)
                queue.append((c_norm, depth + 1))

    return result


def rank_by_fault_proximity(
    error_file: str,
    graph: dict,
    culprits: list,
) -> list:
    """
    Re-rank culprit files by their BFS distance to error_file in the import graph.
    Files closer to the error origin are more likely to be the root cause.

    Args:
        error_file: Absolute path of the error-throwing file.
        graph:      Output of build_import_graph().
        culprits:   Candidate files list from the fault localizer.

    Returns:
        Re-ordered list — closest files first.
    """
    error_norm = os.path.normpath(error_file)

    # BFS forward from error_file
    dist: dict = {error_norm: 0}
    queue = deque([error_norm])
    while queue:
        cur = queue.popleft()
        for nb in graph.get(cur, []):
            nb_norm = os.path.normpath(nb)
            if nb_norm not in dist:
                dist[nb_norm] = dist[cur] + 1
                queue.append(nb_norm)

    # BFS backward (callers of error_file)
    reverse: dict = {f: [] for f in graph}
    for src, targets in graph.items():
        for tgt in targets:
            tn = os.path.normpath(tgt)
            reverse.setdefault(tn, []).append(src)

    rev_q = deque([error_norm])
    rev_visited: set = {error_norm}
    while rev_q:
        cur = rev_q.popleft()
        for caller in reverse.get(cur, []):
            cn = os.path.normpath(caller)
            if cn not in dist:
                dist[cn] = 1  # direct caller: distance 1
            if cn not in rev_visited:
                rev_visited.add(cn)
                rev_q.append(cn)

    _INF = 999
    return sorted(culprits, key=lambda p: dist.get(os.path.normpath(p), _INF))


def graph_to_serializable(graph: dict, workspace_dir: str) -> dict:
    """
    Convert the raw import graph to a JSON-serializable {nodes, edges} dict
    suitable for the frontend DependencyMap component and the /dependency-graph API.
    Paths are made relative to workspace_dir for portability.
    """
    def rel(p: str) -> str:
        try:
            return os.path.relpath(p, workspace_dir).replace("\\", "/")
        except ValueError:
            return os.path.basename(p)

    nodes = [{"id": rel(f), "file": os.path.basename(f)} for f in graph]
    edges = [
        {"source": rel(src), "target": rel(tgt)}
        for src, targets in graph.items()
        for tgt in targets
    ]
    return {"nodes": nodes, "edges": edges}


# ─── CLI self-test ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sample_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../target_app")
    )
    print(f"\n=== Phase 3 Import Graph Test: {sample_dir} ===\n")
    g = build_import_graph(sample_dir)
    for src, deps in g.items():
        if deps:
            print(f"  {os.path.basename(src)} -> {[os.path.basename(d) for d in deps]}")
    serial = graph_to_serializable(g, sample_dir)
    print(f"\nNodes: {len(serial['nodes'])}  |  Edges: {len(serial['edges'])}")
