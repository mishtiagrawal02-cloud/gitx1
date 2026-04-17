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

import {
  githubApi,
  type GitHubUser,
  type GitHubEvent,
  type GitHubPRSearchItem,
} from "./github-api";
import type { HeuristicResult, SlopScore } from "../types/messages";

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

function scoreAccountAge(user: GitHubUser): HeuristicResult {
  const createdAt = new Date(user.created_at);
  const now = new Date();
  const ageMonths =
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

  let score: number;
  let reason: string;

  if (ageMonths < 1) {
    score = -20;
    reason = "Account less than 1 month old — almost certainly suspicious";
  } else if (ageMonths < 3) {
    score = -15;
    reason = "Account less than 3 months old — likely created for spam";
  } else if (ageMonths < 6) {
    score = -10;
    reason = "Account less than 6 months old — very new";
  } else if (ageMonths < 12) {
    score = 0;
    reason = "Account 6-12 months old — neutral";
  } else if (ageMonths < 36) {
    score = 5;
    reason = "Account 1-3 years old — not brand new";
  } else if (ageMonths < 60) {
    score = 10;
    reason = "Account 3-5 years old — established";
  } else {
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

function scoreProfileCompleteness(user: GitHubUser): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

  // Positive signals
  if (user.avatar_url && !user.avatar_url.includes("identicon")) {
    score += 5;
    signals.push("+5 custom avatar");
  } else {
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

function scoreFollowerPatterns(user: GitHubUser): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

  // Positive: follower count
  if (user.followers >= 50) {
    score += 8;
    signals.push(`+8 ${user.followers} followers (50+)`);
  } else if (user.followers >= 20) {
    score += 5;
    signals.push(`+5 ${user.followers} followers (20+)`);
  } else if (user.followers >= 5) {
    score += 2;
    signals.push(`+2 ${user.followers} followers (5+)`);
  }

  // Negative: bot-like follow pattern
  if (user.following >= 500 && user.followers < 10) {
    score -= 10;
    signals.push(`-10 following ${user.following} but only ${user.followers} followers (bot-like)`);
  } else if (
    user.followers > 0 &&
    user.following / user.followers > 50
  ) {
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

function scorePrAcceptanceRate(
  prs: GitHubPRSearchItem[]
): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

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
  const closed = prs.filter(
    (pr) => pr.state === "closed" && pr.pull_request?.merged_at === null
  );
  const total = prs.length;
  const mergeRate = total > 0 ? merged.length / total : 0;

  // Check monthly burst patterns (last 12 months)
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const recentPRs = prs.filter((pr) => new Date(pr.created_at) > oneYearAgo);

  // Group by month
  const monthlyBuckets = new Map<string, { total: number; merged: number }>();
  for (const pr of recentPRs) {
    const monthKey = pr.created_at.substring(0, 7); // YYYY-MM
    const bucket = monthlyBuckets.get(monthKey) ?? { total: 0, merged: 0 };
    bucket.total++;
    if (pr.pull_request?.merged_at) bucket.merged++;
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
    } else if (mergeRate > 0.5 && total >= 10) {
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

async function scoreForkTiming(
  author: string,
  owner: string,
  repo: string,
  prCreatedAt: string | null
): Promise<HeuristicResult> {
  const signals: string[] = [];

  try {
    const forks = await githubApi.getRepoForks(owner, repo, 50);
    const authorFork = forks.find(
      (f) => f.owner.login.toLowerCase() === author.toLowerCase()
    );

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
      const hoursBetween =
        (prDate.getTime() - forkDate.getTime()) / (1000 * 60 * 60);

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
  } catch {
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

function scoreActivityPatterns(
  user: GitHubUser,
  events: GitHubEvent[]
): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

  const accountAgeYears =
    (Date.now() - new Date(user.created_at).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);

  // Positive: consistent activity over 2+ years
  if (accountAgeYears >= 2 && events.length > 20) {
    score += 10;
    signals.push("+10 consistent activity over 2+ years");
  } else if (events.length > 10) {
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
    const prEvents = events.filter(
      (e) => e.type === "PullRequestEvent"
    );
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

function scoreContributionType(events: GitHubEvent[]): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

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
      const payload = event.payload as Record<string, unknown>;
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      const title = ((pr?.title as string) ?? "").toLowerCase();
      if (
        title.includes("typo") ||
        title.includes("readme") ||
        title.includes("doc") ||
        title.includes("spelling") ||
        title.includes("grammar") ||
        title.includes("fix link")
      ) {
        docsOnlyCount++;
      }
    }

    if (docsOnlyCount >= 5 && docsOnlyCount === prEvents.length) {
      score -= 12;
      signals.push(`-12 all ${docsOnlyCount} PRs are docs/typo changes — common spam pattern`);
    }

    // Check for duplicate patterns
    const titles = prEvents.map((e) => {
      const payload = e.payload as Record<string, unknown>;
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      return ((pr?.title as string) ?? "").toLowerCase().trim();
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

function scoreNotableContributions(
  events: GitHubEvent[],
  prs: GitHubPRSearchItem[]
): HeuristicResult {
  let score = 0;
  const signals: string[] = [];

  // Check events for PRs merged to notable orgs
  const notableRepos = new Set<string>();

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

export class ReputationScorer {
  private readonly warnThreshold: number;
  private readonly closeThreshold: number;

  constructor(warnThreshold = -10, closeThreshold = -40) {
    this.warnThreshold = warnThreshold;
    this.closeThreshold = closeThreshold;
  }

  async analyzeAuthor(
    author: string,
    owner: string,
    repo: string
  ): Promise<SlopScore> {
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
    const [
      accountAge,
      profileComplete,
      followerPat,
      prRate,
      forkTime,
      activityPat,
      contribType,
      notableContrib,
    ] = await Promise.all([
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

    let recommendation: "allow" | "warn" | "close";
    if (overall <= this.closeThreshold) {
      recommendation = "close";
    } else if (overall <= this.warnThreshold) {
      recommendation = "warn";
    } else {
      recommendation = "allow";
    }

    const summary = this.buildSummary(author, overall, recommendation, breakdown);

    console.log(
      `[GitX1 Scorer] @${author}: raw=${totalRaw}, clamped=${overall}, rec=${recommendation}`
    );

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

  private buildSummary(
    author: string,
    score: number,
    recommendation: string,
    breakdown: HeuristicResult[]
  ): string {
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

  private getOneYearAgo(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  }
}

// ── Singleton ─────────────────────────────────

export const reputationScorer = new ReputationScorer();
