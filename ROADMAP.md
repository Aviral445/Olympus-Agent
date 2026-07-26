# Project Olympus — Roadmap

> **Solving Any Error Automatically**
> *From single Python files to zero-human-intervention repair across any language, any repo.*

---

## The North Star

```
Developer pushes broken code  →  Olympus detects it  →  Olympus fixes it  →  PR lands in minutes.
No human reads the error. No human writes the fix. No human opens the PR.
```

---

## Phase 1 — Single-File Python Errors ✅ **(Shipping)**

> *The foundation: prove the loop works end-to-end.*

### What's Built
| Capability | Status | File |
|---|---|---|
| LangGraph patch → validate → gate loop | ✅ Done | `backend/src/agents/core_graph.py` |
| Multi-LLM fallback (Groq → OpenRouter → Gemini) | ✅ Done | `core_graph.py` |
| Tree-sitter AST chunking + ChromaDB RAG | ✅ Done | `backend/rag/code_rag.py` |
| Hybrid BM25 + vector retrieval | ✅ Done | `backend/rag/rag_api.py` |
| Patch Memory — anti-oscillation lessons | ✅ Done | `backend/rag/patch_memory.py` |
| Docker sandbox test isolation | ✅ Done | `backend/src/utils/sandbox.py` |
| Semgrep SAST gate (Linux/Docker) | ✅ Done | `backend/src/utils/sast_scanner.py` |
| Sigstore cryptographic attestation | ✅ Done | `backend/src/utils/attestation.py` |
| GitHub PR auto-creation | ✅ Done | `backend/src/utils/github_pr.py` |
| GitHub Webhook trigger | ✅ Done | `backend/src/server.py` |
| SSE real-time log streaming | ✅ Done | `backend/src/server.py` |
| **Apache Kafka durable streaming** | ✅ Done | `backend/kafka/` |
| **CLI (`olympus` command)** | ✅ Done | `cli/cli.py` |
| Next.js frontend dashboard | ✅ Done | `frontend/` |

### Phase 1 Remaining Gaps
- [ ] **SAST on Windows** — Semgrep doesn't run natively on Windows; gate is silently skipped outside Docker/WSL
- [ ] **Workspace caching** — repos are re-cloned on every run; no incremental pull
- [ ] **Error detection without pytest** — relies on test suite existing in the target repo
- [ ] **Single-file scope** — the patcher only rewrites one file per attempt cycle

---

## Phase 2 — Real-Time Frontend Streaming + Multi-Language Support 🔜

> *Make it feel alive. Speak more than Python.*

### Goals
1. **Live frontend terminal** — the existing SSE log console shows plain text; upgrade it to a proper real-time log stream with step-level progress rings, agent state highlighting, and Kafka-backed replay
2. **Multi-language patch support** — extend Tree-sitter AST chunking and the LLM prompt template to handle JavaScript/TypeScript, Go, Java, and Rust errors (not just Python)
3. **Language-aware SAST** — swap Semgrep ruleset per detected language (`p/javascript`, `p/java`, etc.)
4. **Sandbox generalisation** — replace pytest-only validation with language-specific test runners (Jest, Go test, Cargo test, Maven)
5. **Better fault localization** — parse non-pytest stack traces (Node.js, JVM, Go panic) into the same `target_file` interface

### Key Work
| Feature | Approach |
|---|---|
| Multi-language Tree-sitter chunking | `tree-sitter-language-pack` already supports 40+ languages — extend `chunk_file_with_treesitter()` to detect language from file extension |
| Language-aware prompt | Template system: swap test-runner examples and idioms in the LLM prompt per language |
| Jest/Go/Cargo sandbox | Extend `sandbox.py` with a runner registry; select runner based on repo manifest (`package.json`, `go.mod`, `Cargo.toml`) |
| Frontend live terminal upgrade | Kafka consumer in Next.js via `EventSource`; step-level state machine rendering in `AgentGraph` |

---

## Phase 3 — Multi-File Dependency Repair + Cross-Repo Context 🔮

> *Real bugs cross file boundaries. Olympus must too.*

### Goals
1. **Multi-file patch sessions** — a single bug may span `models.py → serializers.py → views.py`; the patcher must identify all affected files and patch them atomically
2. **Cross-repo RAG** — a bug in a service that calls an internal library; Olympus clones both, indexes both, and repairs with full context
3. **Dependency graph traversal** — use Tree-sitter AST + import resolution to build a call graph; walk it to find the actual root cause file rather than only parsing pytest stack traces
4. **Agent specialization** — split the single Patch Agent into specialized sub-agents: `ImportResolverAgent`, `TypeFixAgent`, `LogicRepairAgent` — orchestrated by a router

### Key Work
| Feature | Approach |
|---|---|
| Multi-file state | Extend `AgentState` with `target_files: List[str]` + per-file diff tracking |
| Cross-file RAG context | `index_codebase_rag()` already walks directories — extend to merge multiple repo indexes |
| Atomic multi-file commit | `git_manager.py` already branches; extend `commit_patch()` to commit a file list |
| Dependency graph | `backend/src/utils/code_graph.py` already exists — extend with import edge traversal |

---

## Phase 4 — Any Language, Any Error, Any Repo — Zero Human Intervention 🚀

> *The dream: an autonomous SRE that never sleeps.*

### Goals
1. **Universal language support** — every language with a Tree-sitter grammar and a test runner is supported automatically
2. **Self-improving prompts** — Olympus uses its own patch memory to fine-tune its prompt strategy per language, error class, and codebase style over time
3. **Confidence scoring** — before opening a PR, Olympus self-evaluates the patch with a separate critic LLM call; low-confidence patches are flagged for human review instead of auto-merging
4. **Event-driven architecture** — GitHub push → Kafka event → Olympus picks up → patches → PR; fully headless, no human trigger required
5. **Distributed patch workers** — multiple Olympus instances process different repos in parallel via Kafka consumer groups
6. **Rollback intelligence** — if a merged PR breaks production metrics (via OTLP/Prometheus alerts), Olympus auto-reverts and re-attempts with the failure context

### Architecture Vision (Phase 4)
```
GitHub Push
    │
    ▼
GitHub Webhook → Kafka: olympus.repo.events
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        OlympusWorker   OlympusWorker   OlympusWorker
        (repo-A)        (repo-B)        (repo-C)
              │
              ├── Language Detector
              ├── Dependency Graph Builder
              ├── Multi-File Patcher (LangGraph)
              ├── Confidence Critic (LLM)
              └── PR / Rollback Engine
                              │
                    Kafka: olympus.run.logs
                              │
                    Frontend Dashboard (all workers)
```

---

## Milestones Summary

| Phase | Headline | ETA |
|---|---|---|
| **Phase 1** | Single-file Python errors, CLI, Kafka | ✅ **Now** |
| **Phase 2** | Multi-language + live frontend | Next sprint |
| **Phase 3** | Multi-file + cross-repo | Mid-term |
| **Phase 4** | Any language, any repo, zero-human | Long-term |

---

## Contributing to the Roadmap

Each phase has its own feature branch convention:
- `olympus/phase-2/*` — multi-language and frontend work
- `olympus/phase-3/*` — multi-file and cross-repo work
- `olympus/phase-4/*` — autonomous / distributed work

All patches go through the standard `olympus/patch-attempt-N` branch → PR flow.
