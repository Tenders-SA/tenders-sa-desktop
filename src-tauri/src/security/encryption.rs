use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

use super::error::SecurityError;
use super::secret_store::SecretStore;

/// Name of the secure-storage entry holding the local data-encryption
/// key. The key itself is generated on first use and never leaves the
/// native side; only ciphertext (base64) crosses the IPC boundary.
const DATA_KEY_NAME: &str = "local_data_encryption_key";
const NONCE_LEN: usize = 12;

fn load_or_create_key(store: &dyn SecretStore) -> Result<Aes256Gcm, SecurityError> {
    let encoded = match store.get(DATA_KEY_NAME)? {
        Some(existing) => existing,
        None => {
            let key = Aes256Gcm::generate_key(OsRng);
            let encoded = STANDARD.encode(key);
            store.set(DATA_KEY_NAME, &encoded)?;
            encoded
        }
    };
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| SecurityError::CryptoFailure)?;
    let key = Key::<Aes256Gcm>::from_slice(&bytes);
    Ok(Aes256Gcm::new(key))
}

/// Encrypts an arbitrary string with the local data-encryption key.
/// Used by higher layers (e.g. the SQLite cache, TASK-0.5) to store
/// sensitive workspace payloads at rest without exposing key material
/// to the webview.
pub fn encrypt_value(store: &dyn SecretStore, plaintext: &str) -> Result<String, SecurityError> {
    if plaintext.is_empty() {
        return Err(SecurityError::InvalidArgument(
            "value must not be empty".into(),
        ));
    }
    let cipher = load_or_create_key(store)?;
    let nonce = Aes256Gcm::generate_nonce(OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|_| SecurityError::CryptoFailure)?;

    let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&ciphertext);
    Ok(STANDARD.encode(payload))
}

pub fn decrypt_value(store: &dyn SecretStore, encoded: &str) -> Result<String, SecurityError> {
    if encoded.is_empty() {
        return Err(SecurityError::InvalidArgument(
            "value must not be empty".into(),
        ));
    }
    let cipher = load_or_create_key(store)?;
    let payload = STANDARD
        .decode(encoded)
        .map_err(|_| SecurityError::InvalidArgument("value must be valid base64".into()))?;
    if payload.len() <= NONCE_LEN {
        return Err(SecurityError::InvalidArgument(
            "value is too short to be valid ciphertext".into(),
        ));
    }
    let (nonce_bytes, ciphertext) = payload.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| SecurityError::CryptoFailure)?;
    String::from_utf8(plaintext).map_err(|_| SecurityError::CryptoFailure)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::secret_store::InMemorySecretStore;

    #[test]
    fn round_trips_a_value() {
        let store = InMemorySecretStore::default();
        let ciphertext = encrypt_value(&store, "hello procurement world").unwrap();
        assert_ne!(ciphertext, "hello procurement world");
        let plaintext = decrypt_value(&store, &ciphertext).unwrap();
        assert_eq!(plaintext, "hello procurement world");
    }

    #[test]
    fn distinct_ciphertexts_for_the_same_plaintext() {
        let store = InMemorySecretStore::default();
        let a = encrypt_value(&store, "same value").unwrap();
        let b = encrypt_value(&store, "same value").unwrap();
        assert_ne!(a, b, "nonces must differ between encryptions");
    }

    #[test]
    fn rejects_tampered_ciphertext() {
        let store = InMemorySecretStore::default();
        let mut ciphertext = encrypt_value(&store, "sensitive data").unwrap();
        ciphertext.push('A');
        assert!(decrypt_value(&store, &ciphertext).is_err());
    }

    #[test]
    fn plaintext_never_appears_in_a_failed_decrypt_error() {
        let store = InMemorySecretStore::default();
        let secret = "top-secret-pricing-value";
        let ciphertext = encrypt_value(&store, secret).unwrap();
        let corrupted = format!("{}A", &ciphertext[..ciphertext.len() - 1]);
        let error = decrypt_value(&store, &corrupted).unwrap_err();
        let rendered = format!("{error:?} {error}");
        assert!(!rendered.contains(secret));
    }
}
