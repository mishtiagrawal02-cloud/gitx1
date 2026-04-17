/**
 * ──────────────────────────────────────────────
 *  Burstiness Engine (Browser-adapted)
 *  Adapted from pablocaeg/sloptotal burstiness.py
 *  Since GPT-2 perplexity isn't available in-browser,
 *  this uses sentence-length & vocabulary-richness
 *  variance as a proxy for burstiness.
 *  AI text has flat, uniform sentence rhythm.
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

export function analyzeBurstiness(text: string): EngineResult {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 5);

  if (sentences.length < 5) {
    return {
      engineName: "Burstiness",
      engineCode: "BU",
      score: 0,
      verdict: "clean",
      details: "Not enough sentences for burstiness analysis.",
      type: "statistical",
    };
  }

  // 1. Sentence length variance (primary proxy)
  const sentLengths = sentences.map((s) => s.split(/\s+/).length);
  const lengthCV = coefficientOfVariation(sentLengths);

  // 2. Per-sentence vocabulary richness variance
  const sentTTRs = sentences.map((s) => {
    const words = s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z]/g, ""))
      .filter((w) => w.length > 2);
    if (words.length === 0) return 0;
    return new Set(words).size / words.length;
  });
  const ttrCV = coefficientOfVariation(sentTTRs);

  // 3. Sentence complexity variance (avg word length per sentence)
  const sentComplexity = sentences.map((s) => {
    const words = s.split(/\s+/).filter((w) => w.length > 0);
    return words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
  });
  const complexityCV = coefficientOfVariation(sentComplexity);

  // Combined burstiness CV
  const combinedCV = lengthCV * 0.5 + ttrCV * 0.3 + complexityCV * 0.2;

  // Score: Low CV = flat rhythm = AI-like
  // CV <= 0.15 → score 1.0, CV >= 0.8 → score 0.0
  let score: number;
  if (combinedCV <= 0.15) {
    score = 1.0;
  } else if (combinedCV >= 0.8) {
    score = 0.0;
  } else {
    score = 1.0 - (combinedCV - 0.15) / 0.65;
  }

  const details =
    `Sentence rhythm CV: ${combinedCV.toFixed(3)} ` +
    `(length=${lengthCV.toFixed(3)}, vocab=${ttrCV.toFixed(3)}, complexity=${complexityCV.toFixed(3)}, ` +
    `n=${sentences.length} sentences). ` +
    `${score > 0.5 ? "Flat rhythm — AI-like" : "Natural variation — human-like"}`;

  return {
    engineName: "Burstiness",
    engineCode: "BU",
    score: Math.round(score * 1000) / 1000,
    verdict: scoreToVerdict(score),
    details,
    type: "statistical",
  };
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
