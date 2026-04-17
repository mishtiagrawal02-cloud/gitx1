/**
 * ──────────────────────────────────────────────
 *  GitHub REST API Client with Cache
 *  Authenticates via user-provided PAT stored in
 *  chrome.storage.local. Includes LRU cache with
 *  configurable TTL to respect rate limits.
 * ──────────────────────────────────────────────
 */

// ── Types ─────────────────────────────────────

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  email: string | null;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  created_at: string; // ISO 8601
  updated_at: string;
}

export interface GitHubSearchResult<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
}

export interface GitHubPRSearchItem {
  id: number;
  number: number;
  title: string;
  state: string; // "open" | "closed"
  pull_request: {
    merged_at: string | null;
  };
  created_at: string;
  closed_at: string | null;
  repository_url: string;
}

export interface GitHubEvent {
  id: string;
  type: string;
  repo: { id: number; name: string };
  payload: Record<string, unknown>;
  created_at: string;
}

export interface GitHubFork {
  id: number;
  owner: { login: string };
  created_at: string;
  full_name: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// ── Cache ─────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number; // ms

  constructor(maxSize = 100, defaultTTLMinutes = 30) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMinutes * 60 * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
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

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ── API Client ────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";
const STORAGE_KEY_PAT = "gitx1_github_pat";

export class GitHubApiClient {
  private pat: string | null = null;
  private rateLimitInfo: RateLimitInfo | null = null;
  private readonly cache = new LRUCache(200, 30);

  // ── PAT Management ────────────────────────

  async savePAT(pat: string): Promise<{ valid: boolean; username: string | null }> {
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

      const user = (await response.json()) as GitHubUser;
      this.pat = pat;
      this.updateRateLimit(response);

      // Store securely in chrome.storage.local
      await chrome.storage.local.set({ [STORAGE_KEY_PAT]: pat });
      console.log(`[GitX1 API] PAT saved for user: ${user.login}`);

      return { valid: true, username: user.login };
    } catch {
      return { valid: false, username: null };
    }
  }

  async loadPAT(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_PAT);
      const storedPat = result[STORAGE_KEY_PAT] as string | undefined;
      if (storedPat) {
        this.pat = storedPat;
        return true;
      }
    } catch {
      // Storage not available
    }
    return false;
  }

  async removePAT(): Promise<void> {
    this.pat = null;
    this.cache.clear();
    await chrome.storage.local.remove(STORAGE_KEY_PAT);
  }

  get isAuthenticated(): boolean {
    return this.pat !== null;
  }

  get rateLimit(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  // ── API Methods ───────────────────────────

  /** Fetch a GitHub user's profile. */
  async getUser(username: string): Promise<GitHubUser> {
    const cacheKey = `user:${username}`;
    const cached = this.cache.get<GitHubUser>(cacheKey);
    if (cached) return cached;

    const user = await this.request<GitHubUser>(`/users/${username}`);
    this.cache.set(cacheKey, user);
    return user;
  }

  /**
   * Search for PRs authored by a user.
   * Returns merged + closed + open PRs for acceptance rate calculation.
   */
  async searchUserPRs(
    username: string,
    options: { maxResults?: number; dateRange?: string } = {}
  ): Promise<GitHubPRSearchItem[]> {
    const { maxResults = 100, dateRange } = options;
    const cacheKey = `prs:${username}:${dateRange ?? "all"}`;
    const cached = this.cache.get<GitHubPRSearchItem[]>(cacheKey);
    if (cached) return cached;

    let query = `author:${username} type:pr`;
    if (dateRange) {
      query += ` created:${dateRange}`;
    }

    const perPage = Math.min(maxResults, 100);
    const result = await this.request<GitHubSearchResult<GitHubPRSearchItem>>(
      `/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}&sort=created&order=desc`
    );

    this.cache.set(cacheKey, result.items);
    return result.items;
  }

  /** Fetch recent public events for a user. */
  async getUserEvents(username: string): Promise<GitHubEvent[]> {
    const cacheKey = `events:${username}`;
    const cached = this.cache.get<GitHubEvent[]>(cacheKey);
    if (cached) return cached;

    const events = await this.request<GitHubEvent[]>(
      `/users/${username}/events/public?per_page=100`
    );
    this.cache.set(cacheKey, events);
    return events;
  }

  /** Fetch forks of a repository (to check fork timing). */
  async getRepoForks(
    owner: string,
    repo: string,
    perPage = 30
  ): Promise<GitHubFork[]> {
    const cacheKey = `forks:${owner}/${repo}`;
    const cached = this.cache.get<GitHubFork[]>(cacheKey);
    if (cached) return cached;

    const forks = await this.request<GitHubFork[]>(
      `/repos/${owner}/${repo}/forks?sort=newest&per_page=${perPage}`
    );
    this.cache.set(cacheKey, forks);
    return forks;
  }

  /** Get the authenticated user (for PAT validation). */
  async getAuthenticatedUser(): Promise<GitHubUser | null> {
    if (!this.pat) return null;
    try {
      return await this.request<GitHubUser>("/user");
    } catch {
      return null;
    }
  }

  /** Fetch the unified diff for a pull request. */
  async getPrDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<string> {
    const cacheKey = `diff:${owner}/${repo}/${prNumber}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

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

  private async request<T>(endpoint: string): Promise<T> {
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
        const resetTime = new Date(
          (this.rateLimitInfo.reset ?? 0) * 1000
        ).toLocaleTimeString();
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}.`);
      }
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  private updateRateLimit(response: Response): void {
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

export const githubApi = new GitHubApiClient();
