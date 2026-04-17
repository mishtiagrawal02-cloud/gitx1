/**
 * ──────────────────────────────────────────────
 *  Structural Analysis Engine
 *  Ported from pablocaeg/sloptotal structural.py
 *  Detects structural uniformity in text layout.
 *  AI tends to produce evenly-sized paragraphs
 *  and uniform sentence structures.
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

export function analyzeStructural(text: string): EngineResult {
  const lines = text.split("\n");
  const paragraphs = splitParagraphs(text);
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (paragraphs.length < 3 || sentences.length < 5) {
    return {
      engineName: "Structural",
      engineCode: "ST",
      score: 0,
      verdict: "clean",
      details: "Text too short for structural analysis.",
      type: "structural",
    };
  }

  const signals: string[] = [];

  // 1. Paragraph length uniformity (low variance = AI)
  const paraLengths = paragraphs.map(
    (p) => p.split(/\s+/).filter(Boolean).length
  );
  const paraCV = coefficientOfVariation(paraLengths);
  // AI: CV < 0.3, Human: CV 0.5–1.5
  const paraScore =
    paraCV < 0.15 ? 1.0 : paraCV > 0.6 ? 0.0 : (0.6 - paraCV) / 0.45;
  if (paraCV < 0.4) {
    signals.push(`paragraph length CV: ${paraCV.toFixed(3)} (uniform)`);
  }

  // 2. Sentence length uniformity
  const sentLengths = sentences.map(
    (s) => s.split(/\s+/).filter(Boolean).length
  );
  const sentCV = coefficientOfVariation(sentLengths);
  const sentScore =
    sentCV < 0.15 ? 1.0 : sentCV > 0.6 ? 0.0 : (0.6 - sentCV) / 0.45;
  if (sentCV < 0.4) {
    signals.push(`sentence length CV: ${sentCV.toFixed(3)} (uniform)`);
  }

  // 3. List/bullet density
  const bulletLines = lines.filter((l) => /^\s*[-•*]\s/.test(l)).length;
  const numberedLines = lines.filter((l) => /^\s*\d+[.)]\s/.test(l)).length;
  const totalListLines = bulletLines + numberedLines;
  const listDensity = totalListLines / Math.max(lines.length, 1);
  // AI tends to over-list: density > 0.3 is suspicious
  const listScore = Math.min(listDensity / 0.4, 1.0);
  if (totalListLines > 3) {
    signals.push(
      `list density: ${(listDensity * 100).toFixed(1)}% (${totalListLines} list items)`
    );
  }

  // 4. Heading patterns (## / ### or short bold lines)
  const headingLines = lines.filter(
    (l) =>
      /^#{1,4}\s/.test(l.trim()) ||
      (/^\*\*[^*]+\*\*$/.test(l.trim()) && l.trim().length < 60)
  ).length;
  const headingDensity = headingLines / Math.max(lines.length, 1);
  const headingScore = Math.min(headingDensity / 0.15, 1.0);
  if (headingLines > 2) {
    signals.push(`${headingLines} heading-style lines`);
  }

  // 5. Uniform paragraph count per section
  // AI likes 3-paragraph sections under each heading
  let sectionSizes: number[] = [];
  let currentSize = 0;
  for (const line of lines) {
    if (/^#{1,4}\s/.test(line.trim()) || /^\*\*[^*]+\*\*$/.test(line.trim())) {
      if (currentSize > 0) sectionSizes.push(currentSize);
      currentSize = 0;
    } else if (line.trim().length > 0) {
      currentSize++;
    }
  }
  if (currentSize > 0) sectionSizes.push(currentSize);

  let sectionScore = 0;
  if (sectionSizes.length >= 3) {
    const secCV = coefficientOfVariation(sectionSizes);
    sectionScore = secCV < 0.2 ? 1.0 : secCV > 0.6 ? 0.0 : (0.6 - secCV) / 0.4;
    if (secCV < 0.3) {
      signals.push(`section size CV: ${secCV.toFixed(3)} (uniform)`);
    }
  }

  // Weighted composite
  const score =
    paraScore * 0.25 +
    sentScore * 0.25 +
    listScore * 0.20 +
    headingScore * 0.15 +
    sectionScore * 0.15;

  const details =
    signals.length > 0
      ? `Structural signals: ${signals.join("; ")}`
      : "No structural AI patterns detected.";

  return {
    engineName: "Structural",
    engineCode: "ST",
    score: Math.round(score * 1000) / 1000,
    verdict: scoreToVerdict(score),
    details,
    type: "structural",
  };
}

// ── Helpers ───────────────────────────────────

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
