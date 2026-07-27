fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "session_store",
            "session_load",
            "session_clear",
            "encrypt_value",
            "decrypt_value",
        ]),
    ))
    .expect("failed to run tauri-build");
}
