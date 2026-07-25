<div align="center">

# 🏛️ Project Olympus

### Autonomous SRE Engine — Self-Healing Code Repair at Scale

*Clone a repo. Find the bug. Patch it. Verify it. Open a PR. Automatically.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-6366f1?style=flat-square&logo=python&logoColor=white)](https://github.com/langchain-ai/langgraph)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-e97627?style=flat-square)](https://www.trychroma.com/)
[![Docker](https://img.shields.io/badge/Docker-Sandbox-2496ed?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Semgrep](https://img.shields.io/badge/Semgrep-SAST_Gate-20b2aa?style=flat-square)](https://semgrep.dev/)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

</div>

---

## What is Project Olympus?

**Project Olympus** is a fully autonomous Site Reliability Engineering (SRE) agent that detects, patches, validates, and deploys code fixes — without human intervention. Point it at any GitHub repository, and it will:

1. **Clone** the repository into an isolated workspace
2. **Localize** the failing file autonomously via `pytest` traceback analysis
3. **Generate** a patch using a cascading multi-LLM fallback chain (Groq → OpenRouter → Gemini)
4. **Gate** the patch through a static security scanner (Semgrep) before touching any real file
5. **Validate** the fix by running the full test suite inside a clean Docker sandbox
6. **Learn** from each failure — past bad patches are stored in a vector memory to prevent oscillation
7. **Commit** the verified patch to a new branch with a Sigstore cryptographic attestation
8. **Open** a GitHub Pull Request with a full summary — automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              Next.js Frontend  (:3000)                              │
│   Control Terminal · Live Log Console · Pipeline Graph · Diff View  │
└───────────────────────┬──────────────────────────────┬──────────────┘
                        │ HTTP / SSE                   │ GitHub Webhook
                        ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                FastAPI Backend  (:8000)                              │
│    /api/v1/trigger  ·  /api/v1/stream/{run_id}  ·  /github-webhook  │
│    Workspace Manager  ·  Fault Localizer  ·  Run Logger (SSE bus)   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ invoke(initial_state)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LangGraph StateGraph Agent Engine                       │
│                                                                      │
│  ┌──────────────────┐   patch     ┌──────────────────┐             │
│  │   Patch Agent    │ ──────────► │ Validation Agent │             │
│  │                  │             │                  │             │
│  │  · RAG retrieval │ ◄── retry ──│  · Docker pytest │             │
│  │  · LLM fallback  │             │  · Root-cause    │             │
│  │  · SAST gate     │             │    isolation     │             │
│  │  · Git commit    │             │  · Memory write  │             │
│  │  · Sigstore sign │             └────────┬─────────┘             │
│  └──────────────────┘                      │                       │
│                                     PASS ──┼──► GitHub PR          │
│                                   max att ─┴──► Human Gate         │
└─────────────────────────────────────────────────────────────────────┘
         │                │                 │
         ▼                ▼                 ▼
    ChromaDB           SQLite          Artifacts
  (RAG + Memory)   (patch_logs)    (.diff + .sigstore)
```

---

## Key Features

| Feature | Description |
|---|---|
| 🤖 **Autonomous Fault Localization** | Runs `pytest`, parses tracebacks, and pinpoints the failing source file automatically |
| 🧠 **Dual RAG System** | Tree-sitter AST-chunked code + ChromaDB for semantic code retrieval |
| 🔁 **Anti-Oscillation Memory** | Past failed patches are vectorized and injected as "don't repeat" lessons |
| ⚡ **Multi-LLM Fallback** | Groq → OpenRouter → Gemini — never blocked by a single rate limit |
| 🛡️ **SAST Hard Gate** | Semgrep scans proposed code in a temp file; bad patches never touch real files |
| 🐳 **Docker Sandboxed Validation** | Tests run in a clean `python:3.11-slim` container — no host contamination |
| 🔐 **Sigstore Attestation** | Every committed patch is cryptographically signed with keyless Sigstore OIDC |
| 📡 **Real-Time SSE Streaming** | Live log output streamed from agent nodes to the browser as the pipeline runs |
| 🔗 **GitHub PR Automation** | Verified patches are automatically pushed and opened as pull requests |
| 🌐 **Webhook Integration** | Listens for GitHub events to trigger autonomous repair pipelines |

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) + Uvicorn — async REST API & SSE streaming
- [LangGraph](https://github.com/langchain-ai/langgraph) — typed `StateGraph` agent orchestration
- [LangChain](https://www.langchain.com/) — LLM integration (Groq, OpenRouter, Gemini)
- [ChromaDB](https://www.trychroma.com/) — local persistent vector store
- [Tree-sitter](https://tree-sitter.github.io/) — AST-level code chunking & symbol extraction
- [Semgrep](https://semgrep.dev/) — static application security testing
- [Sigstore](https://www.sigstore.dev/) — keyless cryptographic patch attestation
- [PyGithub](https://github.com/PyGithub/PyGithub) — GitHub PR automation
- [GitPython](https://gitpython.readthedocs.io/) — local git operations
- [OpenTelemetry](https://opentelemetry.io/) — distributed trace spans
- SQLite — lightweight relational audit log

**Frontend**
- [Next.js 16](https://nextjs.org/) + React 19 + TypeScript
- [TailwindCSS v4](https://tailwindcss.com/) — utility-first styling
- [lucide-react](https://lucide.dev/) — icon set
- Server-Sent Events (SSE) — real-time log streaming

**Infrastructure**
- Docker — isolated `olympus-sandbox` test container

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend runtime |
| Docker | Latest | Required for sandbox validation |
| Git | Any | Repo cloning & patch management |
| Semgrep | Latest | Optional — SAST gate gracefully degrades |

### 1. Clone the Repository

```bash
git clone https://github.com/Aviral445/Olympus-Agent.git
cd Olympus-Agent/olympus-agent
```

### 2. Configure Environment Variables

Create a `.env` file in the `olympus-agent/` directory:

```env
# LLM Providers (at least one required — Groq is recommended as primary)
GROQ_API_KEY=your_groq_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# GitHub Integration (required for PR automation)
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=owner/repo-name
```

> **Get your API keys:**
> - Groq: [console.groq.com](https://console.groq.com) — free tier, very fast
> - OpenRouter: [openrouter.ai/keys](https://openrouter.ai/keys) — routes to 100+ models
> - Gemini: [aistudio.google.com](https://aistudio.google.com) — Google AI Studio
> - GitHub Token: [github.com/settings/tokens](https://github.com/settings/tokens) — needs `repo` scope

### 3. Build the Docker Sandbox

```bash
cd backend
docker build -t olympus-sandbox .
```

### 4. Set Up the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv ../venv

# Windows:
..\venv\Scripts\activate
# macOS/Linux:
source ../venv/bin/activate

# Install dependencies
pip install fastapi uvicorn langgraph langchain langchain-groq \
    langchain-openai langchain-google-genai chromadb \
    tree-sitter-language-pack gitpython PyGithub \
    python-dotenv opentelemetry-sdk opentelemetry-api \
    sigstore semgrep

# Start the backend server
python src/server.py
# Server runs at http://localhost:8000
```

### 5. Set Up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
# UI available at http://localhost:3000
```

### 6. Open the Dashboard

Navigate to [http://localhost:3000](http://localhost:3000) and you will see the Olympus Control Terminal.

---

## Usage

### Option A — Via the Web UI

1. **Enter a GitHub repository URL** (e.g. `https://github.com/username/repo`)
2. **Optionally specify a target file** — leave blank for autonomous fault detection
3. **Set max repair attempts** (slider, 1–200)
4. Click **"Clone & Trigger Autonomous Fix"**
5. Watch the **Live Log Console** and **Pipeline Graph** update in real time
6. On success, view the **Diff Viewer** and click the auto-generated PR link

### Option B — Via the REST API

```bash
# Trigger a repair pipeline
curl -X POST http://localhost:8000/api/v1/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "repo_url": "https://github.com/username/your-repo",
    "target_file": "src/app.py",
    "max_attempts": 10
  }'

# Stream logs via SSE
curl -N http://localhost:8000/api/v1/stream/<run_id>
```

### Option C — GitHub Webhook

Configure a GitHub repository webhook:
- **Payload URL:** `http://your-server:8000/api/v1/github-webhook`
- **Content type:** `application/json`
- **Events:** Push, Issues, or any event you would like to trigger repairs

---

## API Reference

### `POST /api/v1/trigger`

| Field | Type | Required | Description |
|---|---|---|---|
| `repo_url` | string | No | Full GitHub repo URL to clone |
| `repo_name` | string | No | `owner/repo` format |
| `target_file` | string | No | Relative path to buggy file. Leave blank to auto-detect |
| `max_attempts` | int | No | Max repair loop iterations (default: 5, max: 200) |
| `bug_description` | string | No | Human-readable context |

**Response:** `{ "status": "initiated", "run_id": "uuid", "message": "..." }`

### `GET /api/v1/stream/{run_id}`

SSE stream. Emits two event types:
- `{ "type": "log", "message": "..." }` — per-action log line
- `{ "type": "complete", "result": "PASS|FAIL", "diff": "..." }` — final result

### `GET /health`

Returns `{ "status": "healthy", "service": "Project Olympus SRE Engine" }`

---

## How It Works — The Repair Loop

```
Patch Agent                          Validation Agent
──────────────────────────────       ──────────────────────────────
1. Read target file content          1. docker run olympus-sandbox
2. Index codebase (Tree-sitter)         pytest tests/ --tb=short
3. RAG: fetch top-3 code chunks
4. Memory: fetch top-2 failure       2. exit 0 → record PASS
   lessons (anti-oscillation)              → open GitHub PR
5. Build LLM prompt
6. Groq → OpenRouter → Gemini        3. exit 1 → record FAIL
7. Write to .olympus_tmp                   → isolate root-cause file
8. Semgrep SAST scan ←── FAIL: discard    → retry patch agent
9. Atomic os.replace to target file
10. git checkout -B olympus/patch-N
11. git add + commit
12. sigstore sign .diff
```

---

## Project Structure

```
olympus-agent/
├── .env                          # API keys and config
├── frontend/                     # Next.js 16 + TypeScript + Tailwind
│   ├── app/page.tsx              # Main UI: terminal, logs, graph, diff
│   └── components/
│       ├── graph-flow/           # AgentGraph pipeline step visualizer
│       ├── diff-viewer/          # Git diff renderer
│       └── telemetry/            # OTel metrics display
└── backend/
    ├── Dockerfile                # olympus-sandbox (python:3.11-slim + pytest)
    ├── artifacts/                # Signed .diff and .sigstore.json bundles
    ├── workspaces/               # Runtime-cloned external repos
    ├── database/db.py            # SQLite schema + logging
    ├── rag/
    │   ├── code_rag.py           # Tree-sitter AST chunking + ChromaDB indexer
    │   └── patch_memory.py       # Failure memory + anti-oscillation
    └── src/
        ├── server.py             # FastAPI entrypoint + pipeline runner
        ├── agents/core_graph.py  # LangGraph StateGraph
        └── utils/
            ├── attestation.py    # Sigstore diff signing
            ├── git_manager.py    # Branch, diff, commit
            ├── github_pr.py      # PyGithub PR creation
            ├── run_logger.py     # Thread-safe SSE log bus
            ├── sandbox.py        # Docker subprocess executor
            ├── sast_scanner.py   # Semgrep wrapper
            └── telemetry.py      # OpenTelemetry spans
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Recommended | Primary LLM (llama-3.3-70b-versatile) |
| `OPENROUTER_API_KEY` | Optional | Tier-2 LLM fallback (openrouter/auto) |
| `GEMINI_API_KEY` | Optional | Tier-3 LLM fallback (gemini-2.0-flash) |
| `GITHUB_TOKEN` | For PRs | PAT with `repo` scope |
| `GITHUB_REPO` | Optional | Default repo if not in webhook payload |

---

## Roadmap

- [ ] Multi-file patch support — fix bugs spanning multiple source files
- [ ] Streaming diff preview — show incremental diffs as they are generated
- [ ] Replay mode — re-run any historical run from the SQLite audit log
- [ ] Plugin LLM providers — Anthropic Claude, Mistral, local Ollama
- [ ] Docker Compose setup — single-command full-stack launch
- [ ] Web dashboard for run history — searchable table with diffs and outcomes
- [ ] Kubernetes Helm chart — production SRE deployment manifests

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Make your changes with tests where applicable
4. Commit with a clear message: `git commit -m "feat: add multi-file patch support"`
5. Push and open a Pull Request

Please open an issue first for major feature proposals.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

<div align="center">

Built with autonomy and security in mind.

**Project Olympus** — *Because bugs should not wait for humans.*

</div>
