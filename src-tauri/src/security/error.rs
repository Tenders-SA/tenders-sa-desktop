use serde::Serialize;

/// A typed, redacted error for the native security boundary.
///
/// Variants never carry secret material (session values, encryption
/// keys, plaintext, ciphertext). Only key/entry *names* and a coarse
/// reason are ever included, so this type is safe to log or return to
/// the webview as-is.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum SecurityError {
    #[error("invalid argument: {0}")]
    InvalidArgument(String),

    #[error("secure storage entry not found")]
    NotFound,

    #[error("secure storage operation failed")]
    StoreUnavailable,

    #[error("encryption operation failed")]
    CryptoFailure,
}

impl From<keyring::Error> for SecurityError {
    fn from(error: keyring::Error) -> Self {
        match error {
            keyring::Error::NoEntry => SecurityError::NotFound,
            // keyring::Error implements Display but callers must never
            // surface the underlying platform message here: some
            // backends can echo back call arguments in diagnostic text.
            _ => SecurityError::StoreUnavailable,
        }
    }
}
