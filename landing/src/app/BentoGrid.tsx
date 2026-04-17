"use client";

import { useRef, useCallback, type MouseEvent as ReactMouseEvent } from "react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAGNETIC TILT CARD                                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function MagneticCard({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      /* Tilt: ±8 degrees max */
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;

      /* Glow follows cursor */
      if (glowRef.current) {
        glowRef.current.style.opacity = "1";
        glowRef.current.style.background = `radial-gradient(300px circle at ${x}px ${y}px, var(--accent-glow), transparent 70%)`;
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) {
      card.style.transform =
        "perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
    }
    if (glowRef.current) {
      glowRef.current.style.opacity = "0";
    }
  }, []);

  return (
    <div
      ref={cardRef}
      id={id}
      className={`bento-card-glass ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: "preserve-3d", transition: "transform 0.25s ease-out" }}
    >
      {/* Cursor-follow glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 transition-opacity duration-500"
        aria-hidden="true"
      />
      {/* Content sits above glow */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  BENTO GRID                                                      */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function BentoGrid() {
  return (
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
            Every pull request passes through four independent detection layers
            — each catching what the others miss.
          </p>
        </div>

        {/* Bento Grid — glassmorphism 2.0 */}
        <div className="bento-grid-v2">
          {/* ── Card 1: Instant Triage (1×1) ──────────────────── */}
          <MagneticCard id="bento-instant-triage" className="bento-sm">
            <div className="flex items-start gap-4 mb-5">
              <span className="bento-layer-badge">L1</span>
              <div>
                <h3 className="text-lg font-semibold text-heading">
                  Instant Triage
                </h3>
                <p className="text-xs text-foreground-muted/60 mt-0.5">
                  Layer 1 · Metadata Analysis
                </p>
              </div>
            </div>

            {/* Rule grid visualization */}
            <div className="mb-5 rounded-xl bg-background/40 border border-white/[0.06] dark:border-white/[0.08] p-4">
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 34 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 rounded-sm transition-colors duration-300"
                    style={{
                      background:
                        i < 28
                          ? `rgba(0, 128, 128, ${0.15 + (i / 34) * 0.5})`
                          : `rgba(61, 153, 112, ${0.2 + ((i - 28) / 6) * 0.6})`,
                    }}
                  />
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-foreground-muted/50 text-center">
                34 metadata rules evaluated per PR
              </p>
            </div>

            <p className="text-sm leading-relaxed text-foreground-muted">
              Runs in <span className="bento-stat">&lt;15s</span> with{" "}
              <span className="bento-stat">34</span> language-agnostic metadata
              rules. Catches obvious AI slop instantly — before heavier analysis
              even begins.
            </p>
          </MagneticCard>

          {/* ── Card 2: Reputation Score (1×1) ────────────────── */}
          <MagneticCard id="bento-reputation-score" className="bento-sm">
            <div className="flex items-start gap-4 mb-5">
              <span className="bento-layer-badge">L2</span>
              <div>
                <h3 className="text-lg font-semibold text-heading">
                  Reputation Score
                </h3>
                <p className="text-xs text-foreground-muted/60 mt-0.5">
                  Layer 2 · Contributor Trust
                </p>
              </div>
            </div>

            {/* Trust meter */}
            <div className="mb-5 rounded-xl bg-background/40 border border-white/[0.06] dark:border-white/[0.08] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-foreground-muted/60">
                  Trust Level
                </span>
                <span className="text-[11px] font-mono font-semibold text-accent">
                  87 / 100
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-border/60 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "87%",
                    background:
                      "linear-gradient(90deg, var(--accent) 0%, var(--leaf) 100%)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-foreground-muted/40">
                <span>New Account</span>
                <span>Trusted Contributor</span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground-muted">
              Calculates trust based on{" "}
              <span className="bento-stat">account age</span> and{" "}
              <span className="bento-stat">PR acceptance history</span>. New
              accounts with zero merged PRs get extra scrutiny; established
              contributors get a trust boost.
            </p>
          </MagneticCard>

          {/* ── Card 3: Structural AST (1×1) ──────────────────── */}
          <MagneticCard id="bento-structural-ast" className="bento-sm">
            <div className="flex items-start gap-4 mb-5">
              <span className="bento-layer-badge">L3</span>
              <div>
                <h3 className="text-lg font-semibold text-heading">
                  Structural AST
                </h3>
                <p className="text-xs text-foreground-muted/60 mt-0.5">
                  Layer 3 · Deep Code Analysis
                </p>
              </div>
            </div>

            {/* AST tree visualization */}
            <div className="mb-5 rounded-xl bg-background/40 border border-white/[0.06] dark:border-white/[0.08] p-4 font-mono text-[11px] leading-5 text-foreground-muted/70">
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
                <span>
                  BlockStatement{" "}
                  <span className="text-foreground-muted/40">× 14</span>
                </span>
              </div>
              <div className="flex items-center gap-2 ml-8">
                <span className="text-leaf">●</span>
                <span>
                  Identifier{" "}
                  <span className="text-foreground-muted/40">× 31</span>
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-accent">▸</span>
                <span>
                  ClassDecl{" "}
                  <span className="text-foreground-muted/40">
                    — bloat detected
                  </span>
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground-muted">
              Powered by <span className="bento-stat">Rust</span> &amp;{" "}
              <span className="bento-stat">WebAssembly (WASM)</span> to catch AI
              syntax bloat natively. Parses abstract syntax trees to find
              over-engineered, copy-paste patterns LLMs love to generate.
            </p>
          </MagneticCard>

          {/* ── Card 4: Local AI Consensus (2×2 FOCAL) ────────── */}
          <MagneticCard
            id="bento-local-ai-consensus"
            className="bento-focal"
          >
            {/* Focal badge */}
            <div className="absolute top-5 right-5 z-20">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Core Engine
              </span>
            </div>

            <div className="flex items-start gap-4 mb-6">
              <span className="bento-layer-badge bento-layer-badge-lg">L4</span>
              <div>
                <h3 className="text-xl font-bold text-heading sm:text-2xl">
                  Local AI Consensus
                </h3>
                <p className="text-sm text-foreground-muted/60 mt-1">
                  Layer 4 · Ensemble Voting — The Final Verdict
                </p>
              </div>
            </div>

            {/* Engine voting visualization — expanded for focal */}
            <div className="mb-6 rounded-xl bg-background/40 border border-white/[0.06] dark:border-white/[0.08] p-5">
              <div className="space-y-2.5">
                {[
                  { name: "Engine 1", vote: "slop", conf: 94 },
                  { name: "Engine 2", vote: "slop", conf: 88 },
                  { name: "Engine 3", vote: "human", conf: 72 },
                  { name: "Engine 4", vote: "slop", conf: 91 },
                  { name: "Engine 5", vote: "slop", conf: 85 },
                  { name: "Engine 6", vote: "slop", conf: 79 },
                  { name: "Engine 7", vote: "human", conf: 66 },
                ].map((engine, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="w-[4.5rem] text-foreground-muted/50 font-mono shrink-0">
                      {engine.name}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${engine.conf}%`,
                          background:
                            engine.vote === "slop"
                              ? "var(--accent)"
                              : "var(--leaf)",
                        }}
                      />
                    </div>
                    <span
                      className={`w-12 text-right font-mono font-semibold ${
                        engine.vote === "slop" ? "text-accent" : "text-leaf"
                      }`}
                    >
                      {engine.conf}%
                    </span>
                    <span
                      className={`w-14 text-[10px] font-medium uppercase tracking-wide ${
                        engine.vote === "slop"
                          ? "text-accent/60"
                          : "text-leaf/60"
                      }`}
                    >
                      {engine.vote}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-foreground-muted/40">
                  Consensus Result
                </span>
                <span className="text-sm font-mono font-bold text-accent">
                  5/7 → AI Slop Detected
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground-muted sm:text-base sm:leading-relaxed">
              <span className="bento-stat">7</span> independent detection engines
              running <span className="bento-stat">100% locally</span> in your
              browser. No API calls, no cloud — the consensus vote determines the
              final Slop Score with zero data leaving your machine.
            </p>
          </MagneticCard>
        </div>
      </div>
    </section>
  );
}
