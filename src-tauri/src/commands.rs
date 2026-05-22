use std::path::Path;
use std::process::Command;

use serde::Serialize;
use tauri::State;

use crate::downloads::{destination_for_source, download_source_to_file};
use crate::schema::{
    CatalogGameView, DownloadRecord, RepositorySchema, RepositorySummary, RequirementItem, RequirementsReport,
    SourceUri, TrustedExecutable,
};
use crate::security::{validate_repository_schema, validate_repository_url};
use crate::storage::RepositoryStore;
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchReport {
    pub pid: u32,
    pub executable: String,
    pub game_path: String,
}

#[tauri::command]
pub async fn connect_repository(url: String, state: State<'_, AppState>) -> Result<RepositorySummary, String> {
    let allow_dev_http = cfg!(debug_assertions);
    let parsed = validate_repository_url(&url, allow_dev_http)?;
    let response = reqwest::get(parsed)
        .await
        .map_err(|error| format!("Failed to fetch repository: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Repository returned an error: {error}"))?;
    let repo = response
        .json::<RepositorySchema>()
        .await
        .map_err(|error| format!("Repository JSON is invalid: {error}"))?;

    validate_repository_schema(&repo, allow_dev_http)?;

    let mut store = lock_store(&state)?;
    store.store_repository(&url, &repo)
}

#[tauri::command]
pub fn list_repositories(state: State<'_, AppState>) -> Result<Vec<RepositorySummary>, String> {
    lock_store(&state)?.list_repositories()
}

#[tauri::command]
pub fn disconnect_repository(repository_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    lock_store(&state)?.disconnect_repository(&repository_id)
}

#[tauri::command]
pub fn get_catalog(state: State<'_, AppState>) -> Result<Vec<CatalogGameView>, String> {
    lock_store(&state)?.get_catalog()
}

#[tauri::command]
pub fn get_game(game_id: String, state: State<'_, AppState>) -> Result<Option<CatalogGameView>, String> {
    lock_store(&state)?.get_game(&game_id)
}

#[tauri::command]
pub fn check_requirements(game_id: String, state: State<'_, AppState>) -> Result<RequirementsReport, String> {
    let store = lock_store(&state)?;
    let game = store.get_game(&game_id)?
        .ok_or_else(|| format!("Unknown game: {game_id}"))?;
    build_requirements_report(&store, &game)
}

#[tauri::command]
pub async fn download_asset(asset_id: String, state: State<'_, AppState>) -> Result<DownloadRecord, String> {
    let asset = {
        let store = lock_store(&state)?;
        store.get_asset(&asset_id)?
            .ok_or_else(|| format!("Unknown asset: {asset_id}"))?
    };

    let source = asset.sources.first()
        .ok_or_else(|| format!("Asset {} has no sources.", asset.display_name))?;
    let destination = destination_for_source(
        &state.data_dir.join("System"),
        &asset.platform,
        &asset.id,
        source,
        &asset.display_name,
    );

    match download_source_to_file(source, &destination).await {
        Ok(file) => {
            let local_path = file.path.to_string_lossy().to_string();
            lock_store(&state)?.record_download(
                &asset.id,
                "asset",
                Some(&local_path),
                Some(&file.sha256),
                None,
            )
        }
        Err(error) => {
            let _ = lock_store(&state)?.record_download(&asset.id, "asset", None, None, Some(&error));
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn download_game(game_id: String, state: State<'_, AppState>) -> Result<DownloadRecord, String> {
    let game = {
        let store = lock_store(&state)?;
        store.get_game(&game_id)?
            .ok_or_else(|| format!("Unknown game: {game_id}"))?
    };

    let source = game.downloads.first()
        .ok_or_else(|| format!("Game {} has no download sources.", game.title))?;
    let destination = destination_for_source(
        &state.data_dir.join("Games"),
        &game.platform,
        &game.id,
        source,
        &game.title,
    );

    match download_source_to_file(source, &destination).await {
        Ok(file) => {
            let local_path = file.path.to_string_lossy().to_string();
            lock_store(&state)?.record_download(
                &game.id,
                "game",
                Some(&local_path),
                Some(&file.sha256),
                None,
            )
        }
        Err(error) => {
            let _ = lock_store(&state)?.record_download(&game.id, "game", None, None, Some(&error));
            Err(error)
        }
    }
}

#[tauri::command]
pub fn trust_executable(asset_id: String, state: State<'_, AppState>) -> Result<TrustedExecutable, String> {
    let store = lock_store(&state)?;
    let asset = store.get_asset(&asset_id)?
        .ok_or_else(|| format!("Unknown asset: {asset_id}"))?;
    if !asset.executable {
        return Err(format!("Asset {} is not marked executable.", asset.display_name));
    }

    let download = store.get_download(&asset.id)?
        .ok_or_else(|| format!("Executable asset {} has not been downloaded.", asset.display_name))?;
    if download.status != "ready" {
        return Err(format!("Executable asset {} is not ready.", asset.display_name));
    }

    let local_path = download.local_path
        .ok_or_else(|| format!("Executable asset {} has no local path.", asset.display_name))?;
    let sha256 = download.sha256
        .ok_or_else(|| format!("Executable asset {} has no verified SHA-256.", asset.display_name))?;
    if !Path::new(&local_path).exists() {
        return Err(format!("Executable file is missing: {local_path}"));
    }

    store.trust_executable(&asset.id, &local_path, &sha256)
}

#[tauri::command]
pub fn launch_game(game_id: String, state: State<'_, AppState>) -> Result<LaunchReport, String> {
    let store = lock_store(&state)?;
    let game = store.get_game(&game_id)?
        .ok_or_else(|| format!("Unknown game: {game_id}"))?;
    let requirements = build_requirements_report(&store, &game)?;
    if !requirements.ready {
        return Err("Required system files are not ready or trusted.".to_string());
    }

    let game_download = store.get_download(&game.id)?
        .ok_or_else(|| format!("Game {} has not been downloaded.", game.title))?;
    if game_download.status != "ready" {
        return Err(format!("Game {} is not ready.", game.title));
    }
    let game_path = game_download.local_path
        .ok_or_else(|| format!("Game {} has no local path.", game.title))?;
    if !Path::new(&game_path).exists() {
        return Err(format!("Game file is missing: {game_path}"));
    }

    let executable_asset = requirements.requirements
        .iter()
        .find(|item| item.asset.executable)
        .ok_or_else(|| "No executable emulator asset is associated with this game.".to_string())?;
    let trusted = store.get_trusted_executable(&executable_asset.asset.id)?
        .ok_or_else(|| "Executable asset is not trusted.".to_string())?;
    if !Path::new(&trusted.local_path).exists() {
        return Err(format!("Trusted executable is missing: {}", trusted.local_path));
    }

    let mut command = Command::new(&trusted.local_path);
    command.arg(&game_path);
    if let Some(parent) = Path::new(&trusted.local_path).parent() {
        command.current_dir(parent);
    }
    let child = command
        .spawn()
        .map_err(|error| format!("Failed to launch executable: {error}"))?;

    Ok(LaunchReport {
        pid: child.id(),
        executable: trusted.local_path,
        game_path,
    })
}

fn build_requirements_report(store: &RepositoryStore, game: &CatalogGameView) -> Result<RequirementsReport, String> {
    let game_downloaded = store.get_download(&game.id)?
        .map(|download| download.status == "ready" && download.local_path.is_some())
        .unwrap_or(false);
    let assets = store.get_assets(&game.required_system_file_ids)?;
    let mut requirements = Vec::new();

    for asset in assets {
        let download = store.get_download(&asset.id)?;
        let trusted = store.get_trusted_executable(&asset.id)?;
        let downloaded = download.as_ref()
            .map(|record| record.status == "ready" && record.local_path.is_some())
            .unwrap_or(false);
        let trusted_ok = if asset.executable {
            trusted.is_some()
        } else {
            true
        };
        requirements.push(RequirementItem {
            asset,
            downloaded,
            trusted: trusted_ok,
            local_path: download.and_then(|record| record.local_path),
        });
    }

    let ready = game_downloaded && requirements.iter().all(|item| item.downloaded && item.trusted);
    Ok(RequirementsReport {
        game_id: game.id.clone(),
        ready,
        game_downloaded,
        requirements,
    })
}

fn lock_store<'a>(state: &'a State<'_, AppState>) -> Result<std::sync::MutexGuard<'a, RepositoryStore>, String> {
    state.store.lock().map_err(|_| "Repository store lock is poisoned.".to_string())
}

#[allow(dead_code)]
fn source_has_http(sources: &[SourceUri]) -> bool {
    sources.iter().any(|source| matches!(source, SourceUri::Http { .. }))
}
