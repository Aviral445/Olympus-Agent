import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LiveHeroAnimation } from "@/components/landing/LiveHeroAnimation";
import {
  ShieldCheck, Cpu, GitPullRequest, Code2, Terminal,
  Zap, RefreshCw, CheckCircle2, Lock, ArrowRight, Play,
  Layers, FileCode, Check, ExternalLink, Activity, Sparkles
} from "lucide-react";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-[#07111d] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* ── Background Glow Orbs & Grid ─────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.22) 0%, transparent 70%), linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      />

      {/* Floating Animated Gradient Orbs */}
      <div className="absolute top-1/4 left-10 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 right-10 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "4s" }} />

      {/* ── Navigation Bar ─────────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-[#162035] bg-[#0d1b2e]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <span className="text-xl">🏛️</span>
            </div>
            <div>
              <span className="font-bold text-base gradient-text tracking-wide">Project Olympus</span>
              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
                v2.0 SRE
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#demo" className="hover:text-indigo-400 transition-colors flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Live Demo
            </a>
            <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
            <a href="#security" className="hover:text-indigo-400 transition-colors">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href="/console"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Launch Console
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-slate-700/60 hover:border-slate-600 transition-all active:scale-95"
              >
                Sign in with GitHub
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="relative z-10 pt-20 pb-12 px-6 max-w-7xl mx-auto text-center">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-xs font-mono mb-8 animate-slide-in shadow-xl shadow-indigo-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Autonomous SRE Agent · LangGraph Pipeline Active
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight mb-6">
          Self-Healing Code Repair{" "}
          <span className="gradient-text">at Scale.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          Point Olympus at any GitHub repository. It autonomously localizes failing tracebacks,
          generates patches via multi-LLM consensus, validates code inside isolated Docker containers,
          signs artifacts with keyless Sigstore, and opens Pull Requests — automatically.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link
            href={session ? "/console" : "/login"}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            {session ? "Enter Agent Console" : "Get Started with GitHub"}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#demo"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Watch Live Simulation
          </a>
        </div>

        {/* ── Interactive Live Simulation Widget ── */}
        <div id="demo" className="mt-6">
          <LiveHeroAnimation />
        </div>
      </section>

      {/* ── Live Animated Stats Bar ────────────────────────────────────── */}
      <section className="relative z-10 border-y border-[#162035] bg-[#0d1b2e]/40 py-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="p-4 rounded-xl hover:bg-white/[0.02] transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">100%</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Autonomous Repair Loop</div>
          </div>
          <div className="p-4 rounded-xl hover:bg-white/[0.02] transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-400 font-mono tracking-tight">3-Tier</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Groq → OpenRouter → Gemini</div>
          </div>
          <div className="p-4 rounded-xl hover:bg-white/[0.02] transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono tracking-tight">0 Code</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Leaked to Unsafe State</div>
          </div>
          <div className="p-4 rounded-xl hover:bg-white/[0.02] transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-sky-400 font-mono tracking-tight">Sigstore</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Keyless Cryptographic Proof</div>
          </div>
        </div>
      </section>

      {/* ── How It Works Section ───────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-xs font-mono text-indigo-400 uppercase tracking-widest mb-2">The Autonomous Cycle</h2>
          <h3 className="text-3xl font-bold text-white">How Project Olympus Operates</h3>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "Traceback Localization & AST RAG",
              desc: "Runs pytest, isolates failing file tracebacks, and indexes AST code symbols with Tree-sitter into ChromaDB.",
              icon: Cpu,
              color: "text-indigo-400",
            },
            {
              step: "02",
              title: "Multi-LLM Patch Generation",
              desc: "Cascades through Groq (Llama-3.3), OpenRouter, and Gemini with anti-oscillation failure memory.",
              icon: Zap,
              color: "text-violet-400",
            },
            {
              step: "03",
              title: "SAST Gate & Docker Sandbox",
              desc: "Scans proposed fixes with Semgrep in temporary files before running unit tests inside clean Docker containers.",
              icon: ShieldCheck,
              color: "text-teal-400",
            },
            {
              step: "04",
              title: "Sigstore Proof & GitHub PR",
              desc: "Cryptographically signs patch diffs with keyless Sigstore OIDC, then pushes the fix branch and opens a GitHub PR.",
              icon: GitPullRequest,
              color: "text-emerald-400",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-xl border border-[#1e304e] bg-[#0d1b2e]/60 p-6 relative hover:border-indigo-500/40 hover:bg-[#0d1b2e]/90 transition-all duration-300 group hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-2xl font-bold text-slate-600 group-hover:text-indigo-400 transition-colors">
                  {s.step}
                </span>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <h4 className="font-semibold text-white text-sm mb-2">{s.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid Section ──────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-[#162035]">
        <div className="text-center mb-16">
          <h2 className="text-xs font-mono text-indigo-400 uppercase tracking-widest mb-2">Engine Capabilities</h2>
          <h3 className="text-3xl font-bold text-white">Built for SRE Resilience</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Autonomous Fault Localization",
              desc: "Parses short & full pytest tracebacks automatically to identify the root-cause file without human prompting.",
              icon: Terminal,
            },
            {
              title: "Tree-sitter AST RAG Search",
              desc: "Chunks code by AST function boundaries instead of arbitrary line counts for precise semantic retrieval.",
              icon: FileCode,
            },
            {
              title: "Anti-Oscillation Memory",
              desc: "Vectorized failure memory prevents the LLM from repeating bad patches across repair attempts.",
              icon: RefreshCw,
            },
            {
              title: "Cascading Multi-LLM Chain",
              desc: "Seamless failover between Groq (Llama-3.3 70B), OpenRouter, and Gemini 2.0 Flash.",
              icon: Zap,
            },
            {
              title: "Semgrep SAST Security Gate",
              desc: "Every candidate patch is scanned for security vulnerabilities before reaching the real codebase.",
              icon: ShieldCheck,
            },
            {
              title: "Docker Container Sandbox",
              desc: "Runs unit tests in clean, isolated docker containers (`python:3.11-slim`) to guarantee execution safety.",
              icon: Code2,
            },
          ].map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e304e] bg-[#0d1b2e]/40 p-6 hover:bg-[#0d1b2e]/80 transition-all duration-300 hover:border-indigo-500/30 hover:-translate-y-1"
            >
              <f.icon className="w-6 h-6 text-indigo-400 mb-4" />
              <h4 className="font-semibold text-white text-base mb-2">{f.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Security & Proof Section ───────────────────────────────────── */}
      <section id="security" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-[#162035]">
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-[#0d1b2e] to-slate-950 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-4">
              <Lock className="w-3.5 h-3.5" /> Keyless Sigstore Verification
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Cryptographic Proof for Every Generated Patch
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              Olympus attaches a keyless Sigstore OIDC attestation bundle to every created commit diff. Maintainers can independently verify that the patch originated from the automated SRE pipeline.
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> OIDC Attestation</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Semgrep Hard Gate</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sandboxed Pytest</div>
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0">
            <Link
              href={session ? "/console" : "/login"}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              {session ? "Go to Console" : "Sign In & Get Started"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[#162035] bg-[#05080f] py-12 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏛️</span>
            <span className="font-bold text-slate-300">Project Olympus</span>
            <span>— Autonomous SRE Engine</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://github.com/Aviral445/Olympus-Agent" target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> GitHub Repository
            </a>
            <span className="text-slate-700">|</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}