use serde::{Deserialize, Serialize};
use tauri::State;

use crate::security::{SecretStore, SecurityError};

/// Closed set of session values the webview may ask the native layer
/// to store. Deliberately not a free-form string: it keeps the secure
/// storage surface auditable and prevents arbitrary key sprawl.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionKey {
    AccessToken,
    RefreshToken,
}

impl SessionKey {
    fn storage_key(self) -> &'static str {
        match self {
            SessionKey::AccessToken => "session_access_token",
            SessionKey::RefreshToken => "session_refresh_token",
        }
    }
}

/// Stores a session value in OS-backed secure storage. The value never
/// touches SQLite, logs, or Zustand/webview-persisted state.
///
/// Production authentication remains disabled (REQ-4) until the Phase 1
/// native auth contract (TASK-1.3) is accepted; this command only
/// establishes the storage boundary the auth feature (TASK-0.9) will
/// call into.
#[tauri::command]
pub fn session_store(
    store: State<'_, Box<dyn SecretStore>>,
    key: SessionKey,
    value: String,
) -> Result<(), SecurityError> {
    store.set(key.storage_key(), &value)
}

#[tauri::command]
pub fn session_load(
    store: State<'_, Box<dyn SecretStore>>,
    key: SessionKey,
) -> Result<Option<String>, SecurityError> {
    store.get(key.storage_key())
}

#[tauri::command]
pub fn session_clear(
    store: State<'_, Box<dyn SecretStore>>,
    key: SessionKey,
) -> Result<(), SecurityError> {
    store.delete(key.storage_key())
}
