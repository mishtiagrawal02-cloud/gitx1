/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/types/messages.ts
/**
 * ──────────────────────────────────────────────
 *  Message Protocol — shared between all contexts
 *  (service-worker ↔ content-script ↔ side-panel)
 * ──────────────────────────────────────────────
 */
// ── Action constants ──────────────────────────
const ACTION = {
    /** Content script → Background: PR page detected */
    PR_PAGE_DETECTED: "PR_PAGE_DETECTED",
    /** Background → Content script: Update the slop badge */
    UPDATE_SLOP_BADGE: "UPDATE_SLOP_BADGE",
    /** Side panel → Background: Request current PR data */
    GET_PR_DATA: "GET_PR_DATA",
    /** Background → Side panel: Respond with PR data */
    PR_DATA_RESPONSE: "PR_DATA_RESPONSE",
    /** Side panel → Background: Request a fresh analysis */
    REQUEST_ANALYSIS: "REQUEST_ANALYSIS",
    /** Background → Side panel: Analysis progress / result */
    ANALYSIS_UPDATE: "ANALYSIS_UPDATE",
    /** Side panel → Background: Save a GitHub PAT */
    SAVE_PAT: "SAVE_PAT",
    /** Side panel → Background: Check if PAT is configured */
    GET_PAT_STATUS: "GET_PAT_STATUS",
    /** Background → Side panel: PAT status response */
    PAT_STATUS_RESPONSE: "PAT_STATUS_RESPONSE",
    /** Content script → Background: Layer 1 instant triage completed */
    LAYER1_TRIAGE_RESULT: "LAYER1_TRIAGE_RESULT",
    /** Side panel: WASM structural analysis complete */
    WASM_ANALYSIS_RESULT: "WASM_ANALYSIS_RESULT",
    /** Side panel → Background: Request PR diff for WASM analysis */
    REQUEST_PR_DIFF: "REQUEST_PR_DIFF",
    /** Background → Side panel: PR diff response */
    PR_DIFF_RESPONSE: "PR_DIFF_RESPONSE",
    /** Side panel → Content script: Request PR description text */
    REQUEST_PR_DESCRIPTION: "REQUEST_PR_DESCRIPTION",
    /** Content script → Side panel: PR description text response */
    PR_DESCRIPTION_RESPONSE: "PR_DESCRIPTION_RESPONSE",
    /** Service worker → Content script: Ask content script to re-scan the page */
    RESCAN_PAGE: "RESCAN_PAGE",
};

;// ./src/analysis/engines/linguistic-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Linguistic Markers Engine
 *  Ported from pablocaeg/sloptotal linguistic.py
 *  Detects AI-preferred words/phrases with tiered weighting.
 * ──────────────────────────────────────────────
 */
function scoreToVerdict(score) {
    if (score < 0.2)
        return "clean";
    if (score < 0.4)
        return "low-risk";
    if (score < 0.6)
        return "suspicious";
    return "likely-ai";
}
const AI_MARKERS = [
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
function countWordBoundary(text, phrase) {
    // Case-insensitive word-boundary search
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    const matches = text.match(re);
    return matches ? matches.length : 0;
}
function analyzeLinguistic(text) {
    const textLower = text.toLowerCase();
    const wordCount = Math.max(text.split(/\s+/).filter(Boolean).length, 1);
    let totalWeight = 0;
    const foundMarkers = [];
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
    let details;
    if (foundMarkers.length > 0) {
        const top = foundMarkers.slice(0, 8);
        details = `Found ${foundMarkers.length} AI markers (density: ${density.toFixed(1)}/1k words): ${top.join(", ")}`;
        if (foundMarkers.length > 8) {
            details += ` and ${foundMarkers.length - 8} more`;
        }
    }
    else {
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

;// ./src/analysis/engines/formulaic-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Formulaic Patterns Engine
 *  Ported from pablocaeg/sloptotal formulaic.py
 *  Detects cliché AI openings, closings, filler,
 *  sentence starter repetition, heading→bullet lists.
 * ──────────────────────────────────────────────
 */

// ── AI Opener patterns (first 300 chars) ──────
const AI_OPENERS = [
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
const AI_CLOSERS = [
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
const FILLER_PATTERNS = [
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
function analyzeFormulaic(text) {
    const textLower = text.toLowerCase();
    const wordCount = Math.max(text.split(/\s+/).filter(Boolean).length, 1);
    const found = [];
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
    const firstWords = [];
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
        const counts = new Map();
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
        if (line &&
            line.length < 60 &&
            !line.endsWith(".") &&
            !/^\s*[-•*]\s/.test(line)) {
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
    const finalScore = openerScore * 0.2 +
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

;// ./src/analysis/engines/vocabulary-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Vocabulary Diversity Engine
 *  Ported from pablocaeg/sloptotal vocabulary.py
 *  Measures lexical diversity via TTR and hapax legomena.
 *  AI text tends to have lower diversity (repetitive vocabulary).
 * ──────────────────────────────────────────────
 */

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
function analyzeVocabulary(text) {
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
    const wordCounts = new Map();
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
    const yulesK = totalWords > 0
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
    const details = `TTR: ${ttr.toFixed(3)} (${uniqueWords.size}/${totalWords} unique), ` +
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

;// ./src/analysis/engines/readability-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Readability Engine
 *  Ported from pablocaeg/sloptotal readability.py
 *  AI text tends toward uniformly moderate readability.
 *  Uses Flesch-Kincaid and sentence length analysis.
 * ──────────────────────────────────────────────
 */

function countSyllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length <= 2)
        return 1;
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
    if (w.endsWith("e") && count > 1)
        count--;
    // Adjust for -le endings
    if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) {
        count++;
    }
    return Math.max(count, 1);
}
function analyzeReadability(text) {
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
    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    // Flesch-Kincaid Grade Level
    const avgSentenceLength = wordCount / sentences.length;
    const avgSyllablesPerWord = totalSyllables / wordCount;
    const fkGrade = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
    // Flesch Reading Ease
    const fleschEase = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
    // Sentence length variance
    const sentLengths = sentences.map((s) => s.split(/\s+/).length);
    const avgLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
    const variance = sentLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) /
        sentLengths.length;
    const sentLenCV = Math.sqrt(variance) / Math.max(avgLen, 1);
    // AI detection scoring:
    // 1. AI has very uniform sentence lengths (low CV)
    // CV < 0.2 → score 1.0, CV > 0.6 → score 0.0
    const uniformityScore = Math.max(0, Math.min(1, (0.6 - sentLenCV) / 0.4));
    // 2. AI tends toward "Goldilocks zone" FK grade (8–12)
    // Perfectly centered around 10 → suspicious
    const fkDeviation = Math.abs(fkGrade - 10);
    const fkScore = fkDeviation < 2 ? 1.0 : fkDeviation > 8 ? 0.0 : (8 - fkDeviation) / 6;
    // 3. AI has uniform Flesch Ease (typically 40–60 consistently)
    const fleschMidDev = Math.abs(fleschEase - 50);
    const fleschScore = fleschMidDev < 10 ? 1.0 : fleschMidDev > 40 ? 0.0 : (40 - fleschMidDev) / 30;
    // Composite
    const score = uniformityScore * 0.45 + fkScore * 0.30 + fleschScore * 0.25;
    const details = `FK Grade: ${fkGrade.toFixed(1)}, Flesch Ease: ${fleschEase.toFixed(1)}, ` +
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

;// ./src/analysis/engines/structural-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Structural Analysis Engine
 *  Ported from pablocaeg/sloptotal structural.py
 *  Detects structural uniformity in text layout.
 *  AI tends to produce evenly-sized paragraphs
 *  and uniform sentence structures.
 * ──────────────────────────────────────────────
 */

function analyzeStructural(text) {
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
    const signals = [];
    // 1. Paragraph length uniformity (low variance = AI)
    const paraLengths = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
    const paraCV = coefficientOfVariation(paraLengths);
    // AI: CV < 0.3, Human: CV 0.5–1.5
    const paraScore = paraCV < 0.15 ? 1.0 : paraCV > 0.6 ? 0.0 : (0.6 - paraCV) / 0.45;
    if (paraCV < 0.4) {
        signals.push(`paragraph length CV: ${paraCV.toFixed(3)} (uniform)`);
    }
    // 2. Sentence length uniformity
    const sentLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const sentCV = coefficientOfVariation(sentLengths);
    const sentScore = sentCV < 0.15 ? 1.0 : sentCV > 0.6 ? 0.0 : (0.6 - sentCV) / 0.45;
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
        signals.push(`list density: ${(listDensity * 100).toFixed(1)}% (${totalListLines} list items)`);
    }
    // 4. Heading patterns (## / ### or short bold lines)
    const headingLines = lines.filter((l) => /^#{1,4}\s/.test(l.trim()) ||
        (/^\*\*[^*]+\*\*$/.test(l.trim()) && l.trim().length < 60)).length;
    const headingDensity = headingLines / Math.max(lines.length, 1);
    const headingScore = Math.min(headingDensity / 0.15, 1.0);
    if (headingLines > 2) {
        signals.push(`${headingLines} heading-style lines`);
    }
    // 5. Uniform paragraph count per section
    // AI likes 3-paragraph sections under each heading
    let sectionSizes = [];
    let currentSize = 0;
    for (const line of lines) {
        if (/^#{1,4}\s/.test(line.trim()) || /^\*\*[^*]+\*\*$/.test(line.trim())) {
            if (currentSize > 0)
                sectionSizes.push(currentSize);
            currentSize = 0;
        }
        else if (line.trim().length > 0) {
            currentSize++;
        }
    }
    if (currentSize > 0)
        sectionSizes.push(currentSize);
    let sectionScore = 0;
    if (sectionSizes.length >= 3) {
        const secCV = coefficientOfVariation(sectionSizes);
        sectionScore = secCV < 0.2 ? 1.0 : secCV > 0.6 ? 0.0 : (0.6 - secCV) / 0.4;
        if (secCV < 0.3) {
            signals.push(`section size CV: ${secCV.toFixed(3)} (uniform)`);
        }
    }
    // Weighted composite
    const score = paraScore * 0.25 +
        sentScore * 0.25 +
        listScore * 0.20 +
        headingScore * 0.15 +
        sectionScore * 0.15;
    const details = signals.length > 0
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
function splitParagraphs(text) {
    return text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 20);
}
function coefficientOfVariation(values) {
    if (values.length < 2)
        return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0)
        return 0;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
}

;// ./src/analysis/engines/sentiment-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Sentiment Uniformity Engine
 *  Adapted from pablocaeg/sloptotal sentiment.py
 *  Uses AFINN-based lexicon scoring to detect
 *  unnaturally uniform sentiment (AI characteristic).
 * ──────────────────────────────────────────────
 */

// Compact AFINN-style sentiment lexicon (positive/negative words)
// Scores range from -3 to +3
const SENTIMENT_LEXICON = {
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
function analyzeSentiment(text) {
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
    const paraScores = [];
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
    const mean = paraScores.reduce((a, b) => a + b, 0) / paraScores.length;
    const variance = paraScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
        paraScores.length;
    const sentimentCV = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 0;
    // Low variance = uniform sentiment = AI-like
    // CV < 0.3 → high AI score, CV > 1.0 → low AI score
    const uniformityScore = sentimentCV < 0.2 ? 1.0 : sentimentCV > 1.0 ? 0.0 : (1.0 - sentimentCV) / 0.8;
    // 2. Consistently positive bias (AI tends toward mild positivity)
    const avgSentiment = mean;
    // AI sweet spot: mildly positive (0.3–1.0)
    const positivityScore = avgSentiment > 0.3 && avgSentiment < 1.0
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
    const score = uniformityScore * 0.45 + positivityScore * 0.30 + hedgingScore * 0.25;
    const signals = [];
    if (uniformityScore > 0.5) {
        signals.push(`low sentiment variance (CV: ${sentimentCV.toFixed(3)})`);
    }
    if (positivityScore > 0.5) {
        signals.push(`mildly positive bias (avg: ${avgSentiment.toFixed(2)})`);
    }
    if (hedgingCount > 0) {
        signals.push(`${hedgingCount} hedging phrases`);
    }
    const details = signals.length > 0
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

;// ./src/analysis/engines/burstiness-engine.ts
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

function analyzeBurstiness(text) {
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
    const lengthCV = burstiness_engine_coefficientOfVariation(sentLengths);
    // 2. Per-sentence vocabulary richness variance
    const sentTTRs = sentences.map((s) => {
        const words = s
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.replace(/[^a-z]/g, ""))
            .filter((w) => w.length > 2);
        if (words.length === 0)
            return 0;
        return new Set(words).size / words.length;
    });
    const ttrCV = burstiness_engine_coefficientOfVariation(sentTTRs);
    // 3. Sentence complexity variance (avg word length per sentence)
    const sentComplexity = sentences.map((s) => {
        const words = s.split(/\s+/).filter((w) => w.length > 0);
        return words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
    });
    const complexityCV = burstiness_engine_coefficientOfVariation(sentComplexity);
    // Combined burstiness CV
    const combinedCV = lengthCV * 0.5 + ttrCV * 0.3 + complexityCV * 0.2;
    // Score: Low CV = flat rhythm = AI-like
    // CV <= 0.15 → score 1.0, CV >= 0.8 → score 0.0
    let score;
    if (combinedCV <= 0.15) {
        score = 1.0;
    }
    else if (combinedCV >= 0.8) {
        score = 0.0;
    }
    else {
        score = 1.0 - (combinedCV - 0.15) / 0.65;
    }
    const details = `Sentence rhythm CV: ${combinedCV.toFixed(3)} ` +
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
function burstiness_engine_coefficientOfVariation(values) {
    if (values.length < 2)
        return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0)
        return 0;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
}

;// ./src/analysis/engines/nano-engine.ts
/**
 * ──────────────────────────────────────────────
 *  Gemini Nano Engine (Chrome Prompt API)
 *  Uses Chrome's built-in on-device LLM to analyze
 *  text for AI-generated patterns.
 *  Falls back gracefully if Nano is unavailable.
 * ──────────────────────────────────────────────
 */

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
async function analyzeWithNano(text) {
    const lm = typeof LanguageModel !== "undefined" ? LanguageModel : window?.LanguageModel;
    if (!lm) {
        return unavailableResult("LanguageModel API not found in this browser.");
    }
    try {
        const availability = await lm.availability();
        if (availability !== "available") {
            return unavailableResult(`Gemini Nano status: ${availability}. Requires Chrome 131+ with on-device model.`);
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
        }
        finally {
            session.destroy();
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return unavailableResult(`Nano analysis failed: ${msg}`);
    }
}
// Check if Nano is available without running analysis
async function isNanoAvailable() {
    try {
        const lm = typeof LanguageModel !== "undefined" ? LanguageModel : window?.LanguageModel;
        if (!lm)
            return false;
        const availability = await lm.availability();
        return availability === "available";
    }
    catch {
        return false;
    }
}
function parseNanoResponse(raw) {
    try {
        // Try to extract JSON from response (Nano may add extra text)
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error("No JSON found");
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
    }
    catch {
        // If parsing fails, estimate from text content
        const lower = raw.toLowerCase();
        if (lower.includes("ai") || lower.includes("generated") || lower.includes("artificial")) {
            return { score: 0.7, confidence: "low", signals: ["parse-fallback"] };
        }
        return { score: 0.3, confidence: "low", signals: ["parse-fallback"] };
    }
}
function unavailableResult(details) {
    return {
        engineName: "Gemini Nano (On-Device)",
        engineCode: "GN",
        score: -1, // -1 signals "not available" to orchestrator
        verdict: "unavailable",
        details,
        type: "neural",
    };
}

;// ./src/analysis/slop-detector.ts
/**
 * ──────────────────────────────────────────────
 *  Slop Detector — Multi-Engine Consensus Orchestrator
 *  Adapted from pablocaeg/sloptotal analyzer.py
 *  Runs 7 heuristic engines + Gemini Nano (optional)
 *  and produces a calibrated consensus score.
 * ──────────────────────────────────────────────
 */








// ── Engine weights (sum to 1.0 when all available) ──
const BASE_WEIGHTS = {
    LM: 0.22, // Linguistic markers — strongest heuristic signal
    FP: 0.18, // Formulaic patterns — strong structural signal
    BU: 0.15, // Burstiness — sentence rhythm variance
    ST: 0.10, // Structural — document layout analysis
    VD: 0.10, // Vocabulary diversity — word repetition
    RD: 0.08, // Readability — FK/Flesch uniformity
    SU: 0.07, // Sentiment — emotional tone flatness
    GN: 0.10, // Gemini Nano — on-device neural (when available)
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
async function detectSlop(text) {
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
    const engineResults = [
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
    }
    catch {
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
    const humanSignals = [];
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
    const highEngines = engineResults.filter((r) => r.score >= 0.6 && r.score >= 0).length;
    const agreementBoost = highEngines >= 5 ? 0.05 : highEngines >= 4 ? 0.03 : 0;
    // Final score: 0–100
    let finalScore = rawScore * 100 + humanAdjustment + agreementBoost * 100;
    finalScore = Math.max(0, Math.min(100, finalScore));
    finalScore = Math.round(finalScore * 10) / 10;
    // Verdict
    let verdict;
    if (finalScore < 30)
        verdict = "clean";
    else if (finalScore < 60)
        verdict = "suspicious";
    else
        verdict = "likely-ai";
    // Confidence based on text length and engine agreement
    const wordCount = text.split(/\s+/).length;
    let confidence;
    if (wordCount > 200 && engineResults.length >= 5) {
        confidence = "high";
    }
    else if (wordCount > 80) {
        confidence = "medium";
    }
    else {
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

;// ./src/analysis/code-text-extractor.ts
/**
 * Extracts human-readable text from a unified diff for AI text detection.
 *
 * Scans added lines for: comments, docstrings, string literals,
 * log/error messages, function/variable names, and inline documentation.
 *
 * This lets L4 detect AI-generated patterns in the actual pushed code,
 * not just the PR description.
 */
/** Extract comments and documentation from code diff lines */
function extractTextFromDiff(diffText) {
    const lines = diffText.split("\n");
    const comments = [];
    const stringLiterals = [];
    const functionNames = [];
    const logMessages = [];
    const variableNames = [];
    let inMultiLineComment = false;
    let multiLineBuffer = "";
    let currentFile = "";
    for (const line of lines) {
        // Track current file
        if (line.startsWith("+++ b/")) {
            currentFile = line.slice(6);
            continue;
        }
        // Only look at added lines (the code being pushed)
        if (!line.startsWith("+") || line.startsWith("+++"))
            continue;
        const code = line.slice(1).trim(); // Remove leading "+"
        if (!code)
            continue;
        // ── Multi-line comment tracking ──
        if (inMultiLineComment) {
            multiLineBuffer += " " + code.replace(/\*\/$/, "").replace(/^\*\s?/, "");
            if (code.includes("*/")) {
                inMultiLineComment = false;
                if (multiLineBuffer.trim().length > 10) {
                    comments.push(multiLineBuffer.trim());
                }
                multiLineBuffer = "";
            }
            continue;
        }
        // ── Block comment start ──
        if (code.startsWith("/*") || code.startsWith("/**")) {
            inMultiLineComment = true;
            multiLineBuffer = code.replace(/^\/\*\*?\s?/, "").replace(/\*\/$/, "");
            if (code.includes("*/")) {
                inMultiLineComment = false;
                if (multiLineBuffer.trim().length > 10) {
                    comments.push(multiLineBuffer.trim());
                }
                multiLineBuffer = "";
            }
            continue;
        }
        // ── Single-line comments ──
        if (code.startsWith("//") || code.startsWith("#")) {
            const comment = code.replace(/^\/\/\s?/, "").replace(/^#\s?/, "").trim();
            if (comment.length > 5 && !comment.startsWith("eslint") && !comment.startsWith("@ts-")) {
                comments.push(comment);
            }
            continue;
        }
        // ── Python docstrings ──
        if (code.startsWith('"""') || code.startsWith("'''")) {
            const doc = code.replace(/^['"]{3}\s?/, "").replace(/['"]{3}$/, "").trim();
            if (doc.length > 10) {
                comments.push(doc);
            }
            continue;
        }
        // ── Console/log messages ──
        const logMatch = code.match(/(?:console\.(?:log|warn|error|info)|print|println!?|logger\.\w+)\s*\(\s*[`'"](.*?)[`'"]/);
        if (logMatch?.[1] && logMatch[1].length > 10) {
            logMessages.push(logMatch[1]);
        }
        // ── Error messages ──
        const errorMatch = code.match(/(?:throw\s+new\s+\w*Error|raise\s+\w*Error|Error)\s*\(\s*[`'"](.*?)[`'"]/);
        if (errorMatch?.[1] && errorMatch[1].length > 10) {
            logMessages.push(errorMatch[1]);
        }
        // ── String literals (longer ones that might be AI-generated) ──
        const stringMatches = code.match(/[`'"]((?:[^`'"\\]|\\.){30,})[`'"]/g);
        if (stringMatches) {
            for (const s of stringMatches) {
                const clean = s.slice(1, -1).trim();
                if (clean.length > 30 && !clean.includes("http") && !clean.match(/^[\w/.-]+$/)) {
                    stringLiterals.push(clean);
                }
            }
        }
        // ── Function names (for naming pattern analysis) ──
        const funcMatch = code.match(/(?:function|def|fn|func)\s+(\w+)/);
        if (funcMatch?.[1]) {
            functionNames.push(funcMatch[1]);
        }
        const arrowMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
        if (arrowMatch?.[1]) {
            functionNames.push(arrowMatch[1]);
        }
        // ── Variable names with descriptive comments ──
        const inlineComment = code.match(/\/\/\s*(.{10,})$/);
        if (inlineComment?.[1]) {
            comments.push(inlineComment[1].trim());
        }
    }
    return {
        comments,
        stringLiterals,
        functionNames,
        logMessages,
        variableNames,
        currentFile,
        totalAddedLines: lines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length,
    };
}
/** Build a combined text block for L4 analysis from extracted code text */
function buildCodeAnalysisText(extracted) {
    const sections = [];
    if (extracted.comments.length > 0) {
        sections.push("Code Comments:\n" + extracted.comments.join("\n"));
    }
    if (extracted.logMessages.length > 0) {
        sections.push("Log/Error Messages:\n" + extracted.logMessages.join("\n"));
    }
    if (extracted.stringLiterals.length > 0) {
        sections.push("String Literals:\n" + extracted.stringLiterals.join("\n"));
    }
    if (extracted.functionNames.length > 5) {
        sections.push("Function Names:\n" + extracted.functionNames.join(", "));
    }
    return sections.join("\n\n");
}
/** Analyze function naming patterns for AI-generated code signals */
function analyzeNamingPatterns(names) {
    if (names.length < 3) {
        return { score: 0, signals: [], isAiLikely: false };
    }
    const signals = [];
    let score = 0;
    // AI tends to use verbose, descriptive camelCase names
    const avgLength = names.reduce((sum, n) => sum + n.length, 0) / names.length;
    if (avgLength > 25) {
        score += 20;
        signals.push(`Very long function names (avg ${Math.round(avgLength)} chars)`);
    }
    // AI loves "handle", "process", "validate", "initialize", "configure"
    const aiPrefixes = ["handle", "process", "validate", "initialize", "configure", "setup", "create", "update", "fetch", "get"];
    const aiPrefixCount = names.filter(n => aiPrefixes.some(p => n.toLowerCase().startsWith(p))).length;
    const aiPrefixRatio = aiPrefixCount / names.length;
    if (aiPrefixRatio > 0.6 && names.length >= 5) {
        score += 15;
        signals.push(`${Math.round(aiPrefixRatio * 100)}% of functions use generic AI prefixes`);
    }
    // AI-generated code often has very uniform naming patterns
    const camelCaseCount = names.filter(n => /^[a-z]+[A-Z]/.test(n)).length;
    const camelRatio = camelCaseCount / names.length;
    if (camelRatio > 0.9 && names.length >= 5) {
        score += 10;
        signals.push("100% uniform camelCase naming");
    }
    return {
        score: Math.min(score, 50),
        signals,
        isAiLikely: score >= 25,
    };
}

;// ./src/analysis/master-controller.ts
/**
 * ──────────────────────────────────────────────
 *  Master Controller — Unified PR Verdict Engine
 *  Aggregates all 4 analysis layers into a single
 *  "Slop Verdict" with smart-skip optimization.
 *
 *  Layer 1: Instant DOM Triage     (metadata rules)
 *  Layer 2: Reputation Scoring     (GitHub API heuristics)
 *  Layer 3: Structural AST (WASM)  (code pattern analysis)
 *  Layer 4: AI Text Detection      (multi-engine linguistic)
 *
 *  If L2 reputation is extremely high (core maintainer),
 *  the controller skips expensive L3 + L4 checks.
 * ──────────────────────────────────────────────
 */
// ── Layer weights (sum to 1.0) ────────────────
const LAYER_WEIGHTS = {
    l1_triage: 0.15, // Instant metadata rules
    l2_reputation: 0.35, // Reputation (strongest signal)
    l3_wasm: 0.20, // Structural code analysis
    l4_ai: 0.30, // AI text detection
};
// Weights when L3+L4 are skipped (redistribute to L1+L2)
const SKIP_WEIGHTS = {
    l1_triage: 0.30,
    l2_reputation: 0.70,
    l3_wasm: 0,
    l4_ai: 0,
};
// ── Thresholds ────────────────────────────────
/** L2 reputation score above which we skip heavy checks */
const TRUSTED_THRESHOLD = 50; // +50 to +100 = core maintainer tier
/** Score thresholds for badge color */
const TIER_GREEN = 25; // 0–25 = green (clean)
const TIER_YELLOW = 55; // 26–55 = yellow (suspicious)
// 56-100 = red (likely slop)
// ── Held layer data (accumulated as layers complete) ──
let layerData = { l1: null, l2: null, l3: null, l4: null };
// ── Public API ────────────────────────────────
function resetMasterState() {
    layerData = { l1: null, l2: null, l3: null, l4: null };
}
function feedLayer1(triage) {
    layerData.l1 = triage;
}
function feedLayer2(score) {
    layerData.l2 = score;
}
function feedLayer3(wasm) {
    layerData.l3 = wasm;
}
function feedLayer4(result) {
    layerData.l4 = result;
}
/**
 * Should we skip heavy checks (L3 + L4)?
 * Returns true if the author's reputation is above the trusted threshold.
 */
function shouldSkipHeavyChecks() {
    if (!layerData.l2)
        return false;
    return layerData.l2.overall >= TRUSTED_THRESHOLD;
}
function getSkipReason() {
    if (!layerData.l2)
        return "";
    if (layerData.l2.overall >= TRUSTED_THRESHOLD) {
        return `Author reputation +${layerData.l2.overall} exceeds trusted threshold (+${TRUSTED_THRESHOLD}). WASM and AI checks skipped.`;
    }
    return "";
}
/**
 * Compute the master verdict from all available layer data.
 */
function computeVerdict() {
    const skipped = shouldSkipHeavyChecks();
    const weights = skipped ? SKIP_WEIGHTS : LAYER_WEIGHTS;
    // ── Normalize each layer to 0-100 (0 = clean, 100 = slop) ──
    const l1 = normalizeL1(layerData.l1);
    const l2 = normalizeL2(layerData.l2);
    const l3 = skipped ? skippedStatus("Skipped (trusted author)") : normalizeL3(layerData.l3);
    const l4 = skipped ? skippedStatus("Skipped (trusted author)") : normalizeL4(layerData.l4);
    // ── Weighted aggregate ──
    let score = 0;
    let totalWeight = 0;
    const layers = [
        ["l1_triage", l1],
        ["l2_reputation", l2],
        ["l3_wasm", l3],
        ["l4_ai", l4],
    ];
    for (const [key, layer] of layers) {
        const w = weights[key];
        if (layer.state === "complete" && w > 0) {
            score += layer.normalizedScore * w;
            totalWeight += w;
        }
    }
    // Normalize if not all layers contributed
    if (totalWeight > 0 && totalWeight < 1) {
        score = score / totalWeight;
    }
    score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
    // ── Tier + verdict ──
    let tier;
    let verdict;
    if (score <= TIER_GREEN) {
        tier = "green";
        verdict = "Clean";
    }
    else if (score <= TIER_YELLOW) {
        tier = "yellow";
        verdict = "Suspicious";
    }
    else {
        tier = "red";
        verdict = "Likely Slop";
    }
    return {
        score,
        tier,
        verdict,
        layers: {
            l1_triage: l1,
            l2_reputation: l2,
            l3_wasm: l3,
            l4_ai: l4,
        },
        skippedHeavyChecks: skipped,
        skipReason: getSkipReason(),
        computedAt: Date.now(),
    };
}
// ── Layer normalizers (→ 0-100, 0=clean, 100=slop) ──
function normalizeL1(data) {
    if (!data)
        return pendingStatus("Awaiting triage…");
    // L1 score is 0-100 where 100 = clean. Invert.
    const slopScore = 100 - data.score;
    let label;
    if (data.verdict === "clean")
        label = "Clean";
    else if (data.verdict === "suspicious")
        label = "Suspicious";
    else
        label = "Likely Slop";
    return {
        state: "complete",
        normalizedScore: slopScore,
        label,
        detail: `${data.passedChecks}/${data.totalChecks} checks passed, ${data.failedChecks} failed`,
    };
}
function normalizeL2(data) {
    if (!data)
        return pendingStatus("Awaiting reputation…");
    // L2 is [-100, +100] where +100 = trusted. Map to [0, 100] inverted.
    // +100 → 0 slop, -100 → 100 slop
    const slopScore = Math.round((100 - data.overall) / 2);
    return {
        state: "complete",
        normalizedScore: Math.max(0, Math.min(100, slopScore)),
        label: data.recommendation === "allow" ? "Trusted" :
            data.recommendation === "warn" ? "Suspicious" : "Untrusted",
        detail: `Score: ${data.overall > 0 ? "+" : ""}${data.overall} — ${data.summary}`,
    };
}
function normalizeL3(data) {
    if (!data)
        return pendingStatus("Run WASM analysis");
    // WASM score is already 0-100 (findings-based)
    return {
        state: "complete",
        normalizedScore: data.score,
        label: data.totalFindings === 0 ? "Clean" :
            data.highCount > 0 ? "Issues Found" : "Minor Findings",
        detail: `${data.totalFindings} findings (${data.highCount} high severity)`,
    };
}
function normalizeL4(data) {
    if (!data)
        return pendingStatus("Run AI detection");
    return {
        state: "complete",
        normalizedScore: data.overallScore,
        label: data.verdict === "clean" ? "Human-like" :
            data.verdict === "suspicious" ? "Mixed Signals" : "AI-like",
        detail: `${data.engineResults.length} engines, ${data.elapsedMs}ms`,
    };
}
function pendingStatus(detail) {
    return { state: "pending", normalizedScore: 0, label: "Pending", detail };
}
function skippedStatus(detail) {
    return { state: "skipped", normalizedScore: 0, label: "Skipped", detail };
}

;// ./src/sidepanel/sidepanel.ts
/**
 * ──────────────────────────────────────────────
 *  Side Panel — Main Dashboard UI Logic
 *  Communicates with the background service worker
 *  to display PR data, manage PAT, and render
 *  heuristic reputation scores.
 * ──────────────────────────────────────────────
 */


// ── DOM references ────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
    // PAT
    patSection: $("pat-section"),
    patUnconfigured: $("pat-unconfigured"),
    patConfigured: $("pat-configured"),
    patInput: $("pat-input"),
    btnSavePat: $("btn-save-pat"),
    btnRemovePat: $("btn-remove-pat"),
    patError: $("pat-error"),
    patUsername: $("pat-username"),
    patRateLimit: $("pat-rate-limit"),
    // PR Info
    emptyState: $("empty-state"),
    prDetails: $("pr-details"),
    prInfo: $("pr-info"),
    prRepo: $("pr-repo"),
    prNumber: $("pr-number"),
    prTitle: $("pr-title"),
    prAuthor: $("pr-author"),
    // Score
    scoreSection: $("score-section"),
    scoreRing: document.getElementById("score-ring"),
    scoreValue: $("score-value"),
    scoreLabel: $("score-label"),
    scoreSummary: $("score-summary"),
    recommendationBadge: $("recommendation-badge"),
    // Actions
    actionsSection: $("actions-section"),
    btnAnalyze: $("btn-analyze"),
    btnRefresh: $("btn-refresh"),
    statusText: $("status-text"),
    // Triage
    triageSection: $("triage-section"),
    triageVerdict: $("triage-verdict"),
    triagePassed: $("triage-passed"),
    triageFailed: $("triage-failed"),
    triageScore: $("triage-score"),
    triageBarFill: $("triage-bar-fill"),
    triageChecks: $("triage-checks"),
    // WASM
    wasmSection: $("wasm-section"),
    wasmScoreBadge: $("wasm-score-badge"),
    wasmResults: $("wasm-results"),
    wasmFiles: $("wasm-files"),
    wasmTotal: $("wasm-total"),
    wasmScore: $("wasm-score"),
    wasmBarFill: $("wasm-bar-fill"),
    wasmHigh: $("wasm-high"),
    wasmMedium: $("wasm-medium"),
    wasmLow: $("wasm-low"),
    wasmFindings: $("wasm-findings"),
    btnWasmAuto: $("btn-wasm-auto"),
    btnWasmManual: $("btn-wasm-manual"),
    wasmDiffInput: $("wasm-diff-input"),
    // Layer 4
    l4Section: $("l4-section"),
    l4Results: $("l4-results"),
    l4Score: $("l4-score"),
    l4Verdict: $("l4-verdict"),
    l4VerdictBadge: $("l4-verdict-badge"),
    l4Confidence: $("l4-confidence"),
    l4Elapsed: $("l4-elapsed"),
    l4Engines: $("l4-engines"),
    l4Human: $("l4-human"),
    l4HumanList: $("l4-human-list"),
    btnL4Auto: $("btn-l4-auto"),
    btnL4Manual: $("btn-l4-manual"),
    l4TextInput: $("l4-text-input"),
    // Master Verdict
    masterSection: $("master-section"),
    masterTier: $("master-tier"),
    masterRingFill: $("master-ring-fill"),
    masterScore: $("master-score"),
    masterVerdictLabel: $("master-verdict-label"),
    masterDesc: $("master-desc"),
    masterSkip: $("master-skip"),
    masterSkipText: $("master-skip-text"),
    btnFullScan: $("btn-full-scan"),
};
// Heuristic keys matching the breakdownMap
const HEURISTIC_KEYS = [
    "accountAge",
    "profileCompleteness",
    "followerPatterns",
    "prAcceptanceRate",
    "forkTiming",
    "activityPatterns",
    "contributionType",
    "notableContributions",
];
// Max ranges for each heuristic (for bar rendering)
const HEURISTIC_RANGES = {
    accountAge: { min: -20, max: 15 },
    profileCompleteness: { min: -10, max: 23 },
    followerPatterns: { min: -10, max: 8 },
    prAcceptanceRate: { min: -25, max: 10 },
    forkTiming: { min: -20, max: 10 },
    activityPatterns: { min: -20, max: 10 },
    contributionType: { min: -15, max: 10 },
    notableContributions: { min: -10, max: 20 },
};
// ── State ─────────────────────────────────────
let currentPR = null;
let cachedTriageData = null;
// ── PAT UI ────────────────────────────────────
function showPatConfigured(username, rateLimit) {
    els.patUnconfigured.style.display = "none";
    els.patConfigured.style.display = "block";
    els.patUsername.textContent = `@${username}`;
    els.patRateLimit.textContent = rateLimit !== null
        ? `${rateLimit} requests remaining`
        : "Rate limit unknown";
    els.patError.style.display = "none";
    els.patInput.value = "";
}
function showPatUnconfigured() {
    els.patUnconfigured.style.display = "block";
    els.patConfigured.style.display = "none";
}
function showPatError(msg) {
    els.patError.textContent = msg;
    els.patError.style.display = "block";
}
// ── PR Info UI ────────────────────────────────
function showPRInfo(pr) {
    currentPR = pr;
    els.emptyState.style.display = "none";
    els.prDetails.style.display = "block";
    els.prInfo.classList.remove("gx-card--empty");
    els.prRepo.textContent = `${pr.owner}/${pr.repo}`;
    els.prNumber.textContent = `#${pr.prNumber}`;
    els.prTitle.textContent = pr.prTitle;
    els.prAuthor.textContent = pr.prAuthor;
    els.actionsSection.style.display = "flex";
    els.wasmSection.style.display = "block";
    els.l4Section.style.display = "block";
    els.masterSection.style.display = "block";
    resetMasterState();
    setStatus("PR detected — ready to analyze");
}
// ── Score UI ──────────────────────────────────
function showScore(score) {
    els.scoreSection.style.display = "block";
    // Score ring — map [-100, +100] to [0, 1] for ring fill
    const normalized = (score.overall + 100) / 200; // 0 = -100, 1 = +100
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - normalized * circumference;
    els.scoreRing.style.strokeDashoffset = String(offset);
    els.scoreRing.style.stroke = tierColor(score.overall);
    // Score display
    els.scoreValue.textContent = (score.overall > 0 ? "+" : "") + String(score.overall);
    els.scoreLabel.textContent = recLabel(score.recommendation);
    els.scoreLabel.style.color = tierColor(score.overall);
    // Recommendation badge
    els.recommendationBadge.textContent = score.recommendation.toUpperCase();
    els.recommendationBadge.className = `gx-recommendation gx-recommendation--${score.recommendation}`;
    // Heuristic breakdown bars
    for (const key of HEURISTIC_KEYS) {
        const value = score.breakdownMap[key];
        const range = HEURISTIC_RANGES[key];
        setHeuristicBar(key, value, range.min, range.max);
    }
    els.scoreSummary.textContent = score.summary;
}
function setHeuristicBar(key, value, rangeMin, rangeMax) {
    const bar = $(`bar-${key}`);
    const val = $(`val-${key}`);
    // Calculate bar width as percentage of range
    const totalRange = rangeMax - rangeMin;
    const percent = totalRange > 0
        ? Math.abs(value) / (value >= 0 ? rangeMax : Math.abs(rangeMin)) * 50
        : 0;
    // Position: negative goes left from center, positive goes right
    if (value >= 0) {
        bar.style.width = `${Math.min(percent, 50)}%`;
        bar.style.marginLeft = "50%";
        bar.style.backgroundColor = tierColor(value > 0 ? 60 : 0);
        bar.style.borderRadius = "0 3px 3px 0";
    }
    else {
        bar.style.width = `${Math.min(percent, 50)}%`;
        bar.style.marginLeft = `${50 - Math.min(percent, 50)}%`;
        bar.style.backgroundColor = value <= -15 ? "#f85149" : "#d29922";
        bar.style.borderRadius = "3px 0 0 3px";
    }
    val.textContent = (value > 0 ? "+" : "") + String(value);
    val.style.color = value >= 0 ? "#3fb950" : value <= -15 ? "#f85149" : "#d29922";
}
function setStatus(text) {
    els.statusText.textContent = text;
}
function setLoading(loading) {
    els.btnAnalyze.disabled = loading;
    els.btnAnalyze.textContent = loading ? "Analyzing…" : "🔬 Analyze PR";
    if (loading) {
        els.btnAnalyze.classList.add("gx-btn--loading");
    }
    else {
        els.btnAnalyze.classList.remove("gx-btn--loading");
    }
}
// ── Helpers ───────────────────────────────────
function tierColor(score) {
    if (score >= 10)
        return "#3fb950";
    if (score >= -10)
        return "#58a6ff";
    if (score >= -40)
        return "#d29922";
    return "#f85149";
}
function recLabel(rec) {
    if (rec === "allow")
        return "Trusted";
    if (rec === "warn")
        return "Suspicious";
    return "Likely Spam";
}
// ── Event handlers ────────────────────────────
els.btnSavePat.addEventListener("click", () => {
    const pat = els.patInput.value.trim();
    if (!pat) {
        showPatError("Please enter a GitHub PAT");
        return;
    }
    els.btnSavePat.disabled = true;
    els.btnSavePat.textContent = "Saving…";
    chrome.runtime.sendMessage({ action: ACTION.SAVE_PAT, payload: { pat } }, (response) => {
        els.btnSavePat.disabled = false;
        els.btnSavePat.textContent = "Save";
        if (response?.payload?.configured) {
            showPatConfigured(response.payload.username ?? "unknown", response.payload.rateLimitRemaining);
            setStatus("PAT saved — ready to analyze");
        }
        else {
            showPatError("Invalid PAT — please check your token and try again.");
        }
    });
});
els.btnRemovePat.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: ACTION.SAVE_PAT, payload: { pat: "" } }, () => {
        showPatUnconfigured();
        setStatus("PAT removed");
    });
});
els.btnAnalyze.addEventListener("click", () => {
    if (!currentPR)
        return;
    setLoading(true);
    setStatus("Running heuristic analysis…");
    chrome.runtime.sendMessage({
        action: ACTION.REQUEST_ANALYSIS,
        payload: {
            owner: currentPR.owner,
            repo: currentPR.repo,
            prNumber: currentPR.prNumber,
            author: currentPR.prAuthor,
        },
    });
});
els.btnRefresh.addEventListener("click", () => {
    loadCurrentState();
});
// ── Listen for broadcasts from service worker ─
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.action) {
        case ACTION.ANALYSIS_UPDATE:
            if (message.payload.status === "running") {
                setLoading(true);
                setMasterLayerState("l2", "running");
                setStatus("Running heuristic analysis…");
            }
            else if (message.payload.status === "complete" && message.payload.slopScore) {
                setLoading(false);
                showScore(message.payload.slopScore);
                feedLayer2(message.payload.slopScore);
                refreshMasterVerdict();
                setStatus("Analysis complete ✓");
                if (!currentPR)
                    fetchAndShowPRInfo();
            }
            else if (message.payload.status === "error") {
                setLoading(false);
                setMasterLayerState("l2", "error");
                setStatus(`Error: ${message.payload.error ?? "Unknown"}`);
            }
            break;
        case ACTION.PR_DATA_RESPONSE:
            if (message.payload.prInfo) {
                showPRInfo(message.payload.prInfo);
                if (message.payload.slopScore) {
                    showScore(message.payload.slopScore);
                    feedLayer2(message.payload.slopScore);
                    refreshMasterVerdict();
                }
                if (message.payload.layer1Triage) {
                    showTriage(message.payload.layer1Triage);
                    feedLayer1(message.payload.layer1Triage);
                    refreshMasterVerdict();
                }
            }
            break;
        case ACTION.LAYER1_TRIAGE_RESULT:
            showTriage(message.payload);
            feedLayer1(message.payload);
            refreshMasterVerdict();
            // If PR info hasn't been shown yet, fetch it now
            if (!currentPR)
                fetchAndShowPRInfo();
            break;
    }
    sendResponse({ ok: true });
    return true;
});
/** Fetch PR info from service worker and display it (used when broadcasts arrive before PR info) */
async function fetchAndShowPRInfo() {
    try {
        const response = await chrome.runtime.sendMessage({ action: ACTION.GET_PR_DATA });
        if (response?.payload?.prInfo) {
            showPRInfo(response.payload.prInfo);
        }
    }
    catch { /* ignore */ }
}
/** Ensure currentPR is populated — try cache first, then rescan the active tab */
async function ensureCurrentPR() {
    // Try cached data first
    try {
        const response = await chrome.runtime.sendMessage({ action: ACTION.GET_PR_DATA });
        if (response?.payload?.prInfo) {
            showPRInfo(response.payload.prInfo);
            if (response.payload.layer1Triage) {
                showTriage(response.payload.layer1Triage);
                feedLayer1(response.payload.layer1Triage);
            }
            if (response.payload.slopScore) {
                showScore(response.payload.slopScore);
                feedLayer2(response.payload.slopScore);
            }
            refreshMasterVerdict();
            return;
        }
    }
    catch { /* ignore */ }
    // Trigger rescan and wait
    try {
        setStatus("Detecting PR page…");
        await chrome.runtime.sendMessage({ action: ACTION.RESCAN_PAGE });
        // Wait for content script to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Re-fetch
        const retry = await chrome.runtime.sendMessage({ action: ACTION.GET_PR_DATA });
        if (retry?.payload?.prInfo) {
            showPRInfo(retry.payload.prInfo);
        }
    }
    catch { /* ignore */ }
}
// ── Bootstrap ─────────────────────────────────
async function loadCurrentState() {
    setStatus("Loading…");
    // Check PAT status
    chrome.runtime.sendMessage({ action: ACTION.GET_PAT_STATUS }, (response) => {
        if (response?.payload?.configured) {
            showPatConfigured(response.payload.username ?? "unknown", response.payload.rateLimitRemaining);
        }
        else {
            showPatUnconfigured();
        }
    });
    // Load PR data from service worker cache
    try {
        const response = await chrome.runtime.sendMessage({
            action: ACTION.GET_PR_DATA,
        });
        if (response?.payload?.prInfo) {
            showPRInfo(response.payload.prInfo);
            if (response.payload.layer1Triage) {
                showTriage(response.payload.layer1Triage);
                feedLayer1(response.payload.layer1Triage);
            }
            if (response.payload.slopScore) {
                showScore(response.payload.slopScore);
                feedLayer2(response.payload.slopScore);
                refreshMasterVerdict();
                setStatus("Loaded cached analysis");
            }
            else {
                setStatus("PR loaded — ready to analyze");
            }
        }
        else {
            // No cached data — ask the content script to re-scan the page
            // This handles the case where the extension was reloaded
            setStatus("Scanning active tab…");
            try {
                await chrome.runtime.sendMessage({ action: ACTION.RESCAN_PAGE });
                // The content script will send PR_PAGE_DETECTED and LAYER1_TRIAGE_RESULT
                // which will be picked up by our onMessage listener above
                // Wait a bit then re-check
                setTimeout(async () => {
                    try {
                        const retry = await chrome.runtime.sendMessage({
                            action: ACTION.GET_PR_DATA,
                        });
                        if (retry?.payload?.prInfo) {
                            showPRInfo(retry.payload.prInfo);
                            if (retry.payload.layer1Triage) {
                                showTriage(retry.payload.layer1Triage);
                                feedLayer1(retry.payload.layer1Triage);
                                refreshMasterVerdict();
                            }
                            setStatus("PR loaded — ready to analyze");
                        }
                        else {
                            setStatus("Navigate to a PR page to begin");
                        }
                    }
                    catch {
                        setStatus("Navigate to a PR page to begin");
                    }
                }, 1500);
            }
            catch {
                setStatus("No active PR");
            }
        }
    }
    catch {
        setStatus("Waiting for a PR page…");
    }
}
// ── Triage UI ─────────────────────────────────
function showTriage(triage) {
    cachedTriageData = triage;
    els.triageSection.style.display = "block";
    // Verdict badge
    els.triageVerdict.textContent = triage.verdict.toUpperCase().replace("-", " ");
    els.triageVerdict.className = `gx-triage-verdict gx-triage-verdict--${triage.verdict}`;
    // Stats
    els.triagePassed.textContent = String(triage.passedChecks);
    els.triageFailed.textContent = String(triage.failedChecks);
    els.triageScore.textContent = `${triage.score}%`;
    // Progress bar
    els.triageBarFill.style.width = `${triage.score}%`;
    if (triage.verdict === "clean") {
        els.triageBarFill.style.backgroundColor = "var(--gx-green)";
    }
    else if (triage.verdict === "suspicious") {
        els.triageBarFill.style.backgroundColor = "var(--gx-yellow)";
    }
    else {
        els.triageBarFill.style.backgroundColor = "var(--gx-red)";
    }
    // Failed checks list
    const container = els.triageChecks;
    container.innerHTML = "";
    if (triage.failedDetails.length > 0) {
        // Group by category
        const grouped = new Map();
        for (const check of triage.failedDetails) {
            const list = grouped.get(check.category) ?? [];
            list.push(check);
            grouped.set(check.category, list);
        }
        for (const [cat, checks] of grouped) {
            const catEl = document.createElement("div");
            catEl.className = "gx-triage-category";
            catEl.innerHTML = `<span class="gx-triage-category__label">${cat.toUpperCase()}</span>`;
            for (const check of checks) {
                const row = document.createElement("div");
                row.className = "gx-triage-check gx-triage-check--fail";
                row.innerHTML = `<span class="gx-triage-check__icon">✗</span><span class="gx-triage-check__msg">${escapeHtml(check.message)}</span>`;
                catEl.appendChild(row);
            }
            container.appendChild(catEl);
        }
    }
    else {
        container.innerHTML = '<div class="gx-triage-clean">All checks passed ✓</div>';
    }
}
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
// ── WASM Analyzer ─────────────────────────────
let wasmReady = false;
let wasmAnalyzeDiff = null;
async function initWasm() {
    if (wasmReady && wasmAnalyzeDiff)
        return true;
    try {
        const wasmUrl = chrome.runtime.getURL("wasm/gitx1_wasm.js");
        const module = await import(/* webpackIgnore: true */ wasmUrl);
        const wasmBinaryUrl = chrome.runtime.getURL("wasm/gitx1_wasm_bg.wasm");
        await module.default(wasmBinaryUrl);
        wasmAnalyzeDiff = module.analyze_diff;
        wasmReady = true;
        console.log("[GitX1] WASM module loaded ✓");
        return true;
    }
    catch (err) {
        console.error("[GitX1] WASM init failed:", err);
        return false;
    }
}
async function runWasmOnDiff(diffText) {
    cachedDiffText = diffText; // Cache for L4 code analysis
    setStatus("Loading WASM module…");
    const ready = await initWasm();
    if (!ready || !wasmAnalyzeDiff) {
        setStatus("WASM module failed to load");
        return;
    }
    setStatus("Running structural analysis…");
    try {
        const jsonResult = wasmAnalyzeDiff(diffText);
        const report = JSON.parse(jsonResult);
        showWasmResults(report);
        // Feed L3 data into master controller
        feedLayer3({
            score: 100 - report.score, // invert: WASM score = code quality (high=good), master = slop (high=bad)
            totalFindings: report.total_findings,
            highCount: report.severity_counts.high,
        });
        refreshMasterVerdict();
        setStatus("Structural analysis complete ✓");
    }
    catch (err) {
        console.error("[GitX1] WASM analysis error:", err);
        setStatus("WASM analysis failed");
    }
}
function showWasmResults(report) {
    els.wasmSection.style.display = "block";
    els.wasmResults.style.display = "block";
    // Stats
    els.wasmFiles.textContent = String(report.files_analyzed);
    els.wasmTotal.textContent = String(report.total_findings);
    els.wasmScore.textContent = String(report.score);
    // Score badge
    let badgeClass = "gx-wasm-badge--clean";
    let badgeText = `${report.score}/100`;
    if (report.score < 50) {
        badgeClass = "gx-wasm-badge--danger";
    }
    else if (report.score < 80) {
        badgeClass = "gx-wasm-badge--warn";
    }
    els.wasmScoreBadge.textContent = badgeText;
    els.wasmScoreBadge.className = `gx-wasm-badge ${badgeClass}`;
    // Progress bar
    els.wasmBarFill.style.width = `${report.score}%`;
    if (report.score >= 80) {
        els.wasmBarFill.style.backgroundColor = "var(--gx-green)";
    }
    else if (report.score >= 50) {
        els.wasmBarFill.style.backgroundColor = "var(--gx-yellow)";
    }
    else {
        els.wasmBarFill.style.backgroundColor = "var(--gx-red)";
    }
    // Severity pills
    els.wasmHigh.textContent = `${report.severity_counts.high} high`;
    els.wasmMedium.textContent = `${report.severity_counts.medium} medium`;
    els.wasmLow.textContent = `${report.severity_counts.low} low`;
    // Findings list
    const container = els.wasmFindings;
    container.innerHTML = "";
    if (report.findings.length === 0) {
        container.innerHTML = '<div class="gx-wasm-clean">No structural anomalies detected ✓</div>';
        return;
    }
    // Sort by severity: high > medium > low
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...report.findings].sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
    // Limit to top 30 findings for performance
    for (const finding of sorted.slice(0, 30)) {
        const el = document.createElement("div");
        el.className = `gx-wasm-finding gx-wasm-finding--${finding.severity}`;
        el.innerHTML = `
      <div class="gx-wasm-finding__header">
        <span class="gx-wasm-finding__rule">${escapeHtml(finding.rule_id)}</span>
        <span class="gx-wasm-finding__file">${escapeHtml(finding.file)}:${finding.line}</span>
      </div>
      <div class="gx-wasm-finding__msg">${escapeHtml(finding.message)}</div>
      ${finding.snippet ? `<div class="gx-wasm-finding__snippet">${escapeHtml(finding.snippet)}</div>` : ""}
    `;
        container.appendChild(el);
    }
    if (sorted.length > 30) {
        const more = document.createElement("div");
        more.className = "gx-wasm-finding__msg";
        more.textContent = `…and ${sorted.length - 30} more findings`;
        more.style.textAlign = "center";
        more.style.padding = "8px";
        container.appendChild(more);
    }
}
// WASM button handlers
els.btnWasmAuto.addEventListener("click", async () => {
    if (!currentPR) {
        await ensureCurrentPR();
    }
    if (!currentPR) {
        setStatus("No active PR to fetch diff for");
        return;
    }
    els.btnWasmAuto.disabled = true;
    els.btnWasmAuto.textContent = "Fetching…";
    setStatus("Fetching PR diff…");
    try {
        const response = await chrome.runtime.sendMessage({
            action: ACTION.REQUEST_PR_DIFF,
            payload: {
                owner: currentPR.owner,
                repo: currentPR.repo,
                prNumber: currentPR.prNumber,
            },
        });
        if (response?.payload?.diff) {
            await runWasmOnDiff(response.payload.diff);
        }
        else {
            setStatus(response?.payload?.error ?? "Failed to fetch diff");
        }
    }
    catch (err) {
        setStatus("Failed to fetch diff");
    }
    finally {
        els.btnWasmAuto.disabled = false;
        els.btnWasmAuto.innerHTML = '<span class="gx-btn__icon">⚡</span> Auto-fetch Diff';
    }
});
els.btnWasmManual.addEventListener("click", async () => {
    const diff = els.wasmDiffInput.value.trim();
    if (!diff) {
        setStatus("Please paste a diff first");
        return;
    }
    await runWasmOnDiff(diff);
});
// ── Layer 4: AI Text Detection ────────────────


/** Cached diff text from L3, reused by L4 to analyze actual code */
let cachedDiffText = null;
function showL4Results(result) {
    els.l4Results.style.display = "block";
    // Score
    els.l4Score.textContent = String(result.overallScore);
    const scoreColor = result.overallScore >= 60 ? "var(--gx-red)" :
        result.overallScore >= 30 ? "var(--gx-yellow)" :
            "var(--gx-green)";
    els.l4Score.style.color = scoreColor;
    // Verdict
    els.l4Verdict.textContent = result.verdict.toUpperCase().replace("-", " ");
    els.l4Verdict.className = `gx-l4-verdict gx-l4-verdict--${result.verdict}`;
    // Verdict badge
    let badgeClass = "gx-wasm-badge--clean";
    if (result.verdict === "likely-ai")
        badgeClass = "gx-wasm-badge--danger";
    else if (result.verdict === "suspicious")
        badgeClass = "gx-wasm-badge--warn";
    els.l4VerdictBadge.textContent = `${result.overallScore}/100`;
    els.l4VerdictBadge.className = `gx-wasm-badge ${badgeClass}`;
    // Confidence + elapsed
    els.l4Confidence.textContent = `Confidence: ${result.confidence}${result.nanoAvailable ? " (Nano ✓)" : " (heuristics only)"}`;
    els.l4Elapsed.textContent = `${result.elapsedMs}ms · ${result.engineResults.length} engines`;
    // Engine bars
    els.l4Engines.innerHTML = "";
    for (const engine of result.engineResults) {
        const pct = Math.round(engine.score * 100);
        const barColor = pct >= 60 ? "var(--gx-red)" :
            pct >= 30 ? "var(--gx-yellow)" :
                "var(--gx-green)";
        const row = document.createElement("div");
        row.className = "gx-l4-engine";
        row.title = engine.details;
        row.innerHTML = `
      <span class="gx-l4-engine__code">${escapeHtml(engine.engineCode)}</span>
      <span class="gx-l4-engine__name">${escapeHtml(engine.engineName)}</span>
      <div class="gx-l4-engine__bar-bg">
        <div class="gx-l4-engine__bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <span class="gx-l4-engine__value" style="color:${barColor}">${pct}%</span>
    `;
        els.l4Engines.appendChild(row);
    }
    // Human signals
    if (result.humanSignals.length > 0) {
        els.l4Human.style.display = "flex";
        els.l4HumanList.innerHTML = result.humanSignals
            .map((s) => `<span class="gx-l4-human-pill">${escapeHtml(s)}</span>`)
            .join("");
    }
    else {
        els.l4Human.style.display = "none";
    }
}
async function runL4Analysis(text, diffText) {
    setStatus("Running AI text detection…");
    els.btnL4Auto.disabled = true;
    els.btnL4Auto.textContent = "Analyzing…";
    try {
        // ── Combine PR description with code text from the diff ──
        let fullTextToAnalyze = text;
        let codeTextExtracted = "";
        let namingSignals = [];
        if (diffText) {
            const extracted = extractTextFromDiff(diffText);
            codeTextExtracted = buildCodeAnalysisText(extracted);
            if (codeTextExtracted.length > 20) {
                fullTextToAnalyze += "\n\n--- Code Analysis ---\n" + codeTextExtracted;
            }
            // Run naming pattern analysis
            if (extracted.functionNames.length >= 3) {
                const naming = analyzeNamingPatterns(extracted.functionNames);
                namingSignals = naming.signals;
            }
            console.log(`[GitX1 L4] Code extraction: ${extracted.comments.length} comments, ` +
                `${extracted.logMessages.length} log messages, ` +
                `${extracted.stringLiterals.length} string literals, ` +
                `${extracted.functionNames.length} function names from ${extracted.totalAddedLines} added lines`);
        }
        const result = await detectSlop(fullTextToAnalyze);
        // Merge naming signals into human signals
        if (namingSignals.length > 0) {
            result.humanSignals = [...(result.humanSignals || []), ...namingSignals.map(s => `⚠ ${s}`)];
        }
        // Add source info to the result
        if (diffText) {
            result.confidence = result.nanoAvailable ? "high" : "medium (description + code)";
        }
        showL4Results(result);
        feedLayer4(result);
        refreshMasterVerdict();
        const codeNote = diffText ? " (description + code)" : "";
        setStatus(`Text analysis complete ✓ (${result.elapsedMs}ms)${codeNote}`);
    }
    catch (err) {
        console.error("[GitX1] L4 analysis error:", err);
        setStatus("Text analysis failed");
    }
    finally {
        els.btnL4Auto.disabled = false;
        els.btnL4Auto.innerHTML = '<span class="gx-btn__icon">🧠</span> Analyze PR Description & Code';
    }
}
// L4 Auto: extract description + code from content script and diff
els.btnL4Auto.addEventListener("click", async () => {
    if (!currentPR) {
        await ensureCurrentPR();
    }
    if (!currentPR) {
        setStatus("No active PR");
        return;
    }
    setStatus("Extracting PR description & code…");
    els.btnL4Auto.disabled = true;
    els.btnL4Auto.textContent = "Extracting…";
    try {
        // 1. Get PR description from content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            setStatus("No active tab found");
            return;
        }
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: ACTION.REQUEST_PR_DESCRIPTION,
            payload: {},
        });
        const description = response?.payload?.description ?? "";
        const codeComments = response?.payload?.codeComments ?? [];
        let textToAnalyze = description;
        if (codeComments.length > 0) {
            textToAnalyze += "\n\n" + codeComments.join("\n\n");
        }
        // 2. Fetch diff if not already cached
        if (!cachedDiffText && currentPR) {
            try {
                const diffResp = await chrome.runtime.sendMessage({
                    action: ACTION.REQUEST_PR_DIFF,
                    payload: {
                        owner: currentPR.owner,
                        repo: currentPR.repo,
                        prNumber: currentPR.prNumber,
                    },
                });
                if (diffResp?.payload?.diff) {
                    cachedDiffText = diffResp.payload.diff;
                }
            }
            catch { /* diff fetch optional */ }
        }
        if (textToAnalyze.trim().length < 50 && !cachedDiffText) {
            setStatus("PR description too short and no code diff available");
            els.btnL4Auto.disabled = false;
            els.btnL4Auto.innerHTML = '<span class="gx-btn__icon">🧠</span> Analyze PR Description & Code';
            return;
        }
        await runL4Analysis(textToAnalyze, cachedDiffText ?? undefined);
    }
    catch (err) {
        setStatus("Failed to extract PR data");
        els.btnL4Auto.disabled = false;
        els.btnL4Auto.innerHTML = '<span class="gx-btn__icon">🧠</span> Analyze PR Description & Code';
    }
});
// L4 Manual
els.btnL4Manual.addEventListener("click", async () => {
    const text = els.l4TextInput.value.trim();
    if (!text || text.length < 50) {
        setStatus("Please paste at least 50 characters of text");
        return;
    }
    await runL4Analysis(text);
});
// ── Master Controller Integration ───────────

function refreshMasterVerdict() {
    const verdict = computeVerdict();
    renderMasterVerdict(verdict);
    sendBadgeUpdate(verdict);
}
function renderMasterVerdict(v) {
    els.masterSection.style.display = "block";
    // Score ring
    const circumference = 2 * Math.PI * 52; // 326.73
    const offset = circumference - (v.score / 100) * circumference;
    els.masterRingFill.style.strokeDashoffset = String(offset);
    const ringColor = v.tier === "green" ? "var(--gx-green)" :
        v.tier === "yellow" ? "var(--gx-yellow)" : "var(--gx-red)";
    els.masterRingFill.style.stroke = ringColor;
    // Score value
    els.masterScore.textContent = String(v.score);
    els.masterScore.style.color = ringColor;
    // Verdict label
    els.masterVerdictLabel.textContent = v.verdict;
    els.masterVerdictLabel.style.color = ringColor;
    // Tier badge
    els.masterTier.textContent = v.verdict.toUpperCase();
    els.masterTier.className = `gx-master-tier gx-master-tier--${v.tier}`;
    // Description
    const completeLayers = Object.values(v.layers).filter(l => l.state === "complete").length;
    els.masterDesc.textContent = `${completeLayers}/4 layers analyzed${v.skippedHeavyChecks ? " (smart-skip active)" : ""}`;
    // Skip banner
    if (v.skippedHeavyChecks) {
        els.masterSkip.style.display = "flex";
        els.masterSkipText.textContent = v.skipReason;
    }
    else {
        els.masterSkip.style.display = "none";
    }
    // Layer breakdown rows
    renderLayerRow("l1", v.layers.l1_triage);
    renderLayerRow("l2", v.layers.l2_reputation);
    renderLayerRow("l3", v.layers.l3_wasm);
    renderLayerRow("l4", v.layers.l4_ai);
}
function renderLayerRow(id, layer) {
    const pill = $(`ml-${id}-pill`);
    const bar = $(`ml-${id}-bar`);
    const detail = $(`ml-${id}-detail`);
    // Pill
    pill.textContent = layer.state === "complete" ? layer.label :
        layer.state === "skipped" ? "skipped" :
            layer.state === "running" ? "running…" :
                layer.state === "error" ? "error" : "pending";
    pill.className = `gx-master-layer__pill gx-master-layer__pill--${layer.state}`;
    // Bar
    if (layer.state === "complete") {
        const pct = Math.min(layer.normalizedScore, 100);
        bar.style.width = `${pct}%`;
        bar.style.background = pct >= 60 ? "var(--gx-red)" :
            pct >= 30 ? "var(--gx-yellow)" : "var(--gx-green)";
    }
    else if (layer.state === "skipped") {
        bar.style.width = "100%";
        bar.style.background = "var(--gx-surface)";
    }
    else {
        bar.style.width = "0%";
    }
    // Detail
    detail.textContent = layer.detail;
}
function setMasterLayerState(id, state) {
    const pill = $(`ml-${id}-pill`);
    if (pill) {
        pill.textContent = state === "running" ? "running…" : state;
        pill.className = `gx-master-layer__pill gx-master-layer__pill--${state}`;
    }
}
// ── Badge Update to Content Script ──────────
async function sendBadgeUpdate(v) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id)
            return;
        // Map tier to recommendation for the badge
        const recommendation = v.tier === "green" ? "allow" :
            v.tier === "yellow" ? "warn" : "close";
        await chrome.tabs.sendMessage(tab.id, {
            action: ACTION.UPDATE_SLOP_BADGE,
            payload: {
                score: v.score,
                label: v.verdict,
                recommendation,
            },
        });
    }
    catch {
        // Tab may not have content script — ignore
    }
}
// ── Full Scan Orchestrator ──────────────────
els.btnFullScan.addEventListener("click", async () => {
    if (!currentPR) {
        await ensureCurrentPR();
    }
    if (!currentPR) {
        setStatus("No active PR — navigate to a GitHub PR page");
        return;
    }
    els.btnFullScan.disabled = true;
    els.btnFullScan.textContent = "Scanning…";
    resetMasterState();
    // Re-feed L1 so it doesn't show pending while other layers run
    if (cachedTriageData) {
        feedLayer1(cachedTriageData);
    }
    refreshMasterVerdict();
    try {
        // ── Step 1: L2 Reputation ──
        setMasterLayerState("l2", "running");
        setStatus("[1/4] Running reputation analysis…");
        // Attach listener BEFORE sending request to avoid race condition
        const l2Promise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
                chrome.runtime.onMessage.removeListener(handler);
                // If L2 never responded, check if state has cached score
                setMasterLayerState("l2", "error");
                resolve();
            }, 15000); // 15s safety timeout
            const handler = (msg) => {
                if (msg.action === ACTION.ANALYSIS_UPDATE) {
                    if (msg.payload.status === "complete" && msg.payload.slopScore) {
                        clearTimeout(timeout);
                        showScore(msg.payload.slopScore);
                        feedLayer2(msg.payload.slopScore);
                        refreshMasterVerdict();
                        chrome.runtime.onMessage.removeListener(handler);
                        resolve();
                    }
                    else if (msg.payload.status === "error") {
                        clearTimeout(timeout);
                        setMasterLayerState("l2", "error");
                        chrome.runtime.onMessage.removeListener(handler);
                        resolve();
                    }
                }
            };
            chrome.runtime.onMessage.addListener(handler);
        });
        chrome.runtime.sendMessage({
            action: ACTION.REQUEST_ANALYSIS,
            payload: {
                owner: currentPR.owner,
                repo: currentPR.repo,
                prNumber: currentPR.prNumber,
                author: currentPR.prAuthor,
            },
        });
        await l2Promise;
        // ── Smart-skip check ──
        if (shouldSkipHeavyChecks()) {
            setStatus("Trusted author — skipping heavy checks");
            refreshMasterVerdict();
            return;
        }
        // ── Step 2: L3 WASM Structural ──
        setMasterLayerState("l3", "running");
        setStatus("[2/4] Running structural analysis…");
        try {
            const diffResponse = await chrome.runtime.sendMessage({
                action: ACTION.REQUEST_PR_DIFF,
                payload: {
                    owner: currentPR.owner,
                    repo: currentPR.repo,
                    prNumber: currentPR.prNumber,
                },
            });
            if (diffResponse?.payload?.diff) {
                await runWasmOnDiff(diffResponse.payload.diff);
            }
            else {
                setMasterLayerState("l3", "error");
            }
        }
        catch {
            setMasterLayerState("l3", "error");
        }
        // ── Step 3: L4 AI Text Detection (description + code) ──
        setMasterLayerState("l4", "running");
        setStatus("[3/4] Running AI text detection on description & code…");
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                const descResp = await chrome.tabs.sendMessage(tab.id, {
                    action: ACTION.REQUEST_PR_DESCRIPTION,
                    payload: {},
                });
                const description = descResp?.payload?.description ?? "";
                const codeComments = descResp?.payload?.codeComments ?? [];
                let textToAnalyze = description;
                if (codeComments.length > 0) {
                    textToAnalyze += "\n\n" + codeComments.join("\n\n");
                }
                if (textToAnalyze.trim().length >= 50 || cachedDiffText) {
                    await runL4Analysis(textToAnalyze, cachedDiffText ?? undefined);
                }
                else {
                    setMasterLayerState("l4", "pending");
                }
            }
        }
        catch {
            setMasterLayerState("l4", "error");
        }
        // ── Final verdict ──
        refreshMasterVerdict();
        setStatus("Full scan complete ✓");
    }
    finally {
        els.btnFullScan.disabled = false;
        els.btnFullScan.innerHTML = '<span class="gx-btn__icon">🚀</span> Full Scan — All Layers';
    }
});
loadCurrentState();

/******/ })()
;
//# sourceMappingURL=sidepanel.js.map