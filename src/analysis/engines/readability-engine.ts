/**
 * ──────────────────────────────────────────────
 *  Readability Engine
 *  Ported from pablocaeg/sloptotal readability.py
 *  AI text tends toward uniformly moderate readability.
 *  Uses Flesch-Kincaid and sentence length analysis.
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }

  // Adjust for silent e
  if (w.endsWith("e") && count > 1) count--;
  // Adjust for -le endings
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) {
    count++;
  }

  return Math.max(count, 1);
}

export function analyzeReadability(text: string): EngineResult {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount < 30 || sentences.length < 3) {
    return {
      engineName: "Readability",
      engineCode: "RD",
      score: 0,
      verdict: "clean",
      details: "Text too short for readability analysis.",
      type: "statistical",
    };
  }

  // Total syllables
  const totalSyllables = words.reduce(
    (sum, w) => sum + countSyllables(w),
    0
  );

  // Flesch-Kincaid Grade Level
  const avgSentenceLength = wordCount / sentences.length;
  const avgSyllablesPerWord = totalSyllables / wordCount;
  const fkGrade =
    0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

  // Flesch Reading Ease
  const fleschEase =
    206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  // Sentence length variance
  const sentLengths = sentences.map((s) => s.split(/\s+/).length);
  const avgLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
  const variance =
    sentLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) /
    sentLengths.length;
  const sentLenCV = Math.sqrt(variance) / Math.max(avgLen, 1);

  // AI detection scoring:
  // 1. AI has very uniform sentence lengths (low CV)
  // CV < 0.2 → score 1.0, CV > 0.6 → score 0.0
  const uniformityScore = Math.max(0, Math.min(1, (0.6 - sentLenCV) / 0.4));

  // 2. AI tends toward "Goldilocks zone" FK grade (8–12)
  // Perfectly centered around 10 → suspicious
  const fkDeviation = Math.abs(fkGrade - 10);
  const fkScore =
    fkDeviation < 2 ? 1.0 : fkDeviation > 8 ? 0.0 : (8 - fkDeviation) / 6;

  // 3. AI has uniform Flesch Ease (typically 40–60 consistently)
  const fleschMidDev = Math.abs(fleschEase - 50);
  const fleschScore =
    fleschMidDev < 10 ? 1.0 : fleschMidDev > 40 ? 0.0 : (40 - fleschMidDev) / 30;

  // Composite
  const score = uniformityScore * 0.45 + fkScore * 0.30 + fleschScore * 0.25;

  const details =
    `FK Grade: ${fkGrade.toFixed(1)}, Flesch Ease: ${fleschEase.toFixed(1)}, ` +
    `Avg sentence: ${avgSentenceLength.toFixed(1)} words, ` +
    `Sentence length CV: ${sentLenCV.toFixed(3)}. ` +
    `${score > 0.5 ? "Uniformly moderate readability — AI-like" : "Natural readability variation"}`;

  return {
    engineName: "Readability",
    engineCode: "RD",
    score: Math.round(score * 1000) / 1000,
    verdict: scoreToVerdict(score),
    details,
    type: "statistical",
  };
}
