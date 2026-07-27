mod commands;
mod db;
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
        .manage(Box::new(OsKeychain) as Box<dyn SecretStore>)
        .invoke_handler(tauri::generate_handler![
            commands::session::session_store,
            commands::session::session_load,
            commands::session::session_clear,
            commands::vault::encrypt_value,
            commands::vault::decrypt_value,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
