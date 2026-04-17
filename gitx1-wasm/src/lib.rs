//! GitX1 WASM — Structural AST Analyzer
//!
//! Compiles to WebAssembly for in-browser code analysis.
//! Takes a unified diff string, parses it into file chunks,
//! runs structural AST checks (tree-sitter) and regex pattern
//! checks (ported from dabit3/deslop), and returns a JSON report.

mod ast_checks;
mod diff_parser;
mod pattern_checks;
mod report;

use wasm_bindgen::prelude::*;
use diff_parser::{parse_diff, Language};
use report::AnalysisReport;

/// Analyze a unified diff string for AI-generated code patterns.
///
/// Takes a raw diff (e.g. from `git diff` or GitHub's `.diff` endpoint)
/// and returns a JSON string containing the analysis report.
///
/// # Arguments
/// * `diff_text` - A unified diff format string
///
/// # Returns
/// JSON string with the `AnalysisReport` structure
#[wasm_bindgen]
pub fn analyze_diff(diff_text: &str) -> String {
    // Catch any panics to prevent WASM "unreachable" crashes
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        analyze_diff_inner(diff_text)
    })) {
        Ok(result) => result,
        Err(_) => {
            // Return a safe fallback report on panic
            serde_json::json!({
                "files_analyzed": 0,
                "total_findings": 0,
                "findings": [],
                "score": 100,
                "severity_counts": { "high": 0, "medium": 0, "low": 0 }
            }).to_string()
        }
    }
}

fn analyze_diff_inner(diff_text: &str) -> String {
    let chunks = parse_diff(diff_text);
    let mut all_findings = Vec::new();
    let files_analyzed = chunks.len();

    for chunk in &chunks {
        let lang = chunk.language.unwrap_or(Language::Other);

        // 1. Run regex pattern checks on all files (language-agnostic)
        let pattern_findings = pattern_checks::run_pattern_checks(
            &chunk.added_lines,
            &chunk.filename,
        );
        all_findings.extend(pattern_findings);

        // 2. Run AST checks on parseable files (JS/TS via tree-sitter)
        if lang.is_parseable() && !chunk.full_added_text.is_empty() {
            let ast_findings = ast_checks::run_ast_checks(
                &chunk.full_added_text,
                &chunk.filename,
            );
            all_findings.extend(ast_findings);
        }
    }

    let report = AnalysisReport::new(all_findings, files_analyzed);
    serde_json::to_string(&report).unwrap_or_else(|_| "{}".to_string())
}

/// Get the version of the analyzer
#[wasm_bindgen]
pub fn analyzer_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get supported languages
#[wasm_bindgen]
pub fn supported_languages() -> String {
    serde_json::json!({
        "ast_analysis": ["javascript", "typescript"],
        "pattern_analysis": ["all"]
    }).to_string()
}
