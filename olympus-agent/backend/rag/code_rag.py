"""
Code RAG — Tree-sitter AST chunker + ChromaDB vector index.

Phase 2 upgrades:
  - chunk_file_with_treesitter() now detects language from file extension
    and passes it to tree-sitter-language-pack (40+ languages supported).
  - index_codebase_rag() walks JS, TS, Go, Java, Rust files in addition to Python.
  - retrieve_relevant_code_context() still uses hybrid BM25+vector retrieval.
  - Every chunk tagged with run_id and detected language for traceability.
"""
import sys
import os
from pathlib import Path
from typing import Optional

# Add backend directory to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import chromadb
import tree_sitter_language_pack as tslp

# Store ChromaDB codebase index in backend/rag/data/vector_db
DATA_DIR = CURRENT_DIR / "data" / "vector_db"
DATA_DIR.mkdir(parents=True, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=str(DATA_DIR))
code_collection = chroma_client.get_or_create_collection(name="codebase_chunks")

# ─── Language detection ───────────────────────────────────────────────────────

# File extensions that will be indexed (Python + Phase 2 multi-language)
INDEXED_EXTENSIONS: set[str] = {
    ".py",                        # Python
    ".js", ".mjs", ".cjs",        # JavaScript
    ".ts", ".tsx", ".jsx",        # TypeScript / JSX
    ".go",                        # Go
    ".java",                      # Java
    ".rs",                        # Rust
    ".rb",                        # Ruby
    ".cpp", ".cc", ".c",          # C / C++
}

# Map from file extension → tree-sitter language name
_EXT_TO_TS_LANG: dict[str, str] = {
    ".py":   "python",
    ".js":   "javascript",
    ".mjs":  "javascript",
    ".cjs":  "javascript",
    ".jsx":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".go":   "go",
    ".java": "java",
    ".rs":   "rust",
    ".rb":   "ruby",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".c":    "c",
}

_SKIP_DIRS = {"venv", ".venv", ".git", "__pycache__", "node_modules", ".tox", "dist", "build", "target"}


def _detect_ts_language(file_path: str) -> str:
    """Return the tree-sitter language name for a given file path."""
    ext = Path(file_path).suffix.lower()
    return _EXT_TO_TS_LANG.get(ext, "python")


# ─── AST Chunking ─────────────────────────────────────────────────────────────

def chunk_file_with_treesitter(file_path: str) -> list:
    """
    Parse a source file with Tree-sitter and return a list of chunk dicts.

    Phase 2: language is now auto-detected from the file extension instead of
    being hard-coded to 'python'.  Falls back to whole-file chunking if
    tree-sitter-language-pack does not have a grammar for the detected language.
    """
    if not os.path.exists(file_path):
        return []

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    lang = _detect_ts_language(file_path)
    fname = os.path.basename(file_path)
    chunks = []
    lines = content.splitlines()

    try:
        parsed = tslp.process(content, lang)
        structure = parsed.get("structure", [])

        if not structure:
            # tree-sitter returned no structure (empty file or unsupported grammar)
            return [{
                "id":      fname,
                "content": content,
                "file":    file_path,
                "lang":    lang,
            }]

        for sym in structure:
            sym_name = sym.get("name", "block")
            start_line = max(0, sym.get("line", 1) - 1)
            end_line = min(len(lines), start_line + 35)
            chunk_code = "\n".join(lines[start_line:end_line])

            chunks.append({
                "id":      f"{fname}::{sym_name}",
                "symbol":  sym_name,
                "file":    file_path,
                "lang":    lang,
                "content": f"# File: {fname} | Lang: {lang} | Symbol: {sym_name}\n{chunk_code}",
            })

    except Exception as e:
        print(f"⚠️ [Tree-sitter Chunking Warning] ({lang}): {e}")
        # Graceful degradation: index the whole file as one chunk
        chunks.append({
            "id":      fname,
            "content": content,
            "file":    file_path,
            "lang":    lang,
        })

    return chunks


# ─── Indexing ─────────────────────────────────────────────────────────────────

def index_codebase_rag(target_dir: str, run_id: Optional[str] = None) -> None:
    """
    Walk target_dir and upsert AST chunks for all supported languages into ChromaDB.

    Phase 2: now indexes Python + JS/TS/Go/Java/Rust/Ruby/C/C++ files.

    Args:
        target_dir: Root directory to crawl for source files.
        run_id:     Optional pipeline run identifier — stored as metadata
                    on each chunk for traceability.
    """
    clean_dir = Path(target_dir).resolve()
    if not clean_dir.exists():
        print(f"Directory not found: {target_dir}")
        return

    documents = []
    metadatas = []
    ids       = []
    lang_counts: dict[str, int] = {}

    for root, dirs, files in os.walk(clean_dir):
        # Prune skip dirs in-place so os.walk doesn't descend into them
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]

        for file in files:
            ext = Path(file).suffix.lower()
            if ext not in INDEXED_EXTENSIONS:
                continue

            full_path = os.path.join(root, file)
            file_chunks = chunk_file_with_treesitter(full_path)

            for chunk in file_chunks:
                lang = chunk.get("lang", "unknown")
                lang_counts[lang] = lang_counts.get(lang, 0) + 1

                meta: dict = {
                    "file":   os.path.basename(full_path),
                    "symbol": chunk.get("symbol", "file"),
                    "lang":   lang,
                }
                if run_id:
                    meta["run_id"] = run_id

                documents.append(chunk["content"])
                metadatas.append(meta)
                ids.append(chunk["id"])

    if documents:
        try:
            code_collection.upsert(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            lang_summary = ", ".join(f"{l}={c}" for l, c in sorted(lang_counts.items()))
            print(
                f"🌲 [Tree-sitter RAG]: Indexed {len(documents)} AST chunks "
                f"[{lang_summary}] into ChromaDB."
                + (f" (run_id={run_id})" if run_id else "")
            )
        except Exception as e:
            print(f"⚠️ [Tree-sitter RAG Indexing Error]: {e}")


# ─── Retrieval (hybrid BM25 + vector) ────────────────────────────────────────

def retrieve_relevant_code_context(
    error_log: str,
    top_k: int = 3,
    run_id: Optional[str] = None,
) -> str:
    """
    Retrieve the most relevant code chunks for the given error log.

    Uses hybrid retrieval: ChromaDB semantic search (top-10 candidates)
    re-ranked with BM25, returning the top_k results as a prompt-ready string.

    Args:
        error_log: The test failure log / traceback text to search against.
        top_k:     Number of chunks to include in the returned context block.
        run_id:    Optional run context for tagging (passed to rag_api).

    Returns:
        Formatted multi-line string for LLM prompt inclusion, or "" if no results.
    """
    if not error_log or code_collection.count() == 0:
        return ""

    try:
        from rag.rag_api import query_rag, format_for_prompt, COLLECTION_CODEBASE
        results = query_rag(
            query_text=error_log,
            top_k=top_k,
            collection_name=COLLECTION_CODEBASE,
            run_id=run_id,
            pre_filter_k=10,
        )
        return format_for_prompt(results, "Codebase RAG — Relevant Code & Test Assertions")
    except Exception as e:
        print(f"⚠️ [RAG Context Retrieval Error]: {e}")
        return ""


if __name__ == "__main__":
    print("Testing Tree-sitter Codebase RAG (hybrid retrieval)...")
    sample_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../target_app"))
    index_codebase_rag(sample_dir, run_id="test-run-001")

    query = "FAILED tests/test_calculator.py::test_negative_values - ValueError: Price cannot be negative"
    retrieved = retrieve_relevant_code_context(query)
    print("\nRetrieved Context:\n", retrieved)