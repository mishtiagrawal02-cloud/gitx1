/**
 * ──────────────────────────────────────────────
 *  Layer 1 Triage — Instant Metadata Checks
 *  Ported from peakoss/anti-slop's 34 check rules.
 *
 *  Runs entirely in the content script using DOM
 *  data available on the GitHub PR page. No API
 *  calls needed — provides instant results.
 *
 *  Each check returns pass/fail with a reason.
 *  The aggregate failure count becomes the
 *  Layer 1 triage signal.
 * ──────────────────────────────────────────────
 */

// ── Types ─────────────────────────────────────

export interface TriageCheck {
  id: string;
  category: TriageCategory;
  passed: boolean;
  message: string;
}

export type TriageCategory =
  | "branch"
  | "title"
  | "description"
  | "size"
  | "files"
  | "commits"
  | "user";

export interface TriageResult {
  checks: TriageCheck[];
  totalChecks: number;
  failedChecks: number;
  passedChecks: number;
  verdict: "clean" | "suspicious" | "likely-slop";
  /** 0-100 where 100 = all checks pass */
  score: number;
  ranAt: number;
}

// ── DOM Data Scraper ──────────────────────────

export interface PRDomData {
  // URL-derived
  owner: string;
  repo: string;
  prNumber: number;

  // PR metadata
  title: string;
  body: string;
  author: string;

  // Branch info
  baseBranch: string;
  headBranch: string;

  // Size metrics (from diffstat)
  additions: number;
  deletions: number;
  changedFiles: number;

  // File list
  fileNames: string[];

  // Commit info
  commitCount: number;
  commitMessages: string[];

  // Labels
  labels: string[];

  // Author meta
  isDraft: boolean;
}

/**
 * Scrapes all available PR metadata from the GitHub DOM.
 * This runs synchronously and instantly.
 */
export function scrapePRDom(): PRDomData | null {
  const urlMatch = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!urlMatch) return null;

  const [, owner, repo, numStr] = urlMatch;

  return {
    owner: owner ?? "",
    repo: repo ?? "",
    prNumber: parseInt(numStr ?? "0", 10),

    title: scrapeTitle(),
    body: scrapeBody(),
    author: scrapeAuthor(),

    baseBranch: scrapeBranch("base"),
    headBranch: scrapeBranch("head"),

    additions: scrapeDiffStat("additions"),
    deletions: scrapeDiffStat("deletions"),
    changedFiles: scrapeChangedFileCount(),

    fileNames: scrapeFileNames(),

    commitCount: scrapeCommitCount(),
    commitMessages: scrapeCommitMessages(),

    labels: scrapeLabels(),

    isDraft: scrapeIsDraft(),
  };
}

// ── DOM Scrapers ──────────────────────────────

function scrapeTitle(): string {
  const el = document.querySelector<HTMLElement>(
    ".gh-header-title .js-issue-title, .gh-header-title .markdown-title, [data-testid='issue-title'], .js-issue-title, h1 bdi, h1 .markdown-title"
  );
  if (el?.textContent?.trim()) return el.textContent.trim();

  // Fallback: extract from page <title> tag
  // Format: "PR title by username · Pull Request #N · org/repo · GitHub"
  const titleMatch = document.title.match(/^(.+?)\s+by\s+\S+\s+·\s+Pull Request/);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  return "";
}

function scrapeBody(): string {
  // Try multiple selectors — GitHub renders comment bodies differently on open vs merged PRs
  const selectors = [
    ".comment-body .js-comment-body",
    ".js-comment-body",
    ".comment-body.markdown-body",
    ".markdown-body",
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

function scrapeAuthor(): string {
  // Strategy 1: Classic .author in header meta (legacy GitHub)
  const classic = document.querySelector<HTMLElement>(".gh-header-meta .author");
  if (classic?.textContent?.trim()) return classic.textContent.trim();

  // Strategy 2: Extract from page <title> tag — works for both open & merged PRs
  // Format: "PR title by username · Pull Request #N · org/repo · GitHub"
  const titleMatch = document.title.match(/by (\S+)\s+·\s+Pull Request/);
  if (titleMatch?.[1]) return titleMatch[1];

  // Strategy 3: Any .author link on the page (timeline comments)
  const authorLink = document.querySelector<HTMLElement>("a.author");
  if (authorLink?.textContent?.trim()) return authorLink.textContent.trim();

  // Strategy 4: Primer React CSS Modules — header summary link
  const candidates = document.querySelectorAll<HTMLElement>(
    "[class*='PullRequestHeaderSummary'], [class*='summaryContainer'], .gh-header-meta"
  );
  for (const el of candidates) {
    if (el.textContent?.includes("wants to merge") || el.textContent?.includes("merged")) {
      const link = el.querySelector<HTMLAnchorElement>("a[href^='/']");
      if (link?.textContent?.trim()) return link.textContent.trim();
    }
  }

  // Strategy 5: Hovercard user link
  const hovercard = document.querySelector<HTMLAnchorElement>(
    "a[data-hovercard-type='user']"
  );
  if (hovercard?.textContent?.trim()) return hovercard.textContent.trim();

  return "";
}

function scrapeBranch(type: "base" | "head"): string {
  // GitHub shows "user:branch" or just "branch" in the head ref
  const selector =
    type === "base"
      ? ".commit-ref.base-ref"
      : ".commit-ref.head-ref";
  const el = document.querySelector<HTMLElement>(selector);
  const text = el?.textContent?.trim() ?? "";
  // Strip username prefix if present (e.g., "user:branch" → "branch")
  return text.includes(":") ? text.split(":").pop() ?? text : text;
}

function scrapeDiffStat(type: "additions" | "deletions"): number {
  // Diffstat shows "+N −M" in the PR header
  const el = document.querySelector<HTMLElement>("#diffstat");
  if (!el) {
    // Alternative: look for toc-diff-stats
    const altEl = document.querySelector<HTMLElement>(".toc-diff-stats");
    if (altEl) {
      const text = altEl.textContent ?? "";
      if (type === "additions") {
        const match = text.match(/([\d,]+)\s*addition/);
        return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
      } else {
        const match = text.match(/([\d,]+)\s*deletion/);
        return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
      }
    }
    return 0;
  }
  const text = el.textContent ?? "";
  if (type === "additions") {
    const match = text.match(/([\d,]+)\s*addition/);
    return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
  } else {
    const match = text.match(/([\d,]+)\s*deletion/);
    return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
  }
}

function scrapeChangedFileCount(): number {
  // PR "Files changed" tab shows a count
  const el = document.querySelector<HTMLElement>(
    '#diffstat, .tabnav-tab[href*="files"] .Counter, .toc-diff-stats'
  );
  if (el) {
    const text = el.textContent ?? "";
    const match = text.match(/([\d,]+)\s*changed\s*file/);
    if (match) return parseInt(match[1].replace(/,/g, ""), 10);
    // Fallback: count from the file list
  }
  return document.querySelectorAll(".file-header[data-path]").length;
}

function scrapeFileNames(): string[] {
  const elements = document.querySelectorAll<HTMLElement>(
    ".file-header[data-path]"
  );
  return Array.from(elements).map(
    (el) => el.getAttribute("data-path") ?? ""
  ).filter(Boolean);
}

function scrapeCommitCount(): number {
  // "Commits" tab shows count
  const el = document.querySelector<HTMLElement>(
    '.tabnav-tab[href*="commits"] .Counter'
  );
  if (el) {
    return parseInt(el.textContent?.trim() ?? "0", 10);
  }
  // Alternative: timeline commit entries
  return document.querySelectorAll(".TimelineItem--condensed").length;
}

function scrapeCommitMessages(): string[] {
  // Commit messages in the PR conversation timeline
  const els = document.querySelectorAll<HTMLElement>(
    ".TimelineItem--condensed .message, .commit-message code"
  );
  return Array.from(els)
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);
}

function scrapeLabels(): string[] {
  const els = document.querySelectorAll<HTMLElement>(
    ".js-issue-labels .IssueLabel"
  );
  return Array.from(els)
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);
}

function scrapeIsDraft(): boolean {
  return (
    document.querySelector(".State--draft") !== null ||
    document.querySelector('[title="Status: Draft"]') !== null
  );
}

// ═══════════════════════════════════════════════
//  CHECK IMPLEMENTATIONS — ~30 rules from anti-slop
// ═══════════════════════════════════════════════

// ── Constants ─────────────────────────────────

const CONVENTIONAL_PATTERN = /^(\w+)(?:\([^)]+\))?!?:\s.+/;

const SPAM_USERNAME_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^\d+$/, reason: "username is all digits" },
  { pattern: /\d{5,}/, reason: "username contains 5+ consecutive digits" },
  { pattern: /^[a-z]+-[a-z]+-\d+$/i, reason: "word-word-number pattern" },
  { pattern: /(?:^|[-_])ai(?:[-_]|$)/i, reason: "contains 'ai' segment" },
  { pattern: /^[a-z]{2,3}\d{4,}$/i, reason: "short prefix + long number" },
  { pattern: /bot$/i, reason: "ends with 'bot'" },
  { pattern: /^temp|tmp|test|fake/i, reason: "starts with temp/test/fake" },
];

const BLOCKED_PATHS = [
  "readme.md",
  "security.md",
  "license",
  "licence",
  "code_of_conduct.md",
  "contributing.md",
];

const BLOCKED_SOURCE_BRANCHES = ["main", "master"];

const ISSUE_REF_PATTERNS = [
  /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/(\d+)/gi,
  /(?:[\w.-]+\/[\w.-]+)#(\d+)/g,
  /GH-(\d+)/gi,
  /(?:^|[\s(])#(\d+)/gm,
];

const LLM_SLOP_PHRASES = [
  "as an ai",
  "i cannot",
  "i can't",
  "i'm an ai",
  "language model",
  "as a large language model",
  "i don't have the ability",
  "comprehensive solution",
  "it's important to note",
  "it is important to note",
  "it is worth noting",
  "let me know if you",
  "here's a comprehensive",
  "here is a comprehensive",
  "i'd be happy to help",
  "delve into",
  "streamline the",
  "leverage the",
  "elevate the",
  "harness the power",
];

const DOCS_ONLY_EXTENSIONS = new Set([
  "md", "txt", "rst", "adoc", "json", "yaml", "yml", "toml",
]);

// ── 1. Branch Checks ─────────────────────────

function checkSourceBranchBlocked(data: PRDomData): TriageCheck {
  const head = data.headBranch.toLowerCase();
  const blocked = BLOCKED_SOURCE_BRANCHES.some((b) => head === b);
  return {
    id: "source-branch-blocked",
    category: "branch",
    passed: !blocked,
    message: blocked
      ? `Source branch "${data.headBranch}" is typically a protected branch — suspicious`
      : `Source branch "${data.headBranch}" is not a blocked branch`,
  };
}

function checkBranchNaming(data: PRDomData): TriageCheck {
  const head = data.headBranch.toLowerCase();
  // Suspicious: "patch-N", "username-patch-N" (GitHub's auto-generated web edit branches)
  const isWebEdit = /^.+-patch-\d+$/.test(head) || /^patch-\d+$/.test(head);
  return {
    id: "branch-web-edit",
    category: "branch",
    passed: !isWebEdit,
    message: isWebEdit
      ? `Branch "${data.headBranch}" looks auto-generated from GitHub's web editor`
      : `Branch name "${data.headBranch}" appears intentional`,
  };
}

function checkBranchRandomChars(data: PRDomData): TriageCheck {
  const head = data.headBranch;
  // Detect branches that are just random hex or uuids
  const isRandom = /^[a-f0-9]{8,}$/i.test(head) || /^[a-f0-9-]{32,}$/i.test(head);
  return {
    id: "branch-random",
    category: "branch",
    passed: !isRandom,
    message: isRandom
      ? `Branch "${head}" appears to be random characters`
      : `Branch name is readable`,
  };
}

// ── 2. Title Checks ──────────────────────────

function checkTitleEmpty(data: PRDomData): TriageCheck {
  const empty = data.title.trim().length === 0;
  return {
    id: "title-empty",
    category: "title",
    passed: !empty,
    message: empty ? "PR title is empty" : "PR title is present",
  };
}

function checkTitleTooShort(data: PRDomData): TriageCheck {
  const tooShort = data.title.trim().length > 0 && data.title.trim().length < 5;
  return {
    id: "title-too-short",
    category: "title",
    passed: !tooShort,
    message: tooShort
      ? `PR title is only ${data.title.trim().length} characters — suspiciously short`
      : `PR title length is acceptable (${data.title.length} chars)`,
  };
}

function checkConventionalTitle(data: PRDomData): TriageCheck {
  const match = CONVENTIONAL_PATTERN.test(data.title);
  return {
    id: "conventional-title",
    category: "title",
    passed: true, // informational — not a fail
    message: match
      ? "PR title follows conventional commits format"
      : "PR title does not follow conventional commits format (informational)",
  };
}

function checkTitleAllCaps(data: PRDomData): TriageCheck {
  const allCaps = data.title.length > 5 && data.title === data.title.toUpperCase();
  return {
    id: "title-all-caps",
    category: "title",
    passed: !allCaps,
    message: allCaps
      ? "PR title is ALL CAPS — potentially aggressive or spam"
      : "PR title casing is normal",
  };
}

// ── 3. Description Checks ────────────────────

function checkDescriptionEmpty(data: PRDomData): TriageCheck {
  const empty = data.body.replace(/\s/g, "").length === 0;
  return {
    id: "description-empty",
    category: "description",
    passed: !empty,
    message: empty
      ? "PR description is empty — low-effort signal"
      : "PR description is present",
  };
}

function checkDescriptionTooLong(data: PRDomData): TriageCheck {
  const MAX = 2500;
  const over = data.body.length > MAX;
  return {
    id: "description-too-long",
    category: "description",
    passed: !over,
    message: over
      ? `Description is ${data.body.length} chars — exceeds ${MAX} (possible LLM dump)`
      : `Description length (${data.body.length}) is within limits`,
  };
}

function checkEmojiOveruse(data: PRDomData): TriageCheck {
  const MAX = 3;
  const text = `${data.title} ${data.body}`;
  const unicodeEmojis = text.match(/\p{Extended_Pictographic}/gu) ?? [];
  const shortcodes = text.match(/(?<!\w):[\w+-]+:(?!\w)/g) ?? [];
  const count = unicodeEmojis.length + shortcodes.length;
  const over = count > MAX;
  return {
    id: "emoji-overuse",
    category: "description",
    passed: !over,
    message: over
      ? `Found ${count} emojis — excessive emoji use is a spam signal`
      : `Emoji count (${count}) is reasonable`,
  };
}

function checkLlmSlop(data: PRDomData): TriageCheck {
  const bodyLower = data.body.toLowerCase();
  const found = LLM_SLOP_PHRASES.filter((phrase) => bodyLower.includes(phrase));
  const isSlop = found.length >= 2; // need 2+ phrases to trigger
  return {
    id: "llm-slop-phrases",
    category: "description",
    passed: !isSlop,
    message: isSlop
      ? `Description contains ${found.length} LLM-typical phrases: "${found.slice(0, 3).join('", "')}"`
      : "No significant LLM-generated text patterns detected",
  };
}

function checkCodeReferencesOveruse(data: PRDomData): TriageCheck {
  const MAX = 5;
  const CODE_PATTERNS = [
    /(?:[\w@.-]+\/)+[\w.-]+\.\w{1,10}/g, // file paths
    /\w+(?:->|::)\w+\(\)/g,              // method calls
    /\w{3,}\(\)/g,                         // function calls
  ];
  let count = 0;
  for (const pattern of CODE_PATTERNS) {
    count += (data.body.match(pattern) ?? []).length;
  }
  const over = count > MAX;
  return {
    id: "code-references-overuse",
    category: "description",
    passed: !over,
    message: over
      ? `Description has ${count} code references — possible auto-generated content`
      : `Code reference count (${count}) is normal`,
  };
}

function checkDescriptionIssueRef(data: PRDomData): TriageCheck {
  const numbers = new Set<number>();
  for (const pattern of ISSUE_REF_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(data.body)) !== null) {
      if (match[1]) numbers.add(parseInt(match[1]));
    }
  }
  const hasRef = numbers.size > 0;
  return {
    id: "linked-issue",
    category: "description",
    passed: true, // informational
    message: hasRef
      ? `Found ${numbers.size} linked issue(s) in description`
      : "No linked issues found (informational)",
  };
}

// ── 4. Size Checks ───────────────────────────

function checkChangedFilesCount(data: PRDomData): TriageCheck {
  const MAX = 50;
  const over = data.changedFiles > MAX;
  return {
    id: "max-changed-files",
    category: "size",
    passed: !over,
    message: over
      ? `PR changes ${data.changedFiles} files — exceeds ${MAX} file limit`
      : `PR changes ${data.changedFiles} file(s) — within limits`,
  };
}

function checkChangedLinesCount(data: PRDomData): TriageCheck {
  const MAX = 10000;
  const total = data.additions + data.deletions;
  const over = total > MAX;
  return {
    id: "max-changed-lines",
    category: "size",
    passed: !over,
    message: over
      ? `PR has ${total} changed lines — exceeds ${MAX} (possible bulk dump)`
      : `PR has ${total} changed lines — within limits`,
  };
}

function checkAddDeleteRatio(data: PRDomData): TriageCheck {
  // Suspiciously one-sided: all additions, zero deletions in large PRs
  const total = data.additions + data.deletions;
  const isOneWay =
    total > 200 &&
    (data.deletions === 0 || data.additions / (data.deletions || 1) > 50);
  return {
    id: "add-delete-ratio",
    category: "size",
    passed: !isOneWay,
    message: isOneWay
      ? `PR is heavily one-sided: +${data.additions}/-${data.deletions} — possible code dump`
      : `Add/delete ratio (+${data.additions}/-${data.deletions}) looks normal`,
  };
}

// ── 5. File Checks ───────────────────────────

function checkBlockedPaths(data: PRDomData): TriageCheck {
  const blocked = data.fileNames.filter((f) =>
    BLOCKED_PATHS.includes(f.toLowerCase())
  );
  const hasBlocked = blocked.length > 0;
  return {
    id: "blocked-paths",
    category: "files",
    passed: !hasBlocked,
    message: hasBlocked
      ? `PR touches protected files: ${blocked.join(", ")} — common spam target`
      : "No protected files are modified",
  };
}

function checkDocsOnlyPR(data: PRDomData): TriageCheck {
  if (data.fileNames.length === 0) {
    return {
      id: "docs-only-pr",
      category: "files",
      passed: true,
      message: "File list not available in DOM",
    };
  }

  const allDocs = data.fileNames.every((f) => {
    const ext = f.split(".").pop()?.toLowerCase() ?? "";
    return DOCS_ONLY_EXTENSIONS.has(ext);
  });

  return {
    id: "docs-only-pr",
    category: "files",
    passed: !allDocs,
    message: allDocs
      ? "PR only modifies documentation/config files — common slop pattern"
      : "PR includes non-documentation file changes",
  };
}

function checkReadmeOnlyChange(data: PRDomData): TriageCheck {
  const readmeOnly =
    data.fileNames.length === 1 &&
    data.fileNames[0].toLowerCase() === "readme.md";
  return {
    id: "readme-only",
    category: "files",
    passed: !readmeOnly,
    message: readmeOnly
      ? "PR only touches README.md — the #1 spam target"
      : "PR does not exclusively target README",
  };
}

function checkSensitiveFileChange(data: PRDomData): TriageCheck {
  const SENSITIVE = [
    ".github/workflows/",
    ".github/actions/",
    "dockerfile",
    "docker-compose",
    ".env",
    "package-lock.json",
    "yarn.lock",
  ];
  const sensitive = data.fileNames.filter((f) => {
    const lower = f.toLowerCase();
    return SENSITIVE.some((s) => lower.includes(s));
  });
  const hasSensitive = sensitive.length > 0;
  return {
    id: "sensitive-files",
    category: "files",
    passed: true, // warning, not fail
    message: hasSensitive
      ? `PR modifies sensitive files: ${sensitive.slice(0, 3).join(", ")} (⚠ review carefully)`
      : "No sensitive files are modified",
  };
}

// ── 6. Commit Checks ─────────────────────────

function checkSingleCommitPR(data: PRDomData): TriageCheck {
  // Not a fail, but informational for large PRs
  const suspicious =
    data.commitCount === 1 && data.changedFiles > 10;
  return {
    id: "single-commit-large",
    category: "commits",
    passed: !suspicious,
    message: suspicious
      ? `Single commit changing ${data.changedFiles} files — possible squash of AI-generated code`
      : `Commit count (${data.commitCount}) vs files changed is reasonable`,
  };
}

function checkCommitMessageQuality(data: PRDomData): TriageCheck {
  if (data.commitMessages.length === 0) {
    return {
      id: "commit-message-quality",
      category: "commits",
      passed: true,
      message: "No commit messages available in DOM",
    };
  }

  const low = data.commitMessages.filter((msg) => {
    const lower = msg.toLowerCase().trim();
    return (
      lower.length < 5 ||
      lower === "update" ||
      lower === "fix" ||
      lower === "changes" ||
      lower === "update readme.md" ||
      lower === "initial commit" ||
      /^update\s+\S+\.\S+$/i.test(lower)
    );
  });

  const isLow = low.length > 0 && low.length === data.commitMessages.length;
  return {
    id: "commit-message-quality",
    category: "commits",
    passed: !isLow,
    message: isLow
      ? `All commit messages are low-effort: "${low[0]}"${low.length > 1 ? ` (+${low.length - 1} more)` : ""}`
      : "Commit messages have reasonable quality",
  };
}

function checkExcessiveCommits(data: PRDomData): TriageCheck {
  const MAX = 30;
  const over = data.commitCount > MAX;
  return {
    id: "excessive-commits",
    category: "commits",
    passed: !over,
    message: over
      ? `PR has ${data.commitCount} commits — unusually high`
      : `Commit count (${data.commitCount}) is reasonable`,
  };
}

function checkDuplicateCommitMessages(data: PRDomData): TriageCheck {
  if (data.commitMessages.length < 3) {
    return {
      id: "duplicate-commits",
      category: "commits",
      passed: true,
      message: "Not enough commits to check for duplicates",
    };
  }
  const unique = new Set(data.commitMessages.map((m) => m.toLowerCase().trim()));
  const duplicateRatio =
    1 - unique.size / data.commitMessages.length;
  const isDuplicated = duplicateRatio > 0.5 && data.commitMessages.length >= 3;
  return {
    id: "duplicate-commits",
    category: "commits",
    passed: !isDuplicated,
    message: isDuplicated
      ? `${Math.round(duplicateRatio * 100)}% of commit messages are duplicates — automated pattern`
      : "Commit messages are sufficiently varied",
  };
}

// ── 7. User Checks ───────────────────────────

function checkSpamUsername(data: PRDomData): TriageCheck {
  const matched = SPAM_USERNAME_PATTERNS.filter((entry) =>
    entry.pattern.test(data.author)
  );
  const isSpam = matched.length > 0;
  return {
    id: "spam-username",
    category: "user",
    passed: !isSpam,
    message: isSpam
      ? `Username "${data.author}" matches spam patterns: ${matched.map((e) => e.reason).join(", ")}`
      : `Username "${data.author}" does not match spam patterns`,
  };
}

function checkBotDraftPR(data: PRDomData): TriageCheck {
  // Not a fail — drafts may just be WIPs
  return {
    id: "draft-pr",
    category: "user",
    passed: true, // informational
    message: data.isDraft
      ? "PR is a draft"
      : "PR is not a draft",
  };
}

function checkKnownBotAuthor(data: PRDomData): TriageCheck {
  const BOTS = [
    "dependabot[bot]",
    "renovate[bot]",
    "github-actions[bot]",
    "autofix-ci[bot]",
    "actions-user",
    "mergify[bot]",
    "greenkeeper[bot]",
    "snyk-bot",
  ];
  const isBot = BOTS.some(
    (b) => data.author.toLowerCase() === b.toLowerCase()
  );
  return {
    id: "known-bot",
    category: "user",
    passed: true, // informational
    message: isBot
      ? `Author "${data.author}" is a known bot — exempt from checks`
      : `Author "${data.author}" is not a known bot`,
  };
}

// ── 8. Cross-Signal Checks ───────────────────

function checkTypoFixPattern(data: PRDomData): TriageCheck {
  const titleLower = data.title.toLowerCase();
  const bodyLower = data.body.toLowerCase();
  const isTypoFix =
    (titleLower.includes("typo") ||
      titleLower.includes("spelling") ||
      titleLower.includes("grammar") ||
      titleLower.includes("fix link") ||
      titleLower.includes("update readme")) &&
    data.changedFiles <= 2 &&
    data.additions + data.deletions < 10;
  const alsoEmpty = isTypoFix && bodyLower.replace(/\s/g, "").length < 20;
  return {
    id: "typo-fix-pattern",
    category: "description",
    passed: !alsoEmpty,
    message: alsoEmpty
      ? "Typo/spelling fix with minimal description — classic spam pattern"
      : isTypoFix
        ? "Small typo fix — looks legitimate"
        : "Not a typo-fix PR",
  };
}

function checkTitleBodyMismatch(data: PRDomData): TriageCheck {
  // If title says "fix" but body is massive/unrelated
  if (data.body.length < 20 || data.title.length < 3) {
    return {
      id: "title-body-mismatch",
      category: "description",
      passed: true,
      message: "Insufficient data to compare title and body",
    };
  }

  const titleWords = new Set(
    data.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  );
  const bodyWords = new Set(
    data.body
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .slice(0, 100)
  );

  const overlap = [...titleWords].filter((w) => bodyWords.has(w)).length;
  const overlapRatio = titleWords.size > 0 ? overlap / titleWords.size : 1;
  const isMismatch = overlapRatio === 0 && titleWords.size >= 3;

  return {
    id: "title-body-mismatch",
    category: "description",
    passed: !isMismatch,
    message: isMismatch
      ? "Title and description share zero words — potentially auto-generated"
      : "Title and description are topically aligned",
  };
}

// ═══════════════════════════════════════════════
//  MAIN TRIAGE RUNNER
// ═══════════════════════════════════════════════

const ALL_CHECKS: ((data: PRDomData) => TriageCheck)[] = [
  // Branch (3)
  checkSourceBranchBlocked,
  checkBranchNaming,
  checkBranchRandomChars,

  // Title (4)
  checkTitleEmpty,
  checkTitleTooShort,
  checkConventionalTitle,
  checkTitleAllCaps,

  // Description (7)
  checkDescriptionEmpty,
  checkDescriptionTooLong,
  checkEmojiOveruse,
  checkLlmSlop,
  checkCodeReferencesOveruse,
  checkDescriptionIssueRef,
  checkTypoFixPattern,
  checkTitleBodyMismatch,

  // Size (3)
  checkChangedFilesCount,
  checkChangedLinesCount,
  checkAddDeleteRatio,

  // Files (4)
  checkBlockedPaths,
  checkDocsOnlyPR,
  checkReadmeOnlyChange,
  checkSensitiveFileChange,

  // Commits (4)
  checkSingleCommitPR,
  checkCommitMessageQuality,
  checkExcessiveCommits,
  checkDuplicateCommitMessages,

  // User (3)
  checkSpamUsername,
  checkBotDraftPR,
  checkKnownBotAuthor,
];

/**
 * Run all ~30 Layer 1 triage checks using DOM-scraped data.
 * Returns instantly (no API calls).
 */
export function runLayer1Triage(data: PRDomData): TriageResult {
  const checks = ALL_CHECKS.map((check) => check(data));
  const failedChecks = checks.filter((c) => !c.passed).length;
  const passedChecks = checks.filter((c) => c.passed).length;

  let verdict: TriageResult["verdict"];
  if (failedChecks >= 6) {
    verdict = "likely-slop";
  } else if (failedChecks >= 3) {
    verdict = "suspicious";
  } else {
    verdict = "clean";
  }

  const score = Math.round((passedChecks / checks.length) * 100);

  return {
    checks,
    totalChecks: checks.length,
    failedChecks,
    passedChecks,
    verdict,
    score,
    ranAt: Date.now(),
  };
}
