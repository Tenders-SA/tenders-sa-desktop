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
        .manage(Box::new(OsKeychain) as Box<dyn SecretStore>)
        .invoke_handler(tauri::generate_handler![
            commands::session::session_store,
            commands::session::session_load,
            commands::session::session_clear,
            commands::vault::encrypt_value,
            commands::vault::decrypt_value,
            commands::log::log_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
