//! Native security boundary (SEC-1, SEC-2, SEC-4): OS-backed secure
//! storage and local-payload encryption. Secrets and key material never
//! cross into the webview; only opaque ciphertext or typed, redacted
//! errors do. See docs/architecture/security.md for the design record.

pub mod encryption;
pub mod error;
pub mod secret_store;

pub use error::SecurityError;
pub use secret_store::{OsKeychain, SecretStore};
