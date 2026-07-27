use crate::observability::{sanitize, LogError, LogEvent, LogLevel};

/// Receives an already-redacted structured event from the webview,
/// re-redacts it, and writes it to the native log stream.
///
/// Writing to stderr keeps Phase 0 dependency-free; a file/rotation
/// sink is an operational decision for the packaging task rather than
/// something to guess at now.
#[tauri::command]
pub fn log_event(event: LogEvent) -> Result<(), LogError> {
    let event = sanitize(event)?;
    let line = serde_json::to_string(&event)
        .map_err(|_| LogError::InvalidEvent("event could not be serialised".into()))?;

    match event.level {
        LogLevel::Error | LogLevel::Warn => eprintln!("{line}"),
        _ => println!("{line}"),
    }
    Ok(())
}
