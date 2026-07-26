"""
Unified RAG query API for Project Olympus.

Provides a single `query_rag()` function that:
  1. Performs semantic (vector) search via ChromaDB
  2. Re-ranks results with BM25 (lexical) for hybrid retrieval
  3. Returns ranked chunks with metadata

Exposed via:
  - core_graph.py (Patch Agent internal use)
  - server.py POST /api/v1/rag/query  (REST endpoint for CLI + frontend)
"""
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure backend is on sys.path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import chromadb

# ─── ChromaDB client (shared with code_rag / patch_memory) ────────────────────
DATA_DIR = CURRENT_DIR / "data" / "vector_db"
DATA_DIR.mkdir(parents=True, exist_ok=True)
_chroma_client = chromadb.PersistentClient(path=str(DATA_DIR))

# ─── Available collections ────────────────────────────────────────────────────
COLLECTION_CODEBASE  = "codebase_chunks"
COLLECTION_EXPERIENCE = "patch_experience"

VALID_COLLECTIONS = {COLLECTION_CODEBASE, COLLECTION_EXPERIENCE}


def _get_collection(collection_name: str):
    """Return the ChromaDB collection object, creating it if absent."""
    return _chroma_client.get_or_create_collection(name=collection_name)


def _bm25_rerank(query: str, documents: List[str], top_k: int) -> List[int]:
    """
    BM25 re-rank a list of pre-fetched documents.

    Returns the indices of the top_k documents in BM25-descending order.
    Falls back to original order if rank-bm25 is not installed.
    """
    try:
        from rank_bm25 import BM25Okapi
        tokenized_docs = [doc.lower().split() for doc in documents]
        bm25 = BM25Okapi(tokenized_docs)
        scores = bm25.get_scores(query.lower().split())
        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        return ranked_indices[:top_k]
    except ImportError:
        # Graceful fallback — return first top_k indices unchanged
        return list(range(min(top_k, len(documents))))


def query_rag(
    query_text: str,
    top_k: int = 3,
    collection_name: str = COLLECTION_CODEBASE,
    run_id: Optional[str] = None,
    pre_filter_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    Hybrid BM25 + vector retrieval from a ChromaDB collection.

    Args:
        query_text:      The search query (error log, natural language, code snippet).
        top_k:           Number of final results to return after re-ranking.
        collection_name: "codebase_chunks" or "patch_experience".
        run_id:          Optional run context tag; if provided, results are tagged
                         with the originating run for traceability (not used as a filter
                         since cross-run context is often helpful for the patch agent).
        pre_filter_k:    Number of semantic candidates to fetch from ChromaDB before
                         BM25 re-ranking. Higher = better recall, slower query.

    Returns:
        List of dicts with keys: document, metadata, rank, collection
    """
    if collection_name not in VALID_COLLECTIONS:
        raise ValueError(f"Unknown collection '{collection_name}'. Valid: {VALID_COLLECTIONS}")

    if not query_text or not query_text.strip():
        return []

    collection = _get_collection(collection_name)
    total_docs = collection.count()

    if total_docs == 0:
        return []

    # Step 1 — Semantic retrieval (ChromaDB vector search)
    n_candidates = min(pre_filter_k, total_docs)
    try:
        results = collection.query(
            query_texts=[query_text],
            n_results=n_candidates,
        )
    except Exception as e:
        print(f"⚠️ [RAG API]: ChromaDB query error — {e}")
        return []

    documents: List[str] = results.get("documents", [[]])[0]
    metadatas: List[dict] = results.get("metadatas", [[]])[0]

    if not documents:
        return []

    # Step 2 — BM25 re-ranking over the semantic candidates
    ranked_indices = _bm25_rerank(query_text, documents, top_k)

    # Step 3 — Build final result list
    output = []
    for rank, idx in enumerate(ranked_indices, start=1):
        entry: Dict[str, Any] = {
            "rank":       rank,
            "document":   documents[idx],
            "metadata":   metadatas[idx] if idx < len(metadatas) else {},
            "collection": collection_name,
        }
        if run_id:
            entry["run_id"] = run_id
        output.append(entry)

    return output


def format_for_prompt(results: List[Dict[str, Any]], section_label: str) -> str:
    """
    Convert query_rag() results into a prompt-ready string block.

    Args:
        results:       Output of query_rag().
        section_label: Header label for the block (e.g. "Codebase RAG").

    Returns:
        Multi-line string suitable for inclusion in an LLM prompt.
    """
    if not results:
        return ""

    blocks = [f"\n🎯 [{section_label}]:"]
    for item in results:
        blocks.append(f"---\n{item['document']}")
    return "\n".join(blocks) + "\n"
