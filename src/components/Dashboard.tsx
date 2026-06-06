'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  RotateCw,
  Search,
  Settings,
  ShieldAlert,
  X
} from 'lucide-react';
import { GameDetailsModal } from '@/components/GameDetailsModal';
import { LaunchErrorModal } from '@/components/LaunchErrorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AppShell } from '@/components/shell/AppShell';
import {
  collectionTargetForId,
  CollectionsPanel,
  HeroPanel,
  type CollectionTarget,
  type HomeRail
} from '@/components/shell/CockpitPanels';
import { GameArt, GamePoster } from '@/components/shell/GamePoster';
import { useGamepad } from '@/hooks/useGamepad';
import {
  buildGameLibraryItems,
  filterLibraryItems,
  type GameLibraryItem,
  searchAndSortLibraryItems,
  type LibraryFilter,
  type LibrarySort
} from '@/lib/libraryStatus';
import { api } from '@/lib/api';
import { isDirectGameDownload } from '@/lib/downloadActions';
import { normalizeLaunchFailure } from '@/lib/launchErrors';
import { isTauriRuntime } from '@/lib/runtime';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/settings';
import { unknownSourcePrompt } from '@/lib/sourceTrust';
import { useLauncherStore, type ActivityEvent, type LauncherView } from '@/stores/launcherStore';
import type {
  CatalogGame,
  DownloadProgressEvent,
  HealthReport,
  LaunchFailure,
  RepositoryPreview,
  RepositorySummary,
  TorrentDownloadRecord,
  TorrentDownloadStatus,
  UpdateCheckError,
  UpdateCheckReport
} from '@/types/repository';

type BusyAction = string | null;
type UpdatePanelPhase = 'idle' | 'checking' | 'up-to-date' | 'available' | 'installing' | 'error';

interface UpdatePanelState {
  phase: UpdatePanelPhase;
  report: UpdateCheckReport | null;
  error: UpdateCheckError | null;
}

interface DashboardProps {
  catalog: CatalogGame[];
  repositories: RepositorySummary[];
  message: string | null;
  onDisconnectRepository: (repositoryId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const FILTERS: Array<{ id: LibraryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'installed', label: 'Installed' },
  { id: 'downloading', label: 'Downloading' },
  { id: 'missing', label: 'Missing Requirements' }
];

const SORTS: Array<{ id: LibrarySort; label: string }> = [
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'platform', label: 'Platform' },
  { id: 'repository', label: 'Source' }
];

const ACTIVE_DOWNLOAD_STATUSES: TorrentDownloadStatus[] = ['resolving', 'downloading', 'cancelling'];
const RESUMABLE_DOWNLOAD_STATUSES: TorrentDownloadStatus[] = ['paused', 'interrupted', 'error'];

export function Dashboard({
  catalog,
  repositories,
  message,
  onDisconnectRepository,
  onRefresh
}: DashboardProps) {
  const storeCatalog = useLauncherStore((state) => state.catalog);
  const storeRepositories = useLauncherStore((state) => state.repositories);
  const libraryStatuses = useLauncherStore((state) => state.libraryStatuses);
  const downloads = useLauncherStore((state) => state.downloads);
  const settings = useLauncherStore((state) => state.settings);
  const activeView = useLauncherStore((state) => state.activeView);
  const focusedItemId = useLauncherStore((state) => state.focusedItemId);
  const selectedGameId = useLauncherStore((state) => state.selectedGameId);
  const activityEvents = useLauncherStore((state) => state.activityEvents);
  const setCatalog = useLauncherStore((state) => state.setCatalog);
  const setRepositories = useLauncherStore((state) => state.setRepositories);
  const setLibraryStatuses = useLauncherStore((state) => state.setLibraryStatuses);
  const setDownloads = useLauncherStore((state) => state.setDownloads);
  const setSettings = useLauncherStore((state) => state.setSettings);
  const setActiveView = useLauncherStore((state) => state.setActiveView);
  const setFocusedItemId = useLauncherStore((state) => state.setFocusedItemId);
  const setSelectedGameId = useLauncherStore((state) => state.setSelectedGameId);
  const mergeDownloadEvent = useLauncherStore((state) => state.mergeDownloadEvent);
  const addActivityEvent = useLauncherStore((state) => state.addActivityEvent);

  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySort, setLibrarySort] = useState<LibrarySort>('title');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [launcherMessage, setLauncherMessage] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourcePreview, setSourcePreview] = useState<RepositoryPreview | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [launchFailure, setLaunchFailure] = useState<LaunchFailure | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [updatePanel, setUpdatePanel] = useState<UpdatePanelState>({
    phase: 'idle',
    report: null,
    error: null
  });

  useEffect(() => {
    setCatalog(catalog);
    setRepositories(repositories);
  }, [catalog, repositories, setCatalog, setRepositories]);

  const refreshLauncherData = useCallback(async () => {
    try {
      const [nextLibraryStatuses, nextDownloads] = await Promise.all([
        api.getLibraryStatuses(),
        api.listTorrentDownloads()
      ]);
      setLibraryStatuses(nextLibraryStatuses);
      setDownloads(nextDownloads);
      setLauncherMessage(null);
    } catch (error) {
      setLauncherMessage(error instanceof Error ? error.message : String(error));
    }
  }, [setDownloads, setLibraryStatuses]);

  useEffect(() => {
    let cancelled = false;
    const loadPersistedSettings = async () => {
      try {
        const persistedSettings = await loadSettings();
        if (!cancelled) {
          setSettings(persistedSettings);
          setSettingsMessage(null);
        }
      } catch (error) {
        if (!cancelled) setSettingsMessage(`Failed to load settings: ${error}`);
      }
    };

    void loadPersistedSettings();
    return () => {
      cancelled = true;
    };
  }, [setSettings]);

  useEffect(() => {
    void refreshLauncherData();
  }, [storeCatalog.length, refreshLauncherData]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    const unlistenPromise = listen<DownloadProgressEvent>('download:progress', (event) => {
      if (active) mergeDownloadEvent(event.payload);
    });

    return () => {
      active = false;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [mergeDownloadEvent]);

  const items = useMemo(
    () => buildGameLibraryItems(storeCatalog, libraryStatuses, settings),
    [libraryStatuses, settings, storeCatalog]
  );
  const itemsByGameId = useMemo(() => new Map(items.map((item) => [item.game.id, item])), [items]);
  const readyItems = useMemo(() => items.filter((item) => item.readyToPlay), [items]);
  const installedItems = useMemo(() => items.filter((item) => item.installed), [items]);
  const activeDownloadItems = useMemo(
    () => items.filter((item) => item.isDownloading || item.isPaused || item.hasError),
    [items]
  );
  const needsSetupItems = useMemo(
    () => items.filter((item) => item.installed && item.missingRequirements.length > 0),
    [items]
  );
  const recentItems = useMemo(() => items.slice(0, 14), [items]);
  const heroItem = readyItems[0] ?? installedItems[0] ?? activeDownloadItems[0] ?? items[0] ?? null;
  const selectedGame = selectedGameId ? storeCatalog.find((game) => game.id === selectedGameId) ?? null : null;
  const visibleLibraryItems = useMemo(
    () => searchAndSortLibraryItems(items, libraryFilter, librarySearch, librarySort),
    [items, libraryFilter, librarySearch, librarySort]
  );

  const persistSettings = async (nextSettings: AppSettings) => {
    const savedSettings = await saveSettings(nextSettings);
    setSettings(savedSettings);
    setSettingsMessage(null);
    await refreshLauncherData();
    return savedSettings;
  };

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setBusyAction(label);
    setLauncherMessage(null);
    try {
      await action();
      await refreshLauncherData();
    } catch (error) {
      setLauncherMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  };

  const refreshAll = async () => {
    await runAction('refresh', async () => {
      await onRefresh();
      await refreshLauncherData();
    });
  };

  const disconnect = async (repositoryId: string) => {
    await runAction(`repo:${repositoryId}`, async () => onDisconnectRepository(repositoryId));
  };

  const refreshRepository = async (repositoryId: string) => {
    await runAction(`repo-refresh:${repositoryId}`, async () => {
      await api.refreshRepository(repositoryId);
      await onRefresh();
    });
  };

  const updateSourceUrl = (value: string) => {
    setSourceUrl(value);
    setSourcePreview(null);
  };

  const previewRepositoryUrl = async () => {
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) {
      setLauncherMessage('Repository URL is required.');
      return;
    }

    await runAction('repo-preview-url', async () => {
      const preview = await api.previewRepository(trimmedUrl);
      setSourcePreview(preview);
      addActivityEvent({
        title: 'Source previewed',
        detail: preview.name,
        tone: preview.hasExecutableAssets ? 'warning' : 'info'
      });
    });
  };

  const connectRepositoryUrl = async () => {
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) {
      setLauncherMessage('Repository URL is required.');
      return;
    }

    await runAction('repo-connect-url', async () => {
      const preview = sourcePreview?.url === trimmedUrl
        ? sourcePreview
        : await api.previewRepository(trimmedUrl);
      if (preview.trustLevel === 'unknown') {
        const confirmed = window.confirm(unknownSourcePrompt(preview));
        if (!confirmed) return;
      }
      await api.connectRepository(trimmedUrl);
      setSourceUrl('');
      setSourcePreview(null);
      addActivityEvent({
        title: 'Source connected',
        detail: preview.name,
        tone: preview.hasExecutableAssets ? 'warning' : 'success'
      });
      await onRefresh();
    });
  };

  const connectRepositoryFile = async () => {
    if (!isTauriRuntime()) {
      setLauncherMessage('Local JSON import is available in the desktop build.');
      return;
    }
    await runAction('repo-file', async () => {
      const selected = await open({
        title: 'Select RetroHydra repository JSON',
        multiple: false,
        directory: false,
        filters: [{ name: 'Repository JSON', extensions: ['json'] }]
      });
      if (typeof selected !== 'string') return;
      const preview = await api.previewRepositoryFile(selected);
      if (preview.trustLevel === 'unknown') {
        const confirmed = window.confirm(unknownSourcePrompt(preview));
        if (!confirmed) return;
      }
      await api.connectRepositoryFile(selected);
      await onRefresh();
    });
  };

  const runHealthCheck = async () => {
    await runAction('health', async () => {
      setHealthReport(await api.runHealthCheck());
    });
  };

  const copyDiagnostics = async () => {
    await runAction('diagnostics', async () => {
      const bundle = await api.getDiagnosticsBundle();
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setHealthReport(bundle.health);
      addActivityEvent({
        title: 'Diagnostics copied',
        detail: bundle.logPath,
        tone: 'success'
      });
    });
  };

  const openLogs = async () => {
    await runAction('logs', () => api.openLogsFolder());
  };

  const checkAppUpdate = async () => {
    setUpdatePanel((current) => ({ ...current, phase: 'checking', error: null }));
    try {
      const report = await api.checkAppUpdate();
      setUpdatePanel({
        phase: report.available ? 'available' : 'up-to-date',
        report,
        error: null
      });
    } catch (error) {
      setUpdatePanel({
        phase: 'error',
        report: null,
        error: normalizeUpdateCheckError(error)
      });
    }
  };

  const installAppUpdate = async () => {
    setUpdatePanel((current) => ({ ...current, phase: 'installing', error: null }));
    try {
      await api.installAppUpdate();
      setUpdatePanel((current) => ({
        phase: 'up-to-date',
        report: current.report,
        error: null
      }));
    } catch (error) {
      setUpdatePanel((current) => ({
        phase: 'error',
        report: current.report,
        error: normalizeUpdateCheckError(error)
      }));
    }
  };

  const installItem = async (item: GameLibraryItem) => {
    setBusyAction(`download:${item.game.id}`);
    setLauncherMessage(null);
    try {
      const result = await api.installGame(item.game.id);
      setSettings(await loadSettings());
      addActivityEvent({
        title: result.status === 'ready' ? 'Installation complete' : 'Installation needs attention',
        detail: item.game.title,
        gameId: item.game.id,
        tone: result.status === 'ready' ? 'success' : 'warning'
      });
      if (result.status !== 'ready') {
        setLauncherMessage(result.message ?? result.errorCode ?? 'Installation needs attention.');
        setSelectedGameId(item.game.id);
      }
      await refreshLauncherData();
    } catch (error) {
      setLauncherMessage(error instanceof Error ? error.message : String(error));
      setSelectedGameId(item.game.id);
    } finally {
      setBusyAction(null);
    }
  };

  const launchItem = async (item: GameLibraryItem) => {
    setBusyAction(`play:${item.game.id}`);
    setLauncherMessage(null);
    setLaunchFailure(null);
    try {
      await api.launchGame(item.game.id);
      addActivityEvent({
        title: 'Launch requested',
        detail: item.game.title,
        gameId: item.game.id,
        tone: 'success'
      });
      await refreshLauncherData();
    } catch (error) {
      setLaunchFailure(normalizeLaunchFailure(error, item.game));
    } finally {
      setBusyAction(null);
    }
  };

  const executePrimaryAction = async (item: GameLibraryItem) => {
    if (item.primaryAction === 'play') return launchItem(item);
    if (item.primaryAction === 'download') return installItem(item);
    if (item.primaryAction === 'resume' || item.primaryAction === 'retry') {
      return runAction(`resume:${item.game.id}`, () => (
        isDirectGameDownload(item.game, item.download)
          ? api.startGameDownload(item.game.id)
          : api.resumeDownload(item.game.id)
      ));
    }
    setSelectedGameId(item.game.id);
  };

  const openLibraryCollection = useCallback((target: CollectionTarget) => {
    setLibraryFilter(target.filter);
    setLibrarySearch(target.query);
    setLibrarySort(target.sort);
    setActiveView('library');
  }, [setActiveView]);

  const focusActivate = useCallback((focusId: string) => {
    const [kind, ...rest] = focusId.split(':');
    const value = rest.join(':');
    const encodedTail = rest[rest.length - 1] ?? '';
    const gameId = safeDecodeURIComponent(encodedTail);

    if (kind === 'nav') {
      setActiveView(value as LauncherView);
      return;
    }
    if (kind === 'top') {
      if (value === 'refresh') void refreshAll();
      if (value === 'settings') setSettingsOpen(true);
      return;
    }
    if (kind === 'filter') {
      setLibraryFilter(value as LibraryFilter);
      return;
    }
    if (kind === 'action') {
      const item = itemsByGameId.get(gameId || value);
      if (item) void executePrimaryAction(item);
      return;
    }
    if (kind === 'details' || kind === 'game') {
      if (gameId || value) setSelectedGameId(gameId || value);
      return;
    }
    if (kind === 'download-action') {
      const [downloadAction] = rest;
      if (!gameId) return;
      if (downloadAction === 'pause') void runAction(`pause:${gameId}`, () => api.pauseDownload(gameId));
      if (downloadAction === 'resume' || downloadAction === 'retry') {
        const item = itemsByGameId.get(gameId);
        void runAction(`resume:${gameId}`, () => (
          isDirectGameDownload(item?.game, item?.download)
            ? api.startGameDownload(gameId)
            : api.resumeDownload(gameId)
        ));
      }
      if (downloadAction === 'cancel') void runAction(`cancel:${gameId}`, () => api.cancelDownload(gameId));
      if (downloadAction === 'play') {
        const item = itemsByGameId.get(gameId);
        if (item) void launchItem(item);
      }
      return;
    }
    if (kind === 'activity') {
      if (itemsByGameId.has(gameId)) setSelectedGameId(gameId);
      return;
    }
    if (kind === 'collection') {
      openLibraryCollection(collectionTargetForId(value));
      return;
    }
    if (focusId === 'settings:open') {
      setSettingsOpen(true);
      return;
    }
    if (kind === 'downloads' && rest[0] === 'open') {
      setActiveView('downloads');
      return;
    }
    if (kind === 'library' && rest[0] === 'open') {
      setActiveView('library');
      return;
    }
    if (focusId === 'downloads:open') setActiveView('downloads');
    if (focusId === 'library:open') setActiveView('library');
  }, [executePrimaryAction, itemsByGameId, launchItem, openLibraryCollection, refreshAll, runAction, setActiveView, setSelectedGameId]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-focus-active="true"]').forEach((element) => {
      element.removeAttribute('data-focus-active');
    });

    if (!focusedItemId) return;
    document
      .querySelector<HTMLElement>(`[data-focus-id="${cssEscape(focusedItemId)}"]`)
      ?.setAttribute('data-focus-active', 'true');
  }, [activeView, downloads.length, focusedItemId, items.length, selectedGameId, settingsOpen]);

  useGamepad({
    focusedItemId,
    setFocusedItemId,
    onActivate: focusActivate,
    onBack: () => {
      if (selectedGameId) setSelectedGameId(null);
      else if (settingsOpen) setSettingsOpen(false);
      else setActiveView('home');
    },
    onMenu: (focusId) => {
      const gameId = focusId?.startsWith('game:') ? safeDecodeURIComponent(focusId.split(':').at(-1) ?? '') : null;
      if (gameId) setSelectedGameId(gameId);
    }
  });

  const bannerMessage = message || settingsMessage || launcherMessage;

  return (
    <AppShell
      activeView={activeView}
      repositoriesCount={storeRepositories.length}
      activeDownloadsCount={activeDownloadItems.length}
      onNavigate={setActiveView}
      onFocus={setFocusedItemId}
    >
      <TopChrome
        onRefresh={refreshAll}
        onOpenSettings={() => setSettingsOpen(true)}
        onFocus={setFocusedItemId}
        refreshing={busyAction === 'refresh'}
      />
      {bannerMessage && <div className="rh-banner">{bannerMessage}</div>}

      {activeView === 'home' && (
        <HomeScreen
          heroItem={heroItem}
          readyItems={readyItems}
          activeDownloadItems={activeDownloadItems}
          needsSetupItems={needsSetupItems}
          recentItems={recentItems}
          busyAction={busyAction}
          onPrimaryAction={(item) => void executePrimaryAction(item)}
          onOpenDetails={(game) => setSelectedGameId(game.id)}
          onOpenSettings={() => setSettingsOpen(true)}
          onFocus={setFocusedItemId}
        />
      )}

      {activeView === 'library' && (
        <LibraryScreen
          items={visibleLibraryItems}
          allItems={items}
          totalCount={items.length}
          filter={libraryFilter}
          query={librarySearch}
          sort={librarySort}
          busyAction={busyAction}
          onFilterChange={setLibraryFilter}
          onQueryChange={setLibrarySearch}
          onSortChange={setLibrarySort}
          onPrimaryAction={(item) => void executePrimaryAction(item)}
          onOpenDetails={(game) => setSelectedGameId(game.id)}
          onFocus={setFocusedItemId}
        />
      )}

      {activeView === 'downloads' && (
        <DownloadsScreen
          downloads={downloads}
          itemsByGameId={itemsByGameId}
          busyAction={busyAction}
          onOpenDetails={(game) => setSelectedGameId(game.id)}
          onPause={(gameId) => runAction(`pause:${gameId}`, () => api.pauseDownload(gameId))}
          onResume={(gameId) => {
            const item = itemsByGameId.get(gameId);
            const record = downloads.find((download) => download.gameId === gameId) ?? item?.download;
            return runAction(`resume:${gameId}`, () => (
              isDirectGameDownload(item?.game, record)
                ? api.startGameDownload(gameId)
                : api.resumeDownload(gameId)
            ));
          }}
          onCancel={(gameId) => runAction(`cancel:${gameId}`, () => api.cancelDownload(gameId))}
          onPlay={(item) => void launchItem(item)}
          onFocus={setFocusedItemId}
        />
      )}

      {activeView === 'explore' && (
        <ExploreScreen
          events={activityEvents}
          items={items}
          onOpenEvent={(event) => {
            if (event.gameId) setSelectedGameId(event.gameId);
          }}
          onFocus={setFocusedItemId}
        />
      )}

      {activeView === 'collections' && (
        <CollectionsScreen
          items={items}
          onOpenCollection={openLibraryCollection}
          onFocus={setFocusedItemId}
        />
      )}

      {selectedGame && (
        <GameDetailsModal
          game={selectedGame}
          settings={settings}
          onOpenSettings={() => {
            setSelectedGameId(null);
            setSettingsOpen(true);
          }}
          onClose={() => setSelectedGameId(null)}
          onRefresh={async () => {
            await refreshLauncherData();
            setSettings(await loadSettings());
            await onRefresh();
          }}
        />
      )}

      {launchFailure && (
        <LaunchErrorModal
          failure={launchFailure}
          onClose={() => setLaunchFailure(null)}
          onOpenSettings={() => {
            setLaunchFailure(null);
            setSettingsOpen(true);
          }}
          onOpenDetails={() => {
            if (launchFailure.gameId) setSelectedGameId(launchFailure.gameId);
            setLaunchFailure(null);
          }}
          onRetryDownload={() => {
            const item = launchFailure.gameId ? itemsByGameId.get(launchFailure.gameId) : null;
            setLaunchFailure(null);
            if (item) void installItem(item);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          repositories={storeRepositories}
          downloads={downloads}
          busyAction={busyAction}
          healthReport={healthReport}
          updatePanel={updatePanel}
          sourceUrl={sourceUrl}
          sourcePreview={sourcePreview}
          onClose={() => setSettingsOpen(false)}
          onSave={persistSettings}
          onSourceUrlChange={updateSourceUrl}
          onPreviewRepositoryUrl={previewRepositoryUrl}
          onConnectRepositoryUrl={connectRepositoryUrl}
          onConnectRepositoryFile={connectRepositoryFile}
          onDisconnect={disconnect}
          onRefreshRepository={refreshRepository}
          onRunHealth={runHealthCheck}
          onCopyDiagnostics={copyDiagnostics}
          onOpenLogs={openLogs}
          onCheckAppUpdate={checkAppUpdate}
          onInstallAppUpdate={installAppUpdate}
        />
      )}
    </AppShell>
  );
}

function TopChrome({
  onRefresh,
  onOpenSettings,
  onFocus,
  refreshing
}: {
  onRefresh: () => void;
  onOpenSettings: () => void;
  onFocus: (focusId: string) => void;
  refreshing: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="rh-topbar">
      <div />
      <div className="flex items-center gap-3">
        <button
          data-focus-id="top:refresh"
          data-focus-zone="topbar"
          onFocus={() => onFocus('top:refresh')}
          onClick={onRefresh}
          disabled={refreshing}
          className="rh-icon-button rh-focusable"
          title="Refresh repository"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </button>
        <button
          data-testid="top-settings"
          data-focus-id="top:settings"
          data-focus-zone="topbar"
          onFocus={() => onFocus('top:settings')}
          onClick={onOpenSettings}
          className="rh-icon-button rh-focusable"
          title="Open settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <div className="rh-clock">{formatClock(now)}</div>
      </div>
    </header>
  );
}

function HomeScreen({
  heroItem,
  readyItems,
  activeDownloadItems,
  needsSetupItems,
  recentItems,
  busyAction,
  onPrimaryAction,
  onOpenDetails,
  onOpenSettings,
  onFocus
}: {
  heroItem: GameLibraryItem | null;
  readyItems: GameLibraryItem[];
  activeDownloadItems: GameLibraryItem[];
  needsSetupItems: GameLibraryItem[];
  recentItems: GameLibraryItem[];
  busyAction: BusyAction;
  onPrimaryAction: (item: GameLibraryItem) => void;
  onOpenDetails: (game: CatalogGame) => void;
  onOpenSettings: () => void;
  onFocus: (focusId: string) => void;
}) {
  const rails = useMemo<HomeRail[]>(() => composeHomeRails({
    readyItems,
    activeDownloadItems,
    needsSetupItems,
    recentItems
  }), [activeDownloadItems, needsSetupItems, readyItems, recentItems]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rh-home-screen"
      data-testid="home-screen"
    >
      <HeroPanel
        heroItem={heroItem}
        rails={rails}
        busyAction={busyAction}
        onPrimaryAction={onPrimaryAction}
        onOpenDetails={onOpenDetails}
        onOpenSettings={onOpenSettings}
        onFocus={onFocus}
      />
    </motion.div>
  );
}

function composeHomeRails({
  readyItems,
  activeDownloadItems,
  needsSetupItems,
  recentItems
}: {
  readyItems: GameLibraryItem[];
  activeDownloadItems: GameLibraryItem[];
  needsSetupItems: GameLibraryItem[];
  recentItems: GameLibraryItem[];
}): HomeRail[] {
  const usedGameIds = new Set<string>();
  const rails: HomeRail[] = [];
  const takeUnique = (items: GameLibraryItem[], limit: number) => {
    const result: GameLibraryItem[] = [];
    for (const item of items) {
      if (usedGameIds.has(item.game.id)) continue;
      usedGameIds.add(item.game.id);
      result.push(item);
      if (result.length >= limit) break;
    }
    return result;
  };

  const readyRailItems = takeUnique(readyItems, 10);
  if (readyRailItems.length > 0) {
    rails.push({ title: 'Ready to Play', testId: 'ready-rail', zone: 'ready', items: readyRailItems });
  }

  const downloadRailItems = takeUnique(activeDownloadItems, 8);
  if (downloadRailItems.length > 0) {
    rails.push({ title: 'Downloads', testId: 'downloads-rail', zone: 'home-downloads', items: downloadRailItems });
  }

  const setupRailItems = takeUnique(needsSetupItems, 8);
  if (setupRailItems.length > 0) {
    rails.push({ title: 'Needs Setup', testId: 'needs-setup-rail', zone: 'needs-setup', items: setupRailItems });
  }

  const recentRailItems = takeUnique(recentItems, 10);
  if (recentRailItems.length > 0 || rails.length === 0) {
    rails.push({
      title: 'Recently Added',
      testId: 'recent-rail',
      zone: 'recent',
      items: recentRailItems.length > 0 ? recentRailItems : recentItems.slice(0, 10)
    });
  }

  return rails;
}

function CollectionsScreen({
  items,
  onOpenCollection,
  onFocus
}: {
  items: GameLibraryItem[];
  onOpenCollection: (target: CollectionTarget) => void;
  onFocus: (focusId: string) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rh-screen rh-panel" data-testid="collections-screen">
      <CollectionsPanel items={items} onOpenCollection={onOpenCollection} onFocus={onFocus} />
    </motion.section>
  );
}

function ExploreScreen({
  events,
  items,
  onOpenEvent,
  onFocus
}: {
  events: ReturnType<typeof useLauncherStore.getState>['activityEvents'];
  items: GameLibraryItem[];
  onOpenEvent: (event: ActivityEvent) => void;
  onFocus: (focusId: string) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rh-screen rh-panel" data-testid="explore-screen">
      <ScreenHeader eyebrow="Explore" title="Activity Feed" description="Recent repository, library, and download events" />
      <div className="rh-explore-layout">
        <div className="rh-activity-list">
          {events.length === 0 ? (
            <div className="rh-empty-compact">No activity yet.</div>
          ) : events.slice(0, 12).map((event) => {
            const focusId = `activity:${encodeURIComponent(event.gameId ?? event.id)}`;
            return (
              <button
                key={event.id}
                data-focus-id={focusId}
                data-focus-zone="activity"
                onFocus={() => onFocus(focusId)}
                onClick={() => onOpenEvent(event)}
                className="rh-activity-row rh-focusable"
              >
                <ActivityIcon tone={event.tone} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{event.title}</div>
                  <div className="truncate text-xs text-white/42">{event.detail}</div>
                </div>
                <div className="ml-auto text-[10px] uppercase text-white/34">{formatEventTime(event.timestamp)}</div>
              </button>
            );
          })}
        </div>
        <div className="rh-explore-stats">
          <div className="text-[10px] font-black uppercase tracking-wide text-white/42">Library Stats</div>
          <StatsLine label="Games" value={String(items.length)} />
          <StatsLine label="Ready" value={String(items.filter((item) => item.readyToPlay).length)} />
          <StatsLine label="Downloading" value={String(items.filter((item) => item.isDownloading || item.isPaused || item.hasError).length)} />
        </div>
      </div>
    </motion.section>
  );
}

function LibraryScreen({
  items,
  allItems,
  totalCount,
  filter,
  query,
  sort,
  busyAction,
  onFilterChange,
  onQueryChange,
  onSortChange,
  onPrimaryAction,
  onOpenDetails,
  onFocus
}: {
  items: GameLibraryItem[];
  allItems: GameLibraryItem[];
  totalCount: number;
  filter: LibraryFilter;
  query: string;
  sort: LibrarySort;
  busyAction: BusyAction;
  onFilterChange: (filter: LibraryFilter) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: LibrarySort) => void;
  onPrimaryAction: (item: GameLibraryItem) => void;
  onOpenDetails: (game: CatalogGame) => void;
  onFocus: (focusId: string) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rh-screen rh-panel" data-testid="library-screen">
      <ScreenHeader eyebrow="Library" title="Installed Games & Catalog" description={`${items.length} visible / ${totalCount} total games`} />
      <div className="rh-library-toolbar">
        <div className="rh-library-search">
          <Search className="h-4 w-4 text-white/42" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search library"
            data-testid="library-search"
          />
          {query && (
            <button onClick={() => onQueryChange('')} className="rh-search-clear" title="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as LibrarySort)}
          className="rh-library-sort"
          aria-label="Library sort"
          data-testid="library-sort"
        >
          {SORTS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" data-testid="library-filters">
        {FILTERS.map((item) => {
          const count = filterCountLabel(item.id, totalCount, allItems);
          return (
            <button
              key={item.id}
              data-focus-id={`filter:${item.id}`}
              data-focus-zone="library-filters"
              onFocus={() => onFocus(`filter:${item.id}`)}
              onClick={() => onFilterChange(item.id)}
              className={`rh-filter-chip rh-focusable ${filter === item.id ? 'rh-filter-chip-active' : ''}`}
            >
              {item.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>
      <div className="rh-library-grid" data-testid="library-grid">
        {items.length === 0 ? (
          <div className="rh-empty-compact" data-testid="library-empty">No games match the current library view.</div>
        ) : items.map((item) => (
          <GamePoster
            key={item.game.id}
            item={item}
            focusId={`game:library:${encodeURIComponent(item.game.id)}`}
            zone="library"
            selected={busyAction?.endsWith(item.game.id)}
            onOpen={onOpenDetails}
            onAction={onPrimaryAction}
            onFocus={onFocus}
          />
        ))}
      </div>
    </motion.section>
  );
}

function DownloadsScreen({
  downloads,
  itemsByGameId,
  busyAction,
  onOpenDetails,
  onPause,
  onResume,
  onCancel,
  onPlay,
  onFocus
}: {
  downloads: TorrentDownloadRecord[];
  itemsByGameId: Map<string, GameLibraryItem>;
  busyAction: BusyAction;
  onOpenDetails: (game: CatalogGame) => void;
  onPause: (gameId: string) => Promise<void>;
  onResume: (gameId: string) => Promise<void>;
  onCancel: (gameId: string) => Promise<void>;
  onPlay: (item: GameLibraryItem) => void;
  onFocus: (focusId: string) => void;
}) {
  const summary = summarizeDownloads(downloads);
  const description = summary.active > 0
    ? `Single active slot in use / ${downloads.length} persisted records`
    : `Single active slot ready / ${downloads.length} persisted records`;

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rh-screen rh-panel">
      <div className="rh-downloads-center" data-testid="downloads-center">
        <ScreenHeader eyebrow="Downloads" title="Download Center" description={description} />
        <div className="rh-download-summary">
          <DownloadMetric label="Active" value={String(summary.active)} tone="active" />
          <DownloadMetric label="Paused" value={String(summary.paused)} tone="paused" />
          <DownloadMetric label="Errors" value={String(summary.errors)} tone="error" />
          <DownloadMetric label="Downloaded" value={formatBytes(summary.downloadedBytes)} tone="ready" />
        </div>
        <div className="rh-download-list">
          {downloads.length === 0 ? (
            <div className="rh-empty-compact">No persisted downloads. Start a catalog download from Home or Library.</div>
          ) : downloads.map((download) => {
            const item = itemsByGameId.get(download.gameId) ?? null;
            return (
              <DownloadRow
                key={download.gameId}
                download={download}
                item={item}
                busyAction={busyAction}
                onOpenDetails={onOpenDetails}
                onPause={onPause}
                onResume={onResume}
                onCancel={onCancel}
                onPlay={onPlay}
                onFocus={onFocus}
              />
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

function DownloadRow({
  download,
  item,
  busyAction,
  onOpenDetails,
  onPause,
  onResume,
  onCancel,
  onPlay,
  onFocus
}: {
  download: TorrentDownloadRecord;
  item: GameLibraryItem | null;
  busyAction: BusyAction;
  onOpenDetails: (game: CatalogGame) => void;
  onPause: (gameId: string) => Promise<void>;
  onResume: (gameId: string) => Promise<void>;
  onCancel: (gameId: string) => Promise<void>;
  onPlay: (item: GameLibraryItem) => void;
  onFocus: (focusId: string) => void;
}) {
  const active = ACTIVE_DOWNLOAD_STATUSES.includes(download.status);
  const resumable = RESUMABLE_DOWNLOAD_STATUSES.includes(download.status);
  const cancellable = !['completed', 'cancelled', 'cancelling'].includes(download.status);
  const statusHint = downloadStatusHint(download);

  return (
    <article className="rh-download-row" data-testid="download-row">
      <button
        data-focus-id={`details:${encodeURIComponent(download.gameId)}`}
        data-focus-zone="downloads"
        onFocus={() => onFocus(`details:${encodeURIComponent(download.gameId)}`)}
        onClick={() => item && onOpenDetails(item.game)}
        className="rh-download-art rh-focusable"
      >
        {item ? <GameArt game={item.game} className="h-full w-full" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-black">{item?.game.title ?? download.gameId}</div>
          <span className="rounded border border-white/10 px-2 py-1 text-[10px] uppercase text-white/54">{download.status}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/42">
          <div className="h-full rounded bg-hydra-accent" style={{ width: `${download.status === 'completed' ? 100 : download.progressPercent}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/42">
          <span>{formatBytes(download.downloadedBytes)} / {formatBytes(download.totalBytes)}</span>
          <span>{formatSpeed(download.downloadSpeedBytesPerSec)}</span>
          <span>{download.peersCount} peers</span>
        </div>
        {download.saveDir && <div className="mt-2 truncate text-xs text-white/32">{download.saveDir}</div>}
        {statusHint && <div className="mt-2 text-xs text-white/42">{statusHint}</div>}
        {download.errorMessage && <div className="mt-2 text-xs text-red-100">{download.errorMessage}</div>}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {active && download.status !== 'cancelling' && (
          <IconAction
            focusId={`download-action:pause:${encodeURIComponent(download.gameId)}`}
            onFocus={onFocus}
            busy={busyAction === `pause:${download.gameId}`}
            label="Pause"
            icon={<Pause className="h-3.5 w-3.5" />}
            onClick={() => onPause(download.gameId)}
          />
        )}
        {resumable && (
          <IconAction
            focusId={`download-action:${download.status === 'error' ? 'retry' : 'resume'}:${encodeURIComponent(download.gameId)}`}
            onFocus={onFocus}
            busy={busyAction === `resume:${download.gameId}`}
            label={download.status === 'error' ? 'Retry' : 'Resume'}
            icon={<RotateCw className="h-3.5 w-3.5" />}
            onClick={() => onResume(download.gameId)}
          />
        )}
        {item?.readyToPlay && download.status === 'completed' && (
          <IconAction
            focusId={`download-action:play:${encodeURIComponent(download.gameId)}`}
            onFocus={onFocus}
            busy={busyAction === `play:${download.gameId}`}
            label="Play"
            icon={<Play className="h-3.5 w-3.5" />}
            onClick={() => onPlay(item)}
          />
        )}
        {cancellable && (
          <IconAction
            focusId={`download-action:cancel:${encodeURIComponent(download.gameId)}`}
            onFocus={onFocus}
            busy={busyAction === `cancel:${download.gameId}`}
            label="Cancel"
            icon={<Ban className="h-3.5 w-3.5" />}
            onClick={() => onCancel(download.gameId)}
            danger
          />
        )}
      </div>
    </article>
  );
}

function IconAction({
  label,
  icon,
  busy,
  danger,
  focusId,
  onFocus,
  onClick
}: {
  label: string;
  icon: React.ReactNode;
  busy: boolean;
  danger?: boolean;
  focusId: string;
  onFocus: (focusId: string) => void;
  onClick: () => void;
}) {
  return (
    <button
      data-focus-id={focusId}
      data-focus-zone="download-actions"
      onFocus={() => onFocus(focusId)}
      onClick={onClick}
      className={`rh-mini-action rh-focusable ${danger ? 'rh-mini-action-danger' : ''}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function ScreenHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-5">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-hydra-accent">{eyebrow}</div>
      <h1 className="mt-2 text-3xl font-black uppercase tracking-normal">{title}</h1>
      <p className="mt-1 text-sm text-white/46">{description}</p>
    </header>
  );
}

function ActivityIcon({ tone }: { tone: ActivityEvent['tone'] }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
      {tone === 'success' ? (
        <CheckCircle2 className="h-4 w-4 text-hydra-green" />
      ) : tone === 'error' ? (
        <AlertTriangle className="h-4 w-4 text-red-200" />
      ) : tone === 'warning' ? (
        <ShieldAlert className="h-4 w-4 text-amber-200" />
      ) : (
        <Activity className="h-4 w-4 text-white/60" />
      )}
    </div>
  );
}

function StatsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs">
      <span className="text-white/48">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function normalizeUpdateCheckError(error: unknown): UpdateCheckError {
  if (isUpdateCheckError(error)) return error;
  if (typeof error === 'object' && error !== null && 'kind' in error) {
    const kind = String((error as { kind?: unknown }).kind);
    if (kind === 'endpointUnreachable' || kind === 'parseError' || kind === 'signatureInvalid') {
      const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : undefined;
      return { kind, message };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'parseError', message };
}

function isUpdateCheckError(error: unknown): error is UpdateCheckError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'kind' in error &&
    ['endpointUnreachable', 'parseError', 'signatureInvalid'].includes(String((error as { kind?: unknown }).kind))
  );
}

function formatEventTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0.00 MB/s';
  return `${(bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function filterCountLabel(filter: LibraryFilter, totalCount: number, allItems: GameLibraryItem[]) {
  if (filter === 'all') return totalCount;
  return filterLibraryItems(allItems, filter).length;
}

function summarizeDownloads(downloads: TorrentDownloadRecord[]) {
  return downloads.reduce((summary, download) => {
    if (ACTIVE_DOWNLOAD_STATUSES.includes(download.status)) summary.active += 1;
    if (download.status === 'paused' || download.status === 'interrupted') summary.paused += 1;
    if (download.status === 'error') summary.errors += 1;
    summary.downloadedBytes += download.downloadedBytes;
    return summary;
  }, {
    active: 0,
    paused: 0,
    errors: 0,
    downloadedBytes: 0
  });
}

function downloadStatusHint(download: TorrentDownloadRecord) {
  if (download.status === 'interrupted') return 'Restored after restart. Resume to continue.';
  if (download.status === 'paused') return 'Paused state is persisted.';
  if (download.status === 'resolving') return 'Resolving magnet metadata.';
  if (download.status === 'cancelling') return 'Cancelling and cleaning partial files.';
  if (download.status === 'cancelled') return 'Cancelled session retained for diagnostics.';
  if (download.status === 'error' && !download.errorMessage) return 'Retry from the persisted download state.';
  return null;
}

function DownloadMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'active' | 'paused' | 'error' | 'ready';
}) {
  return (
    <div className={`rh-download-metric rh-download-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }

  return value.replace(/"/g, '\\"');
}
