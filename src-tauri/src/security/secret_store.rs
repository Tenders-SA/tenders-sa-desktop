#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::Mutex;

use super::error::SecurityError;

const SERVICE_NAME: &str = "com.tendersa.desktop";
const MAX_VALUE_LEN: usize = 8192;

/// Abstraction over OS-backed secure storage (SEC-2). Real usage goes
/// through [`OsKeychain`]; [`InMemorySecretStore`] exists only for unit
/// tests, which cannot rely on a running platform credential service.
pub trait SecretStore: Send + Sync {
    fn set(&self, key: &str, value: &str) -> Result<(), SecurityError>;
    fn get(&self, key: &str) -> Result<Option<String>, SecurityError>;
    fn delete(&self, key: &str) -> Result<(), SecurityError>;
}

fn validate_key(key: &str) -> Result<(), SecurityError> {
    if key.is_empty() || key.len() > 128 {
        return Err(SecurityError::InvalidArgument(
            "key must be 1-128 characters".into(),
        ));
    }
    Ok(())
}

fn validate_value(value: &str) -> Result<(), SecurityError> {
    if value.is_empty() || value.len() > MAX_VALUE_LEN {
        return Err(SecurityError::InvalidArgument(format!(
            "value must be 1-{MAX_VALUE_LEN} bytes"
        )));
    }
    Ok(())
}

/// Windows Credential Manager / macOS Keychain / Linux Secret Service,
/// selected automatically per platform by the `keyring` crate.
#[derive(Default)]
pub struct OsKeychain;

impl SecretStore for OsKeychain {
    fn set(&self, key: &str, value: &str) -> Result<(), SecurityError> {
        validate_key(key)?;
        validate_value(value)?;
        let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(SecurityError::from)?;
        entry.set_password(value).map_err(SecurityError::from)
    }

    fn get(&self, key: &str) -> Result<Option<String>, SecurityError> {
        validate_key(key)?;
        let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(SecurityError::from)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(SecurityError::from(error)),
        }
    }

    fn delete(&self, key: &str) -> Result<(), SecurityError> {
        validate_key(key)?;
        let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(SecurityError::from)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(SecurityError::from(error)),
        }
    }
}

/// Process-memory-only store used exclusively by unit tests.
#[cfg(test)]
#[derive(Default)]
pub struct InMemorySecretStore {
    values: Mutex<HashMap<String, String>>,
}

#[cfg(test)]
impl SecretStore for InMemorySecretStore {
    fn set(&self, key: &str, value: &str) -> Result<(), SecurityError> {
        validate_key(key)?;
        validate_value(value)?;
        self.values
            .lock()
            .expect("secret store mutex poisoned")
            .insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn get(&self, key: &str) -> Result<Option<String>, SecurityError> {
        validate_key(key)?;
        Ok(self
            .values
            .lock()
            .expect("secret store mutex poisoned")
            .get(key)
            .cloned())
    }

    fn delete(&self, key: &str) -> Result<(), SecurityError> {
        validate_key(key)?;
        self.values
            .lock()
            .expect("secret store mutex poisoned")
            .remove(key);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_a_value() {
        let store = InMemorySecretStore::default();
        store.set("access_token", "secret-value").unwrap();
        assert_eq!(
            store.get("access_token").unwrap(),
            Some("secret-value".to_string())
        );
        store.delete("access_token").unwrap();
        assert_eq!(store.get("access_token").unwrap(), None);
    }

    #[test]
    fn rejects_empty_key() {
        let store = InMemorySecretStore::default();
        let error = store.set("", "value").unwrap_err();
        assert!(matches!(error, SecurityError::InvalidArgument(_)));
    }

    #[test]
    fn rejects_empty_value() {
        let store = InMemorySecretStore::default();
        let error = store.set("key", "").unwrap_err();
        assert!(matches!(error, SecurityError::InvalidArgument(_)));
    }

    #[test]
    fn deleting_a_missing_key_is_not_an_error() {
        let store = InMemorySecretStore::default();
        store.delete("never-set").unwrap();
    }

    #[test]
    fn errors_never_contain_the_secret_value() {
        let store = InMemorySecretStore::default();
        let secret = "sk_live_super_secret_do_not_leak";
        let error = store.set("key", &"x".repeat(9000)).unwrap_err();
        let rendered = format!("{error:?} {error}");
        assert!(!rendered.contains(secret));
        assert!(!rendered.contains(&"x".repeat(9000)));
    }
}
