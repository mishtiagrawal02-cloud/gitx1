/// Structural code checks using pure-Rust analysis.
///
/// Since tree-sitter's C core can't compile to wasm32-unknown-unknown,
/// we use a lightweight structural analyzer that tracks brace nesting,
/// function boundaries, and pattern matching to detect AI-specific
/// structural anomalies.
///
/// This approach trades some AST precision for WASM compatibility
/// and dramatically smaller binary size (~200KB vs ~5MB).

use crate::report::{Finding, Severity, FindingSource};

/// Run all structural checks on code string
pub fn run_ast_checks(code: &str, filename: &str) -> Vec<Finding> {
    let mut findings = Vec::new();
    let lines: Vec<&str> = code.lines().collect();

    check_excessive_try_catch_wrapping(&lines, filename, &mut findings);
    check_empty_catch_blocks(&lines, filename, &mut findings);
    check_error_swallowing_catch(&lines, filename, &mut findings);
    check_deeply_nested_blocks(&lines, filename, &mut findings);
    check_excessive_params(&lines, filename, &mut findings);
    check_function_entry_exit_log(&lines, filename, &mut findings);
    check_single_use_then_return(&lines, filename, &mut findings);
    check_dead_code_after_return(&lines, filename, &mut findings);
    check_promise_all_single(&lines, filename, &mut findings);
    check_boolean_literal_compare(&lines, filename, &mut findings);
    check_defensive_null_cascade(&lines, filename, &mut findings);
    check_redundant_else_return(&lines, filename, &mut findings);
    check_comment_to_code_ratio(&lines, filename, &mut findings);
    check_overly_defensive_typeof(&lines, filename, &mut findings);
    check_wrapper_function_pattern(&lines, filename, &mut findings);

    findings
}

// ── 1. Function body entirely wrapped in try-catch ─

fn check_excessive_try_catch_wrapping(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim();
        // Detect function start
        if is_function_start(trimmed) {
            let func_start = i;
            // Find opening brace
            let brace_line = find_opening_brace(lines, i);
            if let Some(bl) = brace_line {
                let body_start = bl + 1;
                // Find matching closing brace
                if let Some(body_end) = find_matching_brace(lines, bl) {
                    // Check if the body is just: try { ... } catch { ... }
                    let body_lines: Vec<&str> = lines[body_start..body_end]
                        .iter()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty())
                        .collect();

                    if !body_lines.is_empty() && body_lines[0].starts_with("try") {
                        // Count non-empty statements outside the try-catch
                        let non_try_stmts = body_lines.iter()
                            .filter(|l| {
                                !l.starts_with("try") && !l.starts_with("catch")
                                && !l.starts_with('}') && !l.starts_with('{')
                                && !is_inside_try_catch_block(lines, body_start, body_end)
                            })
                            .count();

                        if non_try_stmts == 0 && body_lines.len() > 2 {
                            findings.push(Finding {
                                rule_id: "excessive-try-catch".into(),
                                severity: Severity::Low,
                                file: filename.into(),
                                line: func_start + 1,
                                message: "Function body entirely wrapped in try-catch — defensive overkill".into(),
                                source: FindingSource::Ast,
                                snippet: truncate(lines[func_start], 120),
                            });
                        }
                    }
                    i = body_end;
                }
            }
        }
        i += 1;
    }
}

fn is_inside_try_catch_block(_lines: &[&str], _start: usize, _end: usize) -> bool {
    // Simplified: if the body has a try statement, we assume everything is inside it
    true
}

// ── 2. Empty catch blocks ─

fn check_empty_catch_blocks(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("catch") || trimmed.contains("} catch") {
            // Check if the catch body is empty: catch(e) { }
            if trimmed.contains("{ }") || trimmed.contains("{}") {
                findings.push(Finding {
                    rule_id: "empty-catch-block".into(),
                    severity: Severity::Medium,
                    file: filename.into(),
                    line: i + 1,
                    message: "Empty catch block — errors silently swallowed".into(),
                    source: FindingSource::Ast,
                    snippet: truncate(trimmed, 120),
                });
            } else if i + 1 < lines.len() {
                let next = lines[i + 1].trim();
                if next == "}" || next.is_empty() {
                    // Check if next non-empty line is closing brace
                    let next_content = lines.iter().skip(i + 1).find(|l| !l.trim().is_empty());
                    if let Some(nc) = next_content {
                        if nc.trim() == "}" {
                            findings.push(Finding {
                                rule_id: "empty-catch-block".into(),
                                severity: Severity::Medium,
                                file: filename.into(),
                                line: i + 1,
                                message: "Empty catch block — errors silently swallowed".into(),
                                source: FindingSource::Ast,
                                snippet: truncate(trimmed, 120),
                            });
                        }
                    }
                }
            }
        }
    }
}

// ── 3. Catch blocks that only log ─

fn check_error_swallowing_catch(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("catch") || trimmed.contains("} catch") {
            // Look at the body (next few lines)
            if let Some(brace_start) = find_opening_brace(lines, i) {
                if let Some(brace_end) = find_matching_brace(lines, brace_start) {
                    let body: Vec<&str> = lines[brace_start + 1..brace_end]
                        .iter()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty())
                        .collect();

                    if body.len() == 1 {
                        let stmt = body[0];
                        if stmt.contains("console.error") || stmt.contains("console.log")
                            || stmt.contains("console.warn")
                        {
                            findings.push(Finding {
                                rule_id: "error-swallowing-catch".into(),
                                severity: Severity::Medium,
                                file: filename.into(),
                                line: i + 1,
                                message: "Catch block only logs error without handling — AI pattern".into(),
                                source: FindingSource::Ast,
                                snippet: truncate(stmt, 120),
                            });
                        }
                    }
                }
            }
        }
    }
}

// ── 4. Deeply nested blocks (5+) ─

fn check_deeply_nested_blocks(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let mut depth: i32 = 0;
    let mut max_depth: i32 = 0;
    let mut max_line = 0;

    for (i, line) in lines.iter().enumerate() {
        for ch in line.chars() {
            match ch {
                '{' => {
                    depth += 1;
                    if depth > max_depth {
                        max_depth = depth;
                        max_line = i;
                    }
                }
                '}' => depth = (depth - 1).max(0),
                _ => {}
            }
        }
    }

    if max_depth >= 5 {
        findings.push(Finding {
            rule_id: "deeply-nested-blocks".into(),
            severity: Severity::Medium,
            file: filename.into(),
            line: max_line + 1,
            message: format!("Code nested {} levels deep — over-engineered structure", max_depth),
            source: FindingSource::Ast,
            snippet: truncate(lines.get(max_line).unwrap_or(&""), 120),
        });
    }
}

// ── 5. Functions with 5+ parameters ─

fn check_excessive_params(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if is_function_start(trimmed) {
            // Find param list
            if let Some(lparen) = trimmed.find('(') {
                let after = &trimmed[lparen + 1..];
                if let Some(rparen) = after.find(')') {
                    let params = &after[..rparen];
                    if !params.is_empty() {
                        let count = params.split(',').count();
                        if count >= 5 {
                            findings.push(Finding {
                                rule_id: "excessive-params".into(),
                                severity: Severity::Low,
                                file: filename.into(),
                                line: i + 1,
                                message: format!("Function has {} parameters — consider destructuring", count),
                                source: FindingSource::Ast,
                                snippet: truncate(trimmed, 120),
                            });
                        }
                    }
                }
            }
        }
    }
}

// ── 6. Function entry/exit logging ─

fn check_function_entry_exit_log(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let entry_words = ["entering", "starting", "begin", "called", "invoking"];
    let exit_words = ["exiting", "ending", "finished", "completed", "done", "returning"];

    for (i, line) in lines.iter().enumerate() {
        let lower = line.to_lowercase();
        if lower.contains("console.log") {
            let is_entry = entry_words.iter().any(|w| lower.contains(w));
            let is_exit = exit_words.iter().any(|w| lower.contains(w));
            if is_entry {
                findings.push(Finding {
                    rule_id: "function-entry-exit-log".into(),
                    severity: Severity::Medium,
                    file: filename.into(),
                    line: i + 1,
                    message: "Function entry logging — AI debugging pattern".into(),
                    source: FindingSource::Ast,
                    snippet: truncate(line.trim(), 120),
                });
            } else if is_exit {
                findings.push(Finding {
                    rule_id: "function-entry-exit-log".into(),
                    severity: Severity::Medium,
                    file: filename.into(),
                    line: i + 1,
                    message: "Function exit logging — AI debugging pattern".into(),
                    source: FindingSource::Ast,
                    snippet: truncate(line.trim(), 120),
                });
            }
        }
    }
}

// ── 7. Assign then immediately return ─

fn check_single_use_then_return(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for i in 0..lines.len().saturating_sub(1) {
        let curr = lines[i].trim();
        let next = lines[i + 1].trim();

        if (curr.starts_with("const ") || curr.starts_with("let ") || curr.starts_with("var "))
            && curr.contains('=')
            && next.starts_with("return ")
        {
            // Extract variable name
            let parts: Vec<&str> = curr.splitn(2, '=').collect();
            if let Some(decl) = parts.first() {
                let name = decl.trim()
                    .trim_start_matches("const ")
                    .trim_start_matches("let ")
                    .trim_start_matches("var ")
                    .trim();
                // Check if return uses this name
                let ret_val = next.trim_start_matches("return ").trim_end_matches(';').trim();
                if ret_val == name {
                    findings.push(Finding {
                        rule_id: "single-use-variable".into(),
                        severity: Severity::Low,
                        file: filename.into(),
                        line: i + 1,
                        message: format!("Variable '{}' declared then immediately returned — return expression directly", name),
                        source: FindingSource::Ast,
                        snippet: format!("{}\n{}", curr, next),
                    });
                }
            }
        }
    }
}

// ── 8. Dead code after return ─

fn check_dead_code_after_return(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for i in 0..lines.len().saturating_sub(1) {
        let curr = lines[i].trim();
        let next = lines[i + 1].trim();

        if curr.starts_with("return ") || curr == "return;" {
            if !next.is_empty() && next != "}" && !next.starts_with("//") && !next.starts_with("case ") && !next.starts_with("default:") {
                findings.push(Finding {
                    rule_id: "dead-code-after-return".into(),
                    severity: Severity::High,
                    file: filename.into(),
                    line: i + 2,
                    message: "Unreachable code after return statement".into(),
                    source: FindingSource::Ast,
                    snippet: truncate(next, 120),
                });
            }
        }
    }
}

// ── 9. Promise.all with single element ─

fn check_promise_all_single(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let re = regex::Regex::new(r"Promise\.all\(\[\s*\w+\s*\]\)").unwrap();
    for (i, line) in lines.iter().enumerate() {
        if re.is_match(line) {
            findings.push(Finding {
                rule_id: "promise-all-single".into(),
                severity: Severity::Low,
                file: filename.into(),
                line: i + 1,
                message: "Promise.all with single element — just await it directly".into(),
                source: FindingSource::Ast,
                snippet: truncate(line.trim(), 120),
            });
        }
    }
}

// ── 10. Boolean literal compare ─

fn check_boolean_literal_compare(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let re = regex::Regex::new(r"===?\s*(true|false)|(true|false)\s*===?").unwrap();
    for (i, line) in lines.iter().enumerate() {
        if re.is_match(line) && !line.contains("typeof") {
            findings.push(Finding {
                rule_id: "boolean-literal-compare".into(),
                severity: Severity::Low,
                file: filename.into(),
                line: i + 1,
                message: "Explicit boolean comparison — simplify condition".into(),
                source: FindingSource::Ast,
                snippet: truncate(line.trim(), 120),
            });
        }
    }
}

// ── 11. Defensive null cascade ─

fn check_defensive_null_cascade(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        let null_count = trimmed.matches("null").count() + trimmed.matches("undefined").count();
        if null_count >= 3 && trimmed.contains("&&") {
            findings.push(Finding {
                rule_id: "defensive-null-cascade".into(),
                severity: Severity::Medium,
                file: filename.into(),
                line: i + 1,
                message: "Triple null/undefined guard — overly defensive AI pattern".into(),
                source: FindingSource::Ast,
                snippet: truncate(trimmed, 120),
            });
        }
    }
}

// ── 12. Redundant else after return ─

fn check_redundant_else_return(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    for i in 0..lines.len().saturating_sub(1) {
        let curr = lines[i].trim();
        let next = lines[i + 1].trim();

        if (curr == "}" || curr.contains("return")) && next.starts_with("} else {") {
            // Look back to see if the if-block has a return
            if i >= 2 {
                let prev = lines[i].trim();
                if prev.contains("return ") {
                    findings.push(Finding {
                        rule_id: "redundant-else-return".into(),
                        severity: Severity::Low,
                        file: filename.into(),
                        line: i + 2,
                        message: "Redundant else after return — remove else and flatten".into(),
                        source: FindingSource::Ast,
                        snippet: truncate(next, 120),
                    });
                }
            }
        }
    }
}

// ── 13. Comment-to-code ratio ─

fn check_comment_to_code_ratio(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let mut comment_count = 0;
    let mut code_count = 0;

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
            comment_count += 1;
        } else {
            code_count += 1;
        }
    }

    if code_count > 5 && comment_count > code_count {
        findings.push(Finding {
            rule_id: "comment-to-code-ratio".into(),
            severity: Severity::Low,
            file: filename.into(),
            line: 1,
            message: format!(
                "Comments ({}) outnumber code lines ({}) — possible AI over-documentation",
                comment_count, code_count
            ),
            source: FindingSource::Ast,
            snippet: String::new(),
        });
    }
}

// ── 14. Overly defensive typeof checks ─

fn check_overly_defensive_typeof(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let re = regex::Regex::new(r#"typeof\s+\w+\s*[!=]==?\s*['"]undefined['"]"#).unwrap();
    for (i, line) in lines.iter().enumerate() {
        if re.is_match(line) {
            // Multiple typeof on same line = overkill
            let count = re.find_iter(line).count();
            if count >= 2 {
                findings.push(Finding {
                    rule_id: "overly-defensive-typeof".into(),
                    severity: Severity::Low,
                    file: filename.into(),
                    line: i + 1,
                    message: "Multiple typeof checks on same line — likely AI-generated defensive code".into(),
                    source: FindingSource::Ast,
                    snippet: truncate(line.trim(), 120),
                });
            }
        }
    }
}

// ── 15. Wrapper function pattern ─

fn check_wrapper_function_pattern(lines: &[&str], filename: &str, findings: &mut Vec<Finding>) {
    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim();
        if is_function_start(trimmed) {
            if let Some(brace_line) = find_opening_brace(lines, i) {
                if let Some(end_brace) = find_matching_brace(lines, brace_line) {
                    let body: Vec<&str> = lines[brace_line + 1..end_brace]
                        .iter()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty())
                        .collect();

                    // Single-statement body that is just a function call or return of a call
                    if body.len() == 1 {
                        let stmt = body[0];
                        let is_call = (stmt.starts_with("return ") && stmt.contains('('))
                            || (stmt.contains('(') && stmt.ends_with(';'));
                        if is_call && !stmt.contains("if") && !stmt.contains("for") {
                            findings.push(Finding {
                                rule_id: "wrapper-function".into(),
                                severity: Severity::Low,
                                file: filename.into(),
                                line: i + 1,
                                message: "Function is a thin wrapper — consider inlining".into(),
                                source: FindingSource::Ast,
                                snippet: truncate(trimmed, 120),
                            });
                        }
                    }
                    i = end_brace;
                }
            }
        }
        i += 1;
    }
}

// ── Helpers ───────────────────────────────────

fn is_function_start(line: &str) -> bool {
    line.starts_with("function ")
        || line.starts_with("async function ")
        || line.contains("=> {")
        || line.contains("=>{")
        || (line.contains("(") && line.contains(")") && line.contains("{")
            && (line.starts_with("export") || line.contains("const ") || line.contains("let ")))
}

fn find_opening_brace(lines: &[&str], start: usize) -> Option<usize> {
    for i in start..lines.len().min(start + 3) {
        if lines[i].contains('{') {
            return Some(i);
        }
    }
    None
}

fn find_matching_brace(lines: &[&str], brace_line: usize) -> Option<usize> {
    let mut depth: i32 = 0;
    for i in brace_line..lines.len() {
        for ch in lines[i].chars() {
            match ch {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        return Some(i);
                    }
                }
                _ => {}
            }
        }
    }
    None
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    // Find the last char boundary at or before `max` to avoid panicking on multi-byte chars
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &s[..end])
}
