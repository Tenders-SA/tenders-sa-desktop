mod commands;
mod db;
mod observability;
mod security;

use security::{OsKeychain, SecretStore};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_URL, db::migrations())
                .build(),
        )
        // HTTP transport (TASK-2.2, REQ-A1). Requests execute in Rust, so browser
        // CORS does not apply -- which is the only reason the parent API is
        // reachable at all (auth-subscription-contract.md §6).
        //
        // The plugin grants NO origin by default; every reachable origin is listed
        // explicitly in `capabilities/default.json`. That allowlist is the security
        // boundary, and `capability-scope.test.ts` fails if it is widened.
        .plugin(tauri_plugin_http::init())
        // Save-dialog path for exports (Slice 6, R-Ex-3). The dialog plugin
        // extends the fs scope at runtime to exactly the path the user picks,
        // so no broad fs scope is granted in capabilities/default.json.
.plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Signed auto-updates (desktop-app-updater R-U3). The updater fetches
        // manifests and payloads in Rust with its own HTTP client, so no CSP
        // change and no `http:` allow-list widening was needed -- the webview
        // network stack is not involved. The public key in tauri.conf.json
        // verifies every downloaded payload; there is no unverified mode.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Relaunch after an update install (desktop-app-updater R-U7).
        // capabilities/default.json grants only `process:allow-restart`.
        .plugin(tauri_plugin_process::init())
        .manage(Box::new(OsKeychain) as Box<dyn SecretStore>)
        .invoke_handler(tauri::generate_handler![
            commands::session::session_store,
            commands::session::session_load,
            commands::session::session_clear,
            commands::vault::encrypt_value,
            commands::vault::decrypt_value,
            commands::log::log_event,
            commands::workspace::workspace_document_read,
            commands::workspace::workspace_document_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
