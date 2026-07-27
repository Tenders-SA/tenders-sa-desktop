//! Native log bridge (REQ-8, OPS-1, PRIV-1).
//!
//! The webview redacts before calling `log_event`, but this side
//! redacts again rather than trusting that. The IPC boundary is
//! exactly where "the caller already sanitised it" stops being a
//! safe assumption: a future call site, or a bug in the TypeScript
//! redactor, would otherwise write unredacted tender content to disk.

pub mod redaction;

use serde::{Deserialize, Serialize};

pub const MAX_EVENT_NAME_LEN: usize = 128;
pub const MAX_FIELD_LEN: usize = 2048;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// A log event as received from the webview. Field values are strings
/// only: accepting arbitrary JSON here would mean re-implementing a
/// full recursive scrubber on this side too, for no benefit -- the
/// webview already flattens before sending.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    pub level: LogLevel,
    pub event: String,
    pub timestamp: String,
    pub app_version: String,
    pub environment: String,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default)]
    pub fields: Vec<(String, String)>,
}

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum LogError {
    #[error("invalid log event: {0}")]
    InvalidEvent(String),
}

/// Validates and re-redacts an event, returning the sanitised form.
pub fn sanitize(mut event: LogEvent) -> Result<LogEvent, LogError> {
    if event.event.is_empty() || event.event.len() > MAX_EVENT_NAME_LEN {
        return Err(LogError::InvalidEvent(format!(
            "event name must be 1-{MAX_EVENT_NAME_LEN} characters"
        )));
    }

    event.event = redaction::redact(&event.event);
    event.correlation_id = event.correlation_id.map(|id| redaction::redact(&id));
    event.fields = event
        .fields
        .into_iter()
        .map(|(key, value)| {
            let mut value = redaction::redact(&value);
            if value.len() > MAX_FIELD_LEN {
                value.truncate(MAX_FIELD_LEN);
            }
            (redaction::redact(&key), value)
        })
        .collect();

    Ok(event)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event_with(fields: Vec<(&str, &str)>) -> LogEvent {
        LogEvent {
            level: LogLevel::Info,
            event: "test.event".into(),
            timestamp: "2026-07-27T00:00:00.000Z".into(),
            app_version: "0.1.0".into(),
            environment: "development".into(),
            correlation_id: None,
            fields: fields
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        }
    }

    #[test]
    fn rejects_an_empty_event_name() {
        let mut event = event_with(vec![]);
        event.event = String::new();
        assert!(sanitize(event).is_err());
    }

    #[test]
    fn redacts_a_bearer_token_the_webview_failed_to_scrub() {
        let event = event_with(vec![("header", "Bearer tsa_prod_supersecret")]);
        let sanitized = sanitize(event).unwrap();
        assert!(!sanitized.fields[0].1.contains("supersecret"));
    }

    #[test]
    fn redacts_an_email_address() {
        let event = event_with(vec![("note", "contact buyer@example.com today")]);
        let sanitized = sanitize(event).unwrap();
        assert!(!sanitized.fields[0].1.contains("buyer@example.com"));
    }

    #[test]
    fn redacts_a_rand_amount() {
        let event = event_with(vec![("bid", "quoted R 1 250 000.00 total")]);
        let sanitized = sanitize(event).unwrap();
        assert!(!sanitized.fields[0].1.contains("1 250 000"));
    }

    #[test]
    fn truncates_an_overlong_field() {
        let event = event_with(vec![("document", &"x".repeat(MAX_FIELD_LEN * 2))]);
        let sanitized = sanitize(event).unwrap();
        assert_eq!(sanitized.fields[0].1.len(), MAX_FIELD_LEN);
    }

    #[test]
    fn keeps_an_operational_value_intact() {
        let event = event_with(vec![("status", "pending")]);
        let sanitized = sanitize(event).unwrap();
        assert_eq!(sanitized.fields[0].1, "pending");
    }
}
