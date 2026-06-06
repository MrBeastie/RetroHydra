import type {
  CatalogGame,
  DiagnosticsBundle,
  DiagnosticsPaths,
  DownloadRecord,
  EmulatorConfig,
  GameSetupState,
  GameDownloadStartReport,
  HealthReport,
  ImportAssetFileReport,
  ImportGameFileReport,
  LaunchReport,
  LibraryGameStatus,
  OnboardingState,
  PlatformSetupProfile,
  ProfileEmulatorConfig,
  RecommendedEmulator,
  RepairLibraryReport,
  RepositoryPreview,
  RepositorySummary,
  RequirementsReport,
  TorrentDownloadRecord,
  TorrentStartReport,
  TorrentStatus,
  TrustedExecutable,
  UpdateCheckReport
} from '../types/repository.ts';
import type {
  EmulatorInstallResult,
  EmulatorStatus,
  InstallResult
} from '../types/emulatorProfile.ts';
import type { Platform } from '../types/platform.ts';
import {
  PLATFORM_SETUP_PROFILES,
  getDefaultPlatformSetupProfile,
  getPlatformSetupProfile
} from './setupProfiles.ts';

const now = '2026-05-26T08:00:00.000Z';

const repository: RepositorySummary = {
  id: 'retrohydra-preview',
  name: 'RetroHydra Preview Repository',
  version: '1.0.0',
  url: 'preview://retrohydra',
  connectedAt: now,
  catalogCount: 13,
  systemFileCount: 3,
  maintainer: 'RetroHydra Team',
  homepageUrl: 'https://retrohydra.local',
  license: 'Mixed legal homebrew/demo content',
  trustLevel: 'official',
  contentHash: '0'.repeat(64),
  lastRefreshedAt: now,
  hasExecutableAssets: false
};

const catalog: CatalogGame[] = [
  game(
    'retrohydra_nes_smoke',
    'nes',
    'RetroHydra NES Smoke Demo',
    'First-party NES smoke demo for the one-click setup path.',
    ['.nes'],
    [{ kind: 'bundled', path: 'demo-content/retrohydra-smoke.nes', sha256: '9'.repeat(64), sizeBytes: 24592 }],
    { setupProfileId: 'nes-mesen' }
  ),
  game('crystal-caverns', 'gba', 'Crystal Caverns DX', 'A fast homebrew platformer tuned for short sessions.', ['.gba'], undefined, {
    artwork: {
      cover: 'https://example.com/retrohydra/showcase/crystal-caverns-cover.jpg',
      hero: 'https://example.com/retrohydra/showcase/crystal-caverns-hero.jpg'
    },
    metadata: {
      releaseYear: 2026,
      developer: 'RetroHydra Labs',
      genres: ['Platformer', 'Homebrew'],
      players: '1 player'
    }
  }),
  game('neon-rally', 'psp', 'Neon Rally Portable', 'Arcade racing with synthetic night tracks and drift challenges.', ['.iso']),
  game('star-orbit', 'switch', 'Star Orbit Prototype', 'A community tech demo for testing modern handheld workflows.', ['.nsp', '.xci'], [
    { kind: 'user_provided', instructions: 'Import your locally built or legally dumped .nsp/.xci package.' }
  ], {
    contentMode: 'user_provided',
    setupProfileId: 'switch-manual',
    artwork: {
      cover: 'https://example.com/retrohydra/showcase/star-orbit-cover.jpg',
      hero: 'https://example.com/retrohydra/showcase/star-orbit-hero.jpg',
      logo: 'https://example.com/retrohydra/showcase/star-orbit-logo.png'
    },
    metadata: {
      releaseYear: 2026,
      developer: 'North Pier Interactive',
      publisher: 'Community Preview',
      genres: ['Adventure', 'Tech Demo'],
      tags: ['user-provided', 'modern-console'],
      players: '1 player',
      series: 'Star Orbit'
    }
  }),
  game('midnight-pinball', 'ps1', 'Midnight Pinball Club', 'Table physics, neon bumpers, and quick-score runs.', ['.cue', '.bin']),
  game('skyline-runner', 'dreamcast', 'Skyline Runner', 'A compact futuristic runner for launcher smoke tests.', ['.gdi', '.cdi']),
  game('forest-quest', 'snes', 'Forest Quest Recut', '16-bit adventure pacing with a warm pixel palette.', ['.sfc']),
  game('byte-brawlers', 'n64', 'Byte Brawlers Arena', 'Local arena chaos with chunky prototype characters.', ['.z64']),
  game('lunar-keys', 'nds', 'Lunar Keys', 'Puzzle rooms and touch-friendly menu checks.', ['.nds']),
  game('signal-echo', 'ps2', 'Signal Echo Trial', 'Atmospheric test package for large-disc workflows.', ['.iso']),
  game('terra-pico', 'nes', 'Terra Pico', 'Minimal mapper-friendly demo entry.', ['.nes']),
  game('orbit-garden', 'gamecube', 'Orbit Garden', 'A tiny world tour used for metadata rows.', ['.rvz', '.iso']),
  game('copper-line', 'genesis', 'Copper Line', 'A bright scrolling test ROM with punchy status art.', ['.md'])
];

let downloads: TorrentDownloadRecord[] = [
  torrent('crystal-caverns', 'completed', 100, 46_000_000, 46_000_000, 0, 0, null),
  torrent('neon-rally', 'downloading', 68, 2_400_000_000, 3_500_000_000, 12_000_000, 7, null),
  torrent('byte-brawlers', 'paused', 42, 310_000_000, 720_000_000, 0, 4, null),
  torrent('signal-echo', 'error', 18, 1_600_000_000, 8_900_000_000, 0, 0, 'No peers were found for this magnet.')
];

let emulatorConfigs: EmulatorConfig[] = [];
let profileEmulatorConfigs: ProfileEmulatorConfig[] = [];
let profileSystemFileImports: Record<string, string> = {};
let downloadRoot = 'preview://games';

export const previewApi = {
  async previewRepository(url = repository.url): Promise<RepositoryPreview> {
    return {
      url,
      id: repository.id,
      name: repository.name,
      version: repository.version,
      maintainer: repository.maintainer,
      homepageUrl: repository.homepageUrl,
      license: repository.license,
      trustLevel: repository.trustLevel,
      catalogCount: repository.catalogCount,
      systemFileCount: repository.systemFileCount,
      hasExecutableAssets: repository.hasExecutableAssets,
      contentHash: repository.contentHash ?? '0'.repeat(64)
    };
  },
  async previewRepositoryFile(path: string): Promise<RepositoryPreview> {
    return previewApi.previewRepository(path ? `file://${path}` : 'file://preview/repository.json');
  },
  async previewBuiltInDemoRepository(): Promise<RepositoryPreview> {
    return previewApi.previewRepository('retrohydra://builtin/demo-repository.json');
  },
  async connectRepository(_url = repository.url): Promise<RepositorySummary> {
    return repository;
  },
  async connectRepositoryFile(path: string): Promise<RepositorySummary> {
    return {
      ...repository,
      url: path ? `file://${path}` : 'file://preview/repository.json'
    };
  },
  async connectBuiltInDemoRepository(): Promise<RepositorySummary> {
    return {
      ...repository,
      url: 'retrohydra://builtin/demo-repository.json'
    };
  },
  async refreshRepository(_repositoryId = repository.id): Promise<RepositorySummary> {
    return { ...repository, lastRefreshedAt: new Date().toISOString() };
  },
  async repairLibrary(): Promise<RepairLibraryReport> {
    return { repaired: false, repositoryId: null, removedPaths: [] };
  },
  async getOnboardingState(): Promise<OnboardingState> {
    return {
      step: emulatorConfigs.length > 0 ? 'complete' : 'configureEmulator',
      repositoriesConfigured: true,
      emulatorsConfigured: emulatorConfigs.length > 0,
      catalogCount: catalog.length,
      validEmulatorCount: emulatorConfigs.filter((config) => config.status === 'valid').length
    };
  },
  async listRepositories(): Promise<RepositorySummary[]> {
    return [repository];
  },
  async disconnectRepository(_repositoryId = repository.id): Promise<boolean> {
    return true;
  },
  async getCatalog(): Promise<CatalogGame[]> {
    return catalog;
  },
  async getGame(gameId: string): Promise<CatalogGame | null> {
    return catalog.find((item) => item.id === gameId) ?? null;
  },
  async checkRequirements(gameId: string): Promise<RequirementsReport> {
    const setup = await previewApi.getGameSetupState(gameId);
    return {
      gameId,
      ready: setup.launch.status === 'ready',
      gameDownloaded: setup.gameFile.status === 'ready',
      requirements: setup.repositoryRequirements
    };
  },
  async getLibraryStatuses(): Promise<LibraryGameStatus[]> {
    return catalog.map((item) => {
      const download = downloads.find((record) => record.gameId === item.id) ?? null;
      const installed = download?.status === 'completed';
      const emulatorReady = emulatorConfigs.some((config) => (
        config.platform === item.platform && config.status === 'valid'
      ));
      const missingRequirements = installed && !emulatorReady ? [`Configure ${item.platform.toUpperCase()} emulator`] : [];

      return {
        gameId: item.id,
        installed,
        systemRequirementsReady: missingRequirements.length === 0,
        missingRequirements,
        download
      };
    });
  },
  async listPlatformSetupProfiles(): Promise<PlatformSetupProfile[]> {
    return PLATFORM_SETUP_PROFILES;
  },
  async getGameSetupState(gameId: string): Promise<GameSetupState> {
    const game = catalog.find((item) => item.id === gameId);
    if (!game) throw new Error(`Unknown preview game: ${gameId}`);
    return buildPreviewGameSetupState(game);
  },
  async installGame(gameId: string): Promise<InstallResult> {
    const game = catalog.find((item) => item.id === gameId);
    if (!game) {
      return { gameId, status: 'error', errorCode: 'unknown_game', message: `Unknown preview game: ${gameId}` };
    }
    const emulator = await previewApi.getEmulatorStatus(game.platform);
    if (!emulator.installed) {
      if (game.platform === 'switch') {
        return {
          gameId,
          status: 'error',
          errorCode: 'switch_emulator_not_configured',
          message: 'Select a Switch emulator executable before installing this game.'
        };
      }
      await previewApi.installEmulator(game.platform);
    }
    let setup = await previewApi.getGameSetupState(gameId);
    const missingSystemFiles = setup.systemFiles
      .filter((item) => item.required && item.status !== 'ready')
      .map((item) => item.id);
    if (missingSystemFiles.length > 0) {
      return {
        gameId,
        status: 'needs_system_files',
        errorCode: `missing:${missingSystemFiles.join(',')}`,
        message: `Import once to continue: ${missingSystemFiles.join(', ')}`
      };
    }
    if (setup.gameFile.status !== 'ready') {
      if (isUserProvidedGame(game) || game.contentMode === 'metadata_only') {
        return {
          gameId,
          status: 'error',
          errorCode: 'game_requires_import',
          message: 'Import your local game file to continue.'
        };
      }
      await previewApi.startGameDownload(gameId);
      setup = await previewApi.getGameSetupState(gameId);
    }
    if (setup.launch.status !== 'ready') {
      return {
        gameId,
        status: 'error',
        errorCode: 'launch_not_ready',
        message: setup.launch.blockers.join('; ')
      };
    }
    return { gameId, status: 'ready', errorCode: null, message: null };
  },
  async installEmulator(platform: string): Promise<EmulatorInstallResult> {
    if (platform === 'switch') {
      throw new Error('switch_emulator_not_configured: Select a Switch emulator executable.');
    }
    const profile = getDefaultPlatformSetupProfile(platform);
    if (!profile || profile.emulator.installMode !== 'downloadable') {
      throw new Error(`no_profile_for:${platform}`);
    }
    const existing = emulatorConfigs.find((item) => item.platform === platform && item.status === 'valid');
    if (existing?.exePath) {
      return {
        profileId: profile.id,
        exePath: existing.exePath,
        version: existing.version ?? 'installed',
        fromCache: true
      };
    }
    const exePath = `preview://emulators/${platform}/${profile.emulator.executableName ?? `${platform}.exe`}`;
    const version = 'latest';
    await previewApi.saveEmulatorConfig(platform, exePath, profile.launch.argsTemplate);
    await previewApi.selectProfileEmulator(profile.id, exePath);
    return { profileId: profile.id, exePath, version, fromCache: false };
  },
  async getEmulatorStatus(platform: string): Promise<EmulatorStatus> {
    const profile = getDefaultPlatformSetupProfile(platform);
    const config = emulatorConfigs.find((item) => item.platform === platform && item.status === 'valid');
    return {
      platform: platform as Platform,
      installed: Boolean(config?.exePath),
      exePath: config?.exePath ?? null,
      profileId: profile?.id ?? null
    };
  },
  async installProfileEmulator(profileId: string): Promise<ProfileEmulatorConfig> {
    const profile = getPlatformSetupProfile(profileId);
    if (!profile) throw new Error(`Unknown setup profile: ${profileId}`);
    if (profile.emulator.installMode !== 'downloadable') {
      throw new Error(`${profile.displayName} requires manual emulator selection.`);
    }
    await previewApi.installEmulator(profile.platform);
    return profileEmulatorConfigs.find((item) => item.profileId === profile.id)
      ?? previewApi.selectProfileEmulator(
        profile.id,
        `preview://emulators/${profile.platform}/${profile.emulator.executableName ?? `${profile.platform}.exe`}`
      );
  },
  async selectProfileEmulator(profileId: string, executablePath: string): Promise<ProfileEmulatorConfig> {
    const profile = getPlatformSetupProfile(profileId);
    if (!profile) throw new Error(`Unknown setup profile: ${profileId}`);
    const config: ProfileEmulatorConfig = {
      profileId: profile.id,
      platform: profile.platform,
      exePath: executablePath,
      status: executablePath.trim() ? 'valid' : 'invalid',
      lastValidatedAt: new Date().toISOString(),
      launchArgsTemplate: profile.launch.argsTemplate
    };
    profileEmulatorConfigs = [config, ...profileEmulatorConfigs.filter((item) => item.profileId !== profile.id)];
    await previewApi.saveEmulatorConfig(profile.platform, executablePath, profile.launch.argsTemplate);
    return config;
  },
  async importProfileSystemFile(
    gameId: string,
    requirementId: string,
    sourcePath: string
  ): Promise<ImportAssetFileReport> {
    const game = catalog.find((item) => item.id === gameId);
    const profile = getPlatformSetupProfile(game?.setupProfileId);
    const requirement = profile?.systemFiles.find((item) => item.id === requirementId);
    if (!game || !profile || !requirement) {
      return { status: 'error', installedPath: '', errorCode: 'unknown_asset' };
    }
    if (!sourcePath.trim()) {
      return { status: 'error', installedPath: '', errorCode: 'source_missing' };
    }
    if (!requirement.extensions.some((extension) => sourcePath.toLowerCase().endsWith(extension))) {
      return { status: 'error', installedPath: '', errorCode: 'wrong_extension' };
    }
    const installedPath = `preview://system/${profile.platform}/${requirement.targetName ?? requirement.id}`;
    profileSystemFileImports[`${profile.id}:${requirement.id}`] = installedPath;
    return { status: 'installed', installedPath };
  },
  async listEmulatorConfigs(): Promise<EmulatorConfig[]> {
    return emulatorConfigs;
  },
  async getRecommendedEmulators(): Promise<RecommendedEmulator[]> {
    return ['switch', 'ps1', 'ps2', 'gba', 'nes'].map((platform) => {
      const config = emulatorConfigs.find((item) => item.platform === platform);
      const nes = platform === 'nes';
      return {
        platform: platform as RecommendedEmulator['platform'],
        platformLabel: platform === 'nes' ? 'NES / Famicom' : platform.toUpperCase(),
        emulatorName: nes ? 'Mesen2' : `${platform.toUpperCase()} emulator`,
        version: nes ? '2.1.1' : null,
        downloadUrl: nes ? 'https://github.com/SourMesen/Mesen2/releases/download/2.1.1/Mesen_2.1.1_Windows.zip' : null,
        sha256: nes ? '23ccc2bc060b663c68dad3a8c5d6da7d23a50f872d04f135bafa2b04ff7d5cbe' : null,
        executableName: nes ? 'Mesen.exe' : `${platform}.exe`,
        status: config ? 'installed' : nes ? 'available' : 'manual',
        installedPath: config?.exePath ?? null,
        message: config ? 'Configured' : nes ? 'Available for automatic setup' : 'Manual setup required'
      };
    });
  },
  async installRecommendedEmulator(platform: string): Promise<EmulatorConfig> {
    if (platform !== 'nes') throw new Error('Automatic setup is available only for NES / Mesen2.');
    return previewApi.saveEmulatorConfig('nes', 'preview://emulators/Mesen2-2.1.1/Mesen.exe', '{game_path}');
  },
  async saveEmulatorConfig(
    platform: string,
    exePath: string,
    launchArgsTemplate?: string
  ): Promise<EmulatorConfig> {
    const config: EmulatorConfig = {
      platform: platform as EmulatorConfig['platform'],
      exePath,
      status: exePath.trim() ? 'valid' : 'invalid',
      lastValidatedAt: new Date().toISOString(),
      launchArgsTemplate
    };
    emulatorConfigs = [config, ...emulatorConfigs.filter((item) => item.platform !== platform)];
    return config;
  },
  async validateEmulatorConfig(platform: string): Promise<EmulatorConfig> {
    const config = emulatorConfigs.find((item) => item.platform === platform);
    if (!config) throw new Error(`No emulator config is stored for ${platform}`);
    return {
      ...config,
      lastValidatedAt: new Date().toISOString()
    };
  },
  async deleteEmulatorConfig(platform: string): Promise<boolean> {
    const before = emulatorConfigs.length;
    emulatorConfigs = emulatorConfigs.filter((item) => item.platform !== platform);
    return emulatorConfigs.length !== before;
  },
  async downloadAsset(assetId: string): Promise<DownloadRecord> {
    return downloadRecord(assetId, 'asset');
  },
  async importAssetFile(assetId: string, sourcePath: string): Promise<ImportAssetFileReport> {
    if (!assetId.trim()) {
      return { status: 'error', installedPath: '', errorCode: 'unknown_asset' };
    }
    if (!sourcePath.trim()) {
      return { status: 'error', installedPath: `preview://system/${assetId}`, errorCode: 'source_missing' };
    }
    return {
      status: 'installed',
      installedPath: `preview://system/${assetId}`,
      errorCode: undefined
    };
  },
  async importGameFile(gameId: string, sourcePath: string): Promise<ImportGameFileReport> {
    const game = catalog.find((item) => item.id === gameId);
    if (!game) {
      return { status: 'error', gameId, installedPath: '', errorCode: 'unknown_game' };
    }
    if (game.contentMode === 'metadata_only' || !isUserProvidedGame(game)) {
      return { status: 'error', gameId, installedPath: '', errorCode: 'unsupported_target' };
    }
    if (!sourcePath.trim()) {
      return { status: 'error', gameId, installedPath: '', errorCode: 'source_missing' };
    }
    if (sourcePath.endsWith('/') || sourcePath.endsWith('\\')) {
      return { status: 'error', gameId, installedPath: '', errorCode: 'source_not_file' };
    }
    if (!game.expectedExtensions.some((extension) => sourcePath.toLowerCase().endsWith(extension.toLowerCase()))) {
      return { status: 'error', gameId, installedPath: '', errorCode: 'wrong_extension' };
    }
    const fileName = sourcePath.split(/[\\/]/).pop() || `${gameId}${game.expectedExtensions[0]}`;
    const saveDir = `${downloadRoot}/${game.platform}/${gameId}/${fileName}`;
    const torrentRecord = directDownloadRecord(gameId, 'user_import', saveDir, 128_000_000);
    downloads = [torrentRecord, ...downloads.filter((item) => item.gameId !== gameId)];
    return {
      status: 'installed',
      gameId,
      installedPath: saveDir,
      sha256: '1'.repeat(64)
    };
  },
  async downloadGame(gameId: string): Promise<DownloadRecord> {
    return downloadRecord(gameId, 'game');
  },
  async startGameDownload(gameId: string): Promise<GameDownloadStartReport> {
    const game = catalog.find((item) => item.id === gameId);
    const source = game?.downloads[0];
    if (game && (game.contentMode === 'user_provided' || game.contentMode === 'metadata_only' || isUserProvidedGame(game))) {
      throw new Error('This game uses a user-provided file. Import it from Game Details.');
    }
    if (source?.kind === 'http' || source?.kind === 'bundled') {
      const record = downloadRecord(gameId, 'game');
      const torrentRecord = directDownloadRecord(
        gameId,
        source.kind,
        record.localPath ?? `${downloadRoot}/${gameId}`,
        source.sizeBytes ?? 24_592
      );
      downloads = [torrentRecord, ...downloads.filter((item) => item.gameId !== gameId)];
      return { gameId, sourceKind: source.kind, saveDir: torrentRecord.saveDir, record, torrent: torrentRecord };
    }
    const torrent = await previewApi.startMagnetDownload(
      gameId,
      source?.kind === 'magnet' ? source.uri : `magnet:?xt=urn:btih:${gameId.replaceAll('-', '')}`,
      `${downloadRoot}/${gameId}`
    );
    const record = downloads.find((item) => item.gameId === gameId) ?? null;
    return { gameId, sourceKind: 'magnet', saveDir: torrent.saveDir, record: null, torrent: record };
  },
  async trustExecutable(assetId: string): Promise<TrustedExecutable> {
    return {
      assetId,
      localPath: `preview://system/${assetId}`,
      sha256: '0'.repeat(64),
      trustedAt: new Date().toISOString()
    };
  },
  async getDownloadRoot(): Promise<string> {
    return downloadRoot;
  },
  async setDownloadRoot(path: string): Promise<string> {
    downloadRoot = path || downloadRoot;
    return downloadRoot;
  },
  async removeGame(gameId: string, _deleteFiles: boolean): Promise<boolean> {
    const before = downloads.length;
    downloads = downloads.filter((item) => item.gameId !== gameId);
    return downloads.length !== before;
  },
  async redownloadAsset(assetId: string): Promise<DownloadRecord> {
    return downloadRecord(assetId, 'asset');
  },
  async openGameFolder(_gameId: string): Promise<void> {},
  async openEmulatorFolder(_platform: string): Promise<void> {},
  async openLogsFolder(): Promise<void> {},
  async runHealthCheck(): Promise<HealthReport> {
    return previewHealthReport();
  },
  async getDiagnosticsPaths(): Promise<DiagnosticsPaths> {
    return {
      dataDir: 'preview://data',
      logPath: 'preview://logs/retrohydra.log'
    };
  },
  async getDiagnosticsBundle(): Promise<DiagnosticsBundle> {
    return {
      generatedAt: new Date().toISOString(),
      appVersion: '0.1.0-preview',
      os: 'preview browser',
      dataDir: 'preview://data',
      logPath: 'preview://logs/retrohydra.log',
      health: previewHealthReport(),
      downloads,
      logs: ['{"event":"preview"}']
    };
  },
  async startMagnetDownload(gameId: string, magnetUri: string, saveDir: string): Promise<TorrentStartReport> {
    downloads = [
      {
        gameId,
        magnetUri,
        saveDir,
        status: 'downloading',
        progressPercent: 2,
        downloadedBytes: 2_000_000,
        totalBytes: 100_000_000,
        downloadSpeedBytesPerSec: 2_400_000,
        uploadSpeedBytesPerSec: 120_000,
        peersCount: 3,
        torrentId: 99,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      },
      ...downloads.filter((record) => record.gameId !== gameId)
    ];

    return { gameId, state: 'downloading', saveDir };
  },
  async getTorrentStatus(gameId: string): Promise<TorrentStatus> {
    const record = downloads.find((item) => item.gameId === gameId);
    if (!record) throw new Error(`Unknown preview torrent: ${gameId}`);
    return {
      gameId,
      state: record.status,
      progress: record.progressPercent / 100,
      downloadedBytes: record.downloadedBytes,
      totalBytes: record.totalBytes,
      downloadSpeedBytesPerSec: record.downloadSpeedBytesPerSec,
      uploadSpeedBytesPerSec: record.uploadSpeedBytesPerSec,
      peersCount: record.peersCount,
      finished: record.status === 'completed',
      saveDir: record.saveDir,
      error: record.errorMessage
    };
  },
  async getGameDownload(gameId: string): Promise<TorrentDownloadRecord | null> {
    return downloads.find((item) => item.gameId === gameId) ?? null;
  },
  async listTorrentDownloads(): Promise<TorrentDownloadRecord[]> {
    return downloads;
  },
  async pauseDownload(gameId: string): Promise<TorrentDownloadRecord> {
    return updateTorrentStatus(gameId, 'paused');
  },
  async resumeDownload(gameId: string): Promise<TorrentDownloadRecord> {
    return updateTorrentStatus(gameId, 'downloading', null, 4_800_000);
  },
  async cancelDownload(gameId: string): Promise<TorrentDownloadRecord> {
    return updateTorrentStatus(gameId, 'cancelled');
  },
  async launchGame(gameId: string): Promise<LaunchReport> {
    const game = catalog.find((item) => item.id === gameId);
    if (!game) throw new Error(`Unknown preview game: ${gameId}`);
    const setup = buildPreviewGameSetupState(game);
    if (setup.launch.status !== 'ready') {
      throw new Error(setup.launch.blockers.join('; '));
    }
    const emulator = emulatorConfigs.find((item) => item.platform === setup.emulator.platform);
    const gamePath = downloads.find((item) => item.gameId === gameId)?.saveDir ?? `preview://games/${gameId}`;
    return {
      pid: 1,
      executable: emulator?.exePath ?? `preview://emulators/${game.platform}`,
      gamePath,
      resolvedGamePath: gamePath,
      args: [emulator?.launchArgsTemplate ?? '{game_path}', setup.gameFile.expectedExtensions.join(',')]
    };
  },
  async checkAppUpdate(): Promise<UpdateCheckReport> {
    return {
      available: false,
      currentVersion: '0.1.0-preview',
      version: null,
      date: null,
      body: null
    };
  },
  async installAppUpdate(): Promise<void> {
    return undefined;
  }
};

function game(
  id: string,
  platform: CatalogGame['platform'],
  title: string,
  description: string,
  expectedExtensions: string[],
  downloads?: CatalogGame['downloads'],
  extras?: Partial<Pick<CatalogGame, 'artwork' | 'metadata' | 'contentMode' | 'setupProfileId'>>
): CatalogGame {
  return {
    id,
    sourceId: id,
    repositoryId: repository.id,
    repositoryName: repository.name,
    platform,
    title,
    description,
    downloads: downloads ?? [{ kind: 'magnet', uri: `magnet:?xt=urn:btih:${id.replaceAll('-', '')}` }],
    expectedExtensions,
    requiredSystemFileIds: [],
    ...extras
  };
}

function torrent(
  gameId: string,
  status: TorrentDownloadRecord['status'],
  progressPercent: number,
  downloadedBytes: number,
  totalBytes: number,
  downloadSpeedBytesPerSec: number,
  peersCount: number,
  errorMessage: string | null
): TorrentDownloadRecord {
  return {
    gameId,
    magnetUri: `magnet:?xt=urn:btih:${gameId.replaceAll('-', '')}`,
    saveDir: `preview://games/${gameId}`,
    status,
    progressPercent,
    downloadedBytes,
    totalBytes,
    downloadSpeedBytesPerSec,
    uploadSpeedBytesPerSec: Math.floor(downloadSpeedBytesPerSec / 20),
    peersCount,
    torrentId: 1,
    errorMessage,
    createdAt: now,
    updatedAt: now,
    completedAt: status === 'completed' ? now : null
  };
}

function directDownloadRecord(
  gameId: string,
  sourceKind: 'http' | 'bundled' | 'user_import',
  saveDir: string,
  totalBytes: number
): TorrentDownloadRecord {
  const timestamp = new Date().toISOString();
  return {
    gameId,
    magnetUri: `direct:${sourceKind}`,
    saveDir,
    status: 'completed',
    progressPercent: 100,
    downloadedBytes: totalBytes,
    totalBytes,
    downloadSpeedBytesPerSec: 0,
    uploadSpeedBytesPerSec: 0,
    peersCount: 0,
    torrentId: null,
    errorMessage: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp
  };
}

function isUserProvidedGame(game: CatalogGame) {
  return game.contentMode === 'user_provided' || game.downloads.some((source) => source.kind === 'user_provided');
}

function buildPreviewGameSetupState(game: CatalogGame): GameSetupState {
  const profile = getPlatformSetupProfile(game.setupProfileId)
    ?? getDefaultPlatformSetupProfile(game.platform);
  const unsupportedProfileId = game.setupProfileId && !profile ? game.setupProfileId : null;
  const expectedExtensions = profile?.gameFiles.expectedExtensions ?? game.expectedExtensions;
  const profileConfig = profileEmulatorConfigs.find((item) => item.profileId === profile?.id);
  const legacyConfig = emulatorConfigs.find((item) => item.platform === (profile?.platform ?? game.platform));
  const emulatorPath = profileConfig?.exePath ?? legacyConfig?.exePath ?? null;
  const emulatorReady = Boolean(emulatorPath) && (profileConfig?.status ?? legacyConfig?.status) === 'valid';
  const download = downloads.find((item) => item.gameId === game.id && item.status === 'completed');
  const fileName = download?.saveDir.toLowerCase() ?? '';
  const gameFileReady = Boolean(download) && (
    fileName.startsWith('preview://')
    || expectedExtensions.some((extension) => fileName.endsWith(extension))
  );
  const systemFiles = (profile?.systemFiles ?? []).map((requirement) => {
    const installedPath = profileSystemFileImports[`${profile?.id}:${requirement.id}`] ?? null;
    return {
      id: requirement.id,
      label: requirement.label,
      assetKind: requirement.assetKind,
      required: requirement.required,
      status: installedPath ? 'ready' : 'missing',
      installedPath,
      expectedExtensions: requirement.extensions,
      checksum: requirement.checksum,
      message: installedPath ?? requirement.notes
    };
  });

  const blockers = [
    ...(unsupportedProfileId ? [`Unsupported setup profile: ${unsupportedProfileId}`] : []),
    ...(!emulatorReady ? [profile?.emulator.installMode === 'downloadable'
      ? `Install ${profile.emulator.emulatorName}`
      : `Select ${profile?.emulator.emulatorName ?? `${game.platform.toUpperCase()} emulator`}`] : []),
    ...systemFiles.filter((item) => item.required && item.status !== 'ready').map((item) => `Import ${item.label}`),
    ...(!gameFileReady ? ['Game file is missing.'] : [])
  ];
  const launchReady = blockers.length === 0;

  return {
    gameId: game.id,
    profileId: profile?.id ?? game.setupProfileId ?? null,
    profileDisplayName: profile?.displayName ?? null,
    unsupportedProfileId,
    emulator: {
      status: emulatorReady ? 'ready' : profile?.emulator.installMode === 'downloadable' ? 'missing' : 'manual_required',
      profileId: profile?.id ?? null,
      platform: profile?.platform ?? game.platform,
      emulatorName: profile?.emulator.emulatorName ?? `${game.platform.toUpperCase()} emulator`,
      installMode: profile?.emulator.installMode ?? 'manual',
      executablePath: emulatorPath,
      message: emulatorReady ? null : 'Emulator is not configured.'
    },
    systemFiles,
    repositoryRequirements: [],
    gameFile: {
      status: gameFileReady ? 'ready' : 'missing',
      installedPath: download?.saveDir ?? null,
      expectedExtensions,
      allowDirectory: profile?.gameFiles.allowDirectory ?? true,
      message: gameFileReady ? download?.saveDir : 'Game file is missing.'
    },
    launch: {
      status: launchReady ? 'ready' : 'blocked',
      blockers
    },
    primaryAction: launchReady
      ? 'play'
      : !gameFileReady && isUserProvidedGame(game)
        ? 'import_game'
        : !gameFileReady
          ? 'download'
          : !emulatorReady || systemFiles.some((item) => item.required && item.status !== 'ready')
            ? 'setup'
            : 'details'
  };
}

function downloadRecord(subjectId: string, subjectType: DownloadRecord['subjectType']): DownloadRecord {
  return {
    subjectId,
    subjectType,
    status: 'ready',
    localPath: `preview://${subjectType}/${subjectId}`,
    sha256: '0'.repeat(64),
    source: 'legacy',
    magnetUri: '',
    updatedAt: new Date().toISOString()
  };
}

function updateTorrentStatus(
  gameId: string,
  status: TorrentDownloadRecord['status'],
  errorMessage: string | null = null,
  downloadSpeedBytesPerSec = 0
) {
  const record = downloads.find((item) => item.gameId === gameId);
  if (!record) throw new Error(`Unknown preview torrent: ${gameId}`);
  const updated = {
    ...record,
    status,
    errorMessage,
    downloadSpeedBytesPerSec,
    updatedAt: new Date().toISOString()
  };
  downloads = downloads.map((item) => item.gameId === gameId ? updated : item);
  return updated;
}

function previewHealthReport(): HealthReport {
  return {
    generatedAt: new Date().toISOString(),
    emulators: ['switch', 'ps1', 'ps2', 'gba', 'nes'].map((platform) => {
      const config = emulatorConfigs.find((item) => item.platform === platform);
      return {
        id: `emulator:${platform}`,
        label: `${platform.toUpperCase()} emulator`,
        status: config ? 'ready' : 'missing',
        message: config?.exePath ?? 'Not configured',
        action: config ? 'openEmulatorFolder' : 'reconfigureEmulator',
        path: config?.exePath ?? undefined
      };
    }),
    platformSetup: PLATFORM_SETUP_PROFILES.map((profile) => {
      const config = profileEmulatorConfigs.find((item) => item.profileId === profile.id)
        ?? emulatorConfigs.find((item) => item.platform === profile.platform);
      const requiredMissing = profile.systemFiles.filter((requirement) => (
        requirement.required && !profileSystemFileImports[`${profile.id}:${requirement.id}`]
      )).length;
      const ready = Boolean(config?.exePath) && config?.status === 'valid' && requiredMissing === 0;
      return {
        id: `profile:${profile.id}`,
        label: profile.displayName,
        status: ready ? 'ready' : 'missing',
        message: ready ? 'Profile setup is ready.' : `${requiredMissing} required file(s) missing`,
        action: ready ? 'openProfileFolder' : 'configureProfile',
        path: config?.exePath ?? undefined
      };
    }),
    systemFiles: [
      {
        id: 'asset:ps1-bios',
        label: 'PS1 BIOS',
        status: 'missing',
        message: 'User-provided BIOS is not present.',
        action: 'openTargetFolder'
      }
    ],
    gameFiles: downloads.map((download) => ({
      id: `game:${download.gameId}`,
      label: download.gameId,
      status: download.status === 'completed' ? 'ready' : download.status,
      message: download.saveDir,
      action: 'openGameFolder',
      path: download.saveDir
    })),
    repositories: [
      {
        id: `repository:${repository.id}`,
        label: repository.name,
        status: 'ready',
        message: repository.url,
        action: 'refreshRepository',
        path: repository.url
      }
    ],
    downloader: {
      id: 'downloader:preview',
      label: 'Downloader session',
      status: 'ready',
      message: `${downloads.length} preview records`
    }
  };
}
