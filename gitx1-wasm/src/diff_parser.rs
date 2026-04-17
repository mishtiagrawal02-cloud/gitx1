/// Parses a unified diff string into per-file chunks of added lines.

#[derive(Debug, Clone)]
pub struct DiffChunk {
    pub filename: String,
    pub language: Option<Language>,
    pub added_lines: Vec<(usize, String)>, // (line_number, content)
    pub full_added_text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    JavaScript,
    TypeScript,
    Python,
    Go,
    Rust,
    Other,
}

impl Language {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "js" | "jsx" | "mjs" | "cjs" => Language::JavaScript,
            "ts" | "tsx" | "mts" | "cts" => Language::TypeScript,
            "py" | "pyw" => Language::Python,
            "go" => Language::Go,
            "rs" => Language::Rust,
            _ => Language::Other,
        }
    }

    /// Whether we can parse this language with tree-sitter (JS grammar handles both JS/TS)
    pub fn is_parseable(&self) -> bool {
        matches!(self, Language::JavaScript | Language::TypeScript)
    }
}

/// Parse unified diff format into file chunks
pub fn parse_diff(diff_text: &str) -> Vec<DiffChunk> {
    let mut chunks: Vec<DiffChunk> = Vec::new();
    let mut current_file: Option<String> = None;
    let mut added_lines: Vec<(usize, String)> = Vec::new();
    let mut current_line_num: usize = 0;

    for line in diff_text.lines() {
        // New file header: "diff --git a/path b/path" or "+++ b/path"
        if line.starts_with("+++ b/") || line.starts_with("+++ ./") {
            // Save previous chunk
            if let Some(ref file) = current_file {
                if !added_lines.is_empty() {
                    let ext = file.rsplit('.').next().unwrap_or("");
                    let full_text = added_lines.iter().map(|(_, l)| l.as_str()).collect::<Vec<_>>().join("\n");
                    chunks.push(DiffChunk {
                        filename: file.clone(),
                        language: Some(Language::from_extension(ext)),
                        added_lines: added_lines.clone(),
                        full_added_text: full_text,
                    });
                    added_lines.clear();
                }
            }

            let path = if line.starts_with("+++ b/") {
                &line[6..]
            } else {
                &line[6..]
            };
            current_file = Some(path.to_string());
            current_line_num = 0;
        }
        // Hunk header: "@@ -a,b +c,d @@"
        else if line.starts_with("@@") {
            // Extract the target line number from +c
            if let Some(plus_pos) = line.find('+') {
                let after_plus = &line[plus_pos + 1..];
                let num_str: String = after_plus.chars().take_while(|c| c.is_ascii_digit()).collect();
                current_line_num = num_str.parse().unwrap_or(0);
            }
        }
        // Added line
        else if line.starts_with('+') && !line.starts_with("+++") {
            if current_file.is_some() {
                added_lines.push((current_line_num, line[1..].to_string()));
            }
            current_line_num += 1;
        }
        // Context line
        else if !line.starts_with('-') && !line.starts_with("---") {
            current_line_num += 1;
        }
        // Removed line — don't increment target line number
    }

    // Save last chunk
    if let Some(ref file) = current_file {
        if !added_lines.is_empty() {
            let ext = file.rsplit('.').next().unwrap_or("");
            let full_text = added_lines.iter().map(|(_, l)| l.as_str()).collect::<Vec<_>>().join("\n");
            chunks.push(DiffChunk {
                filename: file.clone(),
                language: Some(Language::from_extension(ext)),
                added_lines,
                full_added_text: full_text,
            });
        }
    }

    chunks
}
