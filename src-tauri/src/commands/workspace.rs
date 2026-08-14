use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn valid_owner(value: &str) -> bool {
    value.len() == 67
        && value.starts_with("v1-")
        && value[3..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn hex_id(value: &str) -> Result<String, String> {
    if value.is_empty() || value.len() > 512 {
        return Err("invalid workspace identifier".into());
    }
    Ok(value
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn document_path(
    app: &AppHandle,
    owner_id: &str,
    tender_id: &str,
    document_id: &str,
) -> Result<PathBuf, String> {
    if !valid_owner(owner_id) {
        return Err("invalid workspace owner".into());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "workspace directory unavailable".to_string())?;
    Ok(root
        .join("workspace")
        .join(owner_id)
        .join("documents")
        .join(hex_id(tender_id)?)
        .join(format!("{}.bin", hex_id(document_id)?)))
}

#[tauri::command]
pub fn workspace_document_read(
    app: AppHandle,
    owner_id: String,
    tender_id: String,
    document_id: String,
) -> Result<Option<Vec<u8>>, String> {
    let path = document_path(&app, &owner_id, &tender_id, &document_id)?;
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("cached document could not be read".into()),
    }
}

#[tauri::command]
pub fn workspace_document_write(
    app: AppHandle,
    owner_id: String,
    tender_id: String,
    document_id: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let path = document_path(&app, &owner_id, &tender_id, &document_id)?;
    let parent = path
        .parent()
        .ok_or_else(|| "workspace directory unavailable".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "workspace directory unavailable".to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes).map_err(|_| "cached document could not be written".to_string())?;
    replace_file(&temporary, &path)?;
    Ok(path.to_string_lossy().into_owned())
}

fn replace_file(temporary: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() {
        fs::remove_file(destination)
            .map_err(|_| "cached document could not be updated".to_string())?;
    }
    fs::rename(temporary, destination)
        .map_err(|_| "cached document could not be committed".to_string())
}

#[cfg(test)]
mod tests {
    use super::{hex_id, valid_owner};

    #[test]
    fn owner_is_hash_only() {
        assert!(valid_owner(&format!("v1-{}", "a".repeat(64))));
        assert!(!valid_owner("person@example.com"));
        assert!(!valid_owner("v1-../../account"));
    }

    #[test]
    fn entity_ids_are_encoded_not_used_as_paths() {
        let encoded = hex_id("../../other/account").unwrap();
        assert!(!encoded.contains('.'));
        assert!(!encoded.contains('/'));
        assert!(!encoded.contains('\\'));
    }
}
