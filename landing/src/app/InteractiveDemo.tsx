"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── Types ───────────────────────────────────────────────────── */

type ScanPhase =
  | "idle"
  | "metadata"
  | "reputation"
  | "ast"
  | "consensus"
  | "verdict";

type Verdict = "clean" | "suspicious";

interface SignalResult {
  label: string;
  score: number;
  status: "pending" | "scanning" | "done";
}

/* ─── Constants ───────────────────────────────────────────────── */

const MOCK_DIFF_LINES = [
  { type: "meta", text: "diff --git a/src/utils/helpers.ts" },
  { type: "meta", text: "@@ -14,6 +14,42 @@" },
  { type: "ctx", text: "  import { validateInput } from './validate';" },
  { type: "ctx", text: "  import { logger } from './logger';" },
  { type: "ctx", text: "" },
  { type: "add", text: "+ export function processDataWithAdvancedAI(" },
  { type: "add", text: "+   input: DataInput," },
  { type: "add", text: "+   options: ProcessingOptions = {}" },
  { type: "add", text: "+ ): ProcessedResult {" },
  { type: "add", text: "+   // Comprehensive data processing pipeline" },
  { type: "add", text: "+   const sanitized = sanitizeInput(input);" },
  { type: "add", text: "+   const validated = validateSchema(sanitized);" },
  { type: "add", text: "+   const enriched = enrichWithMetadata(validated);" },
  { type: "add", text: "+   const transformed = applyTransformations(" },
  { type: "add", text: "+     enriched, options.transforms ?? []" },
  { type: "add", text: "+   );" },
  { type: "del", text: "- // TODO: implement later" },
  { type: "add", text: "+   return { data: transformed, status: 'ok' };" },
  { type: "add", text: "+ }" },
];

const INITIAL_SIGNALS: SignalResult[] = [
  { label: "Metadata Triage", score: 0, status: "pending" },
  { label: "Reputation Score", score: 0, status: "pending" },
  { label: "AST Analysis", score: 0, status: "pending" },
  { label: "AI Consensus", score: 0, status: "pending" },
];

/* suspicious scenario scores */
const SUSPICIOUS_SCORES = [72, 34, 81, 78];
/* clean scenario scores */
const CLEAN_SCORES = [12, 89, 8, 15];

const PHASE_TIMING: Record<ScanPhase, number> = {
  idle: 0,
  metadata: 900,
  reputation: 1100,
  ast: 1400,
  consensus: 1200,
  verdict: 0,
};

/* ─── Helpers ─────────────────────────────────────────────────── */

function getPhaseIndex(phase: ScanPhase): number {
  const order: ScanPhase[] = [
    "idle",
    "metadata",
    "reputation",
    "ast",
    "consensus",
    "verdict",
  ];
  return order.indexOf(phase);
}

/* ─── Scanning Indicator Dots ─────────────────────────────────── */

function ScanningDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1.5">
      <span className="inline-block h-1 w-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="inline-block h-1 w-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="inline-block h-1 w-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

/* ─── Score Ring ───────────────────────────────────────────────── */

function ScoreRing({
  score,
  verdict,
  visible,
}: {
  score: number;
  verdict: Verdict;
  visible: boolean;
}) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  const color =
    verdict === "suspicious"
      ? "var(--color-warning, #e65100)"
      : "var(--color-accent)";

  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-700 ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
      }`}
    >
      <svg width="108" height="108" className="-rotate-90">
        <circle
          cx="54"
          cy="54"
          r="42"
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <circle
          cx="54"
          cy="54"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={visible ? offset : circumference}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-foreground-muted">
          slop
        </span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN COMPONENT                                                  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function InteractiveDemo() {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [signals, setSignals] = useState<SignalResult[]>(INITIAL_SIGNALS);
  const [overallScore, setOverallScore] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>("clean");
  const [scanLine, setScanLine] = useState(-1);
  const [scenarioIdx, setScenarioIdx] = useState(0); // alternates between suspicious/clean

  const isScanning = phase !== "idle" && phase !== "verdict";
  const isDone = phase === "verdict";

  /* Determine which scenario to use */
  const isSuspicious = scenarioIdx % 2 === 0;
  const scores = isSuspicious ? SUSPICIOUS_SCORES : CLEAN_SCORES;

  /* ── Scan orchestrator ─────────────────────────────────────── */

  const runScan = useCallback(() => {
    if (isScanning) return;

    /* Reset state */
    setSignals(INITIAL_SIGNALS.map((s) => ({ ...s, score: 0, status: "pending" })));
    setOverallScore(0);
    setPhase("metadata");
    setScanLine(-1);

    const currentScores = isSuspicious ? SUSPICIOUS_SCORES : CLEAN_SCORES;

    /* Animate diff line scanning */
    MOCK_DIFF_LINES.forEach((_, i) => {
      setTimeout(() => setScanLine(i), 200 + i * 120);
    });

    /* Phase 1: Metadata */
    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, status: "scanning" } : s
        )
      );
    }, 100);

    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, score: currentScores[0], status: "done" } : s
        )
      );
      setPhase("reputation");
    }, PHASE_TIMING.metadata);

    /* Phase 2: Reputation */
    const t2 = PHASE_TIMING.metadata;
    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 1 ? { ...s, status: "scanning" } : s
        )
      );
    }, t2 + 100);

    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 1 ? { ...s, score: currentScores[1], status: "done" } : s
        )
      );
      setPhase("ast");
    }, t2 + PHASE_TIMING.reputation);

    /* Phase 3: AST */
    const t3 = t2 + PHASE_TIMING.reputation;
    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 2 ? { ...s, status: "scanning" } : s
        )
      );
    }, t3 + 100);

    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 2 ? { ...s, score: currentScores[2], status: "done" } : s
        )
      );
      setPhase("consensus");
    }, t3 + PHASE_TIMING.ast);

    /* Phase 4: Consensus */
    const t4 = t3 + PHASE_TIMING.ast;
    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 3 ? { ...s, status: "scanning" } : s
        )
      );
    }, t4 + 100);

    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s, i) =>
          i === 3 ? { ...s, score: currentScores[3], status: "done" } : s
        )
      );

      /* Compute overall score */
      const avg = Math.round(
        currentScores.reduce((a, b) => a + b, 0) / currentScores.length
      );
      const v: Verdict = avg >= 50 ? "suspicious" : "clean";
      setOverallScore(avg);
      setVerdict(v);
      setPhase("verdict");
    }, t4 + PHASE_TIMING.consensus);
  }, [isScanning, isSuspicious]);

  /* Cycle scenario on each scan */
  const handleScan = () => {
    if (isDone) {
      setScenarioIdx((prev) => prev + 1);
      setPhase("idle");
      setScanLine(-1);
      /* Small delay so reset is visible before next scan starts */
      setTimeout(() => {}, 100);
      return;
    }
    runScan();
  };

  /* Auto-start next scan after reset */
  useEffect(() => {
    if (phase === "idle" && scenarioIdx > 0) {
      const timer = setTimeout(() => runScan(), 200);
      return () => clearTimeout(timer);
    }
  }, [phase, scenarioIdx, runScan]);

  /* ── Button text ───────────────────────────────────────────── */
  const buttonText = isDone
    ? "Scan Another PR"
    : isScanning
    ? "Scanning…"
    : "Scan PR";

  return (
    <section id="live-demo" className="py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
            See it in action
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            Show, Don&apos;t Tell
          </h2>
          <p className="mt-4 mx-auto max-w-xl text-base text-foreground-muted">
            Watch GitX1 scan a pull request in real time. Click the button to
            start the analysis.
          </p>
        </div>

        {/* ── Demo Container ─────────────────────────────────── */}
        <div className="relative mx-auto max-w-5xl">
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            {/* ── Left: Mock GitHub PR ───────────────────────── */}
            <div className="rounded-2xl border border-border bg-card-bg overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
              {/* PR Header */}
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2ea043]/15 px-2.5 py-0.5 text-xs font-semibold text-[#2ea043] dark:bg-[#2ea043]/20">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M7.177 3.073L9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zM11 2.5h-1V4h1a1 1 0 0 1 1 1v5.628a2.251 2.251 0 1 1-1.5 0V5a2.5 2.5 0 0 0-2.5-2.5h-1v1.5l-2.396-2.396a.25.25 0 0 1 0-.354L7.177.073a.25.25 0 0 1 .354 0L9.927 2.47a.25.25 0 0 1-.354.354L7.177 4.22a.25.25 0 0 1-.354-.354L8.22-.073 11 2.5zm0 8.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" /></svg>
                    Open
                  </span>
                  <h3 className="text-sm font-semibold text-heading truncate">
                    feat: add advanced data processing pipeline
                  </h3>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-foreground-muted/60">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-4 w-4 rounded-full bg-border" />
                    pr-bot-9000
                  </span>
                  <span>opened 2 hours ago</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#2ea043]" />
                    +28
                    <span className="inline-block h-2 w-2 rounded-full bg-[#cf222e] ml-1" />
                    -1
                  </span>
                </div>
              </div>

              {/* Diff viewer */}
              <div className="relative overflow-hidden">
                {/* Scan overlay line */}
                {isScanning && scanLine >= 0 && (
                  <div
                    className="absolute left-0 right-0 h-[22px] pointer-events-none z-10 transition-all duration-100"
                    style={{
                      top: `${scanLine * 22}px`,
                      background:
                        "linear-gradient(90deg, var(--accent-glow) 0%, transparent 100%)",
                    }}
                  />
                )}

                <div className="font-mono text-[11px] leading-[22px] overflow-x-auto">
                  {MOCK_DIFF_LINES.map((line, idx) => {
                    let bg = "transparent";
                    let textColor = "text-foreground-muted/70";

                    if (line.type === "add") {
                      bg = "rgba(46, 160, 67, 0.08)";
                      textColor = "text-foreground-muted";
                    } else if (line.type === "del") {
                      bg = "rgba(207, 34, 46, 0.08)";
                      textColor = "text-foreground-muted";
                    } else if (line.type === "meta") {
                      textColor = "text-accent/60";
                    }

                    const isScanned = scanLine >= idx && isScanning;

                    return (
                      <div
                        key={idx}
                        className={`flex ${textColor} transition-opacity duration-200 ${
                          isScanning && !isScanned ? "opacity-40" : "opacity-100"
                        }`}
                        style={{ background: bg }}
                      >
                        <span className="w-10 shrink-0 select-none border-r border-border/40 px-2 text-right text-foreground-muted/30">
                          {idx + 1}
                        </span>
                        <span className="w-5 shrink-0 text-center select-none">
                          {line.type === "add"
                            ? "+"
                            : line.type === "del"
                            ? "-"
                            : " "}
                        </span>
                        <span className="px-2 whitespace-pre">{line.text.replace(/^[+-]\s?/, "")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PR Footer / tab bar */}
              <div className="flex items-center gap-1 border-t border-border px-4 py-2.5 text-[11px] text-foreground-muted/50">
                <span className="rounded bg-background-subtle px-2 py-0.5 font-medium text-foreground-muted">Files changed</span>
                <span className="rounded px-2 py-0.5">Conversation</span>
                <span className="rounded px-2 py-0.5">Commits</span>
              </div>
            </div>

            {/* ── Right: Mock Side Panel ─────────────────────── */}
            <div className="rounded-2xl border border-border bg-card-bg overflow-hidden flex flex-col" style={{ boxShadow: "var(--card-shadow)" }}>
              {/* Panel header */}
              <div className="border-b border-border px-5 py-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-accent/15 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-heading">GitX1 Side Panel</span>
                </div>
                <span className="text-[10px] text-foreground-muted/40 font-mono">v0.1.0</span>
              </div>

              {/* Panel body */}
              <div className="flex-1 flex flex-col p-5 gap-5">
                {/* Score ring area */}
                <div className="flex justify-center py-2">
                  {phase === "idle" ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-[108px] w-[108px] rounded-full border-2 border-dashed border-border flex items-center justify-center">
                        <span className="text-xs text-foreground-muted/40">No scan</span>
                      </div>
                    </div>
                  ) : (
                    <ScoreRing
                      score={isDone ? overallScore : 0}
                      verdict={verdict}
                      visible={isDone}
                    />
                  )}
                </div>

                {/* Verdict badge */}
                {isDone && (
                  <div
                    className="text-center animate-fade-in-up"
                  >
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${
                        verdict === "suspicious"
                          ? "bg-[#e65100]/10 text-[#e65100]"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {verdict === "suspicious" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      )}
                      {verdict === "suspicious" ? "Suspicious — Likely AI Slop" : "Clean — Human Authored"}
                    </span>
                  </div>
                )}

                {/* Signal results */}
                <div className="space-y-3">
                  {signals.map((signal, i) => {
                    const phaseIdx = getPhaseIndex(phase);
                    const isActive = signal.status === "scanning";
                    const isDoneSignal = signal.status === "done";
                    const isWarning = isDoneSignal && signal.score >= 50;

                    return (
                      <div
                        key={i}
                        className={`rounded-xl border px-4 py-3 transition-all duration-300 ${
                          isActive
                            ? "border-accent/50 bg-accent-light"
                            : isDoneSignal
                            ? "border-border bg-background-subtle"
                            : "border-border/40 bg-transparent opacity-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-heading">
                            {signal.label}
                          </span>
                          <span className="text-[11px] font-mono">
                            {isActive ? (
                              <span className="text-accent flex items-center">
                                analyzing
                                <ScanningDots />
                              </span>
                            ) : isDoneSignal ? (
                              <span
                                className={`font-semibold ${
                                  isWarning ? "text-[#e65100]" : "text-accent"
                                }`}
                              >
                                {signal.score}/100
                              </span>
                            ) : (
                              <span className="text-foreground-muted/30">—</span>
                            )}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: isDoneSignal
                                ? `${signal.score}%`
                                : isActive
                                ? "60%"
                                : "0%",
                              background: isDoneSignal
                                ? isWarning
                                  ? "#e65100"
                                  : "var(--accent)"
                                : isActive
                                ? "var(--accent)"
                                : "transparent",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scan button */}
              <div className="border-t border-border p-4">
                <button
                  id="demo-scan-button"
                  onClick={handleScan}
                  disabled={isScanning}
                  className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    isScanning
                      ? "bg-accent/20 text-accent cursor-wait"
                      : isDone
                      ? "bg-accent text-white hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md"
                      : "bg-accent text-white hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md animate-pulse-ring"
                  }`}
                >
                  {isScanning && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {buttonText}
                </button>
              </div>
            </div>
          </div>

          {/* Floating label */}
          <div className="mt-6 text-center">
            <span className="text-xs text-foreground-muted/40">
              {isSuspicious
                ? "Scenario: AI-generated pull request"
                : "Scenario: Human-authored pull request"}
              {" · "}
              Interactive demo — no real code is analyzed
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
