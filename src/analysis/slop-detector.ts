/**
 * ──────────────────────────────────────────────
 *  Slop Detector — Multi-Engine Consensus Orchestrator
 *  Adapted from pablocaeg/sloptotal analyzer.py
 *  Runs 7 heuristic engines + Gemini Nano (optional)
 *  and produces a calibrated consensus score.
 * ──────────────────────────────────────────────
 */

import { type EngineResult } from "./engines/linguistic-engine";
import { analyzeLinguistic } from "./engines/linguistic-engine";
import { analyzeFormulaic } from "./engines/formulaic-engine";
import { analyzeVocabulary } from "./engines/vocabulary-engine";
import { analyzeReadability } from "./engines/readability-engine";
import { analyzeStructural } from "./engines/structural-engine";
import { analyzeSentiment } from "./engines/sentiment-engine";
import { analyzeBurstiness } from "./engines/burstiness-engine";
import { analyzeWithNano, isNanoAvailable } from "./engines/nano-engine";

// ── Types ─────────────────────────────────────

export interface SlopDetectionResult {
  overallScore: number;             // 0–100
  verdict: "clean" | "suspicious" | "likely-ai";
  confidence: "high" | "medium" | "low";
  engineResults: EngineResult[];
  nanoAvailable: boolean;
  humanSignals: string[];
  elapsedMs: number;
}

// ── Engine weights (sum to 1.0 when all available) ──

const BASE_WEIGHTS: Record<string, number> = {
  LM: 0.22,  // Linguistic markers — strongest heuristic signal
  FP: 0.18,  // Formulaic patterns — strong structural signal
  BU: 0.15,  // Burstiness — sentence rhythm variance
  ST: 0.10,  // Structural — document layout analysis
  VD: 0.10,  // Vocabulary diversity — word repetition
  RD: 0.08,  // Readability — FK/Flesch uniformity
  SU: 0.07,  // Sentiment — emotional tone flatness
  GN: 0.10,  // Gemini Nano — on-device neural (when available)
};

// ── Human signals that reduce AI score ────────

const HUMAN_SIGNALS = [
  { pattern: /\b(i'm|i've|i'll|i'd|we're|we've|they're|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't)\b/gi, name: "contractions", weight: -3 },
  { pattern: /\b(lol|lmao|btw|imo|tbh|afaik|fwiw|ngl|smh|brb|omg)\b/gi, name: "internet slang", weight: -5 },
  { pattern: /\b(haha|hehe|hmm|umm|ugh|yep|nope|gonna|wanna|gotta)\b/gi, name: "casual language", weight: -3 },
  { pattern: /\bi\b/gi, name: "first-person", weight: -1 },
  { pattern: /[!?]{2,}/g, name: "emphatic punctuation", weight: -2 },
  { pattern: /\.{3}/g, name: "ellipsis", weight: -1 },
  { pattern: /\b[A-Z]{3,}\b/g, name: "shouting/emphasis", weight: -2 },
];

// ── Orchestrator ──────────────────────────────

export async function detectSlop(text: string): Promise<SlopDetectionResult> {
  const startTime = performance.now();

  if (text.trim().length < 50) {
    return {
      overallScore: 0,
      verdict: "clean",
      confidence: "low",
      engineResults: [],
      nanoAvailable: false,
      humanSignals: [],
      elapsedMs: 0,
    };
  }

  // Run all heuristic engines synchronously (they're fast)
  const engineResults: EngineResult[] = [
    analyzeLinguistic(text),
    analyzeFormulaic(text),
    analyzeBurstiness(text),
    analyzeStructural(text),
    analyzeVocabulary(text),
    analyzeReadability(text),
    analyzeSentiment(text),
  ];

  // Check Nano availability and run if possible
  let nanoAvailable = false;
  try {
    nanoAvailable = await isNanoAvailable();
    if (nanoAvailable) {
      const nanoResult = await analyzeWithNano(text);
      engineResults.push(nanoResult);
    }
  } catch {
    // Nano unavailable — proceed with heuristics only
  }

  // Calculate weighted score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of engineResults) {
    const weight = BASE_WEIGHTS[result.engineCode] ?? 0;
    if (result.score >= 0) {
      // Skip unavailable engines (score === -1)
      weightedSum += result.score * weight;
      totalWeight += weight;
    }
  }

  // Normalize if some engines are missing
  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Human signal adjustment
  const humanSignals: string[] = [];
  let humanAdjustment = 0;
  for (const signal of HUMAN_SIGNALS) {
    signal.pattern.lastIndex = 0;
    const matches = text.match(signal.pattern);
    if (matches && matches.length > 0) {
      humanSignals.push(`${signal.name} (×${matches.length})`);
      humanAdjustment += signal.weight * Math.min(matches.length, 5);
    }
  }

  // Engine agreement boosting
  const highEngines = engineResults.filter(
    (r) => r.score >= 0.6 && r.score >= 0
  ).length;
  const agreementBoost = highEngines >= 5 ? 0.05 : highEngines >= 4 ? 0.03 : 0;

  // Final score: 0–100
  let finalScore = rawScore * 100 + humanAdjustment + agreementBoost * 100;
  finalScore = Math.max(0, Math.min(100, finalScore));
  finalScore = Math.round(finalScore * 10) / 10;

  // Verdict
  let verdict: SlopDetectionResult["verdict"];
  if (finalScore < 30) verdict = "clean";
  else if (finalScore < 60) verdict = "suspicious";
  else verdict = "likely-ai";

  // Confidence based on text length and engine agreement
  const wordCount = text.split(/\s+/).length;
  let confidence: SlopDetectionResult["confidence"];
  if (wordCount > 200 && engineResults.length >= 5) {
    confidence = "high";
  } else if (wordCount > 80) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    overallScore: finalScore,
    verdict,
    confidence,
    engineResults: engineResults.filter((r) => r.score >= 0),
    nanoAvailable,
    humanSignals,
    elapsedMs: Math.round(performance.now() - startTime),
  };
}
