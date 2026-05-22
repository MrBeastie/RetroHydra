import { invoke } from '@tauri-apps/api/core';
import type {
  CatalogGame,
  DownloadRecord,
  RepositorySummary,
  RequirementsReport,
  TrustedExecutable
} from '@/types/repository';

const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error('RetroHydra desktop bridge is unavailable. Start the app through Tauri.');
  }

  return invoke<T>(command, args);
}

export const api = {
  connectRepository(url: string) {
    return call<RepositorySummary>('connect_repository', { url });
  },
  listRepositories() {
    return call<RepositorySummary[]>('list_repositories');
  },
  disconnectRepository(repositoryId: string) {
    return call<boolean>('disconnect_repository', { repositoryId });
  },
  getCatalog() {
    return call<CatalogGame[]>('get_catalog');
  },
  getGame(gameId: string) {
    return call<CatalogGame | null>('get_game', { gameId });
  },
  checkRequirements(gameId: string) {
    return call<RequirementsReport>('check_requirements', { gameId });
  },
  downloadAsset(assetId: string) {
    return call<DownloadRecord>('download_asset', { assetId });
  },
  downloadGame(gameId: string) {
    return call<DownloadRecord>('download_game', { gameId });
  },
  trustExecutable(assetId: string) {
    return call<TrustedExecutable>('trust_executable', { assetId });
  },
  launchGame(gameId: string) {
    return call<{ pid: number; executable: string; gamePath: string }>('launch_game', { gameId });
  }
};
