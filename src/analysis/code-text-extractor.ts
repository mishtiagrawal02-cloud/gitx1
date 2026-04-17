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
export function extractTextFromDiff(diffText: string): ExtractedCodeText {
  const lines = diffText.split("\n");
  const comments: string[] = [];
  const stringLiterals: string[] = [];
  const functionNames: string[] = [];
  const logMessages: string[] = [];
  const variableNames: string[] = [];

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
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const code = line.slice(1).trim(); // Remove leading "+"
    if (!code) continue;

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
export function buildCodeAnalysisText(extracted: ExtractedCodeText): string {
  const sections: string[] = [];

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
export function analyzeNamingPatterns(names: string[]): NamingAnalysis {
  if (names.length < 3) {
    return { score: 0, signals: [], isAiLikely: false };
  }

  const signals: string[] = [];
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

export interface ExtractedCodeText {
  comments: string[];
  stringLiterals: string[];
  functionNames: string[];
  logMessages: string[];
  variableNames: string[];
  currentFile: string;
  totalAddedLines: number;
}

export interface NamingAnalysis {
  score: number;
  signals: string[];
  isAiLikely: boolean;
}
