import { buildGithubOAuthUrl } from "@/lib/auth";

// GitHub SVG Icon
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error } = await searchParams;
  const oauthUrl = buildGithubOAuthUrl();

  const errorMessages: Record<string, string> = {
    oauth_denied: "GitHub OAuth was denied. Please try again.",
    token_exchange_failed: "Failed to exchange OAuth token. Check your Client Secret.",
    github_api_failed: "Could not reach GitHub API. Try again later.",
    unauthorized: "Your GitHub account is not on the allowlist.",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, var(--bg-base) 60%)",
      }}
    >
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm animate-slide-in">
        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "rgba(13,27,46,0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border-muted)",
            boxShadow: "0 0 0 1px rgba(99,102,241,0.1), 0 25px 50px rgba(0,0,0,0.6)",
          }}
        >
          {/* Logo + Title */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "var(--indigo-glow)",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            >
              <span className="text-2xl">🏛️</span>
            </div>
            <h1 className="text-xl font-bold gradient-text mb-1">Project Olympus</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Autonomous SRE Engine · v2.0
            </p>
          </div>

          {/* Error */}
          {error && errorMessages[error] && (
            <div
              className="mb-4 p-3 rounded-lg text-xs font-mono text-center animate-fade-in"
              style={{
                background: "var(--error-glow)",
                border: "1px solid rgba(244,63,94,0.3)",
                color: "var(--error)",
              }}
            >
              {errorMessages[error]}
            </div>
          )}

          {/* Divider */}
          <div className="mb-6">
            <p className="text-xs text-center mb-5" style={{ color: "var(--text-secondary)" }}>
              Sign in to access the autonomous repair engine
            </p>

            {/* GitHub OAuth button */}
            <a
              href={oauthUrl}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 group"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "var(--text-primary)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
              }}
            >
              <GithubIcon />
              Continue with GitHub
            </a>
          </div>

          {/* Footer */}
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Only authorized GitHub accounts can sign in.
          </p>
        </div>

        {/* Bottom label */}
        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          Self-healing code · Verified PRs · Sandboxed validation
        </p>
      </div>
    </div>
  );
}
