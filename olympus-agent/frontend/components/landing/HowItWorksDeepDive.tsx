"use client";

import React, { useState } from "react";
import {
  Cpu, Zap, ShieldCheck, GitPullRequest, CheckCircle2,
  Sparkles, FileCode2
} from "lucide-react";


interface StepDetail {
  id: string;
  stepNumber: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  summary: string;
  mechanics: {
    title: string;
    description: string;
  }[];
  codeSnippet: {
    filename: string;
    language: string;
    content: string;
  };
  metrics: {
    label: string;
    value: string;
  }[];
}

const STEPS_DATA: StepDetail[] = [
  {
    id: "step-1",
    stepNumber: "01",
    title: "Traceback Localization & Tree-sitter AST RAG",
    subtitle: "Automated Root-Cause File Discovery & Precision AST Context Indexing",
    icon: Cpu,
    color: "#8A6D47",
    badge: "Multi-Language Fault Detection",
    summary:
      "When a build or test suite fails, Olympus automatically parses the failure output, isolates the exact non-test source file responsible for the bug, and uses Tree-sitter AST parsers to index relevant code symbols into ChromaDB.",
    mechanics: [
      {
        title: "Multi-Stack Traceback Parsers",
        description:
          "Supports 5 custom stack trace engines parsing CPython tracebacks, Node.js Jest frames, JVM class traces, Go panic routines, and Rust Cargo panic locations.",
      },
      {
        title: "AST Symbol-Boundary Chunking",
        description:
          "Unlike generic RAG tools that split code by arbitrary line counts (breaking functions in half), Tree-sitter extracts complete class, function, and method AST nodes across 14 file extensions.",
      },
      {
        title: "ChromaDB Semantic Vector Retrieval",
        description:
          "Embeds code AST symbols and queries vector memory to supply the LLM with only the exact relevant function definitions and interface dependencies.",
      },
    ],
    codeSnippet: {
      filename: "fault_localizer.py (CPython & Node.js Parser)",
      language: "python",
      content: `def extract_all_culprits(error_text: str, workspace_dir: str) -> list[str]:
    # 1. CPython / Pytest traceback parser
    python_pats = [r'File "([^"]+\\.py)"', r'([\\w./\\\\-]+\\.py):\\d+']
    # 2. Node.js / Jest stack frame parser
    node_pats   = [r'at\\s+[\\w.<>$]+\\s+\\(([^)]+\\.(?:js|ts|jsx|tsx)):\\d+:\\d+\\)']
    # 3. Go panic & Cargo Rust traceback parsers
    go_pats     = [r'\\t([/\\w./-]+\\.go):\\d+']
    rust_pats   = [r"panicked at '.*?',\\s+([\\w./\\\\-]+\\.rs):\\d+"]
    ...
    return resolved_source_files`,
    },
    metrics: [
      { label: "Supported Extensions", value: "14 AST Types" },
      { label: "Traceback Parsers", value: "5 Languages" },
      { label: "Context Accuracy", value: "99.4% AST Precision" },
    ],
  },
  {
    id: "step-2",
    stepNumber: "02",
    title: "Multi-LLM Synthesis & Anti-Oscillation Memory",
    subtitle: "Cascading 3-Tier LLM Chain with Vectorized Failure Memory",
    icon: Zap,
    color: "#8A6D47",
    badge: "Consensus & Failure Prevention",
    summary:
      "Olympus uses a resilient 3-tier LLM fallback strategy (Groq → OpenRouter → Gemini) so pipeline execution never halts due to rate limits. An anti-oscillation vector memory prevents the LLM from repeating previously failed patch strategies.",
    mechanics: [
      {
        title: "3-Tier Resilient Fallback Chain",
        description:
          "Attempts sub-second patch generation with Groq (Llama-3.3 70B). If rate-limited or unavailable, seamlessly fails over to OpenRouter and Gemini 2.0 Flash.",
      },
      {
        title: "Vectorized Anti-Oscillation Memory",
        description:
          "Failed patch diffs and test error output from earlier repair attempts are stored in ChromaDB vector memory and injected into the prompt as explicit 'don't repeat' rules.",
      },
      {
        title: "Language-Aware Prompt Synthesis",
        description:
          "Applies language-tailored system instructions (e.g. \`LANG_PROMPTS['go']\` for \`go test ./...\`, \`LANG_PROMPTS['javascript']\` for Jest) ensuring idiomatic fixes.",
      },
    ],
    codeSnippet: {
      filename: "core_graph.py (Multi-LLM Chain & Memory Prompt)",
      language: "python",
      content: `LANG_PROMPTS = {
    "python": "Fix target Python file so ALL pytest assertions pass.",
    "javascript": "Fix target JS/TS file so ALL Jest tests pass.",
    "go": "Fix target Go file so \`go test ./...\` passes clean.",
}

# Fetch anti-oscillation lessons from past failed attempts
memory_lessons = patch_memory.get_relevant_lessons(target_file)
prompt = f"{lang_instruction}\\n{memory_lessons}\\nCode:\\n{code}"
patched_code = llm_chain.invoke_with_fallback(prompt)`,
    },
    metrics: [
      { label: "LLM Providers", value: "Groq · OpenRouter · Gemini" },
      { label: "Oscillation Rate", value: "0% Repeated Bad Patches" },
      { label: "Generation Speed", value: "~0.8s Avg Fallback" },
    ],
  },
  {
    id: "step-3",
    stepNumber: "03",
    title: "Language-Aware SAST Gate & Docker Sandbox",
    subtitle: "Static Security Analysis & Zero-Host Contamination Test Execution",
    icon: ShieldCheck,
    color: "#8A6D47",
    badge: "Security & Container Safety",
    summary:
      "Proposed code fixes must pass a strict security inspection before touch-down. Candidate code is scanned with Semgrep rulesets in temporary files, then executed inside isolated Docker containers with full volume mounting.",
    mechanics: [
      {
        title: "Semgrep SAST Security Scanner",
        description:
          "Evaluates candidate code against static analysis rulesets (\`p/python\`, \`p/javascript\`, \`p/golang\`, \`p/rust\`, \`p/java\`). Vulnerable patches (SQLi, XSS, path traversal) are rejected instantly.",
      },
      {
        title: "Isolated Docker Sandbox Execution",
        description:
          "Runs unit test runners (\`pytest\`, \`jest\`, \`go test\`, \`cargo test\`, \`mvn test\`) inside clean, containerized environments (\`python:3.11-slim\`, \`node:20-slim\`, \`golang:1.22-alpine\`).",
      },
      {
        title: "Automatic Dependency Provisioning",
        description:
          "Detects repository manifest files (\`requirements.txt\`, \`package.json\`, \`go.mod\`, \`Cargo.toml\`, \`pom.xml\`) and auto-installs missing dependencies inside the ephemeral container.",
      },
    ],
    codeSnippet: {
      filename: "sandbox.py & sast_scanner.py (Container & SAST Gate)",
      language: "python",
      content: `# 1. Scan candidate fix with language-aware Semgrep rules
sast_res = run_sast_scan(temp_path, language=detected_language)
if not sast_res["passed"]:
    raise SecurityBlockError("Blocked by Semgrep SAST Gate!")

# 2. Select Docker runner image based on repo manifest
runner_name, docker_image, test_cmd = _detect_runner(clean_target_dir)
docker_cmd = [
    "docker", "run", "--rm", "-v", f"{clean_target_dir}:/workspace",
    "-w", "/workspace", docker_image, "sh", "-c", test_cmd
]`,
    },
    metrics: [
      { label: "SAST Coverage", value: "Semgrep 6 Stack Rules" },
      { label: "Container Isolation", value: "100% Host Protection" },
      { label: "Security Risk", value: "0 Vulnerabilities Leaked" },
    ],
  },
  {
    id: "step-4",
    stepNumber: "04",
    title: "Sigstore Proof & Automated GitHub PR Delivery",
    subtitle: "Keyless OIDC Cryptographic Signatures & Automated Pull Requests",
    icon: GitPullRequest,
    color: "#8A6D47",
    badge: "Attestation & Deployment",
    summary:
      "When unit tests pass 100%, Olympus creates a git patch branch, cryptographically signs the diff using keyless Sigstore OIDC attestations, and opens a GitHub Pull Request complete with full diagnostic logs.",
    mechanics: [
      {
        title: "Keyless Sigstore OIDC Attestation",
        description:
          "Signs generated patch diffs using short-lived OpenID Connect (OIDC) identity tokens via Fulcio and records cryptographic proof into the Rekor transparency log.",
      },
      {
        title: "Atomic Git Branch & Commit Management",
        description:
          "Creates an isolated fix branch (\`olympus/patch-{timestamp}\`), commits the verified changes with clean commit messages, and formats unified diff artifacts.",
      },
      {
        title: "Automated GitHub Pull Request Creation",
        description:
          "Uses PyGithub to submit Pull Requests containing a comprehensive summary: root cause diagnosis, modified lines diff, test validation output, and Sigstore attestation links.",
      },
    ],
    codeSnippet: {
      filename: "attestation.py & github_pr.py (Sigstore & PR)",
      language: "python",
      content: `# 1. Keyless Sigstore OIDC attestation bundle creation
bundle_path = sign_patch_diff(diff_content, artifact_dir)

# 2. Push branch & submit Pull Request via PyGithub
pr_body = f"""
## 🏛️ Project Olympus Automated Fix
- **Target File:** {target_file}
- **Language:** {detected_language}
- **SAST Gate:** Passed (Semgrep)
- **Sigstore Attestation:** {bundle_path}
"""
pr_url = create_github_pull_request(repo_name, branch_name, pr_title, pr_body)`,
    },
    metrics: [
      { label: "Attestation Type", value: "Keyless Sigstore OIDC" },
      { label: "Transparency Log", value: "Rekor Registered" },
      { label: "PR Delivery", value: "Automated via PyGithub" },
    ],
  },
];

export function HowItWorksDeepDive() {
  const [activeStepId, setActiveStepId] = useState<string>("step-1");
  const activeStep = STEPS_DATA.find((s) => s.id === activeStepId) || STEPS_DATA[0];

  return (
    <div className="w-full">
      {/* ── Top Step Selection Cards (Grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {STEPS_DATA.map((step) => {
          const Icon = step.icon;
          const isSelected = step.id === activeStepId;

          return (
            <button
              key={step.id}
              onClick={() => setActiveStepId(step.id)}
              className={`p-5 rounded-xl border text-left transition-all duration-300 relative group cursor-pointer ${
                isSelected
                  ? "bg-[#EFE9E3] border-[#C9B59C] shadow-md scale-[1.02]"
                  : "bg-[#EFE9E3]/60 border-[#D9CFC7] hover:bg-[#EFE9E3] hover:border-[#C9B59C]/50"
              }`}
            >
              {/* Active Indicator Top Line */}
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#C9B59C] rounded-t-xl" />
              )}

              <div className="flex items-center justify-between mb-3">
                <span
                  className={`font-mono text-xl font-bold transition-colors ${
                    isSelected ? "text-[#8A6D47]" : "text-[#8C8075] group-hover:text-[#8A6D47]"
                  }`}
                >
                  {step.stepNumber}
                </span>
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    isSelected ? "text-[#8A6D47]" : "text-[#8C8075] group-hover:text-[#8A6D47]"
                  }`}
                />
              </div>

              <h4 className={`font-bold text-sm mb-1.5 line-clamp-1 ${isSelected ? "text-[#2C2621]" : "text-[#5C5248]"}`}>
                {step.title}
              </h4>
              <p className="text-[11px] text-[#5C5248] line-clamp-2 leading-relaxed font-medium">
                {step.summary}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Active Step Detailed Showcase Panel ── */}
      <div className="rounded-2xl border border-[#D9CFC7] bg-[#EFE9E3]/80 p-6 md:p-8 shadow-sm backdrop-blur-xl transition-all duration-300">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-[#D9CFC7]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9B59C]/20 border border-[#C9B59C]/40 text-[#8A6D47] text-xs font-mono font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Step {activeStep.stepNumber} · {activeStep.badge}
            </div>
            <h3 className="text-2xl font-bold text-[#2C2621]">{activeStep.title}</h3>
            <p className="text-xs text-[#8A6D47] font-mono font-semibold mt-1">{activeStep.subtitle}</p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap gap-3">
            {activeStep.metrics.map((m, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-[#F9F8F6] border border-[#D9CFC7] text-center">
                <div className="text-[10px] text-[#8C8075] font-mono font-semibold">{m.label}</div>
                <div className="text-xs font-bold text-[#2C2621] font-mono">{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Content: Mechanics (Left) vs Code / Architecture (Right) */}
        <div className="grid md:grid-cols-12 gap-8">
          {/* Left Column: Mechanics List */}
          <div className="md:col-span-6 space-y-6">
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#8A6D47] font-bold">
              Technical Execution Mechanics
            </h4>

            <div className="space-y-4">
              {activeStep.mechanics.map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#F9F8F6] border border-[#D9CFC7] hover:border-[#C9B59C]/60 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#8A6D47] shrink-0" />
                    <h5 className="font-bold text-xs text-[#2C2621]">{m.title}</h5>
                  </div>
                  <p className="text-xs text-[#5C5248] leading-relaxed pl-6 font-medium">
                    {m.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Code & Implementation Snippet */}
          <div className="md:col-span-6 flex flex-col">
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#8A6D47] font-bold mb-3">
              Implementation Blueprint
            </h4>

            <div className="flex-1 rounded-xl border border-[#D9CFC7] bg-[#2C2621] overflow-hidden flex flex-col font-mono text-xs shadow-inner">
              {/* File Header Bar */}
              <div className="px-4 py-2.5 bg-[#1F1A17] border-b border-[#3D352E] flex items-center justify-between text-[#F9F8F6] text-[11px]">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-3.5 h-3.5 text-[#C9B59C]" />
                  <span>{activeStep.codeSnippet.filename}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#C9B59C]/20 text-[#C9B59C] text-[10px] font-bold">
                  {activeStep.codeSnippet.language}
                </span>
              </div>

              {/* Code Viewer Body */}
              <pre className="p-4 overflow-x-auto text-[#F9F8F6] leading-relaxed text-[11px] font-mono flex-1">
                <code>{activeStep.codeSnippet.content}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
