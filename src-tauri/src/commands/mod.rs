//! Narrow, typed native commands. Each command validates its own
//! arguments and returns a redacted [`crate::security::SecurityError`]
//! on failure; nothing here trusts webview input implicitly.

pub mod log;
pub mod session;
pub mod vault;
pub mod workspace;
