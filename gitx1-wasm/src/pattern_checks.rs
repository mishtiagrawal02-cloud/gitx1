/// Regex-based pattern checks ported from dabit3/deslop.
/// These run on raw diff text without AST parsing.

use regex::Regex;
use crate::report::{Finding, Severity, FindingSource};

struct PatternRule {
    id: &'static str,
    name: &'static str,
    severity: Severity,
    pattern: &'static str,
}

const PATTERN_RULES: &[PatternRule] = &[
    // ── Excessive Comments ────────────────────
    PatternRule {
        id: "verbose-obvious-comment",
        name: "Verbose obvious comment",
        severity: Severity::Low,
        pattern: r"//\s*(Initialize|Declare|Create|Set|Define|Call|Return|Check|Validate|Get|Fetch|Process|Handle|Update|Increment|Decrement)\s+(?:the\s+)?(?:a\s+)?\w+(?:\s+variable|\s+function|\s+method|\s+value|\s+result|\s+array|\s+object)?\s*$",
    },
    PatternRule {
        id: "section-divider-comment",
        name: "Section divider comments",
        severity: Severity::Low,
        pattern: r"//\s*[-=*]{3,}\s*\w+.*[-=*]{3,}\s*$",
    },
    PatternRule {
        id: "todo-placeholder",
        name: "Generic TODO placeholder",
        severity: Severity::Medium,
        pattern: r"//\s*TODO:\s*(Implement|Add|Handle|Fix)\s+(this|here|later|functionality|logic|error handling)\s*$",
    },

    // ── Defensive Programming ─────────────────
    PatternRule {
        id: "triple-null-check",
        name: "Triple null/undefined check",
        severity: Severity::Medium,
        pattern: r"if\s*\(\s*\w+\s*!==?\s*null\s*&&\s*\w+\s*!==?\s*undefined\s*&&\s*\w+\s*!==?\s*",
    },
    PatternRule {
        id: "empty-catch-log",
        name: "Empty catch with console.error",
        severity: Severity::Medium,
        pattern: r"catch\s*\(\s*\w+\s*\)\s*\{\s*console\.(error|log)\(",
    },
    PatternRule {
        id: "unnecessary-try-catch",
        name: "Unnecessary try-catch wrapper",
        severity: Severity::Low,
        pattern: r"try\s*\{\s*(const|let|var)\s+\w+\s*=\s*[^;]+;\s*\}\s*catch",
    },

    // ── Verbose Naming ────────────────────────
    PatternRule {
        id: "verbose-temp-variable",
        name: "Verbose temporary variable",
        severity: Severity::Low,
        pattern: r"(?:const|let|var)\s+(temporaryVariableFor|tempValueOf|resultOfThe|valueToBeReturned|dataToProcess)\w*",
    },
    PatternRule {
        id: "response-data-chain",
        name: "Response data chain",
        severity: Severity::Low,
        pattern: r"response\.data\.data\.",
    },

    // ── Debug Logging ─────────────────────────
    PatternRule {
        id: "console-log-debug",
        name: "Debug console.log",
        severity: Severity::High,
        pattern: r#"console\.log\(['"](DEBUG|TEMP|TEST|TODO|FIXME|XXX|HACK):?"#,
    },
    PatternRule {
        id: "commented-console-log",
        name: "Commented out console.log",
        severity: Severity::Low,
        pattern: r"//\s*console\.(log|debug|info|warn|error)\(",
    },
    PatternRule {
        id: "redundant-return",
        name: "Redundant return undefined",
        severity: Severity::Low,
        pattern: r"return\s+undefined\s*;\s*\}",
    },
    PatternRule {
        id: "triple-equals-null",
        name: "Triple equals null AND undefined",
        severity: Severity::Low,
        pattern: r"\w+\s*===?\s*null\s*\|\|\s*\w+\s*===?\s*undefined",
    },

    // ── Over-Logging ──────────────────────────
    PatternRule {
        id: "function-entry-log",
        name: "Function entry logging",
        severity: Severity::Medium,
        pattern: r#"console\.log\(['"](Entering|Starting|Begin|Called|Invoking)"#,
    },
    PatternRule {
        id: "function-exit-log",
        name: "Function exit logging",
        severity: Severity::Medium,
        pattern: r#"console\.log\(['"](Exiting|Ending|Finished|Completed|Done|Returning)"#,
    },

    // ── Type Coercion ─────────────────────────
    PatternRule {
        id: "string-coercion-verbose",
        name: "Verbose string coercion",
        severity: Severity::Low,
        pattern: r"String\(\w+\)\s*\+\s*String\(\w+\)",
    },
    PatternRule {
        id: "boolean-comparison",
        name: "Explicit boolean comparison",
        severity: Severity::Low,
        pattern: r"===?\s*true|===?\s*false|true\s*===?|false\s*===?",
    },

    // ── Async Patterns ────────────────────────
    PatternRule {
        id: "await-promise-all-single",
        name: "Promise.all with single promise",
        severity: Severity::Low,
        pattern: r"await\s+Promise\.all\(\[\s*\w+\s*\]\)",
    },
];

/// Run all regex pattern checks on the added lines of a file
pub fn run_pattern_checks(lines: &[(usize, String)], filename: &str) -> Vec<Finding> {
    let mut findings = Vec::new();

    let compiled_rules: Vec<(&PatternRule, Regex)> = PATTERN_RULES
        .iter()
        .filter_map(|rule| {
            Regex::new(rule.pattern).ok().map(|re| (rule, re))
        })
        .collect();

    for (line_num, line_text) in lines {
        for (rule, re) in &compiled_rules {
            if re.is_match(line_text) {
                findings.push(Finding {
                    rule_id: rule.id.to_string(),
                    severity: rule.severity.clone(),
                    file: filename.to_string(),
                    line: *line_num,
                    message: rule.name.to_string(),
                    source: FindingSource::Pattern,
                    snippet: if line_text.len() > 120 {
                        format!("{}…", &line_text[..120])
                    } else {
                        line_text.clone()
                    },
                });
            }
        }
    }

    findings
}
