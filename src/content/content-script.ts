/**
 * ──────────────────────────────────────────────
 *  Content Script — Lightweight DOM injector
 *  Only runs on github.com PR pages (pull request URLs).
 *  Injects a tiny "Slop Score" badge next to the
 *  PR author's name. Runs Layer 1 instant triage.
 * ──────────────────────────────────────────────
 */

import { ACTION, type PRPageInfo, type ExtensionMessage } from "../types/messages";
import { scrapePRDom, runLayer1Triage } from "./layer1-triage";
import "./content.css";

// ── Constants ─────────────────────────────────

const BADGE_ID = "gitx1-slop-badge";
const BADGE_POLL_INTERVAL = 800;
const MAX_POLL_ATTEMPTS = 25;

// ── Parse PR metadata from the DOM / URL ──────

function parsePRPage(): PRPageInfo | null {
  const urlMatch = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!urlMatch) return null;

  const [, owner, repo, prNumStr] = urlMatch;
  const prNumber = parseInt(prNumStr, 10);

  // PR title from the page heading (multiple fallback selectors)
  const titleEl = document.querySelector<HTMLElement>(
    ".gh-header-title .js-issue-title, .gh-header-title .markdown-title, [data-testid='issue-title'], .js-issue-title, h1 bdi, h1 .markdown-title"
  );
  const prTitle = titleEl?.textContent?.trim() ?? `PR #${prNumber}`;

  // PR author — GitHub Primer React removed .author from header meta
  const prAuthor = findPRAuthor();

  return {
    owner,
    repo,
    prNumber,
    prTitle,
    prAuthor,
    url: window.location.href,
  };
}

/**
 * Find the PR author using multiple selector strategies.
 * GitHub's DOM changes frequently — they now use Primer React
 * with CSS Modules (hashed class names), so we need broad fallbacks.
 */
function findPRAuthor(): string {
  // Strategy 1: Classic .author in header meta (legacy GitHub)
  const classic = document.querySelector<HTMLElement>(".gh-header-meta .author");
  if (classic?.textContent?.trim()) return classic.textContent.trim();

  // Strategy 2: Extract from page <title> tag — most reliable across all PR states
  // Format: "PR title by username · Pull Request #N · org/repo · GitHub"
  const pageTitle = document.title;
  const titleMatch = pageTitle.match(/by (\S+)\s+·\s+Pull Request/);
  if (titleMatch?.[1]) return titleMatch[1];

  // Strategy 3: Primer React — look for the first user link in header summary
  // For open PRs this is the author; for merged PRs this is the merger
  // We prefer Strategy 2 above to avoid the merger confusion
  const prHeader = findPRHeaderSummary();
  if (prHeader) {
    const authorLink = prHeader.querySelector<HTMLAnchorElement>("a[href^='/']");
    if (authorLink?.textContent?.trim()) return authorLink.textContent.trim();
  }

  // Strategy 4: Timeline author in the first comment (typically the PR author)
  const timelineAuthor = document.querySelector<HTMLElement>(
    ".timeline-comment .author, .TimelineItem .author, a.author"
  );
  if (timelineAuthor?.textContent?.trim()) return timelineAuthor.textContent.trim();

  // Strategy 5: Any user hovercard link near the top of the page  
  const hovercard = document.querySelector<HTMLAnchorElement>(
    "a[data-hovercard-type='user']"
  );
  if (hovercard?.textContent?.trim()) return hovercard.textContent.trim();

  return "unknown";
}

/**
 * Find the PR header summary container that holds "X wants to merge".
 * GitHub 2025+ uses CSS Modules with hashed class names, so we
 * walk the DOM looking for the text pattern instead of class names.
 */
function findPRHeaderSummary(): HTMLElement | null {
  // Try Primer React CSS module container first
  const candidates = document.querySelectorAll<HTMLElement>(
    "[class*='PullRequestHeaderSummary'], [class*='summaryContainer'], .gh-header-meta"
  );
  for (const el of candidates) {
    // Match both open PRs ("wants to merge") and merged PRs ("merged N commit")
    if (el.textContent?.includes("wants to merge") || el.textContent?.includes("merged")) return el;
  }
  
  // Fallback: walk all divs/spans near the top looking for "wants to merge"
  const headerArea = document.querySelector<HTMLElement>(".gh-header, #partial-discussion-header, header");
  if (headerArea) {
    const walker = document.createTreeWalker(headerArea, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes("wants to merge")) {
        return node.parentElement;
      }
    }
  }
  
  return null;
}

/**
 * Find a suitable DOM anchor point to inject the badge next to the author.
 */
function findAuthorAnchor(): HTMLElement | null {
  // Strategy 1: Classic selectors
  const classicSelectors = [
    ".gh-header-meta .author",
    ".gh-header-meta a.text-bold",
    ".gh-header-meta a[data-hovercard-type='user']",
  ];
  for (const sel of classicSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }

  // Strategy 2: Find the author link in the PR header summary
  const prHeader = findPRHeaderSummary();
  if (prHeader) {
    const authorLink = prHeader.querySelector<HTMLAnchorElement>("a[href^='/']");
    if (authorLink) return authorLink;
  }

  // Strategy 3: First .author link anywhere in the page header
  const anyAuthor = document.querySelector<HTMLElement>("a.author");
  if (anyAuthor) return anyAuthor;

  return null;
}

// ── Badge injection ───────────────────────────

function createBadge(): HTMLElement {
  const badge = document.createElement("span");
  badge.id = BADGE_ID;
  badge.className = "gitx1-slop-badge";
  badge.setAttribute("aria-label", "GitX1 Reputation Score – click extension icon for details");
  badge.title = "GitX1 Reputation Score";

  // Default state — awaiting analysis
  badge.innerHTML = `
    <span class="gitx1-slop-badge__icon">⚡</span>
    <span class="gitx1-slop-badge__label">Score</span>
    <span class="gitx1-slop-badge__value">…</span>
  `;

  return badge;
}

function injectBadge(): boolean {
  if (document.getElementById(BADGE_ID)) return true;

  const authorEl = findAuthorAnchor();
  if (!authorEl) return false;

  const badge = createBadge();
  authorEl.parentElement?.insertBefore(badge, authorEl.nextSibling);
  return true;
}

function updateBadge(score: number, _label: string, recommendation: string): void {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;

  const valueEl = badge.querySelector<HTMLElement>(".gitx1-slop-badge__value");
  const labelEl = badge.querySelector<HTMLElement>(".gitx1-slop-badge__label");

  if (valueEl) valueEl.textContent = (score > 0 ? "+" : "") + String(score);
  if (labelEl) labelEl.textContent = recommendation.toUpperCase();

  // Update color tier based on recommendation
  badge.classList.remove("gitx1--allow", "gitx1--warn", "gitx1--close", "gitx1--clean", "gitx1--ok", "gitx1--sloppy");
  badge.classList.add(`gitx1--${recommendation}`);
}

/**
 * Show instant Layer 1 verdict on the badge before API-based analysis completes.
 */
function updateBadgeWithTriage(verdict: string, score: number): void {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;

  const valueEl = badge.querySelector<HTMLElement>(".gitx1-slop-badge__value");
  const labelEl = badge.querySelector<HTMLElement>(".gitx1-slop-badge__label");

  if (valueEl) valueEl.textContent = `${score}%`;
  if (labelEl) labelEl.textContent = verdict.toUpperCase().replace("-", " ");

  badge.classList.remove("gitx1--allow", "gitx1--warn", "gitx1--close");
  if (verdict === "clean") {
    badge.classList.add("gitx1--allow");
  } else if (verdict === "suspicious") {
    badge.classList.add("gitx1--warn");
  } else {
    badge.classList.add("gitx1--close");
  }
}

// ── Poll for DOM readiness (GitHub uses Turbo) ─

function waitForDOMAndInject(callback: () => void): void {
  let attempts = 0;

  const poll = setInterval(() => {
    attempts++;
    if (injectBadge() || attempts >= MAX_POLL_ATTEMPTS) {
      clearInterval(poll);
      if (attempts >= MAX_POLL_ATTEMPTS) {
        console.log("[GitX1] Badge injection skipped — author element not found. Triage still runs.");
      }
      // Always run triage, even if badge couldn't be injected
      callback();
    }
  }, BADGE_POLL_INTERVAL);
}

// ── Layer 1 Triage Runner ─────────────────────

function runInstantTriage(): void {
  const domData = scrapePRDom();
  if (!domData) return;

  const triageResult = runLayer1Triage(domData);

  console.log(
    `[GitX1 L1] Instant triage: ${triageResult.verdict} — ` +
    `${triageResult.passedChecks}/${triageResult.totalChecks} passed, ` +
    `${triageResult.failedChecks} failed`
  );

  if (triageResult.failedChecks > 0) {
    console.log(
      "[GitX1 L1] Failed checks:",
      triageResult.checks
        .filter((c) => !c.passed)
        .map((c) => `  ✗ [${c.category}] ${c.id}: ${c.message}`)
        .join("\n")
    );
  }

  // Update badge immediately with triage verdict
  updateBadgeWithTriage(triageResult.verdict, triageResult.score);

  // Send triage results to service worker for side panel display
  chrome.runtime.sendMessage({
    action: ACTION.LAYER1_TRIAGE_RESULT,
    payload: {
      totalChecks: triageResult.totalChecks,
      failedChecks: triageResult.failedChecks,
      passedChecks: triageResult.passedChecks,
      verdict: triageResult.verdict,
      score: triageResult.score,
      ranAt: triageResult.ranAt,
      failedDetails: triageResult.checks
        .filter((c) => !c.passed)
        .map((c) => ({ id: c.id, category: c.category, message: c.message })),
      allChecks: triageResult.checks.map((c) => ({
        id: c.id,
        category: c.category,
        passed: c.passed,
        message: c.message,
      })),
    },
  }).catch(() => { /* service worker not ready yet */ });
}

// ── Listen for messages from service worker ───

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (resp?: unknown) => void
  ) => {
    if (message.action === ACTION.UPDATE_SLOP_BADGE) {
      const { score, label, recommendation } = message.payload;
      updateBadge(score, label, recommendation);
      sendResponse({ ok: true });
    }

    if (message.action === ACTION.REQUEST_PR_DESCRIPTION) {
      const description = extractPRDescription();
      const codeComments = extractCodeComments();
      sendResponse({
        action: ACTION.PR_DESCRIPTION_RESPONSE,
        payload: { description, codeComments },
      });
    }

    if (message.action === ACTION.RESCAN_PAGE) {
      // Re-parse and re-send PR data after extension reload
      const prInfo = parsePRPage();
      if (prInfo) {
        chrome.runtime.sendMessage({
          action: ACTION.PR_PAGE_DETECTED,
          payload: prInfo,
        }).catch(() => {});
        // Re-run triage after a short delay
        setTimeout(runInstantTriage, 300);
        sendResponse({ ok: true, found: true });
      } else {
        sendResponse({ ok: true, found: false });
      }
    }

    return true;
  }
);

// ── PR Description Extraction ─────────────────

function extractPRDescription(): string {
  // GitHub PR description is in a .comment-body within the first timeline comment
  const bodyEl = document.querySelector<HTMLElement>(
    ".js-comment-body, .comment-body, .markdown-body"
  );
  return bodyEl?.innerText?.trim() ?? "";
}

function extractCodeComments(): string[] {
  // Extract inline code review comments
  const comments: string[] = [];
  const commentEls = document.querySelectorAll<HTMLElement>(
    ".review-comment .comment-body, .timeline-comment .comment-body"
  );
  commentEls.forEach((el, index) => {
    if (index > 0) { // Skip first one (PR description itself)
      const text = el.innerText?.trim();
      if (text && text.length > 20) {
        comments.push(text);
      }
    }
  });
  return comments.slice(0, 20); // Cap at 20 comments
}

// ── Init ──────────────────────────────────────

function init(): void {
  const prInfo = parsePRPage();
  if (!prInfo) {
    console.log("[GitX1] Not a PR page, skipping.");
    return;
  }

  console.log(
    `[GitX1] PR page detected: ${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}`
  );

  // Wait for DOM, then inject badge AND run instant triage
  waitForDOMAndInject(() => {
    // Run Layer 1 triage immediately after badge is injected
    // Small delay to let the DOM fully settle
    setTimeout(runInstantTriage, 200);
  });

  chrome.runtime.sendMessage({
    action: ACTION.PR_PAGE_DETECTED,
    payload: prInfo,
  }).catch(() => { /* service worker not ready yet */ });
}

document.addEventListener("turbo:load", init);
init();
