fn main() {
    // Cargo reruns a build script only when a declared input changes. Without
    // these, replacing the icon set leaves the previously embedded Windows
    // resource in place and the window/taskbar keeps showing the old art even
    // though `icons/icon.ico` on disk is new.
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=tauri.conf.json");

    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "session_store",
            "session_load",
            "session_clear",
            "encrypt_value",
            "decrypt_value",
            "log_event",
            "workspace_document_read",
            "workspace_document_write",
        ]),
    ))
    .expect("failed to run tauri-build");
}
