use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;

mod commands;
mod downloads;
mod schema;
mod security;
mod storage;

use storage::RepositoryStore;

pub struct AppState {
    pub store: Mutex<RepositoryStore>,
    pub data_dir: PathBuf,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| setup_error(error.to_string()))?;
            std::fs::create_dir_all(&data_dir)
                .map_err(|error| setup_error(error.to_string()))?;
            let store = RepositoryStore::open(&data_dir.join("retrohydra.db"))
                .map_err(setup_error)?;

            app.manage(AppState {
                store: Mutex::new(store),
                data_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect_repository,
            commands::list_repositories,
            commands::disconnect_repository,
            commands::get_catalog,
            commands::get_game,
            commands::check_requirements,
            commands::download_asset,
            commands::download_game,
            commands::trust_executable,
            commands::launch_game
        ])
        .run(tauri::generate_context!())
        .expect("failed to run RetroHydra");
}

fn setup_error(message: String) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, message)
}
