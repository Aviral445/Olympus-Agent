import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LiveHeroAnimation } from "@/components/landing/LiveHeroAnimation";
import { HowItWorksDeepDive } from "@/components/landing/HowItWorksDeepDive";
import {
  ShieldCheck, Cpu, GitPullRequest, Code2, Terminal,
  Zap, RefreshCw, CheckCircle2, Lock, ArrowRight, Play,
  Layers, FileCode, Check, ExternalLink, Activity, Sparkles,
  Globe2, Boxes, Server, Flame, Box
} from "lucide-react";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C2621] font-sans selection:bg-[#C9B59C] selection:text-[#1F1A17] relative">
      {/* ── Background Glow Orbs & Grid ─────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,181,156,0.20) 0%, transparent 70%), linear-gradient(rgba(217,207,199,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(217,207,199,0.2) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      />

      {/* Floating Animated Gradient Orbs */}
      <div className="absolute top-1/4 left-10 w-72 h-72 rounded-full bg-[#C9B59C]/15 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 right-10 w-96 h-96 rounded-full bg-[#D9CFC7]/20 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "4s" }} />

      {/* ── Navigation Bar ─────────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-[#D9CFC7] bg-[#F9F8F6]/90 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C9B59C]/20 border border-[#C9B59C]/40 flex items-center justify-center shadow-sm">
              <span className="text-xl">🏛️</span>
            </div>
            <div>
              <span className="font-bold text-base bg-gradient-to-r from-[#2C2621] via-[#A8947D] to-[#2C2621] bg-clip-text text-transparent tracking-wide">
                Project Olympus
              </span>
              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EFE9E3] border border-[#C9B59C]/40 text-[#8A6D47]">
                v2.0 SRE
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#5C5248]">
            <a href="#demo" className="hover:text-[#A8947D] transition-colors flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#C9B59C]" /> Live Demo
            </a>
            <a href="#how-it-works" className="hover:text-[#A8947D] transition-colors">How It Works</a>
            <a href="#ecosystem" className="hover:text-[#A8947D] transition-colors">Ecosystem</a>
            <a href="#features" className="hover:text-[#A8947D] transition-colors">Features</a>
            <a href="#security" className="hover:text-[#A8947D] transition-colors">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href="/console"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#C9B59C] hover:bg-[#B8A287] text-[#1F1A17] transition-all shadow-sm active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Launch Console
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#EFE9E3] hover:bg-[#E5DDD5] text-[#2C2621] border border-[#D9CFC7] transition-all active:scale-95"
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFE9E3] border border-[#C9B59C]/50 text-[#8A6D47] text-xs font-mono font-semibold mb-8 animate-slide-in shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9B59C] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9B59C]" />
          </span>
          Autonomous SRE Agent · LangGraph Pipeline Active
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight mb-6 text-[#2C2621]">
          Self-Healing Code Repair{" "}
          <span className="bg-gradient-to-r from-[#C9B59C] via-[#A8947D] to-[#2C2621] bg-clip-text text-transparent">
            at Scale.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-[#5C5248] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10 font-medium">
          Point Olympus at any GitHub repository. It autonomously localizes failing tracebacks,
          generates patches via multi-LLM consensus, validates code inside isolated Docker containers,
          signs artifacts with keyless Sigstore, and opens Pull Requests — automatically.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link
            href={session ? "/console" : "/login"}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm bg-[#C9B59C] hover:bg-[#B8A287] text-[#1F1A17] transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            {session ? "Enter Agent Console" : "Get Started with GitHub"}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#demo"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-[#EFE9E3] hover:bg-[#E5DDD5] text-[#2C2621] border border-[#D9CFC7] transition-all"
          >
            <Sparkles className="w-4 h-4 text-[#8A6D47]" />
            Watch Live Simulation
          </a>
        </div>

        {/* ── Interactive Live Simulation Widget ── */}
        <div id="demo" className="mt-6">
          <LiveHeroAnimation />
        </div>
      </section>

      {/* ── Live Animated Stats Bar ────────────────────────────────────── */}
      <section className="relative z-10 border-y border-[#D9CFC7] bg-[#EFE9E3]/70 py-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="p-4 rounded-xl hover:bg-[#F9F8F6]/80 transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-[#2C2621] font-mono tracking-tight">100%</div>
            <div className="text-xs text-[#5C5248] mt-1 font-semibold">Autonomous Repair Loop</div>
          </div>
          <div className="p-4 rounded-xl hover:bg-[#F9F8F6]/80 transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-[#8A6D47] font-mono tracking-tight">3-Tier</div>
            <div className="text-xs text-[#5C5248] mt-1 font-semibold">Groq → OpenRouter → Gemini</div>
          </div>
          <div className="p-4 rounded-xl hover:bg-[#F9F8F6]/80 transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-[#8A6D47] font-mono tracking-tight">6+ Stacks</div>
            <div className="text-xs text-[#5C5248] mt-1 font-semibold">Python, JS/TS, Go, Rust, Java</div>
          </div>
          <div className="p-4 rounded-xl hover:bg-[#F9F8F6]/80 transition-colors">
            <div className="text-3xl sm:text-4xl font-extrabold text-[#2C2621] font-mono tracking-tight">Sigstore</div>
            <div className="text-xs text-[#5C5248] mt-1 font-semibold">Keyless Cryptographic Proof</div>
          </div>
        </div>
      </section>

      {/* ── How It Works Section (Expanded Deep Dive) ────────────────────── */}
      <section id="how-it-works" className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xs font-mono text-[#8A6D47] uppercase tracking-widest mb-2 font-bold">The Autonomous Pipeline</h2>
          <h3 className="text-3xl font-bold text-[#2C2621]">How Project Olympus Operates</h3>
          <p className="text-sm text-[#5C5248] max-w-xl mx-auto mt-2 font-medium">
            Click on any phase below to explore the underlying technical mechanics, architectural specs, and real implementation logic.
          </p>
        </div>

        {/* Interactive 4-Step Technical Deep Dive Showcase */}
        <HowItWorksDeepDive />
      </section>

      {/* ── Supported Ecosystem & Multi-Language Matrix ─────────────────── */}
      <section id="ecosystem" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-[#D9CFC7]">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9B59C]/20 border border-[#C9B59C]/40 text-[#8A6D47] text-xs font-mono font-semibold mb-3">
            <Globe2 className="w-3.5 h-3.5" /> Phase 2 Multi-Language Matrix
          </div>
          <h3 className="text-3xl font-bold text-[#2C2621]">Supported Languages & Tooling Ecosystem</h3>
          <p className="text-[#5C5248] text-sm max-w-xl mx-auto mt-2 font-medium">
            Olympus features dedicated language detectors, specialized stack trace parsers, custom Tree-sitter AST indexers, and sandboxed runners for major developer stacks.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              badge: "🐍 Python Stack",
              runner: "pytest / unittest",
              sast: "Bandit + Semgrep (p/python)",
              sandbox: "python:3.11-slim",
              desc: "Native CPython traceback isolation, auto-dependency resolution (`requirements.txt`), and AST symbol indexing.",
              exts: ".py",
            },
            {
              badge: "⚡ JavaScript / TypeScript",
              runner: "Jest / Vitest / Node.js",
              sast: "Semgrep (p/javascript / p/typescript)",
              sandbox: "node:20-slim",
              desc: "Parses Node.js stack frames (`at Object.<anonymous>`), detects `package.json` scripts, and indexes `.js .ts .jsx .tsx` ASTs.",
              exts: ".js, .ts, .jsx, .tsx",
            },
            {
              badge: "🐹 Go Language",
              runner: "go test ./...",
              sast: "Semgrep (p/golang)",
              sandbox: "golang:1.22-alpine",
              desc: "Go panic traceback parser (`goroutine [running]`), `go.mod` manifest detection, and fast compiled container validation.",
              exts: ".go",
            },
            {
              badge: "🦀 Rust / Cargo",
              runner: "cargo test",
              sast: "Semgrep (p/rust)",
              sandbox: "rust:1.78-slim",
              desc: "Cargo panic parser (`panicked at ...`), `Cargo.toml` discovery, and safe compiled memory error verification.",
              exts: ".rs",
            },
            {
              badge: "☕ Java / Kotlin",
              runner: "Maven (mvn test) / Gradle",
              sast: "Semgrep (p/java)",
              sandbox: "maven:3.9-eclipse-temurin",
              desc: "JVM stack trace file locator (`com.example.App.main`), `pom.xml` / `build.gradle` project structure parsing.",
              exts: ".java, .kt",
            },
            {
              badge: "🌳 Tree-sitter AST RAG",
              runner: "14 File Extensions",
              sast: "Multi-Language Semgrep Rules",
              sandbox: "Automated Runner Selection",
              desc: "Extends semantic vector retrieval to C/C++, Ruby, and Web stacks for precise multi-file context assembly.",
              exts: ".rb, .cpp, .c, .h, .json",
            },
          ].map((lang, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#D9CFC7] bg-[#EFE9E3]/80 p-6 relative hover:bg-[#EFE9E3] transition-all duration-300 hover:border-[#C9B59C] hover:-translate-y-1 flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-[#2C2621]">{lang.badge}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C9B59C]/20 text-[#8A6D47] border border-[#C9B59C]/40 font-semibold">
                    {lang.exts}
                  </span>
                </div>
                <p className="text-xs text-[#5C5248] leading-relaxed mb-4">{lang.desc}</p>
              </div>

              <div className="pt-3 border-t border-[#D9CFC7] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-[#5C5248]">
                  <span>Test Runner:</span>
                  <span className="text-[#2C2621] font-semibold">{lang.runner}</span>
                </div>
                <div className="flex justify-between text-[#5C5248]">
                  <span>SAST Engine:</span>
                  <span className="text-[#8A6D47] font-semibold">{lang.sast}</span>
                </div>
                <div className="flex justify-between text-[#5C5248]">
                  <span>Docker Image:</span>
                  <span className="text-[#2C2621]">{lang.sandbox}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid Section ──────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-[#D9CFC7]">
        <div className="text-center mb-16">
          <h2 className="text-xs font-mono text-[#8A6D47] uppercase tracking-widest mb-2 font-bold">Engine Capabilities</h2>
          <h3 className="text-3xl font-bold text-[#2C2621]">Built for SRE Resilience</h3>
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
              className="rounded-xl border border-[#D9CFC7] bg-[#EFE9E3]/70 p-6 hover:bg-[#EFE9E3] transition-all duration-300 hover:border-[#C9B59C] hover:-translate-y-1 shadow-sm"
            >
              <f.icon className="w-6 h-6 text-[#8A6D47] mb-4" />
              <h4 className="font-bold text-[#2C2621] text-base mb-2">{f.title}</h4>
              <p className="text-xs text-[#5C5248] leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Security & Proof Section ───────────────────────────────────── */}
      <section id="security" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-[#D9CFC7]">
        <div className="rounded-2xl border border-[#C9B59C]/40 bg-gradient-to-r from-[#EFE9E3] via-[#F9F8F6] to-[#EFE9E3] p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9F8F6] border border-[#C9B59C]/40 text-[#8A6D47] text-xs font-mono font-semibold mb-4">
              <Lock className="w-3.5 h-3.5" /> Keyless Sigstore Verification
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#2C2621] mb-4">
              Cryptographic Proof for Every Generated Patch
            </h3>
            <p className="text-xs sm:text-sm text-[#5C5248] leading-relaxed mb-6 font-medium">
              Olympus attaches a keyless Sigstore OIDC attestation bundle to every created commit diff. Maintainers can independently verify that the patch originated from the automated SRE pipeline.
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-mono font-semibold text-[#2C2621]">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#8A6D47]" /> OIDC Attestation</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#8A6D47]" /> Semgrep Hard Gate</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#8A6D47]" /> Sandboxed Pytest</div>
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0">
            <Link
              href={session ? "/console" : "/login"}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-[#C9B59C] hover:bg-[#B8A287] text-[#1F1A17] shadow-sm transition-all hover:scale-[1.02]"
            >
              {session ? "Go to Console" : "Sign In & Get Started"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[#D9CFC7] bg-[#EFE9E3] py-12 px-6 text-xs text-[#8C8075]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏛️</span>
            <span className="font-bold text-[#2C2621]">Project Olympus</span>
            <span>— Autonomous SRE Engine</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <a href="https://github.com/Aviral445/Olympus-Agent" target="_blank" rel="noreferrer" className="hover:text-[#8A6D47] transition-colors flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> GitHub Repository
            </a>
            <span className="text-[#D9CFC7]">|</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}