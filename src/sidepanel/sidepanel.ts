/**
 * ──────────────────────────────────────────────
 *  Side Panel — Main Dashboard UI Logic
 *  Communicates with the background service worker
 *  to display PR data, manage PAT, and render
 *  heuristic reputation scores.
 * ──────────────────────────────────────────────
 */

import {
  ACTION,
  type ExtensionMessage,
  type PRPageInfo,
  type SlopScore,
  type Layer1TriagePayload,
  type WasmAnalysisPayload,
} from "../types/messages";
import "./sidepanel.css";

// ── DOM references ────────────────────────────

const $ = (id: string): HTMLElement =>
  document.getElementById(id) as HTMLElement;

const els = {
  // PAT
  patSection: $("pat-section"),
  patUnconfigured: $("pat-unconfigured"),
  patConfigured: $("pat-configured"),
  patInput: $("pat-input") as HTMLInputElement,
  btnSavePat: $("btn-save-pat") as HTMLButtonElement,
  btnRemovePat: $("btn-remove-pat") as HTMLButtonElement,
  patError: $("pat-error"),
  patUsername: $("pat-username"),
  patRateLimit: $("pat-rate-limit"),

  // PR Info
  emptyState: $("empty-state"),
  prDetails: $("pr-details"),
  prInfo: $("pr-info"),
  prRepo: $("pr-repo"),
  prNumber: $("pr-number"),
  prTitle: $("pr-title"),
  prAuthor: $("pr-author"),

  // Score
  scoreSection: $("score-section"),
  scoreRing: document.getElementById("score-ring") as unknown as SVGCircleElement,
  scoreValue: $("score-value"),
  scoreLabel: $("score-label"),
  scoreSummary: $("score-summary"),
  recommendationBadge: $("recommendation-badge"),

  // Actions
  actionsSection: $("actions-section"),
  btnAnalyze: $("btn-analyze") as HTMLButtonElement,
  btnRefresh: $("btn-refresh") as HTMLButtonElement,
  statusText: $("status-text"),

  // Triage
  triageSection: $("triage-section"),
  triageVerdict: $("triage-verdict"),
  triagePassed: $("triage-passed"),
  triageFailed: $("triage-failed"),
  triageScore: $("triage-score"),
  triageBarFill: $("triage-bar-fill") as HTMLDivElement,
  triageChecks: $("triage-checks"),

  // WASM
  wasmSection: $("wasm-section"),
  wasmScoreBadge: $("wasm-score-badge"),
  wasmResults: $("wasm-results"),
  wasmFiles: $("wasm-files"),
  wasmTotal: $("wasm-total"),
  wasmScore: $("wasm-score"),
  wasmBarFill: $("wasm-bar-fill") as HTMLDivElement,
  wasmHigh: $("wasm-high"),
  wasmMedium: $("wasm-medium"),
  wasmLow: $("wasm-low"),
  wasmFindings: $("wasm-findings"),
  btnWasmAuto: $("btn-wasm-auto") as HTMLButtonElement,
  btnWasmManual: $("btn-wasm-manual") as HTMLButtonElement,
  wasmDiffInput: $("wasm-diff-input") as HTMLTextAreaElement,

  // Layer 4
  l4Section: $("l4-section"),
  l4Results: $("l4-results"),
  l4Score: $("l4-score"),
  l4Verdict: $("l4-verdict"),
  l4VerdictBadge: $("l4-verdict-badge"),
  l4Confidence: $("l4-confidence"),
  l4Elapsed: $("l4-elapsed"),
  l4Engines: $("l4-engines"),
  l4Human: $("l4-human"),
  l4HumanList: $("l4-human-list"),
  btnL4Auto: $("btn-l4-auto") as HTMLButtonElement,
  btnL4Manual: $("btn-l4-manual") as HTMLButtonElement,
  l4TextInput: $("l4-text-input") as HTMLTextAreaElement,

  // Master Verdict
  masterSection: $("master-section"),
  masterTier: $("master-tier"),
  masterRingFill: $("master-ring-fill") as unknown as SVGCircleElement,
  masterScore: $("master-score"),
  masterVerdictLabel: $("master-verdict-label"),
  masterDesc: $("master-desc"),
  masterSkip: $("master-skip"),
  masterSkipText: $("master-skip-text"),
  btnFullScan: $("btn-full-scan") as HTMLButtonElement,
};

// Heuristic keys matching the breakdownMap
const HEURISTIC_KEYS = [
  "accountAge",
  "profileCompleteness",
  "followerPatterns",
  "prAcceptanceRate",
  "forkTiming",
  "activityPatterns",
  "contributionType",
  "notableContributions",
] as const;

// Max ranges for each heuristic (for bar rendering)
const HEURISTIC_RANGES: Record<string, { min: number; max: number }> = {
  accountAge:             { min: -20, max: 15 },
  profileCompleteness:    { min: -10, max: 23 },
  followerPatterns:       { min: -10, max: 8 },
  prAcceptanceRate:       { min: -25, max: 10 },
  forkTiming:             { min: -20, max: 10 },
  activityPatterns:       { min: -20, max: 10 },
  contributionType:       { min: -15, max: 10 },
  notableContributions:   { min: -10, max: 20 },
};

// ── State ─────────────────────────────────────

let currentPR: PRPageInfo | null = null;
let cachedTriageData: any = null;

// ── PAT UI ────────────────────────────────────

function showPatConfigured(username: string, rateLimit: number | null): void {
  els.patUnconfigured.style.display = "none";
  els.patConfigured.style.display = "block";
  els.patUsername.textContent = `@${username}`;
  els.patRateLimit.textContent = rateLimit !== null
    ? `${rateLimit} requests remaining`
    : "Rate limit unknown";
  els.patError.style.display = "none";
  els.patInput.value = "";
}

function showPatUnconfigured(): void {
  els.patUnconfigured.style.display = "block";
  els.patConfigured.style.display = "none";
}

function showPatError(msg: string): void {
  els.patError.textContent = msg;
  els.patError.style.display = "block";
}

// ── PR Info UI ────────────────────────────────

function showPRInfo(pr: PRPageInfo): void {
  currentPR = pr;
  els.emptyState.style.display = "none";
  els.prDetails.style.display = "block";
  els.prInfo.classList.remove("gx-card--empty");

  els.prRepo.textContent = `${pr.owner}/${pr.repo}`;
  els.prNumber.textContent = `#${pr.prNumber}`;
  els.prTitle.textContent = pr.prTitle;
  els.prAuthor.textContent = pr.prAuthor;

  els.actionsSection.style.display = "flex";
  els.wasmSection.style.display = "block";
  els.l4Section.style.display = "block";
  els.masterSection.style.display = "block";
  resetMasterState();
  setStatus("PR detected — ready to analyze");
}

// ── Score UI ──────────────────────────────────

function showScore(score: SlopScore): void {
  els.scoreSection.style.display = "block";

  // Score ring — map [-100, +100] to [0, 1] for ring fill
  const normalized = (score.overall + 100) / 200; // 0 = -100, 1 = +100
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - normalized * circumference;
  els.scoreRing.style.strokeDashoffset = String(offset);
  els.scoreRing.style.stroke = tierColor(score.overall);

  // Score display
  els.scoreValue.textContent = (score.overall > 0 ? "+" : "") + String(score.overall);
  els.scoreLabel.textContent = recLabel(score.recommendation);
  els.scoreLabel.style.color = tierColor(score.overall);

  // Recommendation badge
  els.recommendationBadge.textContent = score.recommendation.toUpperCase();
  els.recommendationBadge.className = `gx-recommendation gx-recommendation--${score.recommendation}`;

  // Heuristic breakdown bars
  for (const key of HEURISTIC_KEYS) {
    const value = score.breakdownMap[key];
    const range = HEURISTIC_RANGES[key];
    setHeuristicBar(key, value, range.min, range.max);
  }

  els.scoreSummary.textContent = score.summary;
}

function setHeuristicBar(
  key: string,
  value: number,
  rangeMin: number,
  rangeMax: number
): void {
  const bar = $(`bar-${key}`) as HTMLDivElement;
  const val = $(`val-${key}`);

  // Calculate bar width as percentage of range
  const totalRange = rangeMax - rangeMin;
  const percent = totalRange > 0
    ? Math.abs(value) / (value >= 0 ? rangeMax : Math.abs(rangeMin)) * 50
    : 0;

  // Position: negative goes left from center, positive goes right
  if (value >= 0) {
    bar.style.width = `${Math.min(percent, 50)}%`;
    bar.style.marginLeft = "50%";
    bar.style.backgroundColor = tierColor(value > 0 ? 60 : 0);
    bar.style.borderRadius = "0 3px 3px 0";
  } else {
    bar.style.width = `${Math.min(percent, 50)}%`;
    bar.style.marginLeft = `${50 - Math.min(percent, 50)}%`;
    bar.style.backgroundColor = value <= -15 ? "#f85149" : "#d29922";
    bar.style.borderRadius = "3px 0 0 3px";
  }

  val.textContent = (value > 0 ? "+" : "") + String(value);
  val.style.color = value >= 0 ? "#3fb950" : value <= -15 ? "#f85149" : "#d29922";
}

function setStatus(text: string): void {
  els.statusText.textContent = text;
}

function setLoading(loading: boolean): void {
  els.btnAnalyze.disabled = loading;
  els.btnAnalyze.textContent = loading ? "Analyzing…" : "🔬 Analyze PR";
  if (loading) {
    els.btnAnalyze.classList.add("gx-btn--loading");
  } else {
    els.btnAnalyze.classList.remove("gx-btn--loading");
  }
}

// ── Helpers ───────────────────────────────────

function tierColor(score: number): string {
  if (score >= 10) return "#3fb950";
  if (score >= -10) return "#58a6ff";
  if (score >= -40) return "#d29922";
  return "#f85149";
}

function recLabel(rec: string): string {
  if (rec === "allow") return "Trusted";
  if (rec === "warn") return "Suspicious";
  return "Likely Spam";
}

// ── Event handlers ────────────────────────────

els.btnSavePat.addEventListener("click", () => {
  const pat = els.patInput.value.trim();
  if (!pat) {
    showPatError("Please enter a GitHub PAT");
    return;
  }

  els.btnSavePat.disabled = true;
  els.btnSavePat.textContent = "Saving…";

  chrome.runtime.sendMessage(
    { action: ACTION.SAVE_PAT, payload: { pat } },
    (response) => {
      els.btnSavePat.disabled = false;
      els.btnSavePat.textContent = "Save";

      if (response?.payload?.configured) {
        showPatConfigured(
          response.payload.username ?? "unknown",
          response.payload.rateLimitRemaining
        );
        setStatus("PAT saved — ready to analyze");
      } else {
        showPatError("Invalid PAT — please check your token and try again.");
      }
    }
  );
});

els.btnRemovePat.addEventListener("click", () => {
  chrome.runtime.sendMessage(
    { action: ACTION.SAVE_PAT, payload: { pat: "" } },
    () => {
      showPatUnconfigured();
      setStatus("PAT removed");
    }
  );
});

els.btnAnalyze.addEventListener("click", () => {
  if (!currentPR) return;

  setLoading(true);
  setStatus("Running heuristic analysis…");

  chrome.runtime.sendMessage({
    action: ACTION.REQUEST_ANALYSIS,
    payload: {
      owner: currentPR.owner,
      repo: currentPR.repo,
      prNumber: currentPR.prNumber,
      author: currentPR.prAuthor,
    },
  });
});

els.btnRefresh.addEventListener("click", () => {
  loadCurrentState();
});

// ── Listen for broadcasts from service worker ─

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.action) {
      case ACTION.ANALYSIS_UPDATE:
        if (message.payload.status === "running") {
          setLoading(true);
          setMasterLayerState("l2", "running");
          setStatus("Running heuristic analysis…");
        } else if (message.payload.status === "complete" && message.payload.slopScore) {
          setLoading(false);
          showScore(message.payload.slopScore);
          feedLayer2(message.payload.slopScore);
          refreshMasterVerdict();
          setStatus("Analysis complete ✓");
          if (!currentPR) fetchAndShowPRInfo();
        } else if (message.payload.status === "error") {
          setLoading(false);
          setMasterLayerState("l2", "error");
          setStatus(`Error: ${message.payload.error ?? "Unknown"}`);
        }
        break;

      case ACTION.PR_DATA_RESPONSE:
        if (message.payload.prInfo) {
          showPRInfo(message.payload.prInfo);
          if (message.payload.slopScore) {
            showScore(message.payload.slopScore);
            feedLayer2(message.payload.slopScore);
            refreshMasterVerdict();
          }
          if (message.payload.layer1Triage) {
            showTriage(message.payload.layer1Triage);
            feedLayer1(message.payload.layer1Triage);
            refreshMasterVerdict();
          }
        }
        break;

      case ACTION.LAYER1_TRIAGE_RESULT:
        showTriage(message.payload);
        feedLayer1(message.payload);
        refreshMasterVerdict();
        // If PR info hasn't been shown yet, fetch it now
        if (!currentPR) fetchAndShowPRInfo();
        break;
    }
    sendResponse({ ok: true });
    return true;
  }
);

/** Fetch PR info from service worker and display it (used when broadcasts arrive before PR info) */
async function fetchAndShowPRInfo(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: ACTION.GET_PR_DATA });
    if (response?.payload?.prInfo) {
      showPRInfo(response.payload.prInfo);
    }
  } catch { /* ignore */ }
}

/** Ensure currentPR is populated — try cache first, then rescan the active tab */
async function ensureCurrentPR(): Promise<void> {
  // Try cached data first
  try {
    const response = await chrome.runtime.sendMessage({ action: ACTION.GET_PR_DATA });
    if (response?.payload?.prInfo) {
      showPRInfo(response.payload.prInfo);
      if (response.payload.layer1Triage) {
        showTriage(response.payload.layer1Triage);
        feedLayer1(response.payload.layer1Triage);
      }
      if (response.payload.slopScore) {
        showScore(response.payload.slopScore);
        feedLayer2(response.payload.slopScore);
      }
      refreshMasterVerdict();
      return;
    }
  } catch { /* ignore */ }

  // Trigger rescan and wait
  try {
    setStatus("Detecting PR page…");
    await chrome.runtime.sendMessage({ action: ACTION.RESCAN_PAGE });
    // Wait for content script to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Re-fetch
    const retry = await chrome.runtime.sendMessage({ action: ACTION.GET_PR_DATA });
    if (retry?.payload?.prInfo) {
      showPRInfo(retry.payload.prInfo);
    }
  } catch { /* ignore */ }
}

// ── Bootstrap ─────────────────────────────────

async function loadCurrentState(): Promise<void> {
  setStatus("Loading…");

  // Check PAT status
  chrome.runtime.sendMessage(
    { action: ACTION.GET_PAT_STATUS },
    (response) => {
      if (response?.payload?.configured) {
        showPatConfigured(
          response.payload.username ?? "unknown",
          response.payload.rateLimitRemaining
        );
      } else {
        showPatUnconfigured();
      }
    }
  );

  // Load PR data from service worker cache
  try {
    const response = await chrome.runtime.sendMessage({
      action: ACTION.GET_PR_DATA,
    });

    if (response?.payload?.prInfo) {
      showPRInfo(response.payload.prInfo);
      if (response.payload.layer1Triage) {
        showTriage(response.payload.layer1Triage);
        feedLayer1(response.payload.layer1Triage);
      }
      if (response.payload.slopScore) {
        showScore(response.payload.slopScore);
        feedLayer2(response.payload.slopScore);
        refreshMasterVerdict();
        setStatus("Loaded cached analysis");
      } else {
        setStatus("PR loaded — ready to analyze");
      }
    } else {
      // No cached data — ask the content script to re-scan the page
      // This handles the case where the extension was reloaded
      setStatus("Scanning active tab…");
      try {
        await chrome.runtime.sendMessage({ action: ACTION.RESCAN_PAGE });
        // The content script will send PR_PAGE_DETECTED and LAYER1_TRIAGE_RESULT
        // which will be picked up by our onMessage listener above
        // Wait a bit then re-check
        setTimeout(async () => {
          try {
            const retry = await chrome.runtime.sendMessage({
              action: ACTION.GET_PR_DATA,
            });
            if (retry?.payload?.prInfo) {
              showPRInfo(retry.payload.prInfo);
              if (retry.payload.layer1Triage) {
                showTriage(retry.payload.layer1Triage);
                feedLayer1(retry.payload.layer1Triage);
                refreshMasterVerdict();
              }
              setStatus("PR loaded — ready to analyze");
            } else {
              setStatus("Navigate to a PR page to begin");
            }
          } catch {
            setStatus("Navigate to a PR page to begin");
          }
        }, 1500);
      } catch {
        setStatus("No active PR");
      }
    }
  } catch {
    setStatus("Waiting for a PR page…");
  }
}

// ── Triage UI ─────────────────────────────────

function showTriage(triage: Layer1TriagePayload): void {
  cachedTriageData = triage;
  els.triageSection.style.display = "block";

  // Verdict badge
  els.triageVerdict.textContent = triage.verdict.toUpperCase().replace("-", " ");
  els.triageVerdict.className = `gx-triage-verdict gx-triage-verdict--${triage.verdict}`;

  // Stats
  els.triagePassed.textContent = String(triage.passedChecks);
  els.triageFailed.textContent = String(triage.failedChecks);
  els.triageScore.textContent = `${triage.score}%`;

  // Progress bar
  els.triageBarFill.style.width = `${triage.score}%`;
  if (triage.verdict === "clean") {
    els.triageBarFill.style.backgroundColor = "var(--gx-green)";
  } else if (triage.verdict === "suspicious") {
    els.triageBarFill.style.backgroundColor = "var(--gx-yellow)";
  } else {
    els.triageBarFill.style.backgroundColor = "var(--gx-red)";
  }

  // Failed checks list
  const container = els.triageChecks;
  container.innerHTML = "";

  if (triage.failedDetails.length > 0) {
    // Group by category
    const grouped = new Map<string, typeof triage.failedDetails>();
    for (const check of triage.failedDetails) {
      const list = grouped.get(check.category) ?? [];
      list.push(check);
      grouped.set(check.category, list);
    }

    for (const [cat, checks] of grouped) {
      const catEl = document.createElement("div");
      catEl.className = "gx-triage-category";
      catEl.innerHTML = `<span class="gx-triage-category__label">${cat.toUpperCase()}</span>`;
      for (const check of checks) {
        const row = document.createElement("div");
        row.className = "gx-triage-check gx-triage-check--fail";
        row.innerHTML = `<span class="gx-triage-check__icon">✗</span><span class="gx-triage-check__msg">${escapeHtml(check.message)}</span>`;
        catEl.appendChild(row);
      }
      container.appendChild(catEl);
    }
  } else {
    container.innerHTML = '<div class="gx-triage-clean">All checks passed ✓</div>';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ── WASM Analyzer ─────────────────────────────

let wasmReady = false;
let wasmAnalyzeDiff: ((diff: string) => string) | null = null;

async function initWasm(): Promise<boolean> {
  if (wasmReady && wasmAnalyzeDiff) return true;

  try {
    const wasmUrl = chrome.runtime.getURL("wasm/gitx1_wasm.js");
    const module = await import(/* webpackIgnore: true */ wasmUrl);
    const wasmBinaryUrl = chrome.runtime.getURL("wasm/gitx1_wasm_bg.wasm");
    await module.default(wasmBinaryUrl);
    wasmAnalyzeDiff = module.analyze_diff;
    wasmReady = true;
    console.log("[GitX1] WASM module loaded ✓");
    return true;
  } catch (err) {
    console.error("[GitX1] WASM init failed:", err);
    return false;
  }
}

async function runWasmOnDiff(diffText: string): Promise<void> {
  setStatus("Loading WASM module…");
  const ready = await initWasm();
  if (!ready || !wasmAnalyzeDiff) {
    setStatus("WASM module failed to load");
    return;
  }

  setStatus("Running structural analysis…");
  try {
    const jsonResult = wasmAnalyzeDiff(diffText);
    const report: WasmAnalysisPayload = JSON.parse(jsonResult);
    showWasmResults(report);
    // Feed L3 data into master controller
    feedLayer3({
      score: 100 - report.score, // invert: WASM score = code quality (high=good), master = slop (high=bad)
      totalFindings: report.total_findings,
      highCount: report.severity_counts.high,
    });
    refreshMasterVerdict();
    setStatus("Structural analysis complete ✓");
  } catch (err) {
    console.error("[GitX1] WASM analysis error:", err);
    setStatus("WASM analysis failed");
  }
}

function showWasmResults(report: WasmAnalysisPayload): void {
  els.wasmSection.style.display = "block";
  els.wasmResults.style.display = "block";

  // Stats
  els.wasmFiles.textContent = String(report.files_analyzed);
  els.wasmTotal.textContent = String(report.total_findings);
  els.wasmScore.textContent = String(report.score);

  // Score badge
  let badgeClass = "gx-wasm-badge--clean";
  let badgeText = `${report.score}/100`;
  if (report.score < 50) {
    badgeClass = "gx-wasm-badge--danger";
  } else if (report.score < 80) {
    badgeClass = "gx-wasm-badge--warn";
  }
  els.wasmScoreBadge.textContent = badgeText;
  els.wasmScoreBadge.className = `gx-wasm-badge ${badgeClass}`;

  // Progress bar
  els.wasmBarFill.style.width = `${report.score}%`;
  if (report.score >= 80) {
    els.wasmBarFill.style.backgroundColor = "var(--gx-green)";
  } else if (report.score >= 50) {
    els.wasmBarFill.style.backgroundColor = "var(--gx-yellow)";
  } else {
    els.wasmBarFill.style.backgroundColor = "var(--gx-red)";
  }

  // Severity pills
  els.wasmHigh.textContent = `${report.severity_counts.high} high`;
  els.wasmMedium.textContent = `${report.severity_counts.medium} medium`;
  els.wasmLow.textContent = `${report.severity_counts.low} low`;

  // Findings list
  const container = els.wasmFindings;
  container.innerHTML = "";

  if (report.findings.length === 0) {
    container.innerHTML = '<div class="gx-wasm-clean">No structural anomalies detected ✓</div>';
    return;
  }

  // Sort by severity: high > medium > low
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...report.findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
  );

  // Limit to top 30 findings for performance
  for (const finding of sorted.slice(0, 30)) {
    const el = document.createElement("div");
    el.className = `gx-wasm-finding gx-wasm-finding--${finding.severity}`;
    el.innerHTML = `
      <div class="gx-wasm-finding__header">
        <span class="gx-wasm-finding__rule">${escapeHtml(finding.rule_id)}</span>
        <span class="gx-wasm-finding__file">${escapeHtml(finding.file)}:${finding.line}</span>
      </div>
      <div class="gx-wasm-finding__msg">${escapeHtml(finding.message)}</div>
      ${finding.snippet ? `<div class="gx-wasm-finding__snippet">${escapeHtml(finding.snippet)}</div>` : ""}
    `;
    container.appendChild(el);
  }

  if (sorted.length > 30) {
    const more = document.createElement("div");
    more.className = "gx-wasm-finding__msg";
    more.textContent = `…and ${sorted.length - 30} more findings`;
    more.style.textAlign = "center";
    more.style.padding = "8px";
    container.appendChild(more);
  }
}

// WASM button handlers
els.btnWasmAuto.addEventListener("click", async () => {
  if (!currentPR) {
    await ensureCurrentPR();
  }
  if (!currentPR) {
    setStatus("No active PR to fetch diff for");
    return;
  }

  els.btnWasmAuto.disabled = true;
  els.btnWasmAuto.textContent = "Fetching…";
  setStatus("Fetching PR diff…");

  try {
    const response: any = await chrome.runtime.sendMessage({
      action: ACTION.REQUEST_PR_DIFF,
      payload: {
        owner: currentPR.owner,
        repo: currentPR.repo,
        prNumber: currentPR.prNumber,
      },
    });

    if (response?.payload?.diff) {
      await runWasmOnDiff(response.payload.diff);
    } else {
      setStatus(response?.payload?.error ?? "Failed to fetch diff");
    }
  } catch (err) {
    setStatus("Failed to fetch diff");
  } finally {
    els.btnWasmAuto.disabled = false;
    els.btnWasmAuto.innerHTML = '<span class="gx-btn__icon">⚡</span> Auto-fetch Diff';
  }
});

els.btnWasmManual.addEventListener("click", async () => {
  const diff = els.wasmDiffInput.value.trim();
  if (!diff) {
    setStatus("Please paste a diff first");
    return;
  }
  await runWasmOnDiff(diff);
});

// ── Layer 4: AI Text Detection ────────────────

import { detectSlop, type SlopDetectionResult } from "../analysis/slop-detector";

function showL4Results(result: SlopDetectionResult): void {
  els.l4Results.style.display = "block";

  // Score
  els.l4Score.textContent = String(result.overallScore);
  const scoreColor =
    result.overallScore >= 60 ? "var(--gx-red)" :
    result.overallScore >= 30 ? "var(--gx-yellow)" :
    "var(--gx-green)";
  els.l4Score.style.color = scoreColor;

  // Verdict
  els.l4Verdict.textContent = result.verdict.toUpperCase().replace("-", " ");
  els.l4Verdict.className = `gx-l4-verdict gx-l4-verdict--${result.verdict}`;

  // Verdict badge
  let badgeClass = "gx-wasm-badge--clean";
  if (result.verdict === "likely-ai") badgeClass = "gx-wasm-badge--danger";
  else if (result.verdict === "suspicious") badgeClass = "gx-wasm-badge--warn";
  els.l4VerdictBadge.textContent = `${result.overallScore}/100`;
  els.l4VerdictBadge.className = `gx-wasm-badge ${badgeClass}`;

  // Confidence + elapsed
  els.l4Confidence.textContent = `Confidence: ${result.confidence}${result.nanoAvailable ? " (Nano ✓)" : " (heuristics only)"}`;
  els.l4Elapsed.textContent = `${result.elapsedMs}ms · ${result.engineResults.length} engines`;

  // Engine bars
  els.l4Engines.innerHTML = "";
  for (const engine of result.engineResults) {
    const pct = Math.round(engine.score * 100);
    const barColor =
      pct >= 60 ? "var(--gx-red)" :
      pct >= 30 ? "var(--gx-yellow)" :
      "var(--gx-green)";

    const row = document.createElement("div");
    row.className = "gx-l4-engine";
    row.title = engine.details;
    row.innerHTML = `
      <span class="gx-l4-engine__code">${escapeHtml(engine.engineCode)}</span>
      <span class="gx-l4-engine__name">${escapeHtml(engine.engineName)}</span>
      <div class="gx-l4-engine__bar-bg">
        <div class="gx-l4-engine__bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <span class="gx-l4-engine__value" style="color:${barColor}">${pct}%</span>
    `;
    els.l4Engines.appendChild(row);
  }

  // Human signals
  if (result.humanSignals.length > 0) {
    els.l4Human.style.display = "flex";
    els.l4HumanList.innerHTML = result.humanSignals
      .map((s) => `<span class="gx-l4-human-pill">${escapeHtml(s)}</span>`)
      .join("");
  } else {
    els.l4Human.style.display = "none";
  }
}

async function runL4Analysis(text: string): Promise<void> {
  setStatus("Running AI text detection…");
  els.btnL4Auto.disabled = true;
  els.btnL4Auto.textContent = "Analyzing…";

  try {
    const result = await detectSlop(text);
    showL4Results(result);
    feedLayer4(result);
    refreshMasterVerdict();
    setStatus(`Text analysis complete ✓ (${result.elapsedMs}ms)`);
  } catch (err) {
    console.error("[GitX1] L4 analysis error:", err);
    setStatus("Text analysis failed");
  } finally {
    els.btnL4Auto.disabled = false;
    els.btnL4Auto.innerHTML = '<span class="gx-btn__icon">🧠</span> Analyze PR Description';
  }
}

// L4 Auto: extract description from content script
els.btnL4Auto.addEventListener("click", async () => {
  if (!currentPR) {
    await ensureCurrentPR();
  }
  if (!currentPR) {
    setStatus("No active PR");
    return;
  }

  setStatus("Extracting PR description…");
  els.btnL4Auto.disabled = true;
  els.btnL4Auto.textContent = "Extracting…";

  try {
    // Send message to content script via background
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus("No active tab found");
      return;
    }

    const response: any = await chrome.tabs.sendMessage(tab.id, {
      action: ACTION.REQUEST_PR_DESCRIPTION,
      payload: {},
    });

    const description = response?.payload?.description ?? "";
    const codeComments: string[] = response?.payload?.codeComments ?? [];

    // Combine description + comments for analysis
    let textToAnalyze = description;
    if (codeComments.length > 0) {
      textToAnalyze += "\n\n" + codeComments.join("\n\n");
    }

    if (textToAnalyze.trim().length < 50) {
      setStatus("PR description too short to analyze");
      els.btnL4Auto.disabled = false;
      els.btnL4Auto.innerHTML = '<span class="gx-btn__icon">🧠</span> Analyze PR Description';
      return;
    }

    await runL4Analysis(textToAnalyze);
  } catch (err) {
    setStatus("Failed to extract PR description");
    els.btnL4Auto.disabled = false;
    els.btnL4Auto.innerHTML = '<span class="gx-btn__icon">🧠</span> Analyze PR Description';
  }
});

// L4 Manual
els.btnL4Manual.addEventListener("click", async () => {
  const text = els.l4TextInput.value.trim();
  if (!text || text.length < 50) {
    setStatus("Please paste at least 50 characters of text");
    return;
  }
  await runL4Analysis(text);
});

// ── Master Controller Integration ───────────

import {
  resetMasterState,
  feedLayer1,
  feedLayer2,
  feedLayer3,
  feedLayer4,
  shouldSkipHeavyChecks,
  computeVerdict,
  type MasterVerdict,
  type LayerStatus,
} from "../analysis/master-controller";

function refreshMasterVerdict(): void {
  const verdict = computeVerdict();
  renderMasterVerdict(verdict);
  sendBadgeUpdate(verdict);
}

function renderMasterVerdict(v: MasterVerdict): void {
  els.masterSection.style.display = "block";

  // Score ring
  const circumference = 2 * Math.PI * 52; // 326.73
  const offset = circumference - (v.score / 100) * circumference;
  els.masterRingFill.style.strokeDashoffset = String(offset);
  const ringColor = v.tier === "green" ? "var(--gx-green)" :
                    v.tier === "yellow" ? "var(--gx-yellow)" : "var(--gx-red)";
  els.masterRingFill.style.stroke = ringColor;

  // Score value
  els.masterScore.textContent = String(v.score);
  els.masterScore.style.color = ringColor;

  // Verdict label
  els.masterVerdictLabel.textContent = v.verdict;
  els.masterVerdictLabel.style.color = ringColor;

  // Tier badge
  els.masterTier.textContent = v.verdict.toUpperCase();
  els.masterTier.className = `gx-master-tier gx-master-tier--${v.tier}`;

  // Description
  const completeLayers = Object.values(v.layers).filter(l => l.state === "complete").length;
  els.masterDesc.textContent = `${completeLayers}/4 layers analyzed${v.skippedHeavyChecks ? " (smart-skip active)" : ""}`;

  // Skip banner
  if (v.skippedHeavyChecks) {
    els.masterSkip.style.display = "flex";
    els.masterSkipText.textContent = v.skipReason;
  } else {
    els.masterSkip.style.display = "none";
  }

  // Layer breakdown rows
  renderLayerRow("l1", v.layers.l1_triage);
  renderLayerRow("l2", v.layers.l2_reputation);
  renderLayerRow("l3", v.layers.l3_wasm);
  renderLayerRow("l4", v.layers.l4_ai);
}

function renderLayerRow(id: string, layer: LayerStatus): void {
  const pill = $(`ml-${id}-pill`) as HTMLElement;
  const bar = $(`ml-${id}-bar`) as HTMLDivElement;
  const detail = $(`ml-${id}-detail`) as HTMLElement;

  // Pill
  pill.textContent = layer.state === "complete" ? layer.label :
                     layer.state === "skipped" ? "skipped" :
                     layer.state === "running" ? "running…" :
                     layer.state === "error" ? "error" : "pending";
  pill.className = `gx-master-layer__pill gx-master-layer__pill--${layer.state}`;

  // Bar
  if (layer.state === "complete") {
    const pct = Math.min(layer.normalizedScore, 100);
    bar.style.width = `${pct}%`;
    bar.style.background = pct >= 60 ? "var(--gx-red)" :
                           pct >= 30 ? "var(--gx-yellow)" : "var(--gx-green)";
  } else if (layer.state === "skipped") {
    bar.style.width = "100%";
    bar.style.background = "var(--gx-surface)";
  } else {
    bar.style.width = "0%";
  }

  // Detail
  detail.textContent = layer.detail;
}

function setMasterLayerState(id: string, state: string): void {
  const pill = $(`ml-${id}-pill`) as HTMLElement;
  if (pill) {
    pill.textContent = state === "running" ? "running…" : state;
    pill.className = `gx-master-layer__pill gx-master-layer__pill--${state}`;
  }
}

// ── Badge Update to Content Script ──────────

async function sendBadgeUpdate(v: MasterVerdict): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Map tier to recommendation for the badge
    const recommendation = v.tier === "green" ? "allow" :
                           v.tier === "yellow" ? "warn" : "close";

    await chrome.tabs.sendMessage(tab.id, {
      action: ACTION.UPDATE_SLOP_BADGE,
      payload: {
        score: v.score,
        label: v.verdict,
        recommendation,
      },
    });
  } catch {
    // Tab may not have content script — ignore
  }
}

// ── Full Scan Orchestrator ──────────────────

els.btnFullScan.addEventListener("click", async () => {
  if (!currentPR) {
    await ensureCurrentPR();
  }
  if (!currentPR) {
    setStatus("No active PR — navigate to a GitHub PR page");
    return;
  }

  els.btnFullScan.disabled = true;
  els.btnFullScan.textContent = "Scanning…";
  resetMasterState();
  // Re-feed L1 so it doesn't show pending while other layers run
  if (cachedTriageData) {
    feedLayer1(cachedTriageData);
  }
  refreshMasterVerdict();

  try {
    // ── Step 1: L2 Reputation ──
    setMasterLayerState("l2", "running");
    setStatus("[1/4] Running reputation analysis…");

    // Attach listener BEFORE sending request to avoid race condition
    const l2Promise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(handler);
        // If L2 never responded, check if state has cached score
        setMasterLayerState("l2", "error");
        resolve();
      }, 15000); // 15s safety timeout

      const handler = (msg: ExtensionMessage) => {
        if (msg.action === ACTION.ANALYSIS_UPDATE) {
          if (msg.payload.status === "complete" && msg.payload.slopScore) {
            clearTimeout(timeout);
            showScore(msg.payload.slopScore);
            feedLayer2(msg.payload.slopScore);
            refreshMasterVerdict();
            chrome.runtime.onMessage.removeListener(handler);
            resolve();
          } else if (msg.payload.status === "error") {
            clearTimeout(timeout);
            setMasterLayerState("l2", "error");
            chrome.runtime.onMessage.removeListener(handler);
            resolve();
          }
        }
      };
      chrome.runtime.onMessage.addListener(handler);
    });

    chrome.runtime.sendMessage({
      action: ACTION.REQUEST_ANALYSIS,
      payload: {
        owner: currentPR!.owner,
        repo: currentPR!.repo,
        prNumber: currentPR!.prNumber,
        author: currentPR!.prAuthor,
      },
    });

    await l2Promise;

    // ── Smart-skip check ──
    if (shouldSkipHeavyChecks()) {
      setStatus("Trusted author — skipping heavy checks");
      refreshMasterVerdict();
      return;
    }

    // ── Step 2: L3 WASM Structural ──
    setMasterLayerState("l3", "running");
    setStatus("[2/4] Running structural analysis…");

    try {
      const diffResponse: any = await chrome.runtime.sendMessage({
        action: ACTION.REQUEST_PR_DIFF,
        payload: {
          owner: currentPR.owner,
          repo: currentPR.repo,
          prNumber: currentPR.prNumber,
        },
      });

      if (diffResponse?.payload?.diff) {
        await runWasmOnDiff(diffResponse.payload.diff);
      } else {
        setMasterLayerState("l3", "error");
      }
    } catch {
      setMasterLayerState("l3", "error");
    }

    // ── Step 3: L4 AI Text Detection ──
    setMasterLayerState("l4", "running");
    setStatus("[3/4] Running AI text detection…");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const descResp: any = await chrome.tabs.sendMessage(tab.id, {
          action: ACTION.REQUEST_PR_DESCRIPTION,
          payload: {},
        });

        const description = descResp?.payload?.description ?? "";
        const codeComments: string[] = descResp?.payload?.codeComments ?? [];
        let textToAnalyze = description;
        if (codeComments.length > 0) {
          textToAnalyze += "\n\n" + codeComments.join("\n\n");
        }

        if (textToAnalyze.trim().length >= 50) {
          await runL4Analysis(textToAnalyze);
        } else {
          setMasterLayerState("l4", "pending");
        }
      }
    } catch {
      setMasterLayerState("l4", "error");
    }

    // ── Final verdict ──
    refreshMasterVerdict();
    setStatus("Full scan complete ✓");

  } finally {
    els.btnFullScan.disabled = false;
    els.btnFullScan.innerHTML = '<span class="gx-btn__icon">🚀</span> Full Scan — All Layers';
  }
});

loadCurrentState();
