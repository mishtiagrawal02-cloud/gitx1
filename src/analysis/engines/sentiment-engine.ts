/**
 * ──────────────────────────────────────────────
 *  Sentiment Uniformity Engine
 *  Adapted from pablocaeg/sloptotal sentiment.py
 *  Uses AFINN-based lexicon scoring to detect
 *  unnaturally uniform sentiment (AI characteristic).
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

// Compact AFINN-style sentiment lexicon (positive/negative words)
// Scores range from -3 to +3
const SENTIMENT_LEXICON: Record<string, number> = {
  // Strong positive (+3)
  outstanding: 3, excellent: 3, amazing: 3, wonderful: 3, fantastic: 3,
  brilliant: 3, superb: 3, exceptional: 3, magnificent: 3, remarkable: 3,
  // Moderate positive (+2)
  great: 2, good: 2, love: 2, perfect: 2, beautiful: 2,
  awesome: 2, impressive: 2, elegant: 2, powerful: 2, exciting: 2,
  innovative: 2, effective: 2, efficient: 2, valuable: 2, beneficial: 2,
  // Weak positive (+1)
  nice: 1, fine: 1, helpful: 1, useful: 1, interesting: 1,
  important: 1, clear: 1, clean: 1, fast: 1, easy: 1,
  better: 1, improve: 1, support: 1, recommend: 1, like: 1,
  enjoy: 1, happy: 1, pleased: 1, glad: 1, welcome: 1,
  // Weak negative (-1)
  bad: -1, poor: -1, difficult: -1, hard: -1, slow: -1,
  complex: -1, confusing: -1, issue: -1, problem: -1, concern: -1,
  unfortunately: -1, lack: -1, miss: -1, fail: -1, wrong: -1,
  // Moderate negative (-2)
  terrible: -2, awful: -2, horrible: -2, worst: -2, broken: -2,
  ugly: -2, painful: -2, frustrating: -2, annoying: -2, useless: -2,
  waste: -2, hate: -2, error: -2, crash: -2, bug: -2,
  // Strong negative (-3)
  disaster: -3, catastrophe: -3, devastating: -3, atrocious: -3,
  despicable: -3, abysmal: -3,
};

// AI-characteristic hedging/equivocating phrases
const HEDGING_PHRASES = [
  "it's worth noting",
  "it should be noted",
  "while there are",
  "on the other hand",
  "having said that",
  "that being said",
  "it's important to consider",
  "one could argue",
  "to be fair",
  "it's a double-edged sword",
  "there are pros and cons",
  "both sides of the coin",
];

export function analyzeSentiment(text: string): EngineResult {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (paragraphs.length < 3) {
    return {
      engineName: "Sentiment Uniformity",
      engineCode: "SU",
      score: 0,
      verdict: "clean",
      details: "Text too short for sentiment analysis.",
      type: "statistical",
    };
  }

  // Score sentiment per paragraph
  const paraScores: number[] = [];
  for (const para of paragraphs) {
    const words = para
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z'-]/g, ""))
      .filter((w) => w.length > 2);

    let sentimentSum = 0;
    let scoredWords = 0;
    for (const word of words) {
      if (word in SENTIMENT_LEXICON) {
        sentimentSum += SENTIMENT_LEXICON[word];
        scoredWords++;
      }
    }
    // Normalize: sentiment per scored word (or 0 if no scored words)
    paraScores.push(scoredWords > 0 ? sentimentSum / scoredWords : 0);
  }

  // 1. Sentiment variance across paragraphs
  const mean =
    paraScores.reduce((a, b) => a + b, 0) / paraScores.length;
  const variance =
    paraScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
    paraScores.length;
  const sentimentCV = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 0;

  // Low variance = uniform sentiment = AI-like
  // CV < 0.3 → high AI score, CV > 1.0 → low AI score
  const uniformityScore =
    sentimentCV < 0.2 ? 1.0 : sentimentCV > 1.0 ? 0.0 : (1.0 - sentimentCV) / 0.8;

  // 2. Consistently positive bias (AI tends toward mild positivity)
  const avgSentiment = mean;
  // AI sweet spot: mildly positive (0.3–1.0)
  const positivityScore =
    avgSentiment > 0.3 && avgSentiment < 1.0
      ? 1.0
      : avgSentiment >= 0 && avgSentiment <= 1.5
        ? 0.5
        : 0.0;

  // 3. Hedging phrase count
  const textLower = text.toLowerCase();
  let hedgingCount = 0;
  for (const phrase of HEDGING_PHRASES) {
    if (textLower.includes(phrase)) {
      hedgingCount++;
    }
  }
  const hedgingScore = Math.min(hedgingCount / 3.0, 1.0);

  // Composite
  const score =
    uniformityScore * 0.45 + positivityScore * 0.30 + hedgingScore * 0.25;

  const signals: string[] = [];
  if (uniformityScore > 0.5) {
    signals.push(`low sentiment variance (CV: ${sentimentCV.toFixed(3)})`);
  }
  if (positivityScore > 0.5) {
    signals.push(`mildly positive bias (avg: ${avgSentiment.toFixed(2)})`);
  }
  if (hedgingCount > 0) {
    signals.push(`${hedgingCount} hedging phrases`);
  }

  const details =
    signals.length > 0
      ? `Sentiment signals: ${signals.join("; ")}`
      : "Natural sentiment variation detected.";

  return {
    engineName: "Sentiment Uniformity",
    engineCode: "SU",
    score: Math.round(score * 1000) / 1000,
    verdict: scoreToVerdict(score),
    details,
    type: "statistical",
  };
}
