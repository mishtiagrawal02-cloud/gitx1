/**
 * ──────────────────────────────────────────────
 *  Message Protocol — shared between all contexts
 *  (service-worker ↔ content-script ↔ side-panel)
 * ──────────────────────────────────────────────
 */

// ── Action constants ──────────────────────────

export const ACTION = {
  /** Content script → Background: PR page detected */
  PR_PAGE_DETECTED: "PR_PAGE_DETECTED",

  /** Background → Content script: Update the slop badge */
  UPDATE_SLOP_BADGE: "UPDATE_SLOP_BADGE",

  /** Side panel → Background: Request current PR data */
  GET_PR_DATA: "GET_PR_DATA",

  /** Background → Side panel: Respond with PR data */
  PR_DATA_RESPONSE: "PR_DATA_RESPONSE",

  /** Side panel → Background: Request a fresh analysis */
  REQUEST_ANALYSIS: "REQUEST_ANALYSIS",

  /** Background → Side panel: Analysis progress / result */
  ANALYSIS_UPDATE: "ANALYSIS_UPDATE",

  /** Side panel → Background: Save a GitHub PAT */
  SAVE_PAT: "SAVE_PAT",

  /** Side panel → Background: Check if PAT is configured */
  GET_PAT_STATUS: "GET_PAT_STATUS",

  /** Background → Side panel: PAT status response */
  PAT_STATUS_RESPONSE: "PAT_STATUS_RESPONSE",

  /** Content script → Background: Layer 1 instant triage completed */
  LAYER1_TRIAGE_RESULT: "LAYER1_TRIAGE_RESULT",

  /** Side panel: WASM structural analysis complete */
  WASM_ANALYSIS_RESULT: "WASM_ANALYSIS_RESULT",

  /** Side panel → Background: Request PR diff for WASM analysis */
  REQUEST_PR_DIFF: "REQUEST_PR_DIFF",

  /** Background → Side panel: PR diff response */
  PR_DIFF_RESPONSE: "PR_DIFF_RESPONSE",

  /** Side panel → Content script: Request PR description text */
  REQUEST_PR_DESCRIPTION: "REQUEST_PR_DESCRIPTION",

  /** Content script → Side panel: PR description text response */
  PR_DESCRIPTION_RESPONSE: "PR_DESCRIPTION_RESPONSE",

  /** Service worker → Content script: Ask content script to re-scan the page */
  RESCAN_PAGE: "RESCAN_PAGE",
} as const;

export type ActionType = (typeof ACTION)[keyof typeof ACTION];

// ── Payload interfaces ────────────────────────

export interface PRPageInfo {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  url: string;
}

/**
 * Individual heuristic result — mirrors pr-slop-stopper's HeuristicResult.
 */
export interface HeuristicResult {
  name: string;
  score: number;
  maxPositive: number;
  maxNegative: number;
  reason: string;
}

/**
 * Reputation-based Slop Score.
 * Range: [-100, +100], derived from pr-slop-stopper heuristics.
 */
export interface SlopScore {
  /** Raw sum of all heuristic scores before clamping */
  totalRaw: number;
  /** Clamped score: max(-100, min(+100, totalRaw)) */
  overall: number;
  /** Per-heuristic breakdown */
  breakdown: HeuristicResult[];
  /** Condensed breakdown for quick UI rendering */
  breakdownMap: {
    accountAge: number;
    profileCompleteness: number;
    followerPatterns: number;
    prAcceptanceRate: number;
    forkTiming: number;
    activityPatterns: number;
    contributionType: number;
    notableContributions: number;
  };
  /** Human-readable summary */
  summary: string;
  /** Recommendation based on thresholds */
  recommendation: "allow" | "warn" | "close";
}

// ── Message shapes ────────────────────────────

export interface PrPageDetectedMessage {
  action: typeof ACTION.PR_PAGE_DETECTED;
  payload: PRPageInfo;
}

export interface UpdateSlopBadgeMessage {
  action: typeof ACTION.UPDATE_SLOP_BADGE;
  payload: { score: number; label: string; recommendation: string };
}

export interface GetPrDataMessage {
  action: typeof ACTION.GET_PR_DATA;
}

export interface PrDataResponseMessage {
  action: typeof ACTION.PR_DATA_RESPONSE;
  payload: {
    prInfo: PRPageInfo | null;
    slopScore: SlopScore | null;
    layer1Triage: Layer1TriagePayload | null;
  };
}

export interface RequestAnalysisMessage {
  action: typeof ACTION.REQUEST_ANALYSIS;
  payload: { owner: string; repo: string; prNumber: number; author: string };
}

export interface AnalysisUpdateMessage {
  action: typeof ACTION.ANALYSIS_UPDATE;
  payload: {
    status: "pending" | "running" | "complete" | "error";
    slopScore: SlopScore | null;
    error?: string;
  };
}

export interface SavePatMessage {
  action: typeof ACTION.SAVE_PAT;
  payload: { pat: string };
}

export interface GetPatStatusMessage {
  action: typeof ACTION.GET_PAT_STATUS;
}

export interface PatStatusResponseMessage {
  action: typeof ACTION.PAT_STATUS_RESPONSE;
  payload: {
    configured: boolean;
    rateLimitRemaining: number | null;
    username: string | null;
  };
}

/**
 * Layer 1 triage result — re-exported type from layer1-triage module.
 * Contains the ~30 instant DOM-based check results.
 */
export interface Layer1TriagePayload {
  totalChecks: number;
  failedChecks: number;
  passedChecks: number;
  verdict: "clean" | "suspicious" | "likely-slop";
  score: number;
  ranAt: number;
  /** Subset: only failed checks to reduce message size */
  failedDetails: Array<{
    id: string;
    category: string;
    message: string;
  }>;
  /** All check summaries */
  allChecks: Array<{
    id: string;
    category: string;
    passed: boolean;
    message: string;
  }>;
}

export interface Layer1TriageResultMessage {
  action: typeof ACTION.LAYER1_TRIAGE_RESULT;
  payload: Layer1TriagePayload;
}

// ── WASM Structural Analysis Types ────────────

export interface WasmFinding {
  rule_id: string;
  severity: "high" | "medium" | "low";
  file: string;
  line: number;
  message: string;
  source: "ast" | "pattern";
  snippet: string;
}

export interface WasmAnalysisPayload {
  total_findings: number;
  files_analyzed: number;
  score: number;
  severity_counts: { high: number; medium: number; low: number };
  findings: WasmFinding[];
}

export interface WasmAnalysisResultMessage {
  action: typeof ACTION.WASM_ANALYSIS_RESULT;
  payload: WasmAnalysisPayload;
}

export interface RequestPrDiffMessage {
  action: typeof ACTION.REQUEST_PR_DIFF;
  payload: { owner: string; repo: string; prNumber: number };
}

export interface PrDiffResponseMessage {
  action: typeof ACTION.PR_DIFF_RESPONSE;
  payload: { diff: string | null; error?: string };
}

export interface RequestPrDescriptionMessage {
  action: typeof ACTION.REQUEST_PR_DESCRIPTION;
  payload: Record<string, never>;
}

export interface PrDescriptionResponseMessage {
  action: typeof ACTION.PR_DESCRIPTION_RESPONSE;
  payload: { description: string; codeComments: string[] };
}

export interface RescanPageMessage {
  action: typeof ACTION.RESCAN_PAGE;
  payload?: Record<string, never>;
}

export type ExtensionMessage =
  | PrPageDetectedMessage
  | UpdateSlopBadgeMessage
  | GetPrDataMessage
  | PrDataResponseMessage
  | RequestAnalysisMessage
  | AnalysisUpdateMessage
  | SavePatMessage
  | GetPatStatusMessage
  | PatStatusResponseMessage
  | Layer1TriageResultMessage
  | WasmAnalysisResultMessage
  | RequestPrDiffMessage
  | PrDiffResponseMessage
  | RequestPrDescriptionMessage
  | PrDescriptionResponseMessage
  | RescanPageMessage;
