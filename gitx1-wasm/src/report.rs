use serde::Serialize;

/// Severity levels matching dabit3/deslop
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    High,
    Medium,
    Low,
}

/// Source of the detection
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FindingSource {
    Ast,
    Pattern,
}

/// A single finding from analysis
#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    pub rule_id: String,
    pub severity: Severity,
    pub file: String,
    pub line: usize,
    pub message: String,
    pub source: FindingSource,
    pub snippet: String,
}

/// Severity breakdown counts
#[derive(Debug, Clone, Serialize, Default)]
pub struct SeverityCounts {
    pub high: usize,
    pub medium: usize,
    pub low: usize,
}

/// Full analysis report returned as JSON
#[derive(Debug, Clone, Serialize)]
pub struct AnalysisReport {
    pub total_findings: usize,
    pub files_analyzed: usize,
    /// 0-100 where 100 = perfectly clean
    pub score: u32,
    pub severity_counts: SeverityCounts,
    pub findings: Vec<Finding>,
}

impl AnalysisReport {
    pub fn new(findings: Vec<Finding>, files_analyzed: usize) -> Self {
        let mut counts = SeverityCounts::default();
        for f in &findings {
            match f.severity {
                Severity::High => counts.high += 1,
                Severity::Medium => counts.medium += 1,
                Severity::Low => counts.low += 1,
            }
        }

        // Score: high=10pts, medium=5pts, low=1pt, normalised per file
        let raw_penalty = (counts.high * 10 + counts.medium * 5 + counts.low) as f64;
        let normalised = if files_analyzed > 0 {
            raw_penalty / files_analyzed as f64
        } else {
            raw_penalty
        };
        let score = (100.0 - normalised.min(100.0)).max(0.0) as u32;

        AnalysisReport {
            total_findings: findings.len(),
            files_analyzed,
            score,
            severity_counts: counts,
            findings,
        }
    }
}
