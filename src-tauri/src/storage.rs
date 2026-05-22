use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

use crate::schema::{
    AssetView, CatalogGameView, DownloadRecord, RepositorySchema, RepositorySummary, TrustedExecutable,
};
use crate::security::global_id;

pub struct RepositoryStore {
    conn: Connection,
}

impl RepositoryStore {
    pub fn open(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
        let store = Self { conn };
        store.initialize().map_err(|error| error.to_string())?;
        Ok(store)
    }

    fn initialize(&self) -> rusqlite::Result<()> {
        self.conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS repositories (
              id TEXT PRIMARY KEY,
              url TEXT NOT NULL,
              name TEXT NOT NULL,
              version TEXT NOT NULL,
              schema_version INTEGER NOT NULL,
              updated_at TEXT,
              connected_at TEXT NOT NULL,
              raw_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS repository_assets (
              id TEXT PRIMARY KEY,
              source_id TEXT NOT NULL,
              repository_id TEXT NOT NULL,
              platform TEXT NOT NULL,
              asset_kind TEXT NOT NULL,
              display_name TEXT NOT NULL,
              sources_json TEXT NOT NULL,
              install_hint_json TEXT,
              executable INTEGER NOT NULL DEFAULT 0,
              FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS catalog_games (
              id TEXT PRIMARY KEY,
              source_id TEXT NOT NULL,
              repository_id TEXT NOT NULL,
              platform TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              cover_image_url TEXT,
              trailer_url TEXT,
              downloads_json TEXT NOT NULL,
              required_system_file_ids_json TEXT NOT NULL,
              FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS downloads (
              subject_id TEXT PRIMARY KEY,
              subject_type TEXT NOT NULL CHECK (subject_type IN ('asset', 'game')),
              status TEXT NOT NULL CHECK (status IN ('ready', 'error')),
              local_path TEXT,
              sha256 TEXT,
              message TEXT,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS trusted_executables (
              asset_id TEXT PRIMARY KEY,
              local_path TEXT NOT NULL,
              sha256 TEXT NOT NULL,
              trusted_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_assets_repository ON repository_assets(repository_id);
            CREATE INDEX IF NOT EXISTS idx_games_repository ON catalog_games(repository_id);
            "#
        )
    }

    pub fn store_repository(&mut self, url: &str, repo: &RepositorySchema) -> Result<RepositorySummary, String> {
        let tx = self.conn.transaction().map_err(|error| error.to_string())?;
        let now = Utc::now().to_rfc3339();
        let raw_json = serde_json::to_string(repo).map_err(|error| error.to_string())?;

        tx.execute(
            "DELETE FROM downloads WHERE subject_id IN (
                SELECT id FROM repository_assets WHERE repository_id = ?1
                UNION
                SELECT id FROM catalog_games WHERE repository_id = ?1
            )",
            params![repo.metadata.id],
        ).map_err(|error| error.to_string())?;
        tx.execute(
            "DELETE FROM trusted_executables WHERE asset_id IN (
                SELECT id FROM repository_assets WHERE repository_id = ?1
            )",
            params![repo.metadata.id],
        ).map_err(|error| error.to_string())?;
        tx.execute("DELETE FROM repository_assets WHERE repository_id = ?1", params![repo.metadata.id])
            .map_err(|error| error.to_string())?;
        tx.execute("DELETE FROM catalog_games WHERE repository_id = ?1", params![repo.metadata.id])
            .map_err(|error| error.to_string())?;

        tx.execute(
            r#"
            INSERT INTO repositories (id, url, name, version, schema_version, updated_at, connected_at, raw_json)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
              url = excluded.url,
              name = excluded.name,
              version = excluded.version,
              schema_version = excluded.schema_version,
              updated_at = excluded.updated_at,
              connected_at = excluded.connected_at,
              raw_json = excluded.raw_json
            "#,
            params![
                repo.metadata.id,
                url,
                repo.metadata.name,
                repo.metadata.version,
                repo.metadata.schema_version,
                repo.metadata.updated_at,
                now,
                raw_json
            ],
        ).map_err(|error| error.to_string())?;

        for asset in &repo.system_files {
            let storage_id = global_id(&repo.metadata.id, &asset.id);
            let asset_kind = serde_json::to_string(&asset.asset_kind)
                .map_err(|error| error.to_string())?
                .trim_matches('"')
                .to_string();
            tx.execute(
                r#"
                INSERT INTO repository_assets (
                  id, source_id, repository_id, platform, asset_kind, display_name,
                  sources_json, install_hint_json, executable
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    storage_id,
                    asset.id,
                    repo.metadata.id,
                    asset.platform,
                    asset_kind,
                    asset.display_name,
                    serde_json::to_string(&asset.sources).map_err(|error| error.to_string())?,
                    serde_json::to_string(&asset.install_hint).map_err(|error| error.to_string())?,
                    if asset.executable { 1_i64 } else { 0_i64 }
                ],
            ).map_err(|error| error.to_string())?;
        }

        for game in &repo.catalog {
            let storage_id = global_id(&repo.metadata.id, &game.id);
            let required = game.required_system_file_ids
                .iter()
                .map(|asset_id| global_id(&repo.metadata.id, asset_id))
                .collect::<Vec<_>>();
            tx.execute(
                r#"
                INSERT INTO catalog_games (
                  id, source_id, repository_id, platform, title, description, cover_image_url,
                  trailer_url, downloads_json, required_system_file_ids_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    storage_id,
                    game.id,
                    repo.metadata.id,
                    game.platform,
                    game.title,
                    game.description,
                    game.cover_image_url,
                    game.trailer_url,
                    serde_json::to_string(&game.downloads).map_err(|error| error.to_string())?,
                    serde_json::to_string(&required).map_err(|error| error.to_string())?
                ],
            ).map_err(|error| error.to_string())?;
        }

        tx.commit().map_err(|error| error.to_string())?;
        self.get_repository_summary(&repo.metadata.id)?
            .ok_or_else(|| "Repository was stored but could not be read back.".to_string())
    }

    pub fn list_repositories(&self) -> Result<Vec<RepositorySummary>, String> {
        let mut statement = self.conn.prepare(
            r#"
            SELECT
              r.id, r.name, r.version, r.url, r.connected_at,
              COUNT(DISTINCT g.id) AS catalog_count,
              COUNT(DISTINCT a.id) AS system_file_count
            FROM repositories r
            LEFT JOIN catalog_games g ON g.repository_id = r.id
            LEFT JOIN repository_assets a ON a.repository_id = r.id
            GROUP BY r.id
            ORDER BY r.connected_at DESC
            "#
        ).map_err(|error| error.to_string())?;

        let rows = statement.query_map([], |row| {
            Ok(RepositorySummary {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                url: row.get(3)?,
                connected_at: row.get(4)?,
                catalog_count: row.get::<_, i64>(5)? as usize,
                system_file_count: row.get::<_, i64>(6)? as usize,
            })
        }).map_err(|error| error.to_string())?;

        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|error| error.to_string())
    }

    pub fn disconnect_repository(&self, repository_id: &str) -> Result<bool, String> {
        let changed = self.conn.execute("DELETE FROM repositories WHERE id = ?1", params![repository_id])
            .map_err(|error| error.to_string())?;
        Ok(changed > 0)
    }

    pub fn get_catalog(&self) -> Result<Vec<CatalogGameView>, String> {
        let mut statement = self.conn.prepare(
            r#"
            SELECT
              g.id, g.source_id, g.repository_id, r.name, g.platform, g.title, g.description,
              g.cover_image_url, g.trailer_url, g.downloads_json, g.required_system_file_ids_json
            FROM catalog_games g
            JOIN repositories r ON r.id = g.repository_id
            ORDER BY r.name, g.title
            "#
        ).map_err(|error| error.to_string())?;

        let rows = statement.query_map([], map_game_row).map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|error| error.to_string())
    }

    pub fn get_game(&self, game_id: &str) -> Result<Option<CatalogGameView>, String> {
        self.conn.query_row(
            r#"
            SELECT
              g.id, g.source_id, g.repository_id, r.name, g.platform, g.title, g.description,
              g.cover_image_url, g.trailer_url, g.downloads_json, g.required_system_file_ids_json
            FROM catalog_games g
            JOIN repositories r ON r.id = g.repository_id
            WHERE g.id = ?1
            "#,
            params![game_id],
            map_game_row,
        ).optional().map_err(|error| error.to_string())
    }

    pub fn get_asset(&self, asset_id: &str) -> Result<Option<AssetView>, String> {
        self.conn.query_row(
            r#"
            SELECT id, source_id, repository_id, platform, asset_kind, display_name, sources_json, executable
            FROM repository_assets
            WHERE id = ?1
            "#,
            params![asset_id],
            map_asset_row,
        ).optional().map_err(|error| error.to_string())
    }

    pub fn get_assets(&self, asset_ids: &[String]) -> Result<Vec<AssetView>, String> {
        let mut assets = Vec::new();
        for asset_id in asset_ids {
            if let Some(asset) = self.get_asset(asset_id)? {
                assets.push(asset);
            }
        }
        Ok(assets)
    }

    pub fn get_download(&self, subject_id: &str) -> Result<Option<DownloadRecord>, String> {
        self.conn.query_row(
            r#"
            SELECT subject_id, subject_type, status, local_path, sha256, message, updated_at
            FROM downloads
            WHERE subject_id = ?1
            "#,
            params![subject_id],
            |row| Ok(DownloadRecord {
                subject_id: row.get(0)?,
                subject_type: row.get(1)?,
                status: row.get(2)?,
                local_path: row.get(3)?,
                sha256: row.get(4)?,
                message: row.get(5)?,
                updated_at: row.get(6)?,
            }),
        ).optional().map_err(|error| error.to_string())
    }

    pub fn record_download(
        &self,
        subject_id: &str,
        subject_type: &str,
        local_path: Option<&str>,
        sha256: Option<&str>,
        message: Option<&str>,
    ) -> Result<DownloadRecord, String> {
        let now = Utc::now().to_rfc3339();
        let status = if message.is_some() { "error" } else { "ready" };
        self.conn.execute(
            r#"
            INSERT INTO downloads (subject_id, subject_type, status, local_path, sha256, message, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(subject_id) DO UPDATE SET
              subject_type = excluded.subject_type,
              status = excluded.status,
              local_path = excluded.local_path,
              sha256 = excluded.sha256,
              message = excluded.message,
              updated_at = excluded.updated_at
            "#,
            params![subject_id, subject_type, status, local_path, sha256, message, now],
        ).map_err(|error| error.to_string())?;

        self.get_download(subject_id)?
            .ok_or_else(|| "Download record was not persisted.".to_string())
    }

    pub fn trust_executable(&self, asset_id: &str, local_path: &str, sha256: &str) -> Result<TrustedExecutable, String> {
        let trusted_at = Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO trusted_executables (asset_id, local_path, sha256, trusted_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(asset_id) DO UPDATE SET
              local_path = excluded.local_path,
              sha256 = excluded.sha256,
              trusted_at = excluded.trusted_at
            "#,
            params![asset_id, local_path, sha256, trusted_at],
        ).map_err(|error| error.to_string())?;

        self.get_trusted_executable(asset_id)?
            .ok_or_else(|| "Trusted executable was not persisted.".to_string())
    }

    pub fn get_trusted_executable(&self, asset_id: &str) -> Result<Option<TrustedExecutable>, String> {
        self.conn.query_row(
            r#"
            SELECT asset_id, local_path, sha256, trusted_at
            FROM trusted_executables
            WHERE asset_id = ?1
            "#,
            params![asset_id],
            |row| Ok(TrustedExecutable {
                asset_id: row.get(0)?,
                local_path: row.get(1)?,
                sha256: row.get(2)?,
                trusted_at: row.get(3)?,
            }),
        ).optional().map_err(|error| error.to_string())
    }

    fn get_repository_summary(&self, repository_id: &str) -> Result<Option<RepositorySummary>, String> {
        self.conn.query_row(
            r#"
            SELECT
              r.id, r.name, r.version, r.url, r.connected_at,
              COUNT(DISTINCT g.id) AS catalog_count,
              COUNT(DISTINCT a.id) AS system_file_count
            FROM repositories r
            LEFT JOIN catalog_games g ON g.repository_id = r.id
            LEFT JOIN repository_assets a ON a.repository_id = r.id
            WHERE r.id = ?1
            GROUP BY r.id
            "#,
            params![repository_id],
            |row| Ok(RepositorySummary {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                url: row.get(3)?,
                connected_at: row.get(4)?,
                catalog_count: row.get::<_, i64>(5)? as usize,
                system_file_count: row.get::<_, i64>(6)? as usize,
            }),
        ).optional().map_err(|error| error.to_string())
    }
}

fn map_game_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CatalogGameView> {
    let downloads_json: String = row.get(9)?;
    let required_json: String = row.get(10)?;
    Ok(CatalogGameView {
        id: row.get(0)?,
        source_id: row.get(1)?,
        repository_id: row.get(2)?,
        repository_name: row.get(3)?,
        platform: row.get(4)?,
        title: row.get(5)?,
        description: row.get(6)?,
        cover_image_url: row.get(7)?,
        trailer_url: row.get(8)?,
        downloads: serde_json::from_str(&downloads_json).unwrap_or_default(),
        required_system_file_ids: serde_json::from_str(&required_json).unwrap_or_default(),
    })
}

fn map_asset_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AssetView> {
    let asset_kind_json = format!("\"{}\"", row.get::<_, String>(4)?);
    let sources_json: String = row.get(6)?;
    Ok(AssetView {
        id: row.get(0)?,
        source_id: row.get(1)?,
        repository_id: row.get(2)?,
        platform: row.get(3)?,
        asset_kind: serde_json::from_str(&asset_kind_json).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(error))
        })?,
        display_name: row.get(5)?,
        sources: serde_json::from_str(&sources_json).unwrap_or_default(),
        executable: row.get::<_, i64>(7)? == 1,
    })
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;
    use crate::schema::{AssetKind, RepositoryMetadata, SourceUri};

    fn test_repo() -> RepositorySchema {
        RepositorySchema {
            metadata: RepositoryMetadata {
                id: "repo".to_string(),
                name: "Repo".to_string(),
                version: "1".to_string(),
                schema_version: 1,
                updated_at: None,
            },
            system_files: vec![RepositoryAsset {
                id: "emu".to_string(),
                platform: "nes".to_string(),
                asset_kind: AssetKind::Emulator,
                display_name: "Emulator".to_string(),
                sources: vec![SourceUri::Http {
                    url: "https://example.com/emulator.zip".to_string(),
                    sha256: "a".repeat(64),
                    size_bytes: None,
                }],
                install_hint: None,
                executable: true,
            }],
            catalog: vec![RepositoryGame {
                id: "game".to_string(),
                platform: "nes".to_string(),
                title: "Game".to_string(),
                description: None,
                cover_image_url: None,
                trailer_url: None,
                downloads: vec![SourceUri::Magnet {
                    uri: "magnet:?xt=urn:btih:abc".to_string(),
                    info_hash: None,
                    size_bytes: None,
                }],
                required_system_file_ids: vec!["emu".to_string()],
            }],
        }
    }

    #[test]
    fn stores_and_reads_repository_catalog() {
        let dir = tempdir().unwrap();
        let mut store = RepositoryStore::open(&dir.path().join("retrohydra.db")).unwrap();
        let summary = store.store_repository("https://example.com/index.json", &test_repo()).unwrap();

        assert_eq!(summary.catalog_count, 1);
        assert_eq!(summary.system_file_count, 1);
        assert_eq!(store.list_repositories().unwrap().len(), 1);
        assert_eq!(store.get_catalog().unwrap()[0].required_system_file_ids[0], "repo::emu");
    }
}
