/**
 * ──────────────────────────────────────────────
 *  Formulaic Patterns Engine
 *  Ported from pablocaeg/sloptotal formulaic.py
 *  Detects cliché AI openings, closings, filler,
 *  sentence starter repetition, heading→bullet lists.
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

// ── AI Opener patterns (first 300 chars) ──────

const AI_OPENERS: RegExp[] = [
  /in today'?s (?:rapidly )?(?:evolving|changing|digital|modern)/i,
  /in (?:the|a) (?:world|era|age|landscape) (?:where|of|that)/i,
  /when it comes to/i,
  /in the realm of/i,
  /(?:are you |ever )?(?:looking|wondering|struggling|trying) to/i,
  /(?:have you ever )?wondered (?:what|how|why)/i,
  /let'?s (?:dive|explore|take a (?:closer )?look|unpack|break down)/i,
  /(?:imagine|picture) (?:this|a world)/i,
  /(?:whether you'?re|if you'?re) (?:a |an )?(?:seasoned|beginner|new)/i,
  /(?:in|throughout) (?:recent years|the past decade|today'?s society)/i,
  /(?:it'?s no (?:secret|surprise)|there'?s no denying) that/i,
  /as (?:technology|the world|we|society) continues to/i,
  /the (?:rise|emergence|advent|proliferation) of/i,
];

// ── AI Closer patterns (last 400 chars) ───────

const AI_CLOSERS: RegExp[] = [
  /in conclusion,?/i,
  /(?:in summary|to summarize|to sum up),?/i,
  /(?:ultimately|at the end of the day),?/i,
  /as we (?:navigate|move forward|look ahead|continue)/i,
  /the (?:future|road ahead) (?:is|looks|holds)/i,
  /(?:by|through) (?:embracing|leveraging|harnessing|adopting)/i,
  /(?:only time will tell|the possibilities are (?:endless|limitless))/i,
  /(?:it'?s clear|one thing is (?:clear|certain)) that/i,
  /(?:in this ever|in our ever|in an ever)/i,
  /(?:remember|keep in mind),? (?:it'?s|the)/i,
];

// ── Filler patterns (throughout) ──────────────

const FILLER_PATTERNS: RegExp[] = [
  /not only\b.{3,60}\bbut also/gi,
  /on (?:the )?one hand\b.{3,120}\bon the other(?: hand)?/gi,
  /it(?:'?s| is) (?:important|worth|crucial|essential|interesting) to (?:note|remember|mention|highlight|consider|understand|recognize)/gi,
  /(?:this|that|which) (?:is to say|means that|implies that|suggests that|indicates that)/gi,
  /(?:needless to say|it goes without saying)/gi,
  /(?:first and foremost|last but not least)/gi,
  /(?:without (?:a )?doubt|beyond (?:a )?shadow of (?:a )?doubt)/gi,
  /(?:serves as|acts as) (?:a )?(?:powerful |key |critical )?(?:reminder|testament|example|illustration)/gi,
];

// ── Engine ────────────────────────────────────

export function analyzeFormulaic(text: string): EngineResult {
  const textLower = text.toLowerCase();
  const wordCount = Math.max(text.split(/\s+/).filter(Boolean).length, 1);
  const found: string[] = [];

  // 1. Check openers (first 300 chars)
  const openerText = textLower.slice(0, 300);
  for (const pattern of AI_OPENERS) {
    const match = openerText.match(pattern);
    if (match) {
      found.push(`opener: "${match[0]}"`);
      break; // Only count one opener
    }
  }

  // 2. Check closers (last 400 chars)
  const closerText = textLower.slice(-400);
  for (const pattern of AI_CLOSERS) {
    const match = closerText.match(pattern);
    if (match) {
      found.push(`closer: "${match[0]}"`);
      break;
    }
  }

  // 3. Filler patterns throughout
  let fillerCount = 0;
  for (const pattern of FILLER_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    const matches = textLower.match(pattern);
    if (matches) {
      fillerCount += matches.length;
      for (const m of matches.slice(0, 2)) {
        found.push(`filler: "${m.slice(0, 50)}"`);
      }
    }
  }

  // 4. Sentence starter repetition
  const sentences = text.split(/(?<=[.!?])\s+/);
  const firstWords: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed) {
      const wordMatch = trimmed.match(/^[A-Za-z]+/);
      if (wordMatch) {
        firstWords.push(wordMatch[0].toLowerCase());
      }
    }
  }

  let starterScore = 0;
  if (firstWords.length >= 5) {
    const counts = new Map<string, number>();
    for (const w of firstWords) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const repeated = Array.from(counts.values())
      .filter((c) => c > 1)
      .reduce((sum, c) => sum + c, 0);
    const repeatRatio = repeated / firstWords.length;

    // Only extreme repetition (>55%) is meaningful
    starterScore = Math.min(Math.max(repeatRatio - 0.55, 0) / 0.25, 1.0);
    if (repeatRatio > 0.55) {
      const topStarters = Array.from(counts.entries())
        .filter(([, c]) => c > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([w, c]) => `"${w}"x${c}`)
        .join(", ");
      found.push(`starter repetition: ${(repeatRatio * 100).toFixed(0)}% (${topStarters})`);
    }
  }

  // 5. Heading → bullet-list pattern
  const lines = text.split("\n");
  let headingListCount = 0;
  let i = 0;
  while (i < lines.length - 1) {
    const line = lines[i].trim();
    // Short line without period = potential heading
    if (
      line &&
      line.length < 60 &&
      !line.endsWith(".") &&
      !/^\s*[-•*]\s/.test(line)
    ) {
      let j = i + 1;
      let bulletRun = 0;
      while (j < lines.length && /^\s*[-•*]\s/.test(lines[j].trim())) {
        bulletRun++;
        j++;
      }
      if (bulletRun >= 2) {
        headingListCount++;
        i = j;
        continue;
      }
    }
    i++;
  }

  const headingListScore = Math.min(headingListCount / 3.0, 1.0);
  if (headingListCount > 0) {
    found.push(`heading→list sections: ${headingListCount}`);
  }

  // Weighted scoring
  const openerScore = found.some((f) => f.startsWith("opener")) ? 1.0 : 0.0;
  const closerScore = found.some((f) => f.startsWith("closer")) ? 1.0 : 0.0;
  const fillerDensity = (fillerCount / wordCount) * 1000;
  const fillerScore = Math.min(fillerDensity / 5.0, 1.0);

  const finalScore =
    openerScore * 0.2 +
    closerScore * 0.15 +
    fillerScore * 0.3 +
    starterScore * 0.05 +
    headingListScore * 0.3;

  const details = found.length > 0
    ? `Found ${found.length} formulaic patterns: ${found.slice(0, 8).join("; ")}`
    : "No formulaic AI patterns detected.";

  return {
    engineName: "Formulaic Patterns",
    engineCode: "FP",
    score: Math.round(finalScore * 1000) / 1000,
    verdict: scoreToVerdict(finalScore),
    details,
    type: "linguistic",
  };
}
