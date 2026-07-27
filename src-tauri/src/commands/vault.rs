use tauri::State;

use crate::security::{encryption, SecretStore, SecurityError};

/// Encrypts an arbitrary string for local-only storage (e.g. a
/// sensitive SQLite cache payload, TASK-0.5). Returns opaque base64
/// ciphertext; the data-encryption key never leaves the native side.
#[tauri::command]
pub fn encrypt_value(
    store: State<'_, Box<dyn SecretStore>>,
    value: String,
) -> Result<String, SecurityError> {
    encryption::encrypt_value(&**store, &value)
}

#[tauri::command]
pub fn decrypt_value(
    store: State<'_, Box<dyn SecretStore>>,
    value: String,
) -> Result<String, SecurityError> {
    encryption::decrypt_value(&**store, &value)
}
