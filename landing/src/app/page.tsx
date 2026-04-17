import Image from "next/image";
import InteractiveDemo from "./InteractiveDemo";
import StickyNav from "./StickyNav";

/* ─── Inline SVG Components ───────────────────────────────────── */

function ChromeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="8" x2="21" y2="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8.5" y1="14" x2="2" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15.5" y1="14" x2="17" y2="22" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
      <path d="M12 6v6l4 2" />
      <path d="M16.24 7.76l-4.24 4.24" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/* ─── Feature Card Component ──────────────────────────────────── */

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className={`group relative rounded-2xl border border-border bg-card-bg p-8 transition-all duration-300 hover:border-accent/30 hover:-translate-y-1 animate-fade-in-up ${delay}`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <div className="mb-5 inline-flex items-center justify-center rounded-xl bg-accent-light p-3 text-accent transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mb-3 text-lg font-semibold text-heading">{title}</h3>
      <p className="text-sm leading-relaxed text-foreground-muted">{description}</p>
    </div>
  );
}

/* ─── Trust Badge Component ───────────────────────────────────── */

function TrustBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background-subtle px-3 py-1 text-xs font-medium text-foreground-muted">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-leaf" />
      {text}
    </span>
  );
}

/* ─── Step Component ──────────────────────────────────────────── */

function Step({
  number,
  title,
  description,
  delay,
}: {
  number: string;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div className={`flex gap-5 animate-fade-in-up ${delay}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
        {number}
      </div>
      <div>
        <h3 className="mb-1 text-base font-semibold text-heading">{title}</h3>
        <p className="text-sm leading-relaxed text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN PAGE                                                       */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* ── Sticky Navigation (Client Component) ──────────────── */}
      <StickyNav />

      {/* ── Hero Section ─────────────────────────────────────── */}
      <main className="flex flex-1 flex-col">
        <section
          id="hero"
          className="grain-overlay relative flex min-h-[100dvh] flex-col items-center justify-center px-6 pt-16"
        >
          {/* Subtle dot grid background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--foreground) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Top trust badges */}
          <div className="mb-10 flex flex-wrap justify-center gap-3 animate-fade-in delay-100">
            <TrustBadge text="Open Source" />
            <TrustBadge text="Privacy-First" />
            <TrustBadge text="Free Forever" />
          </div>

          {/* Shield icon */}
          <div className="mb-8 animate-float">
            <Image
              src="/shield-icon.png"
              alt="GitX1 Shield"
              width={96}
              height={96}
              priority
              className="animate-fade-in delay-200"
            />
          </div>

          {/* Headline */}
          <h1 className="max-w-3xl text-center text-4xl font-bold leading-[1.15] tracking-tight text-heading animate-fade-in-up delay-300 sm:text-5xl lg:text-6xl">
            GitX1 PR Moderator:{" "}
            <span className="text-gradient">
              The Ultimate AI&nbsp;Slop Firewall
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 max-w-2xl text-center text-lg leading-relaxed text-foreground-muted animate-fade-in-up delay-400 sm:text-xl">
            Protect your open-source repositories from low-effort, AI-generated
            pull requests without blocking human contributors.
          </p>

          {/* CTA Group */}
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row animate-fade-in-up delay-500">
            {/* Primary CTA */}
            <a
              href="https://chromewebstore.google.com/detail/gitx1-pr-moderator"
              id="cta-add-to-chrome"
              target="_blank"
              rel="noopener noreferrer"
              className="animate-pulse-ring group relative inline-flex h-14 items-center gap-3 rounded-full bg-accent px-8 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-accent-hover hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]"
            >
              <ChromeIcon />
              Add to Chrome — It&apos;s Free
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRightIcon />
              </span>
            </a>

            {/* Secondary CTA */}
            <a
              href="https://github.com/AIMishtworking/gitx1"
              id="cta-view-source"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center gap-2.5 rounded-full border border-border px-8 text-sm font-medium text-foreground-muted transition-all duration-300 hover:border-accent/40 hover:text-heading hover:bg-accent-light"
            >
              <GitHubIcon />
              View Source on GitHub
            </a>
          </div>

          {/* Version info */}
          <p className="mt-8 text-xs text-foreground-muted/60 animate-fade-in delay-700">
            v0.1.0 · Chrome &amp; Edge · Manifest V3
          </p>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 flex flex-col items-center gap-2 animate-fade-in delay-700">
            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground-muted/40">
              Scroll
            </span>
            <div className="h-8 w-[1px] bg-gradient-to-b from-foreground-muted/30 to-transparent" />
          </div>
        </section>

        {/* ── Social Proof Ribbon ─────────────────────────────── */}
        <section className="border-y border-border/60 bg-background-subtle py-10">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.15em] text-foreground-muted/60">
              Built for maintainers who care about code quality
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-foreground-muted">
              <span className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-accent" />
                AI Slop Detection
              </span>
              <span className="flex items-center gap-2">
                <GaugeIcon className="h-4 w-4 text-accent" />
                Instant Scoring
              </span>
              <span className="flex items-center gap-2">
                <EyeIcon className="h-4 w-4 text-accent" />
                Zero Data Collection
              </span>
              <span className="flex items-center gap-2">
                <GitBranchIcon className="h-4 w-4 text-accent" />
                Works on Any Repo
              </span>
            </div>
          </div>
        </section>

        {/* ── How It Works — Bento Grid ─────────────────────────── */}
        <section id="how-it-works" className="py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6">
            {/* Section header */}
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                4-Layer Architecture
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
                How it Works
              </h2>
              <p className="mt-4 mx-auto max-w-xl text-base text-foreground-muted">
                Every pull request passes through four independent detection layers — each catching what the others miss.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="bento-grid">

              {/* ── Card 1: Instant Triage ────────────────────────── */}
              <div className="bento-card animate-fade-in-up delay-100" id="bento-instant-triage">
                <div className="flex items-start gap-4 mb-5">
                  <span className="bento-layer-badge">L1</span>
                  <div>
                    <h3 className="text-lg font-semibold text-heading">Instant Triage</h3>
                    <p className="text-xs text-foreground-muted/60 mt-0.5">Layer 1 · Metadata Analysis</p>
                  </div>
                </div>

                {/* Decorative: Rule grid visualization */}
                <div className="mb-5 rounded-xl bg-background-subtle border border-border/60 p-4">
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: 34 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-2 rounded-sm transition-colors duration-300"
                        style={{
                          background: i < 28
                            ? `rgba(0, 128, 128, ${0.15 + (i / 34) * 0.5})`
                            : `rgba(61, 153, 112, ${0.2 + ((i - 28) / 6) * 0.6})`,
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-2.5 text-[11px] text-foreground-muted/50 text-center">34 metadata rules evaluated per PR</p>
                </div>

                <p className="text-sm leading-relaxed text-foreground-muted">
                  Runs in <span className="bento-stat">&lt;15s</span> with{" "}
                  <span className="bento-stat">34</span> language-agnostic metadata
                  rules. Catches obvious AI slop instantly — before heavier analysis
                  even begins.
                </p>
              </div>

              {/* ── Card 2: Reputation Score ──────────────────────── */}
              <div className="bento-card animate-fade-in-up delay-200" id="bento-reputation-score">
                <div className="flex items-start gap-4 mb-5">
                  <span className="bento-layer-badge">L2</span>
                  <div>
                    <h3 className="text-lg font-semibold text-heading">Reputation Score</h3>
                    <p className="text-xs text-foreground-muted/60 mt-0.5">Layer 2 · Contributor Trust</p>
                  </div>
                </div>

                {/* Decorative: Trust meter */}
                <div className="mb-5 rounded-xl bg-background-subtle border border-border/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-foreground-muted/60">Trust Level</span>
                    <span className="text-[11px] font-mono font-semibold text-accent">87 / 100</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-border/60 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "87%",
                        background: "linear-gradient(90deg, var(--accent) 0%, var(--leaf) 100%)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-foreground-muted/40">
                    <span>New Account</span>
                    <span>Trusted Contributor</span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-foreground-muted">
                  Calculates trust based on <span className="bento-stat">account age</span> and{" "}
                  <span className="bento-stat">PR acceptance history</span>. New accounts
                  with zero merged PRs get extra scrutiny; established contributors
                  get a trust boost.
                </p>
              </div>

              {/* ── Card 3: Structural AST ────────────────────────── */}
              <div className="bento-card animate-fade-in-up delay-300" id="bento-structural-ast">
                <div className="flex items-start gap-4 mb-5">
                  <span className="bento-layer-badge">L3</span>
                  <div>
                    <h3 className="text-lg font-semibold text-heading">Structural AST</h3>
                    <p className="text-xs text-foreground-muted/60 mt-0.5">Layer 3 · Deep Code Analysis</p>
                  </div>
                </div>

                {/* Decorative: AST tree visualization */}
                <div className="mb-5 rounded-xl bg-background-subtle border border-border/60 p-4 font-mono text-[11px] leading-5 text-foreground-muted/70">
                  <div className="flex items-center gap-2">
                    <span className="text-accent">▸</span>
                    <span>Program</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-accent">▸</span>
                    <span>FunctionDecl</span>
                    <span className="bento-stat text-[9px] py-0 px-1.5">WASM</span>
                  </div>
                  <div className="flex items-center gap-2 ml-8">
                    <span className="text-leaf">●</span>
                    <span>BlockStatement <span className="text-foreground-muted/40">× 14</span></span>
                  </div>
                  <div className="flex items-center gap-2 ml-8">
                    <span className="text-leaf">●</span>
                    <span>Identifier <span className="text-foreground-muted/40">× 31</span></span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-accent">▸</span>
                    <span>ClassDecl <span className="text-foreground-muted/40">— bloat detected</span></span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-foreground-muted">
                  Powered by <span className="bento-stat">Rust</span> &amp;{" "}
                  <span className="bento-stat">WebAssembly (WASM)</span> to catch AI
                  syntax bloat natively. Parses abstract syntax trees to find
                  over-engineered, copy-paste patterns LLMs love to generate.
                </p>
              </div>

              {/* ── Card 4: Local AI Consensus ────────────────────── */}
              <div className="bento-card animate-fade-in-up delay-400" id="bento-local-ai-consensus">
                <div className="flex items-start gap-4 mb-5">
                  <span className="bento-layer-badge">L4</span>
                  <div>
                    <h3 className="text-lg font-semibold text-heading">Local AI Consensus</h3>
                    <p className="text-xs text-foreground-muted/60 mt-0.5">Layer 4 · Ensemble Voting</p>
                  </div>
                </div>

                {/* Decorative: Engine voting visualization */}
                <div className="mb-5 rounded-xl bg-background-subtle border border-border/60 p-4">
                  <div className="space-y-2">
                    {[
                      { name: "Engine 1", vote: "slop", conf: 94 },
                      { name: "Engine 2", vote: "slop", conf: 88 },
                      { name: "Engine 3", vote: "human", conf: 72 },
                      { name: "Engine 4", vote: "slop", conf: 91 },
                      { name: "Engine 5", vote: "slop", conf: 85 },
                      { name: "Engine 6", vote: "slop", conf: 79 },
                      { name: "Engine 7", vote: "human", conf: 66 },
                    ].map((engine, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-foreground-muted/50 font-mono shrink-0">{engine.name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-border/60 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${engine.conf}%`,
                              background: engine.vote === "slop"
                                ? "var(--accent)"
                                : "var(--leaf)",
                            }}
                          />
                        </div>
                        <span className={`w-10 text-right font-mono font-semibold ${engine.vote === "slop" ? "text-accent" : "text-leaf"}`}>
                          {engine.conf}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-foreground-muted/40">Consensus</span>
                    <span className="text-[11px] font-mono font-bold text-accent">5/7 → AI Slop</span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-foreground-muted">
                  <span className="bento-stat">7</span> independent detection
                  engines running <span className="bento-stat">100% locally</span> in
                  your browser. No API calls, no cloud — the consensus vote determines
                  the final Slop Score with zero data leaving your machine.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ── Interactive Demo: Show, Don't Tell ──────────────── */}
        <InteractiveDemo />

        {/* ── Features Grid ───────────────────────────────────── */}
        <section
          id="features"
          className="border-t border-border/60 bg-background-subtle py-24 sm:py-32"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                Features
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
                Everything you need to guard your repo
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<ShieldIcon />}
                title="Slop Score Analysis"
                description="Multi-signal algorithm analyzes diffs, commit messages, and contributor history to score each PR on a 0–100 scale."
                delay="delay-100"
              />
              <FeatureCard
                icon={<GaugeIcon />}
                title="Real-Time Badge"
                description="A lightweight badge is injected directly into the GitHub PR page — instantly see the score without opening a side panel."
                delay="delay-200"
              />
              <FeatureCard
                icon={<EyeIcon />}
                title="Side Panel Dashboard"
                description="Open the detailed analysis dashboard in Chrome's Side Panel for signal breakdowns, confidence charts, and actionable insights."
                delay="delay-300"
              />
              <FeatureCard
                icon={<GitBranchIcon />}
                title="Turbo-Nav Aware"
                description="Built for GitHub's SPA architecture — handles turbo:load events so the extension works seamlessly as you navigate between PRs."
                delay="delay-400"
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                title="Privacy First"
                description="All analysis runs locally in your browser. No data is sent to external servers. Your code stays yours — always."
                delay="delay-500"
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20V10" />
                    <path d="M18 20V4" />
                    <path d="M6 20v-4" />
                  </svg>
                }
                title="Open Source"
                description="Fully open source under MIT License. Audit the code, contribute improvements, or fork it — GitX1 is community-powered."
                delay="delay-600"
              />
            </div>
          </div>
        </section>

        {/* ── Privacy & Security Section ─────────────────────── */}
        <section id="privacy" className="relative py-28 sm:py-36 overflow-hidden">
          {/* Background accent glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 60% 50% at 50% 50%, var(--accent) 0%, transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-5xl px-6">
            <div className="text-center">
              {/* Oversized headline */}
              <h2 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-heading sm:text-6xl lg:text-7xl">
                100% Local.
                <br />
                <span className="text-gradient">Zero Data Leaks.</span>
              </h2>

              <p className="mt-8 mx-auto max-w-2xl text-lg leading-relaxed text-foreground-muted sm:text-xl">
                Your proprietary code <strong className="text-heading">never leaves your machine</strong>.
                Every WASM engine and AI model runs entirely on your hardware —
                no cloud APIs, no third-party servers, no telemetry.
              </p>
            </div>

            {/* Privacy pillars */}
            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              {/* Pillar 1 */}
              <div className="group rounded-2xl border border-border bg-card-bg p-7 text-center transition-all duration-300 hover:border-accent/30 hover:-translate-y-1" style={{ boxShadow: "var(--card-shadow)" }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent transition-transform duration-300 group-hover:scale-110">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-heading">No Network Calls</h3>
                <p className="text-sm leading-relaxed text-foreground-muted">
                  The extension makes zero outbound requests. All analysis runs in a sandboxed
                  WebAssembly runtime inside your browser tab.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="group rounded-2xl border border-border bg-card-bg p-7 text-center transition-all duration-300 hover:border-accent/30 hover:-translate-y-1" style={{ boxShadow: "var(--card-shadow)" }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent transition-transform duration-300 group-hover:scale-110">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-heading">Code Never Uploaded</h3>
                <p className="text-sm leading-relaxed text-foreground-muted">
                  Diff content, commit messages, and contributor data stay in
                  <code className="mx-1 rounded bg-background-subtle px-1.5 py-0.5 text-xs font-mono text-accent">chrome.storage.session</code>
                  — scoped to your browser session and auto-cleared.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="group rounded-2xl border border-border bg-card-bg p-7 text-center transition-all duration-300 hover:border-accent/30 hover:-translate-y-1" style={{ boxShadow: "var(--card-shadow)" }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent transition-transform duration-300 group-hover:scale-110">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-heading">Fully Auditable</h3>
                <p className="text-sm leading-relaxed text-foreground-muted">
                  100% open-source under MIT License. Every line of the WASM engine,
                  AI models, and scoring logic is available for audit on GitHub.
                </p>
              </div>
            </div>

            {/* Trust statement */}
            <div className="mt-14 text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-light px-5 py-2.5 text-sm font-medium text-accent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Manifest V3 · Content Security Policy enforced · No remote code execution
              </p>
            </div>
          </div>
        </section>

        {/* ── Final CTA Section ───────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
              Stop AI slop before it reaches{" "}
              <span className="text-gradient">your codebase</span>
            </h2>
            <p className="mt-5 text-lg text-foreground-muted">
              Join maintainers who are taking back control of their pull request
              workflow. Install in seconds, protect forever.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="https://chromewebstore.google.com/detail/gitx1-pr-moderator"
                id="cta-bottom-chrome"
                target="_blank"
                rel="noopener noreferrer"
                className="animate-pulse-ring inline-flex h-14 items-center gap-3 rounded-full bg-accent px-8 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-accent-hover hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]"
              >
                <ChromeIcon />
                Add to Chrome — It&apos;s Free
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-background-subtle py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-foreground-muted">
            © {new Date().getFullYear()} GitX1 · Open Source under MIT License
          </p>
          <div className="flex items-center gap-6 text-sm text-foreground-muted">
            <a
              href="https://github.com/AIMishtworking/gitx1"
              id="footer-github"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-heading"
            >
              GitHub
            </a>
            <a
              href="https://github.com/AIMishtworking/gitx1/issues"
              id="footer-issues"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-heading"
            >
              Report an Issue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
