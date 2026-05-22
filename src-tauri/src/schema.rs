use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub schema_version: u8,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RepositorySchema {
    pub metadata: RepositoryMetadata,
    pub system_files: Vec<RepositoryAsset>,
    pub catalog: Vec<RepositoryGame>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SourceUri {
    Http {
        url: String,
        sha256: String,
        #[serde(rename = "sizeBytes")]
        size_bytes: Option<u64>,
    },
    Magnet {
        uri: String,
        #[serde(rename = "infoHash")]
        info_hash: Option<String>,
        #[serde(rename = "sizeBytes")]
        size_bytes: Option<u64>,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetKind {
    Emulator,
    Bios,
    Firmware,
    Keys,
    Patch,
    Runtime,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallTarget {
    AppSystem,
    EmulatorDir,
    UserSelected,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallHint {
    pub target: InstallTarget,
    pub relative_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryAsset {
    pub id: String,
    pub platform: String,
    pub asset_kind: AssetKind,
    pub display_name: String,
    pub sources: Vec<SourceUri>,
    pub install_hint: Option<InstallHint>,
    #[serde(default)]
    pub executable: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryGame {
    pub id: String,
    pub platform: String,
    pub title: String,
    pub description: Option<String>,
    pub cover_image_url: Option<String>,
    pub trailer_url: Option<String>,
    pub downloads: Vec<SourceUri>,
    #[serde(default)]
    pub required_system_file_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositorySummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub url: String,
    pub connected_at: String,
    pub catalog_count: usize,
    pub system_file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogGameView {
    pub id: String,
    pub source_id: String,
    pub repository_id: String,
    pub repository_name: String,
    pub platform: String,
    pub title: String,
    pub description: Option<String>,
    pub cover_image_url: Option<String>,
    pub trailer_url: Option<String>,
    pub downloads: Vec<SourceUri>,
    pub required_system_file_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetView {
    pub id: String,
    pub source_id: String,
    pub repository_id: String,
    pub platform: String,
    pub asset_kind: AssetKind,
    pub display_name: String,
    pub sources: Vec<SourceUri>,
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementItem {
    pub asset: AssetView,
    pub downloaded: bool,
    pub trusted: bool,
    pub local_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementsReport {
    pub game_id: String,
    pub ready: bool,
    pub game_downloaded: bool,
    pub requirements: Vec<RequirementItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRecord {
    pub subject_id: String,
    pub subject_type: String,
    pub status: String,
    pub local_path: Option<String>,
    pub sha256: Option<String>,
    pub message: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedExecutable {
    pub asset_id: String,
    pub local_path: String,
    pub sha256: String,
    pub trusted_at: String,
}
