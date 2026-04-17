/**
 * ──────────────────────────────────────────────
 *  Master Controller — Unified PR Verdict Engine
 *  Aggregates all 4 analysis layers into a single
 *  "Slop Verdict" with smart-skip optimization.
 *
 *  Layer 1: Instant DOM Triage     (metadata rules)
 *  Layer 2: Reputation Scoring     (GitHub API heuristics)
 *  Layer 3: Structural AST (WASM)  (code pattern analysis)
 *  Layer 4: AI Text Detection      (multi-engine linguistic)
 *
 *  If L2 reputation is extremely high (core maintainer),
 *  the controller skips expensive L3 + L4 checks.
 * ──────────────────────────────────────────────
 */

import type { SlopScore, Layer1TriagePayload } from "../types/messages";
import type { SlopDetectionResult } from "./slop-detector";

// ── Layer result containers ───────────────────

export interface LayerStatus {
  state: "pending" | "running" | "complete" | "skipped" | "error";
  /** Normalized 0-100 score, where 0 = clean, 100 = max slop */
  normalizedScore: number;
  label: string;
  detail: string;
}

export interface MasterVerdict {
  /** 0-100 aggregate score (0 = pristine, 100 = definite slop) */
  score: number;
  /** Color-tier for badge */
  tier: "green" | "yellow" | "red";
  /** Human-readable label */
  verdict: string;
  /** Per-layer breakdown */
  layers: {
    l1_triage: LayerStatus;
    l2_reputation: LayerStatus;
    l3_wasm: LayerStatus;
    l4_ai: LayerStatus;
  };
  /** Whether heavy checks were skipped */
  skippedHeavyChecks: boolean;
  /** Reason for skipping, if applicable */
  skipReason: string;
  /** Timestamp */
  computedAt: number;
}

// ── Layer weights (sum to 1.0) ────────────────

const LAYER_WEIGHTS = {
  l1_triage:    0.15,  // Instant metadata rules
  l2_reputation: 0.35,  // Reputation (strongest signal)
  l3_wasm:      0.20,  // Structural code analysis
  l4_ai:        0.30,  // AI text detection
};

// Weights when L3+L4 are skipped (redistribute to L1+L2)
const SKIP_WEIGHTS = {
  l1_triage:    0.30,
  l2_reputation: 0.70,
  l3_wasm:      0,
  l4_ai:        0,
};

// ── Thresholds ────────────────────────────────

/** L2 reputation score above which we skip heavy checks */
const TRUSTED_THRESHOLD = 50;  // +50 to +100 = core maintainer tier

/** Score thresholds for badge color */
const TIER_GREEN  = 25;  // 0–25 = green (clean)
const TIER_YELLOW = 55;  // 26–55 = yellow (suspicious)
                         // 56-100 = red (likely slop)

// ── Held layer data (accumulated as layers complete) ──

let layerData: {
  l1: Layer1TriagePayload | null;
  l2: SlopScore | null;
  l3: { score: number; totalFindings: number; highCount: number } | null;
  l4: SlopDetectionResult | null;
} = { l1: null, l2: null, l3: null, l4: null };

// ── Public API ────────────────────────────────

export function resetMasterState(): void {
  layerData = { l1: null, l2: null, l3: null, l4: null };
}

export function feedLayer1(triage: Layer1TriagePayload): void {
  layerData.l1 = triage;
}

export function feedLayer2(score: SlopScore): void {
  layerData.l2 = score;
}

export function feedLayer3(wasm: { score: number; totalFindings: number; highCount: number }): void {
  layerData.l3 = wasm;
}

export function feedLayer4(result: SlopDetectionResult): void {
  layerData.l4 = result;
}

/**
 * Should we skip heavy checks (L3 + L4)?
 * Returns true if the author's reputation is above the trusted threshold.
 */
export function shouldSkipHeavyChecks(): boolean {
  if (!layerData.l2) return false;
  return layerData.l2.overall >= TRUSTED_THRESHOLD;
}

export function getSkipReason(): string {
  if (!layerData.l2) return "";
  if (layerData.l2.overall >= TRUSTED_THRESHOLD) {
    return `Author reputation +${layerData.l2.overall} exceeds trusted threshold (+${TRUSTED_THRESHOLD}). WASM and AI checks skipped.`;
  }
  return "";
}

/**
 * Compute the master verdict from all available layer data.
 */
export function computeVerdict(): MasterVerdict {
  const skipped = shouldSkipHeavyChecks();
  const weights = skipped ? SKIP_WEIGHTS : LAYER_WEIGHTS;

  // ── Normalize each layer to 0-100 (0 = clean, 100 = slop) ──

  const l1 = normalizeL1(layerData.l1);
  const l2 = normalizeL2(layerData.l2);
  const l3 = skipped ? skippedStatus("Skipped (trusted author)") : normalizeL3(layerData.l3);
  const l4 = skipped ? skippedStatus("Skipped (trusted author)") : normalizeL4(layerData.l4);

  // ── Weighted aggregate ──

  let score = 0;
  let totalWeight = 0;

  const layers: [string, LayerStatus][] = [
    ["l1_triage", l1],
    ["l2_reputation", l2],
    ["l3_wasm", l3],
    ["l4_ai", l4],
  ];

  for (const [key, layer] of layers) {
    const w = weights[key as keyof typeof weights];
    if (layer.state === "complete" && w > 0) {
      score += layer.normalizedScore * w;
      totalWeight += w;
    }
  }

  // Normalize if not all layers contributed
  if (totalWeight > 0 && totalWeight < 1) {
    score = score / totalWeight;
  }

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

  // ── Tier + verdict ──

  let tier: MasterVerdict["tier"];
  let verdict: string;
  if (score <= TIER_GREEN) {
    tier = "green";
    verdict = "Clean";
  } else if (score <= TIER_YELLOW) {
    tier = "yellow";
    verdict = "Suspicious";
  } else {
    tier = "red";
    verdict = "Likely Slop";
  }

  return {
    score,
    tier,
    verdict,
    layers: {
      l1_triage: l1,
      l2_reputation: l2,
      l3_wasm: l3,
      l4_ai: l4,
    },
    skippedHeavyChecks: skipped,
    skipReason: getSkipReason(),
    computedAt: Date.now(),
  };
}

// ── Layer normalizers (→ 0-100, 0=clean, 100=slop) ──

function normalizeL1(data: Layer1TriagePayload | null): LayerStatus {
  if (!data) return pendingStatus("Awaiting triage…");

  // L1 score is 0-100 where 100 = clean. Invert.
  const slopScore = 100 - data.score;

  let label: string;
  if (data.verdict === "clean") label = "Clean";
  else if (data.verdict === "suspicious") label = "Suspicious";
  else label = "Likely Slop";

  return {
    state: "complete",
    normalizedScore: slopScore,
    label,
    detail: `${data.passedChecks}/${data.totalChecks} checks passed, ${data.failedChecks} failed`,
  };
}

function normalizeL2(data: SlopScore | null): LayerStatus {
  if (!data) return pendingStatus("Awaiting reputation…");

  // L2 is [-100, +100] where +100 = trusted. Map to [0, 100] inverted.
  // +100 → 0 slop, -100 → 100 slop
  const slopScore = Math.round((100 - data.overall) / 2);

  return {
    state: "complete",
    normalizedScore: Math.max(0, Math.min(100, slopScore)),
    label: data.recommendation === "allow" ? "Trusted" :
           data.recommendation === "warn" ? "Suspicious" : "Untrusted",
    detail: `Score: ${data.overall > 0 ? "+" : ""}${data.overall} — ${data.summary}`,
  };
}

function normalizeL3(data: { score: number; totalFindings: number; highCount: number } | null): LayerStatus {
  if (!data) return pendingStatus("Run WASM analysis");

  // WASM score is already 0-100 (findings-based)
  return {
    state: "complete",
    normalizedScore: data.score,
    label: data.totalFindings === 0 ? "Clean" :
           data.highCount > 0 ? "Issues Found" : "Minor Findings",
    detail: `${data.totalFindings} findings (${data.highCount} high severity)`,
  };
}

function normalizeL4(data: SlopDetectionResult | null): LayerStatus {
  if (!data) return pendingStatus("Run AI detection");

  return {
    state: "complete",
    normalizedScore: data.overallScore,
    label: data.verdict === "clean" ? "Human-like" :
           data.verdict === "suspicious" ? "Mixed Signals" : "AI-like",
    detail: `${data.engineResults.length} engines, ${data.elapsedMs}ms`,
  };
}

function pendingStatus(detail: string): LayerStatus {
  return { state: "pending", normalizedScore: 0, label: "Pending", detail };
}

function skippedStatus(detail: string): LayerStatus {
  return { state: "skipped", normalizedScore: 0, label: "Skipped", detail };
}
