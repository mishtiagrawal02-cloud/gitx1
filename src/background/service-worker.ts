/**
 * ──────────────────────────────────────────────
 *  Background Service Worker
 *  Manages extension state, coordinates messaging
 *  between content script ↔ side panel.
 *  Now wired to real GitHub API + reputation scorer.
 * ──────────────────────────────────────────────
 */

import {
  ACTION,
  type ExtensionMessage,
  type PRPageInfo,
  type SlopScore,
  type Layer1TriagePayload,
} from "../types/messages";
import { githubApi } from "./github-api";
import { reputationScorer } from "./reputation-scorer";

// ── In-memory state ───────────────────────────

interface ExtensionState {
  activePR: PRPageInfo | null;
  slopScore: SlopScore | null;
  layer1Triage: Layer1TriagePayload | null;
  analysisStatus: "idle" | "pending" | "running" | "complete" | "error";
}

const state: ExtensionState = {
  activePR: null,
  slopScore: null,
  layer1Triage: null,
  analysisStatus: "idle",
};

// ── Side Panel configuration ──────────────────

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("[GitX1] Failed to set panel behavior:", err));

// ── Load PAT on startup ──────────────────────

githubApi.loadPAT().then((loaded) => {
  console.log(`[GitX1 SW] PAT ${loaded ? "loaded from storage" : "not configured"}`);
});

// ── Message router ────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    console.log("[GitX1 SW] Message received:", message.action);

    switch (message.action) {
      case ACTION.PR_PAGE_DETECTED:
        handlePrPageDetected(message.payload, sender);
        sendResponse({ ok: true });
        break;

      case ACTION.GET_PR_DATA:
        sendResponse({
          action: ACTION.PR_DATA_RESPONSE,
          payload: {
            prInfo: state.activePR,
            slopScore: state.slopScore,
            layer1Triage: state.layer1Triage,
          },
        });
        break;

      case ACTION.REQUEST_ANALYSIS:
        handleRequestAnalysis(message.payload);
        sendResponse({ ok: true, status: "started" });
        break;

      case ACTION.SAVE_PAT:
        handleSavePAT(message.payload.pat, sendResponse);
        return true; // keep channel open for async

      case ACTION.GET_PAT_STATUS:
        handleGetPatStatus(sendResponse);
        return true; // keep channel open for async

      case ACTION.LAYER1_TRIAGE_RESULT:
        handleLayer1Triage(message.payload);
        sendResponse({ ok: true });
        break;

      case ACTION.REQUEST_PR_DIFF:
        handleRequestPrDiff(message.payload, sendResponse);
        return true; // keep channel open for async

      case ACTION.RESCAN_PAGE:
        // Forward to active tab's content script
        handleRescanPage(sendResponse);
        return true; // keep channel open for async

      default:
        sendResponse({ ok: false, error: "Unknown action" });
    }

    return true;
  }
);

// ── PAT Handlers ──────────────────────────────

async function handleSavePAT(
  pat: string,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  try {
    if (pat.trim() === "") {
      // Remove PAT
      await githubApi.removePAT();
      sendResponse({
        action: ACTION.PAT_STATUS_RESPONSE,
        payload: { configured: false, rateLimitRemaining: null, username: null },
      });
      return;
    }

    const result = await githubApi.savePAT(pat.trim());
    if (result.valid) {
      sendResponse({
        action: ACTION.PAT_STATUS_RESPONSE,
        payload: {
          configured: true,
          rateLimitRemaining: githubApi.rateLimit?.remaining ?? null,
          username: result.username,
        },
      });

      // Auto-analyze if we have an active PR
      if (state.activePR && state.analysisStatus !== "running") {
        handleRequestAnalysis({
          owner: state.activePR.owner,
          repo: state.activePR.repo,
          prNumber: state.activePR.prNumber,
          author: state.activePR.prAuthor,
        });
      }
    } else {
      sendResponse({
        action: ACTION.PAT_STATUS_RESPONSE,
        payload: { configured: false, rateLimitRemaining: null, username: null },
      });
    }
  } catch (err) {
    console.error("[GitX1 SW] PAT save error:", err);
    sendResponse({
      action: ACTION.PAT_STATUS_RESPONSE,
      payload: { configured: false, rateLimitRemaining: null, username: null },
    });
  }
}

async function handleGetPatStatus(
  sendResponse: (response?: unknown) => void
): Promise<void> {
  const loaded = await githubApi.loadPAT();
  let username: string | null = null;

  if (loaded) {
    const user = await githubApi.getAuthenticatedUser();
    username = user?.login ?? null;
  }

  sendResponse({
    action: ACTION.PAT_STATUS_RESPONSE,
    payload: {
      configured: loaded,
      rateLimitRemaining: githubApi.rateLimit?.remaining ?? null,
      username,
    },
  });
}

// ── PR Detection Handler ──────────────────────

function handlePrPageDetected(
  prInfo: PRPageInfo,
  _sender: chrome.runtime.MessageSender
): void {
  state.activePR = prInfo;
  state.slopScore = null;
  state.layer1Triage = null;
  state.analysisStatus = "idle";

  console.log(
    `[GitX1 SW] PR detected: ${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber} by @${prInfo.prAuthor}`
  );

  chrome.storage.session.set({ activePR: prInfo }).catch(console.error);

  // Auto-analyze if PAT is configured
  if (githubApi.isAuthenticated) {
    handleRequestAnalysis({
      owner: prInfo.owner,
      repo: prInfo.repo,
      prNumber: prInfo.prNumber,
      author: prInfo.prAuthor,
    });
  }
}

// ── Layer 1 Triage Handler ────────────────────

function handleLayer1Triage(payload: Layer1TriagePayload): void {
  state.layer1Triage = payload;

  console.log(
    `[GitX1 SW] Layer 1 triage: ${payload.verdict} — ${payload.failedChecks}/${payload.totalChecks} failed`
  );

  // Forward to side panel
  broadcastToRuntime({
    action: ACTION.LAYER1_TRIAGE_RESULT,
    payload,
  });

  // Persist
  chrome.storage.session.set({ layer1Triage: payload }).catch(console.error);
}

// ── Analysis Handler ──────────────────────────

async function handleRequestAnalysis(payload: {
  owner: string;
  repo: string;
  prNumber: number;
  author: string;
}): Promise<void> {
  if (!githubApi.isAuthenticated) {
    broadcastToRuntime({
      action: ACTION.ANALYSIS_UPDATE,
      payload: {
        status: "error",
        slopScore: null,
        error: "GitHub PAT not configured. Add your token in the side panel.",
      },
    });
    return;
  }

  state.analysisStatus = "running";

  broadcastToRuntime({
    action: ACTION.ANALYSIS_UPDATE,
    payload: { status: "running", slopScore: null },
  });

  try {
    const slopScore = await reputationScorer.analyzeAuthor(
      payload.author,
      payload.owner,
      payload.repo
    );

    state.slopScore = slopScore;
    state.analysisStatus = "complete";

    // Notify side panel
    broadcastToRuntime({
      action: ACTION.ANALYSIS_UPDATE,
      payload: { status: "complete", slopScore },
    });

    // Tell content script to update badge
    sendToActiveTab({
      action: ACTION.UPDATE_SLOP_BADGE,
      payload: {
        score: slopScore.overall,
        label: slopScore.recommendation,
        recommendation: slopScore.recommendation,
      },
    });

    // Persist
    chrome.storage.session.set({ slopScore }).catch(console.error);
  } catch (err) {
    state.analysisStatus = "error";
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    broadcastToRuntime({
      action: ACTION.ANALYSIS_UPDATE,
      payload: { status: "error", slopScore: null, error: errorMsg },
    });
  }
}

// ── Utilities ─────────────────────────────────

function broadcastToRuntime(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open
  });
}

async function sendToActiveTab(message: ExtensionMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, message).catch(() => {
      // Content script may not be loaded
    });
  }
}

// ── PR Diff Handler (for WASM analysis) ───────

async function handleRequestPrDiff(
  payload: { owner: string; repo: string; prNumber: number },
  sendResponse: (response?: unknown) => void
): Promise<void> {
  try {
    if (!githubApi.isAuthenticated) {
      sendResponse({
        action: ACTION.PR_DIFF_RESPONSE,
        payload: { diff: null, error: "PAT not configured" },
      });
      return;
    }

    const diff = await githubApi.getPrDiff(
      payload.owner,
      payload.repo,
      payload.prNumber
    );

    sendResponse({
      action: ACTION.PR_DIFF_RESPONSE,
      payload: { diff },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch diff";
    sendResponse({
      action: ACTION.PR_DIFF_RESPONSE,
      payload: { diff: null, error: errorMsg },
    });
  }
}

// ── Rescan Page (after extension reload) ──────

async function handleRescanPage(
  sendResponse: (response?: unknown) => void
): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendResponse({ ok: false, error: "No active tab" });
      return;
    }

    // Send RESCAN_PAGE to the content script in the active tab
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: ACTION.RESCAN_PAGE,
    });
    sendResponse({ ok: true, ...response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.log("[GitX1 SW] Rescan failed (content script may not be loaded):", msg);
    sendResponse({ ok: false, error: msg });
  }
}

console.log("[GitX1] Service worker initialized ✓");
