/**
 * ──────────────────────────────────────────────
 *  Vocabulary Diversity Engine
 *  Ported from pablocaeg/sloptotal vocabulary.py
 *  Measures lexical diversity via TTR and hapax legomena.
 *  AI text tends to have lower diversity (repetitive vocabulary).
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

// Common stop words to exclude from diversity analysis
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "and",
  "but", "or", "nor", "not", "so", "yet", "both", "either", "neither",
  "each", "every", "all", "any", "few", "more", "most", "other", "some",
  "such", "no", "only", "own", "same", "than", "too", "very", "just",
  "because", "if", "when", "while", "where", "how", "what", "which",
  "who", "whom", "this", "that", "these", "those", "i", "me", "my",
  "we", "our", "you", "your", "he", "him", "his", "she", "her", "it",
  "its", "they", "them", "their",
]);

export function analyzeVocabulary(text: string): EngineResult {
  // Tokenize: lowercase, only alpha words
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z'-]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const totalWords = words.length;

  if (totalWords < 30) {
    return {
      engineName: "Vocabulary Diversity",
      engineCode: "VD",
      score: 0,
      verdict: "clean",
      details: "Text too short for vocabulary analysis.",
      type: "statistical",
    };
  }

  // Type-Token Ratio (TTR)
  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / totalWords;

  // Hapax Legomena: words appearing exactly once
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }
  const hapaxCount = Array.from(wordCounts.values()).filter((c) => c === 1).length;
  const hapaxRatio = hapaxCount / totalWords;

  // Yule's K measure — more robust than TTR for variable-length texts
  // Lower K = more diverse vocabulary
  let sumFreqSquared = 0;
  for (const count of wordCounts.values()) {
    sumFreqSquared += count * count;
  }
  const yulesK =
    totalWords > 0
      ? (10000 * (sumFreqSquared - totalWords)) / (totalWords * totalWords)
      : 0;

  // Score: AI tends toward low TTR (0.3–0.5), human varies (0.5–0.8)
  // Low TTR = high AI score
  // TTR < 0.35 → score 1.0, TTR > 0.65 → score 0.0
  const ttrScore = Math.max(0, Math.min(1, (0.65 - ttr) / 0.3));

  // Hapax: AI has lower hapax ratio (more repetition)
  // hapax < 0.3 → score 1.0, hapax > 0.6 → score 0.0
  const hapaxScore = Math.max(0, Math.min(1, (0.6 - hapaxRatio) / 0.3));

  // Yule's K: AI tends higher (80–150), human lower (20–80)
  // K > 120 → score 1.0, K < 40 → score 0.0
  const yulesScore = Math.max(0, Math.min(1, (yulesK - 40) / 80));

  // Composite
  const score = ttrScore * 0.4 + hapaxScore * 0.35 + yulesScore * 0.25;

  const details =
    `TTR: ${ttr.toFixed(3)} (${uniqueWords.size}/${totalWords} unique), ` +
    `Hapax: ${hapaxRatio.toFixed(3)} (${hapaxCount} once-words), ` +
    `Yule's K: ${yulesK.toFixed(1)}. ` +
    `${score > 0.5 ? "Low diversity — AI-like" : "Natural vocabulary variation"}`;

  return {
    engineName: "Vocabulary Diversity",
    engineCode: "VD",
    score: Math.round(score * 1000) / 1000,
    verdict: scoreToVerdict(score),
    details,
    type: "statistical",
  };
}
