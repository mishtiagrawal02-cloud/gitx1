/**
 * ──────────────────────────────────────────────
 *  Linguistic Markers Engine
 *  Ported from pablocaeg/sloptotal linguistic.py
 *  Detects AI-preferred words/phrases with tiered weighting.
 * ──────────────────────────────────────────────
 */

export interface EngineResult {
  engineName: string;
  engineCode: string;
  score: number;        // 0.0 – 1.0
  verdict: string;      // "clean" | "low-risk" | "suspicious" | "likely-ai"
  details: string;
  type: "linguistic" | "statistical" | "structural" | "neural";
}

export function scoreToVerdict(score: number): string {
  if (score < 0.2) return "clean";
  if (score < 0.4) return "low-risk";
  if (score < 0.6) return "suspicious";
  return "likely-ai";
}

// ── AI Markers (3 tiers from SlopTotal) ───────

type Marker = [string, number]; // [phrase, weight]

const AI_MARKERS: Marker[] = [
  // Tier 1: Very strong AI signals (weight 3)
  ["delve", 3],
  ["tapestry", 3],
  ["multifaceted", 3],
  ["ever-evolving", 3],
  ["thought-provoking", 3],
  ["it's important to note", 3],
  ["it's worth noting", 3],
  ["in today's digital age", 3],
  ["in today's rapidly evolving", 3],
  ["let's dive in", 3],

  // Tier 2: Strong signals (weight 2)
  ["landscape", 2],
  ["navigate", 2],
  ["leverage", 2],
  ["foster", 2],
  ["pivotal", 2],
  ["nuanced", 2],
  ["robust", 2],
  ["holistic", 2],
  ["synergy", 2],
  ["paradigm", 2],
  ["encompass", 2],
  ["intricate", 2],
  ["comprehensive", 2],
  ["underscores", 2],
  ["underscore", 2],
  ["realm", 2],
  ["cornerstone", 2],
  ["underpinning", 2],
  ["facilitating", 2],
  ["harnessing", 2],
  ["spearheading", 2],
  ["revolutionize", 2],
  ["groundbreaking", 2],
  ["cutting-edge", 2],
  ["game-changer", 2],
  ["deep dive", 2],
  ["at the forefront", 2],
  ["at its core", 2],
  ["in the realm of", 2],
  ["it is crucial", 2],
  ["it is essential", 2],
  ["plays a crucial role", 2],
  ["serves as a testament", 2],
  ["is a testament to", 2],
  ["a myriad of", 2],
  ["plethora", 2],

  // Tier 3: Moderate signals (weight 1)
  ["crucial", 1],
  ["enhance", 1],
  ["dynamic", 1],
  ["innovative", 1],
  ["streamline", 1],
  ["optimize", 1],
  ["elevate", 1],
  ["empower", 1],
  ["stakeholder", 1],
  ["ecosystem", 1],
  ["actionable", 1],
  ["seamless", 1],
  ["seamlessly", 1],
  ["furthermore", 1],
  ["moreover", 1],
  ["consequently", 1],
  ["nevertheless", 1],
  ["in conclusion", 1],
  ["ultimately", 1],
  ["in essence", 1],
  ["it is important to", 1],
  ["not only", 1],
  ["but also", 1],
  ["on the other hand", 1],
  ["having said that", 1],
  ["that being said", 1],
  ["with that in mind", 1],
  ["in this context", 1],
  ["in light of", 1],
  ["as we navigate", 1],
  ["when it comes to", 1],
  ["it goes without saying", 1],
  ["needless to say", 1],
  ["at the end of the day", 1],
  ["the bottom line", 1],
  ["key takeaway", 1],
  ["food for thought", 1],
  ["resonate", 1],
  ["aligns with", 1],
  ["bolster", 1],
  ["catalyst", 1],
  ["testament", 1],
  ["arguably", 1],
  ["notably", 1],
  ["specifically", 1],
  ["essentially", 1],
  ["fundamentally", 1],
  ["inherently", 1],
  ["intricacies", 1],
];

// ── Engine ────────────────────────────────────

function countWordBoundary(text: string, phrase: string): number {
  // Case-insensitive word-boundary search
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export function analyzeLinguistic(text: string): EngineResult {
  const textLower = text.toLowerCase();
  const wordCount = Math.max(text.split(/\s+/).filter(Boolean).length, 1);

  let totalWeight = 0;
  const foundMarkers: string[] = [];

  for (const [marker, weight] of AI_MARKERS) {
    const count = countWordBoundary(textLower, marker);
    if (count > 0) {
      totalWeight += count * weight;
      foundMarkers.push(count > 1 ? `"${marker}" ×${count}` : `"${marker}"`);
    }
  }

  // Density: weighted hits per 1000 words
  const density = (totalWeight / wordCount) * 1000;

  // Score mapping: 0 density = 0.0, 15+ density = 1.0
  const score = Math.min(density / 15.0, 1.0);

  let details: string;
  if (foundMarkers.length > 0) {
    const top = foundMarkers.slice(0, 8);
    details = `Found ${foundMarkers.length} AI markers (density: ${density.toFixed(1)}/1k words): ${top.join(", ")}`;
    if (foundMarkers.length > 8) {
      details += ` and ${foundMarkers.length - 8} more`;
    }
  } else {
    details = "No significant AI linguistic markers detected.";
  }

  return {
    engineName: "Linguistic Markers",
    engineCode: "LM",
    score: Math.round(score * 1000) / 1000,
    verdict: scoreToVerdict(score),
    details,
    type: "linguistic",
  };
}
