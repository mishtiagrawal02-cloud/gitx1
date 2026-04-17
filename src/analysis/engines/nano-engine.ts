/**
 * ──────────────────────────────────────────────
 *  Gemini Nano Engine (Chrome Prompt API)
 *  Uses Chrome's built-in on-device LLM to analyze
 *  text for AI-generated patterns.
 *  Falls back gracefully if Nano is unavailable.
 * ──────────────────────────────────────────────
 */

import { type EngineResult, scoreToVerdict } from "./linguistic-engine";

// ── Types for Chrome's LanguageModel API ──────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  interface Window {
    LanguageModel?: {
      availability(): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
      create(options?: {
        systemPrompt?: string;
        temperature?: number;
        topK?: number;
      }): Promise<{
        prompt(text: string): Promise<string>;
        promptStreaming(text: string): AsyncIterable<string>;
        destroy(): void;
      }>;
    };
  }
  // Also available as global LanguageModel
  const LanguageModel: Window["LanguageModel"];
}

// ── Constants ─────────────────────────────────

const SYSTEM_PROMPT = `You are an expert AI-generated text detector. Analyze the provided text and determine the likelihood it was written by an AI language model (like ChatGPT, Claude, Gemini, etc.).

Look for these specific signals:
1. Overuse of transitional phrases ("furthermore", "moreover", "additionally")
2. "Delve", "tapestry", "landscape", "navigate" and similar AI-preferred vocabulary
3. Formulaic structure: intro → bullet points → conclusion
4. Hedging language: "it's worth noting", "it should be noted"
5. Unnaturally balanced/neutral tone
6. Verbose explanations of simple concepts
7. Absence of personal anecdotes, typos, or colloquialisms

Respond with ONLY a JSON object (no markdown):
{"score": 0.0-1.0, "confidence": "high"|"medium"|"low", "signals": ["signal1", "signal2"]}

Where score 0.0 = definitely human, 1.0 = definitely AI.`;

const MAX_TEXT_LENGTH = 4000; // Nano has limited context

// ── Engine ────────────────────────────────────

export async function analyzeWithNano(text: string): Promise<EngineResult> {
  const lm = typeof LanguageModel !== "undefined" ? LanguageModel : window?.LanguageModel;

  if (!lm) {
    return unavailableResult("LanguageModel API not found in this browser.");
  }

  try {
    const availability = await lm.availability();

    if (availability !== "available") {
      return unavailableResult(
        `Gemini Nano status: ${availability}. Requires Chrome 131+ with on-device model.`
      );
    }

    const session = await lm.create({
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.1,
      topK: 1,
    });

    try {
      const truncated = text.slice(0, MAX_TEXT_LENGTH);
      const prompt = `Analyze this text for AI-generated patterns:\n\n---\n${truncated}\n---`;

      const response = await session.prompt(prompt);

      // Parse JSON response
      const parsed = parseNanoResponse(response);

      return {
        engineName: "Gemini Nano (On-Device)",
        engineCode: "GN",
        score: Math.round(parsed.score * 1000) / 1000,
        verdict: scoreToVerdict(parsed.score),
        details: `Confidence: ${parsed.confidence}. Signals: ${parsed.signals.join(", ") || "none detected"}`,
        type: "neural",
      };
    } finally {
      session.destroy();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return unavailableResult(`Nano analysis failed: ${msg}`);
  }
}

// Check if Nano is available without running analysis
export async function isNanoAvailable(): Promise<boolean> {
  try {
    const lm = typeof LanguageModel !== "undefined" ? LanguageModel : window?.LanguageModel;
    if (!lm) return false;
    const availability = await lm.availability();
    return availability === "available";
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────

interface NanoResponse {
  score: number;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

function parseNanoResponse(raw: string): NanoResponse {
  try {
    // Try to extract JSON from response (Nano may add extra text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: typeof parsed.score === "number"
        ? Math.max(0, Math.min(1, parsed.score))
        : 0.5,
      confidence: ["high", "medium", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "low",
      signals: Array.isArray(parsed.signals)
        ? parsed.signals.map(String).slice(0, 5)
        : [],
    };
  } catch {
    // If parsing fails, estimate from text content
    const lower = raw.toLowerCase();
    if (lower.includes("ai") || lower.includes("generated") || lower.includes("artificial")) {
      return { score: 0.7, confidence: "low", signals: ["parse-fallback"] };
    }
    return { score: 0.3, confidence: "low", signals: ["parse-fallback"] };
  }
}

function unavailableResult(details: string): EngineResult {
  return {
    engineName: "Gemini Nano (On-Device)",
    engineCode: "GN",
    score: -1, // -1 signals "not available" to orchestrator
    verdict: "unavailable",
    details,
    type: "neural",
  };
}
