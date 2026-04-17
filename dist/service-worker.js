/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/types/messages.ts
/**
 * ──────────────────────────────────────────────
 *  Message Protocol — shared between all contexts
 *  (service-worker ↔ content-script ↔ side-panel)
 * ──────────────────────────────────────────────
 */
// ── Action constants ──────────────────────────
const ACTION = {
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
};

;// ./src/background/github-api.ts
/**
 * ──────────────────────────────────────────────
 *  GitHub REST API Client with Cache
 *  Authenticates via user-provided PAT stored in
 *  chrome.storage.local. Includes LRU cache with
 *  configurable TTL to respect rate limits.
 * ──────────────────────────────────────────────
 */
class LRUCache {
    cache = new Map();
    maxSize;
    defaultTTL; // ms
    constructor(maxSize = 100, defaultTTLMinutes = 30) {
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTLMinutes * 60 * 1000;
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }
    set(key, data, ttlMs) {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) {
                this.cache.delete(oldest);
            }
        }
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
        });
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
// ── API Client ────────────────────────────────
const GITHUB_API_BASE = "https://api.github.com";
const STORAGE_KEY_PAT = "gitx1_github_pat";
class GitHubApiClient {
    pat = null;
    rateLimitInfo = null;
    cache = new LRUCache(200, 30);
    // ── PAT Management ────────────────────────
    async savePAT(pat) {
        // Verify PAT by making a test request
        try {
            const response = await fetch(`${GITHUB_API_BASE}/user`, {
                headers: {
                    Authorization: `Bearer ${pat}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            });
            if (!response.ok) {
                return { valid: false, username: null };
            }
            const user = (await response.json());
            this.pat = pat;
            this.updateRateLimit(response);
            // Store securely in chrome.storage.local
            await chrome.storage.local.set({ [STORAGE_KEY_PAT]: pat });
            console.log(`[GitX1 API] PAT saved for user: ${user.login}`);
            return { valid: true, username: user.login };
        }
        catch {
            return { valid: false, username: null };
        }
    }
    async loadPAT() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY_PAT);
            const storedPat = result[STORAGE_KEY_PAT];
            if (storedPat) {
                this.pat = storedPat;
                return true;
            }
        }
        catch {
            // Storage not available
        }
        return false;
    }
    async removePAT() {
        this.pat = null;
        this.cache.clear();
        await chrome.storage.local.remove(STORAGE_KEY_PAT);
    }
    get isAuthenticated() {
        return this.pat !== null;
    }
    get rateLimit() {
        return this.rateLimitInfo;
    }
    // ── API Methods ───────────────────────────
    /** Fetch a GitHub user's profile. */
    async getUser(username) {
        const cacheKey = `user:${username}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        const user = await this.request(`/users/${username}`);
        this.cache.set(cacheKey, user);
        return user;
    }
    /**
     * Search for PRs authored by a user.
     * Returns merged + closed + open PRs for acceptance rate calculation.
     */
    async searchUserPRs(username, options = {}) {
        const { maxResults = 100, dateRange } = options;
        const cacheKey = `prs:${username}:${dateRange ?? "all"}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        let query = `author:${username} type:pr`;
        if (dateRange) {
            query += ` created:${dateRange}`;
        }
        const perPage = Math.min(maxResults, 100);
        const result = await this.request(`/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}&sort=created&order=desc`);
        this.cache.set(cacheKey, result.items);
        return result.items;
    }
    /** Fetch recent public events for a user. */
    async getUserEvents(username) {
        const cacheKey = `events:${username}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        const events = await this.request(`/users/${username}/events/public?per_page=100`);
        this.cache.set(cacheKey, events);
        return events;
    }
    /** Fetch forks of a repository (to check fork timing). */
    async getRepoForks(owner, repo, perPage = 30) {
        const cacheKey = `forks:${owner}/${repo}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        const forks = await this.request(`/repos/${owner}/${repo}/forks?sort=newest&per_page=${perPage}`);
        this.cache.set(cacheKey, forks);
        return forks;
    }
    /** Get the authenticated user (for PAT validation). */
    async getAuthenticatedUser() {
        if (!this.pat)
            return null;
        try {
            return await this.request("/user");
        }
        catch {
            return null;
        }
    }
    /** Fetch the unified diff for a pull request. */
    async getPrDiff(owner, repo, prNumber) {
        const cacheKey = `diff:${owner}/${repo}/${prNumber}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        if (!this.pat) {
            throw new Error("GitHub PAT not configured.");
        }
        const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.pat}`,
                Accept: "application/vnd.github.diff",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
        this.updateRateLimit(response);
        if (!response.ok) {
            throw new Error(`Failed to fetch diff: ${response.status}`);
        }
        const diff = await response.text();
        // Cache for 10 minutes (diffs don't change often)
        this.cache.set(cacheKey, diff, 10 * 60 * 1000);
        return diff;
    }
    // ── Internal ──────────────────────────────
    async request(endpoint) {
        if (!this.pat) {
            throw new Error("GitHub PAT not configured. Please add your token in the side panel.");
        }
        const url = endpoint.startsWith("http")
            ? endpoint
            : `${GITHUB_API_BASE}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.pat}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
        this.updateRateLimit(response);
        if (!response.ok) {
            if (response.status === 403 && this.rateLimitInfo?.remaining === 0) {
                const resetTime = new Date((this.rateLimitInfo.reset ?? 0) * 1000).toLocaleTimeString();
                throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}.`);
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    updateRateLimit(response) {
        const limit = response.headers.get("X-RateLimit-Limit");
        const remaining = response.headers.get("X-RateLimit-Remaining");
        const reset = response.headers.get("X-RateLimit-Reset");
        if (limit && remaining && reset) {
            this.rateLimitInfo = {
                limit: parseInt(limit, 10),
                remaining: parseInt(remaining, 10),
                reset: parseInt(reset, 10),
            };
        }
    }
}
// ── Singleton ─────────────────────────────────
const githubApi = new GitHubApiClient();

;// ./src/background/reputation-scorer.ts
/**
 * ──────────────────────────────────────────────
 *  Heuristic Reputation Scorer
 *  Ported from vmazi/pr-slop-stopper's scoring
 *  engine. Implements all 8 heuristics with exact
 *  weights from the HEURISTICS.md specification.
 *
 *  Score range: [-100, +100]
 * ──────────────────────────────────────────────
 */

// ── Notable OSS Organizations ─────────────────
const NOTABLE_ORGS = new Set([
    "apache",
    "torvalds",
    "linuxfoundation",
    "cncf",
    "kubernetes",
    "prometheus",
    "envoyproxy",
    "mozilla",
    "rust-lang",
    "python",
    "nodejs",
    "django",
    "rails",
    "hashicorp",
]);
// ── Heuristic: Account Age ────────────────────
// Range: -20 to +15
function scoreAccountAge(user) {
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const ageMonths = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    let score;
    let reason;
    if (ageMonths < 1) {
        score = -20;
        reason = "Account less than 1 month old — almost certainly suspicious";
    }
    else if (ageMonths < 3) {
        score = -15;
        reason = "Account less than 3 months old — likely created for spam";
    }
    else if (ageMonths < 6) {
        score = -10;
        reason = "Account less than 6 months old — very new";
    }
    else if (ageMonths < 12) {
        score = 0;
        reason = "Account 6-12 months old — neutral";
    }
    else if (ageMonths < 36) {
        score = 5;
        reason = "Account 1-3 years old — not brand new";
    }
    else if (ageMonths < 60) {
        score = 10;
        reason = "Account 3-5 years old — established";
    }
    else {
        score = 15;
        reason = `Account ${Math.floor(ageMonths / 12)} years old — long-standing`;
    }
    return {
        name: "Account Age",
        score,
        maxPositive: 15,
        maxNegative: -20,
        reason,
    };
}
// ── Heuristic: Profile Completeness ───────────
// Range: -10 to +23
function scoreProfileCompleteness(user) {
    let score = 0;
    const signals = [];
    // Positive signals
    if (user.avatar_url && !user.avatar_url.includes("identicon")) {
        score += 5;
        signals.push("+5 custom avatar");
    }
    else {
        score -= 5;
        signals.push("-5 default avatar");
    }
    if (user.bio) {
        score += 3;
        signals.push("+3 has bio");
    }
    if (user.company) {
        score += 3;
        signals.push("+3 has company");
    }
    if (user.location) {
        score += 2;
        signals.push("+2 has location");
    }
    if (user.blog) {
        score += 3;
        signals.push("+3 has website/blog");
    }
    if (user.twitter_username) {
        score += 2;
        signals.push("+2 has Twitter/X");
    }
    // LinkedIn detection: check bio/blog for linkedin
    const bioAndBlog = `${user.bio ?? ""} ${user.blog ?? ""}`.toLowerCase();
    if (bioAndBlog.includes("linkedin.com")) {
        score += 5;
        signals.push("+5 LinkedIn link found");
    }
    // Negative: completely empty profile
    if (!user.bio && !user.blog && !user.twitter_username && !user.company) {
        score -= 5;
        signals.push("-5 completely empty profile");
    }
    return {
        name: "Profile Completeness",
        score,
        maxPositive: 23,
        maxNegative: -10,
        reason: signals.join(", "),
    };
}
// ── Heuristic: Follower Patterns ──────────────
// Range: -10 to +8
function scoreFollowerPatterns(user) {
    let score = 0;
    const signals = [];
    // Positive: follower count
    if (user.followers >= 50) {
        score += 8;
        signals.push(`+8 ${user.followers} followers (50+)`);
    }
    else if (user.followers >= 20) {
        score += 5;
        signals.push(`+5 ${user.followers} followers (20+)`);
    }
    else if (user.followers >= 5) {
        score += 2;
        signals.push(`+2 ${user.followers} followers (5+)`);
    }
    // Negative: bot-like follow pattern
    if (user.following >= 500 && user.followers < 10) {
        score -= 10;
        signals.push(`-10 following ${user.following} but only ${user.followers} followers (bot-like)`);
    }
    else if (user.followers > 0 &&
        user.following / user.followers > 50) {
        score -= 8;
        signals.push(`-8 following/follower ratio ${Math.round(user.following / user.followers)}:1 (follow-spam)`);
    }
    if (signals.length === 0) {
        signals.push("No significant follower signals");
    }
    return {
        name: "Follower Patterns",
        score,
        maxPositive: 8,
        maxNegative: -10,
        reason: signals.join(", "),
    };
}
// ── Heuristic: PR Acceptance Rate ─────────────
// Range: -25 to +10
function scorePrAcceptanceRate(prs) {
    let score = 0;
    const signals = [];
    if (prs.length === 0) {
        return {
            name: "PR Acceptance Rate",
            score: 0,
            maxPositive: 10,
            maxNegative: -25,
            reason: "No PR history found",
        };
    }
    const merged = prs.filter((pr) => pr.pull_request?.merged_at !== null);
    const closed = prs.filter((pr) => pr.state === "closed" && pr.pull_request?.merged_at === null);
    const total = prs.length;
    const mergeRate = total > 0 ? merged.length / total : 0;
    // Check monthly burst patterns (last 12 months)
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const recentPRs = prs.filter((pr) => new Date(pr.created_at) > oneYearAgo);
    // Group by month
    const monthlyBuckets = new Map();
    for (const pr of recentPRs) {
        const monthKey = pr.created_at.substring(0, 7); // YYYY-MM
        const bucket = monthlyBuckets.get(monthKey) ?? { total: 0, merged: 0 };
        bucket.total++;
        if (pr.pull_request?.merged_at)
            bucket.merged++;
        monthlyBuckets.set(monthKey, bucket);
    }
    // Check for spam burst months
    let hasSpamBurst = false;
    for (const [month, data] of monthlyBuckets) {
        const monthRate = data.total > 0 ? data.merged / data.total : 0;
        if (data.total >= 10 && monthRate < 0.2) {
            score -= 25;
            signals.push(`-25 ${month}: ${data.total} PRs with <20% merge rate (strong spam signal)`);
            hasSpamBurst = true;
            break;
        }
        if (data.total >= 5 && monthRate < 0.2) {
            score -= 15;
            signals.push(`-15 ${month}: ${data.total} PRs with <20% merge rate`);
            hasSpamBurst = true;
            break;
        }
    }
    // Overall rate (only if no burst detected)
    if (!hasSpamBurst) {
        if (mergeRate > 0.7 && total >= 5) {
            score += 10;
            signals.push(`+10 ${Math.round(mergeRate * 100)}% merge rate across ${total} PRs`);
        }
        else if (mergeRate > 0.5 && total >= 10) {
            score += 5;
            signals.push(`+5 ${Math.round(mergeRate * 100)}% merge rate across ${total} PRs`);
        }
    }
    if (closed.length > 5 && merged.length === 0) {
        score = Math.min(score, -20);
        signals.push(`-20 ${closed.length} PRs closed without merge, 0 merged`);
    }
    if (signals.length === 0) {
        signals.push(`${total} PRs total, ${Math.round(mergeRate * 100)}% merge rate`);
    }
    return {
        name: "PR Acceptance Rate",
        score,
        maxPositive: 10,
        maxNegative: -25,
        reason: signals.join("; "),
    };
}
// ── Heuristic: Fork Timing ────────────────────
// Range: -20 to +10
async function scoreForkTiming(author, owner, repo, prCreatedAt) {
    const signals = [];
    try {
        const forks = await githubApi.getRepoForks(owner, repo, 50);
        const authorFork = forks.find((f) => f.owner.login.toLowerCase() === author.toLowerCase());
        if (!authorFork) {
            return {
                name: "Fork Timing",
                score: 5,
                maxPositive: 10,
                maxNegative: -20,
                reason: "No fork found — may be a direct collaborator (+5)",
            };
        }
        const forkDate = new Date(authorFork.created_at);
        // If we know when the PR was created, check timing
        if (prCreatedAt) {
            const prDate = new Date(prCreatedAt);
            const hoursBetween = (prDate.getTime() - forkDate.getTime()) / (1000 * 60 * 60);
            if (hoursBetween < 1) {
                signals.push(`-20 Fork-to-PR in <1 hour (${Math.round(hoursBetween * 60)} min) — instant contribution`);
                return {
                    name: "Fork Timing",
                    score: -20,
                    maxPositive: 10,
                    maxNegative: -20,
                    reason: signals.join(", "),
                };
            }
            if (hoursBetween < 24) {
                signals.push(`-10 Fork-to-PR in <24 hours — no development history`);
                return {
                    name: "Fork Timing",
                    score: -10,
                    maxPositive: 10,
                    maxNegative: -20,
                    reason: signals.join(", "),
                };
            }
            if (hoursBetween > 168) {
                // > 1 week
                signals.push(`+10 Fork created ${Math.round(hoursBetween / 24)} days before PR — indicates real development`);
                return {
                    name: "Fork Timing",
                    score: 10,
                    maxPositive: 10,
                    maxNegative: -20,
                    reason: signals.join(", "),
                };
            }
        }
        signals.push("Fork timing neutral");
        return {
            name: "Fork Timing",
            score: 0,
            maxPositive: 10,
            maxNegative: -20,
            reason: signals.join(", "),
        };
    }
    catch {
        return {
            name: "Fork Timing",
            score: 0,
            maxPositive: 10,
            maxNegative: -20,
            reason: "Could not fetch fork data",
        };
    }
}
// ── Heuristic: Activity Patterns ──────────────
// Range: -20 to +10
function scoreActivityPatterns(user, events) {
    let score = 0;
    const signals = [];
    const accountAgeYears = (Date.now() - new Date(user.created_at).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25);
    // Positive: consistent activity over 2+ years
    if (accountAgeYears >= 2 && events.length > 20) {
        score += 10;
        signals.push("+10 consistent activity over 2+ years");
    }
    else if (events.length > 10) {
        score += 5;
        signals.push("+5 regular recent activity");
    }
    // Negative: burst after dormancy
    if (events.length > 0) {
        const eventDates = events
            .map((e) => new Date(e.created_at).getTime())
            .sort((a, b) => b - a);
        // Check if all events are clustered in a short period
        if (eventDates.length >= 5) {
            const span = eventDates[0] - eventDates[eventDates.length - 1];
            const spanDays = span / (1000 * 60 * 60 * 24);
            if (spanDays < 7 && accountAgeYears > 2) {
                score -= 15;
                signals.push("-15 burst activity after years of dormancy");
            }
        }
        // Check for drive-by PR patterns
        const prEvents = events.filter((e) => e.type === "PullRequestEvent");
        if (prEvents.length >= 10) {
            const uniqueRepos = new Set(prEvents.map((e) => e.repo.name));
            if (uniqueRepos.size > 8) {
                score -= 10;
                signals.push(`-10 ${prEvents.length} PRs across ${uniqueRepos.size} different repos — drive-by pattern`);
            }
        }
    }
    if (signals.length === 0) {
        signals.push("No notable activity patterns");
    }
    return {
        name: "Activity Patterns",
        score,
        maxPositive: 10,
        maxNegative: -20,
        reason: signals.join(", "),
    };
}
// ── Heuristic: Contribution Type ──────────────
// Range: -15 to +10
function scoreContributionType(events) {
    let score = 0;
    const signals = [];
    const pushEvents = events.filter((e) => e.type === "PushEvent");
    const prEvents = events.filter((e) => e.type === "PullRequestEvent");
    // Positive: has actual code contributions
    if (pushEvents.length > 5) {
        score += 5;
        signals.push("+5 has code push history");
    }
    // Check for docs-only PR pattern
    if (prEvents.length >= 5) {
        // We check payload for doc-related patterns
        let docsOnlyCount = 0;
        for (const event of prEvents) {
            const payload = event.payload;
            const pr = payload.pull_request;
            const title = (pr?.title ?? "").toLowerCase();
            if (title.includes("typo") ||
                title.includes("readme") ||
                title.includes("doc") ||
                title.includes("spelling") ||
                title.includes("grammar") ||
                title.includes("fix link")) {
                docsOnlyCount++;
            }
        }
        if (docsOnlyCount >= 5 && docsOnlyCount === prEvents.length) {
            score -= 12;
            signals.push(`-12 all ${docsOnlyCount} PRs are docs/typo changes — common spam pattern`);
        }
        // Check for duplicate patterns
        const titles = prEvents.map((e) => {
            const payload = e.payload;
            const pr = payload.pull_request;
            return (pr?.title ?? "").toLowerCase().trim();
        });
        const uniqueTitles = new Set(titles);
        if (titles.length >= 5 && uniqueTitles.size <= 2) {
            score -= 10;
            signals.push("-10 multiple PRs with identical patterns — automated submission");
        }
    }
    if (signals.length === 0) {
        signals.push("No notable contribution type patterns");
    }
    return {
        name: "Contribution Type",
        score,
        maxPositive: 10,
        maxNegative: -15,
        reason: signals.join(", "),
    };
}
// ── Heuristic: Notable Contributions ──────────
// Range: -10 to +20
function scoreNotableContributions(events, prs) {
    let score = 0;
    const signals = [];
    // Check events for PRs merged to notable orgs
    const notableRepos = new Set();
    for (const event of events) {
        if (event.type === "PullRequestEvent") {
            const orgOrUser = event.repo.name.split("/")[0].toLowerCase();
            if (NOTABLE_ORGS.has(orgOrUser)) {
                notableRepos.add(event.repo.name);
            }
        }
    }
    // Also check from PR search results
    for (const pr of prs) {
        if (pr.pull_request?.merged_at) {
            // Extract org from repository_url
            const parts = pr.repository_url.split("/");
            const orgOrUser = parts[parts.length - 2]?.toLowerCase() ?? "";
            if (NOTABLE_ORGS.has(orgOrUser)) {
                notableRepos.add(`${orgOrUser}/${parts[parts.length - 1]}`);
            }
        }
    }
    if (notableRepos.size > 0) {
        // Cap at +20 to prevent gaming
        score = Math.min(notableRepos.size * 8, 20);
        signals.push(`+${score} contributions to notable orgs: ${[...notableRepos].slice(0, 3).join(", ")}`);
    }
    if (signals.length === 0) {
        signals.push("No contributions to notable OSS organizations detected");
    }
    return {
        name: "Notable Contributions",
        score,
        maxPositive: 20,
        maxNegative: -10,
        reason: signals.join(", "),
    };
}
// ── Main Scorer ───────────────────────────────
class ReputationScorer {
    warnThreshold;
    closeThreshold;
    constructor(warnThreshold = -10, closeThreshold = -40) {
        this.warnThreshold = warnThreshold;
        this.closeThreshold = closeThreshold;
    }
    async analyzeAuthor(author, owner, repo) {
        console.log(`[GitX1 Scorer] Starting reputation analysis for @${author}`);
        // Fetch data in parallel
        const [user, prs, events] = await Promise.all([
            githubApi.getUser(author),
            githubApi.searchUserPRs(author, {
                maxResults: 100,
                dateRange: `>=${this.getOneYearAgo()}`,
            }),
            githubApi.getUserEvents(author),
        ]);
        // Find PR creation date for fork timing
        const currentPR = prs.find((pr) => {
            const repoUrl = pr.repository_url.toLowerCase();
            return repoUrl.endsWith(`/${owner}/${repo}`.toLowerCase());
        });
        const prCreatedAt = currentPR?.created_at ?? null;
        // Run all 8 heuristics (fork timing is async)
        const [accountAge, profileComplete, followerPat, prRate, forkTime, activityPat, contribType, notableContrib,] = await Promise.all([
            Promise.resolve(scoreAccountAge(user)),
            Promise.resolve(scoreProfileCompleteness(user)),
            Promise.resolve(scoreFollowerPatterns(user)),
            Promise.resolve(scorePrAcceptanceRate(prs)),
            scoreForkTiming(author, owner, repo, prCreatedAt),
            Promise.resolve(scoreActivityPatterns(user, events)),
            Promise.resolve(scoreContributionType(events)),
            Promise.resolve(scoreNotableContributions(events, prs)),
        ]);
        const breakdown = [
            accountAge,
            profileComplete,
            followerPat,
            prRate,
            forkTime,
            activityPat,
            contribType,
            notableContrib,
        ];
        const totalRaw = breakdown.reduce((sum, h) => sum + h.score, 0);
        const overall = Math.max(-100, Math.min(100, totalRaw));
        let recommendation;
        if (overall <= this.closeThreshold) {
            recommendation = "close";
        }
        else if (overall <= this.warnThreshold) {
            recommendation = "warn";
        }
        else {
            recommendation = "allow";
        }
        const summary = this.buildSummary(author, overall, recommendation, breakdown);
        console.log(`[GitX1 Scorer] @${author}: raw=${totalRaw}, clamped=${overall}, rec=${recommendation}`);
        return {
            totalRaw,
            overall,
            breakdown,
            breakdownMap: {
                accountAge: accountAge.score,
                profileCompleteness: profileComplete.score,
                followerPatterns: followerPat.score,
                prAcceptanceRate: prRate.score,
                forkTiming: forkTime.score,
                activityPatterns: activityPat.score,
                contributionType: contribType.score,
                notableContributions: notableContrib.score,
            },
            summary,
            recommendation,
        };
    }
    buildSummary(author, score, recommendation, breakdown) {
        const positives = breakdown.filter((h) => h.score > 0);
        const negatives = breakdown.filter((h) => h.score < 0);
        let summary = `@${author} scored ${score > 0 ? "+" : ""}${score} — ${recommendation.toUpperCase()}.`;
        if (positives.length > 0) {
            summary += ` Positive: ${positives.map((h) => `${h.name} (+${h.score})`).join(", ")}.`;
        }
        if (negatives.length > 0) {
            summary += ` Concerns: ${negatives.map((h) => `${h.name} (${h.score})`).join(", ")}.`;
        }
        return summary;
    }
    getOneYearAgo() {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split("T")[0];
    }
}
// ── Singleton ─────────────────────────────────
const reputationScorer = new ReputationScorer();

;// ./src/background/service-worker.ts
/**
 * ──────────────────────────────────────────────
 *  Background Service Worker
 *  Manages extension state, coordinates messaging
 *  between content script ↔ side panel.
 *  Now wired to real GitHub API + reputation scorer.
 * ──────────────────────────────────────────────
 */



const state = {
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
});
// ── PAT Handlers ──────────────────────────────
async function handleSavePAT(pat, sendResponse) {
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
        }
        else {
            sendResponse({
                action: ACTION.PAT_STATUS_RESPONSE,
                payload: { configured: false, rateLimitRemaining: null, username: null },
            });
        }
    }
    catch (err) {
        console.error("[GitX1 SW] PAT save error:", err);
        sendResponse({
            action: ACTION.PAT_STATUS_RESPONSE,
            payload: { configured: false, rateLimitRemaining: null, username: null },
        });
    }
}
async function handleGetPatStatus(sendResponse) {
    const loaded = await githubApi.loadPAT();
    let username = null;
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
function handlePrPageDetected(prInfo, _sender) {
    state.activePR = prInfo;
    state.slopScore = null;
    state.layer1Triage = null;
    state.analysisStatus = "idle";
    console.log(`[GitX1 SW] PR detected: ${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber} by @${prInfo.prAuthor}`);
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
function handleLayer1Triage(payload) {
    state.layer1Triage = payload;
    console.log(`[GitX1 SW] Layer 1 triage: ${payload.verdict} — ${payload.failedChecks}/${payload.totalChecks} failed`);
    // Forward to side panel
    broadcastToRuntime({
        action: ACTION.LAYER1_TRIAGE_RESULT,
        payload,
    });
    // Persist
    chrome.storage.session.set({ layer1Triage: payload }).catch(console.error);
}
// ── Analysis Handler ──────────────────────────
async function handleRequestAnalysis(payload) {
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
        const slopScore = await reputationScorer.analyzeAuthor(payload.author, payload.owner, payload.repo);
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
    }
    catch (err) {
        state.analysisStatus = "error";
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        broadcastToRuntime({
            action: ACTION.ANALYSIS_UPDATE,
            payload: { status: "error", slopScore: null, error: errorMsg },
        });
    }
}
// ── Utilities ─────────────────────────────────
function broadcastToRuntime(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // Side panel may not be open
    });
}
async function sendToActiveTab(message) {
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
async function handleRequestPrDiff(payload, sendResponse) {
    try {
        if (!githubApi.isAuthenticated) {
            sendResponse({
                action: ACTION.PR_DIFF_RESPONSE,
                payload: { diff: null, error: "PAT not configured" },
            });
            return;
        }
        const diff = await githubApi.getPrDiff(payload.owner, payload.repo, payload.prNumber);
        sendResponse({
            action: ACTION.PR_DIFF_RESPONSE,
            payload: { diff },
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to fetch diff";
        sendResponse({
            action: ACTION.PR_DIFF_RESPONSE,
            payload: { diff: null, error: errorMsg },
        });
    }
}
// ── Rescan Page (after extension reload) ──────
async function handleRescanPage(sendResponse) {
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.log("[GitX1 SW] Rescan failed (content script may not be loaded):", msg);
        sendResponse({ ok: false, error: msg });
    }
}
console.log("[GitX1] Service worker initialized ✓");

/******/ })()
;
//# sourceMappingURL=service-worker.js.map