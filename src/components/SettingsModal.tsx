'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Activity,
  Ban,
  Clipboard,
  Download,
  FolderOpen,
  Gamepad2,
  HardDrive,
  HeartPulse,
  Link2,
  Loader2,
  RefreshCcw,
  Save,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { isTauriRuntime } from '@/lib/runtime';
import { getEmulatorPath, type AppSettings } from '@/lib/settings';
import {
  countConfiguredEmulators,
  getEmulatorDraftState,
  hasEmulatorDraftChanges,
  updateDraftEmulatorPath,
  type EmulatorDraftTone
} from '@/lib/settingsModalState';
import { sourceTrustLabel } from '@/lib/sourceTrust';
import { MVP_PLATFORMS, PLATFORM_EMULATOR_HINTS, PLATFORM_LABELS, type MvpPlatform } from '@/types/platform';
import type {
  HealthCheckItem,
  HealthReport,
  PlatformSetupProfile,
  RepositoryPreview,
  RepositorySummary,
  TorrentDownloadRecord,
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

interface SettingsModalProps {
  settings: AppSettings;
  repositories: RepositorySummary[];
  downloads: TorrentDownloadRecord[];
  busyAction: BusyAction;
  healthReport: HealthReport | null;
  updatePanel: UpdatePanelState;
  sourceUrl: string;
  sourcePreview: RepositoryPreview | null;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
  onSourceUrlChange: (value: string) => void;
  onPreviewRepositoryUrl: () => Promise<void>;
  onConnectRepositoryUrl: () => Promise<void>;
  onConnectRepositoryFile: () => Promise<void>;
  onDisconnect: (repositoryId: string) => Promise<void>;
  onRefreshRepository: (repositoryId: string) => Promise<void>;
  onRunHealth: () => Promise<void>;
  onCopyDiagnostics: () => Promise<void>;
  onOpenLogs: () => Promise<void>;
  onCheckAppUpdate: () => Promise<void>;
  onInstallAppUpdate: () => Promise<void>;
}

type BusyState = `browse:${MvpPlatform}` | 'save' | null;
type SettingsSection = 'general' | 'emulators' | 'sources' | 'storage' | 'diagnostics' | 'updates';

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: typeof Settings }> = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'emulators', label: 'Emulators', icon: Gamepad2 },
  { id: 'sources', label: 'Sources', icon: Link2 },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
  { id: 'updates', label: 'Updates', icon: RefreshCcw }
];

const PUBLIC_SOURCE_TEMPLATE_URL = 'https://mrbeastie.github.io/RetroHydra/source-library-template/repository.json';

export function SettingsModal({
  settings,
  repositories,
  downloads,
  busyAction,
  healthReport,
  updatePanel,
  sourceUrl,
  sourcePreview,
  onClose,
  onSave,
  onSourceUrlChange,
  onPreviewRepositoryUrl,
  onConnectRepositoryUrl,
  onConnectRepositoryFile,
  onDisconnect,
  onRefreshRepository,
  onRunHealth,
  onCopyDiagnostics,
  onOpenLogs,
  onCheckAppUpdate,
  onInstallAppUpdate
}: SettingsModalProps) {
  const [savedSettings, setSavedSettings] = useState<AppSettings>(settings);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [activeSection, setActiveSection] = useState<SettingsSection>('emulators');
  const [activePlatform, setActivePlatform] = useState<MvpPlatform>(MVP_PLATFORMS[0]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadRoot, setDownloadRoot] = useState('');
  const [savedDownloadRoot, setSavedDownloadRoot] = useState('');
  const [profiles, setProfiles] = useState<PlatformSetupProfile[]>([]);
  const [appDataDir, setAppDataDir] = useState('');
  const [logPath, setLogPath] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSavedSettings(settings);
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getDownloadRoot(),
      api.listPlatformSetupProfiles(),
      api.getDiagnosticsPaths()
    ])
      .then(([downloadFolder, setupProfiles, diagnostics]) => {
        if (cancelled) return;
        setDownloadRoot(downloadFolder);
        setSavedDownloadRoot(downloadFolder);
        setProfiles(setupProfiles);
        setAppDataDir(diagnostics.dataDir);
        setLogPath(diagnostics.logPath);
      })
      .catch((error) => {
        if (!cancelled) setMessage(`Failed to load settings details: ${error}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const configuredCount = countConfiguredEmulators(draftSettings);
  const readyCount = useMemo(() => (
    MVP_PLATFORMS.filter((platform) => (
      getEmulatorDraftState(draftSettings, savedSettings, platform).tone === 'valid'
    )).length
  ), [draftSettings, savedSettings]);
  const changedEmulators = hasEmulatorDraftChanges(draftSettings, savedSettings);
  const changedStorage = downloadRoot.trim() !== savedDownloadRoot.trim();
  const hasUnsavedChanges = changedEmulators || changedStorage;
  const activeDownloadsCount = downloads.filter((download) => (
    download.status === 'resolving' || download.status === 'downloading' || download.status === 'cancelling'
  )).length;

  const updateEmulatorPath = (platform: MvpPlatform, emulatorPath: string) => {
    setDraftSettings((currentSettings) => updateDraftEmulatorPath(currentSettings, platform, emulatorPath));
    setActivePlatform(platform);
    setMessage(null);
  };

  const browseForEmulator = async (platform: MvpPlatform) => {
    setBusy(`browse:${platform}`);
    setActivePlatform(platform);
    setMessage(null);
    try {
      if (!isTauriRuntime()) {
        setMessage('Native file browsing is available in the Tauri desktop build. For preview, paste a path manually.');
        return;
      }

      const currentPath = getEmulatorPath(draftSettings, platform);
      const selected = await open({
        title: `Select emulator for ${PLATFORM_LABELS[platform]}`,
        multiple: false,
        directory: false,
        defaultPath: currentPath || undefined,
        filters: [
          {
            name: 'Windows executable',
            extensions: ['exe']
          }
        ]
      });

      if (typeof selected === 'string') {
        updateEmulatorPath(platform, selected);
      }
    } catch (error) {
      setMessage(`Failed to open file picker: ${error}`);
    } finally {
      setBusy(null);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasUnsavedChanges) return;

    setBusy('save');
    setMessage(null);
    try {
      const nextSavedSettings = await onSave(draftSettings);
      if (downloadRoot.trim() && changedStorage) {
        const nextDownloadRoot = await api.setDownloadRoot(downloadRoot.trim());
        setDownloadRoot(nextDownloadRoot);
        setSavedDownloadRoot(nextDownloadRoot);
      }
      setSavedSettings(nextSavedSettings);
      setDraftSettings(nextSavedSettings);
      setMessage('Settings saved. Emulator readiness has been refreshed.');
    } catch (error) {
      setMessage(`Failed to save settings: ${error}`);
    } finally {
      setBusy(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = getFocusableElements(modalRef.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/90 px-5 py-5"
      onKeyDown={handleKeyDown}
      data-testid="settings-modal"
    >
      <section
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="flex h-[min(760px,calc(100vh-40px))] w-[min(1080px,calc(100vw-40px))] overflow-hidden rounded-md border border-white/10 bg-[#050507] text-white shadow-[0_40px_120px_rgba(0,0,0,0.72)] outline-none"
      >
        <aside className="hidden w-56 shrink-0 border-r border-white/10 bg-white/[0.025] p-5 md:flex md:flex-col">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">RetroHydra</div>
            <h2 id="settings-modal-title" className="mt-2 text-2xl font-black tracking-normal">Settings</h2>
            <p className="mt-2 text-xs leading-5 text-white/[0.42]">Console-grade setup for launch paths, storage, and diagnostics.</p>
          </div>

          <nav className="mt-8 grid gap-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  data-testid={`settings-tab-${section.id}`}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex h-11 items-center gap-3 rounded-sm border px-3 text-left text-xs font-black uppercase tracking-wide transition ${
                    active
                      ? 'border-white/[0.65] bg-white/[0.085] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_18px_44px_rgba(0,0,0,0.44)]'
                      : 'border-transparent text-white/[0.42] hover:border-white/[0.14] hover:bg-white/[0.045] hover:text-white/[0.72]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/[0.32]">Readiness</div>
            <div className="mt-3 grid gap-2 text-xs text-white/[0.54]">
              <MetricLine label="Configured" value={`${configuredCount}/${MVP_PLATFORMS.length}`} />
              <MetricLine label="Ready" value={`${readyCount}/${MVP_PLATFORMS.length}`} />
              <MetricLine label="Sources" value={String(repositories.length)} />
              <MetricLine label="Unsaved" value={hasUnsavedChanges ? 'Yes' : 'No'} />
            </div>
          </div>
        </aside>

        <form onSubmit={save} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-h-20 items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-7">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">Configuration</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-normal md:hidden">Settings</h2>
                <h3 className="text-xl font-black tracking-normal md:text-2xl">{sectionTitle(activeSection)}</h3>
                {hasUnsavedChanges && (
                  <span className="rounded-sm border border-white/[0.18] bg-white/[0.07] px-2 py-1 text-[10px] font-black uppercase text-white/[0.78]">
                    Unsaved
                  </span>
                )}
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-white/10 bg-white/[0.035] text-white/[0.62] transition hover:border-white/40 hover:bg-white/[0.075] hover:text-white focus:border-white/70 focus:outline-none"
              title="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex border-b border-white/10 md:hidden">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                data-testid={`settings-mobile-tab-${section.id}`}
                onClick={() => setActiveSection(section.id)}
                className={`min-w-0 flex-1 px-2 py-3 text-[10px] font-black uppercase transition ${
                  activeSection === section.id ? 'bg-white/[0.08] text-white' : 'text-white/[0.38]'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-5 [scrollbar-gutter:stable] md:px-7" data-testid={`settings-modal-${activeSection}`}>
            {activeSection === 'general' && (
              <GeneralSection
                configuredCount={configuredCount}
                readyCount={readyCount}
                repositoriesCount={repositories.length}
                activeDownloadsCount={activeDownloadsCount}
                updatePhase={updatePanel.phase}
                healthReport={healthReport}
                hasUnsavedChanges={hasUnsavedChanges}
                desktopBridge={isTauriRuntime()}
                onOpenSection={setActiveSection}
              />
            )}

            {activeSection === 'emulators' && (
              <EmulatorsSection
                draftSettings={draftSettings}
                savedSettings={savedSettings}
                activePlatform={activePlatform}
                busy={busy}
                onFocusPlatform={setActivePlatform}
                onPathChange={updateEmulatorPath}
                onBrowse={browseForEmulator}
              />
            )}

            {activeSection === 'sources' && (
              <SourcesSection
                repositories={repositories}
                busyAction={busyAction}
                sourceUrl={sourceUrl}
                sourcePreview={sourcePreview}
                onSourceUrlChange={onSourceUrlChange}
                onPreviewRepositoryUrl={onPreviewRepositoryUrl}
                onConnectRepositoryUrl={onConnectRepositoryUrl}
                onConnectRepositoryFile={onConnectRepositoryFile}
                onRefreshRepository={onRefreshRepository}
                onDisconnect={onDisconnect}
              />
            )}

            {activeSection === 'storage' && (
              <StorageSection
                downloadRoot={downloadRoot}
                appDataDir={appDataDir}
                logPath={logPath}
                changed={changedStorage}
                onDownloadRootChange={(value) => {
                  setDownloadRoot(value);
                  setMessage(null);
                }}
              />
            )}

            {activeSection === 'diagnostics' && (
              <DiagnosticsSection
                profiles={profiles}
                health={healthReport}
                busyAction={busyAction}
                onRunHealth={onRunHealth}
                onCopyDiagnostics={onCopyDiagnostics}
                onOpenLogs={onOpenLogs}
              />
            )}

            {activeSection === 'updates' && (
              <UpdatesSection
                state={updatePanel}
                onCheck={onCheckAppUpdate}
                onInstall={onInstallAppUpdate}
              />
            )}
          </div>

          {message && (
            <div className="mx-5 mb-4 rounded-sm border border-white/[0.12] bg-white/[0.055] px-3 py-2 text-sm text-white/70 md:mx-7">
              {message}
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 md:px-7">
            <div className="text-xs text-white/[0.38]">
              {hasUnsavedChanges ? 'Changes are local until saved.' : 'No unsaved changes.'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy !== null}
                className="h-10 rounded-sm border border-white/10 px-4 text-sm font-bold text-white/[0.62] transition hover:border-white/[0.36] hover:bg-white/[0.065] hover:text-white disabled:opacity-40"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={busy !== null || !hasUnsavedChanges}
                className="inline-flex h-10 items-center gap-2 rounded-sm border border-white/70 bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-white/90 disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/[0.32]"
              >
                {busy === 'save' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function GeneralSection({
  configuredCount,
  readyCount,
  repositoriesCount,
  activeDownloadsCount,
  updatePhase,
  healthReport,
  hasUnsavedChanges,
  desktopBridge,
  onOpenSection
}: {
  configuredCount: number;
  readyCount: number;
  repositoriesCount: number;
  activeDownloadsCount: number;
  updatePhase: UpdatePanelPhase;
  healthReport: HealthReport | null;
  hasUnsavedChanges: boolean;
  desktopBridge: boolean;
  onOpenSection: (section: SettingsSection) => void;
}) {
  const healthReady = healthReport
    ? [
        ...healthReport.emulators,
        ...healthReport.platformSetup,
        ...healthReport.systemFiles,
        ...healthReport.gameFiles,
        ...healthReport.repositories,
        healthReport.downloader
      ].filter((item) => item.status === 'ready').length
    : 0;
  const healthTotal = healthReport
    ? healthReport.emulators.length
      + healthReport.platformSetup.length
      + healthReport.systemFiles.length
      + healthReport.gameFiles.length
      + healthReport.repositories.length
      + 1
    : 0;

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Configured" value={`${configuredCount}/${MVP_PLATFORMS.length}`} />
        <SummaryCard label="Sources" value={String(repositoriesCount)} />
        <SummaryCard label="Downloads" value={String(activeDownloadsCount)} />
        <SummaryCard label="Ready" value={`${readyCount}/${MVP_PLATFORMS.length}`} />
        <SummaryCard label="Health" value={healthTotal > 0 ? `${healthReady}/${healthTotal}` : 'Not run'} />
        <SummaryCard label="Update" value={updatePhaseLabel(updatePhase)} />
      </div>
      <div className="rounded-sm border border-white/10 bg-black/[0.38] p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-white/10 bg-white/[0.055]">
            <Settings className="h-5 w-5 text-white/[0.78]" />
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-black">Launcher setup</h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.52]">
              Settings now live in one modal surface: emulator paths, community sources, storage, diagnostics, and app updates.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <SectionJumpButton label="Configure Emulators" onClick={() => onOpenSection('emulators')} />
              <SectionJumpButton label="Manage Sources" onClick={() => onOpenSection('sources')} />
              <SectionJumpButton label="Run Diagnostics" onClick={() => onOpenSection('diagnostics')} />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4 text-sm text-white/50">
        {hasUnsavedChanges
          ? 'Unsaved changes are staged in this modal. Save to persist and refresh backend readiness.'
          : `Settings are in sync with the saved backend configuration. Runtime: ${desktopBridge ? 'desktop bridge' : 'preview mode'}.`}
      </div>
    </section>
  );
}

function SectionJumpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-sm border border-white/[0.28] px-4 text-sm font-black uppercase text-white/[0.82] transition hover:border-white/70 hover:bg-white/[0.08]"
    >
      {label}
    </button>
  );
}

function EmulatorsSection({
  draftSettings,
  savedSettings,
  activePlatform,
  busy,
  onFocusPlatform,
  onPathChange,
  onBrowse
}: {
  draftSettings: AppSettings;
  savedSettings: AppSettings;
  activePlatform: MvpPlatform;
  busy: BusyState;
  onFocusPlatform: (platform: MvpPlatform) => void;
  onPathChange: (platform: MvpPlatform, path: string) => void;
  onBrowse: (platform: MvpPlatform) => Promise<void>;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">Executable paths</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.52]">
            Select native Windows `.exe` files per platform. These are stored as local launcher settings, not as visible defaults.
          </p>
        </div>
        <div className="rounded-sm border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/[0.54]">
          Active: {PLATFORM_LABELS[activePlatform]}
        </div>
      </div>

      <div className="grid gap-3">
        {MVP_PLATFORMS.map((platform) => {
          const emulatorPath = getEmulatorPath(draftSettings, platform);
          const state = getEmulatorDraftState(draftSettings, savedSettings, platform);
          const active = activePlatform === platform;
          const browsing = busy === `browse:${platform}`;

          return (
            <article
              key={platform}
              data-testid={`emulator-row-${platform}`}
              onFocusCapture={() => onFocusPlatform(platform)}
              className={`rounded-sm border p-4 transition ${
                active
                  ? 'border-white/70 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_20px_60px_rgba(0,0,0,0.5)]'
                  : 'border-white/10 bg-black/[0.34] hover:border-white/[0.24] hover:bg-white/[0.045]'
              }`}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(150px,220px)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white/90">{PLATFORM_LABELS[platform]}</span>
                    <StatusChip tone={state.tone} label={state.label} />
                  </div>
                  <div className="mt-2 text-xs text-white/[0.38]">Expected executable: {PLATFORM_EMULATOR_HINTS[platform]}</div>
                  <div className="mt-3 text-xs leading-5 text-white/[0.44]">{state.detail}</div>
                </div>

                <label className="min-w-0">
                  <span className="sr-only">{PLATFORM_LABELS[platform]} executable path</span>
                  <div className="flex min-w-0 gap-2">
                    <input
                      value={emulatorPath}
                      onChange={(event) => onPathChange(platform, event.target.value)}
                      onFocus={() => onFocusPlatform(platform)}
                      className="h-11 min-w-0 flex-1 rounded-sm border border-white/10 bg-black/40 px-3 text-sm text-white/80 outline-none transition placeholder:text-white/25 focus:border-white/60"
                      placeholder="Select executable path"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => onBrowse(platform)}
                      disabled={busy !== null}
                      aria-label={`Choose ${PLATFORM_LABELS[platform]} executable`}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-sm border border-white/[0.12] bg-white/[0.045] px-3 text-sm font-bold text-white/70 transition hover:border-white/[0.44] hover:bg-white/[0.08] hover:text-white disabled:opacity-40 sm:px-4"
                    >
                      {browsing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Choose</span>
                    </button>
                  </div>
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SourcesSection({
  repositories,
  busyAction,
  sourceUrl,
  sourcePreview,
  onSourceUrlChange,
  onPreviewRepositoryUrl,
  onConnectRepositoryUrl,
  onConnectRepositoryFile,
  onRefreshRepository,
  onDisconnect
}: {
  repositories: RepositorySummary[];
  busyAction: BusyAction;
  sourceUrl: string;
  sourcePreview: RepositoryPreview | null;
  onSourceUrlChange: (value: string) => void;
  onPreviewRepositoryUrl: () => Promise<void>;
  onConnectRepositoryUrl: () => Promise<void>;
  onConnectRepositoryFile: () => Promise<void>;
  onRefreshRepository: (repositoryId: string) => Promise<void>;
  onDisconnect: (repositoryId: string) => Promise<void>;
}) {
  const sourceBusy = busyAction === 'repo-preview-url' || busyAction === 'repo-connect-url' || busyAction === 'repo-file';

  return (
    <section className="grid gap-4" data-testid="settings-modal-sources-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">Community and user sources</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.52]">
            Connect a community URL or import a private local JSON source. Unknown sources should be reviewed before connecting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSourceUrlChange(PUBLIC_SOURCE_TEMPLATE_URL)}
            disabled={busyAction !== null}
            className="rh-mini-action"
            title="Fill starter source template URL"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Starter URL
          </button>
          <button
            type="button"
            onClick={onConnectRepositoryFile}
            disabled={busyAction !== null}
            className="rh-icon-button"
            title="Import repository JSON"
          >
            {busyAction === 'repo-file' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="rounded-sm border border-white/10 bg-black/[0.34] p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <input
            value={sourceUrl}
            onChange={(event) => onSourceUrlChange(event.target.value)}
            className="h-11 min-w-0 rounded-sm border border-white/10 bg-black/40 px-3 text-sm text-white/80 outline-none transition placeholder:text-white/25 focus:border-white/60"
            placeholder="https://example.com/retrohydra-repository.json"
            data-testid="settings-source-url"
          />
          <button
            type="button"
            onClick={onPreviewRepositoryUrl}
            disabled={busyAction !== null || !sourceUrl.trim()}
            className="rh-mini-action h-11 justify-center"
          >
            {busyAction === 'repo-preview-url' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            Preview
          </button>
          <button
            type="button"
            onClick={onConnectRepositoryUrl}
            disabled={busyAction !== null || !sourceUrl.trim()}
            className="rh-mini-action h-11 justify-center"
          >
            {busyAction === 'repo-connect-url' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Connect
          </button>
          <button
            type="button"
            onClick={onConnectRepositoryFile}
            disabled={busyAction !== null}
            className="rh-mini-action h-11 justify-center"
          >
            {busyAction === 'repo-file' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
            JSON
          </button>
        </div>

        {sourcePreview && <SourcePreviewCard preview={sourcePreview} />}
      </div>

      <div className="rounded-sm border border-white/10 bg-black/[0.28] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-wide text-white/[0.42]">Connected sources</div>
          {sourceBusy && <div className="text-[10px] font-bold uppercase text-white/[0.36]">Working...</div>}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {repositories.length === 0 ? (
            <div className="rh-empty-compact lg:col-span-2">No community or user sources connected.</div>
          ) : repositories.map((repository) => (
            <RepositorySourceCard
              key={repository.id}
              repository={repository}
              busyAction={busyAction}
              onRefreshRepository={onRefreshRepository}
              onDisconnect={onDisconnect}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StorageSection({
  downloadRoot,
  appDataDir,
  logPath,
  changed,
  onDownloadRootChange
}: {
  downloadRoot: string;
  appDataDir: string;
  logPath: string;
  changed: boolean;
  onDownloadRootChange: (value: string) => void;
}) {
  return (
    <section className="grid gap-4">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">Storage</div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.52]">
          Control where downloaded content is written and inspect local app paths used by the desktop build.
        </p>
      </div>
      <label className="rounded-sm border border-white/10 bg-black/[0.34] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-black text-white/90">Download folder</span>
          {changed && <StatusChip tone="unsaved" label="Unsaved" />}
        </div>
        <input
          value={downloadRoot}
          onChange={(event) => onDownloadRootChange(event.target.value)}
          className="mt-3 h-11 w-full rounded-sm border border-white/10 bg-black/40 px-3 text-sm text-white/80 outline-none transition placeholder:text-white/25 focus:border-white/60"
          placeholder="D:\\Games\\RetroHydra"
          spellCheck={false}
        />
      </label>
      <div className="grid gap-3 lg:grid-cols-2">
        <PathCard label="App data" value={appDataDir || 'Loading'} />
        <PathCard label="Logs" value={logPath || 'Loading'} />
      </div>
    </section>
  );
}

function DiagnosticsSection({
  profiles,
  health,
  busyAction,
  onRunHealth,
  onCopyDiagnostics,
  onOpenLogs
}: {
  profiles: PlatformSetupProfile[];
  health: HealthReport | null;
  busyAction: BusyAction;
  onRunHealth: () => Promise<void>;
  onCopyDiagnostics: () => Promise<void>;
  onOpenLogs: () => Promise<void>;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">Diagnostics</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.52]">
            Readiness signals from setup profiles, system files, repositories, and downloader state.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRunHealth} disabled={busyAction === 'health'} className="rh-mini-action">
            {busyAction === 'health' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
            Run
          </button>
          <button type="button" onClick={onCopyDiagnostics} disabled={busyAction === 'diagnostics'} className="rh-mini-action">
            {busyAction === 'diagnostics' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clipboard className="h-3.5 w-3.5" />}
            Copy diagnostics
          </button>
          <button type="button" onClick={onOpenLogs} disabled={busyAction === 'logs'} className="rh-mini-action">
            {busyAction === 'logs' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
            Open logs
          </button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {profiles.length === 0 ? (
          <div className="rounded-sm border border-white/10 bg-black/[0.34] p-4 text-sm text-white/[0.42] lg:col-span-2">
            Platform profiles are loading.
          </div>
        ) : profiles.map((profile) => {
          const item = health?.platformSetup.find((entry) => entry.id === `profile:${profile.id}`);
          const ready = item?.status === 'ready';

          return (
            <div key={profile.id} className="rounded-sm border border-white/10 bg-black/[0.34] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white/[0.86]">{profile.displayName}</div>
                  <div className="mt-1 truncate text-xs text-white/[0.38]">
                    {profile.emulator.emulatorName} / {profile.gameFiles.expectedExtensions.join(', ')}
                  </div>
                </div>
                <StatusChip tone={ready ? 'valid' : 'missing'} label={ready ? 'Ready' : 'Missing'} />
              </div>
              <div className="mt-3 text-xs leading-5 text-white/[0.44]">{item?.message ?? 'Health has not run yet.'}</div>
            </div>
          );
        })}
      </div>
      {health && (
        <div className="grid gap-3 lg:grid-cols-2">
          <HealthGroup title="Emulators" items={health.emulators} />
          <HealthGroup title="Platform Setup" items={health.platformSetup} />
          <HealthGroup title="System Files" items={health.systemFiles} />
          <HealthGroup title="Game Files" items={health.gameFiles} />
          <HealthGroup title="Repositories" items={[...health.repositories, health.downloader]} />
        </div>
      )}
    </section>
  );
}

function UpdatesSection({
  state,
  onCheck,
  onInstall
}: {
  state: UpdatePanelState;
  onCheck: () => Promise<void>;
  onInstall: () => Promise<void>;
}) {
  return (
    <section className="grid gap-4" data-testid="settings-modal-updates-panel">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.35]">Updates</div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.52]">
          GitHub Releases updater for the Windows MVP build.
        </p>
      </div>
      <UpdateCheckPanel state={state} onCheck={onCheck} onInstall={onInstall} />
    </section>
  );
}

function SourcePreviewCard({ preview }: { preview: RepositoryPreview }) {
  return (
    <div className="mt-4 rounded-sm border border-white/[0.16] bg-white/[0.055] p-4" data-testid="source-preview">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{preview.name}</div>
          <div className="mt-1 truncate text-xs text-white/50">{preview.url}</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-white/[0.36]">{sourceTrustLabel(preview.trustLevel)}</div>
        </div>
        <TrustBadge trustLevel={preview.trustLevel} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-white/56 sm:grid-cols-2">
        <SourceFact label="Games" value={String(preview.catalogCount)} />
        <SourceFact label="System files" value={String(preview.systemFileCount)} />
        <SourceFact label="Version" value={preview.version} />
        <SourceFact label="Hash" value={shortHash(preview.contentHash)} />
        {preview.maintainer && <SourceFact label="Maintainer" value={preview.maintainer} />}
        {preview.license && <SourceFact label="License" value={preview.license} />}
      </div>
      {preview.hasExecutableAssets && (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-amber-200/[0.2] bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
          <ShieldAlert className="h-3.5 w-3.5" />
          Contains executable assets
        </div>
      )}
      {preview.trustLevel === 'unknown' && (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-amber-200/[0.2] bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
          <ShieldAlert className="h-3.5 w-3.5" />
          User source: verify the maintainer and file rights before connecting.
        </div>
      )}
    </div>
  );
}

function RepositorySourceCard({
  repository,
  busyAction,
  onRefreshRepository,
  onDisconnect
}: {
  repository: RepositorySummary;
  busyAction: BusyAction;
  onRefreshRepository: (repositoryId: string) => Promise<void>;
  onDisconnect: (repositoryId: string) => Promise<void>;
}) {
  const refreshing = busyAction === `repo-refresh:${repository.id}`;
  const removing = busyAction === `repo:${repository.id}`;

  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.04] p-4" data-testid="source-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{repository.name}</div>
          <div className="mt-1 truncate text-xs text-white/[0.36]">{repository.url}</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-white/[0.28]">{sourceTrustLabel(repository.trustLevel)}</div>
        </div>
        <TrustBadge trustLevel={repository.trustLevel} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-white/[0.46] sm:grid-cols-2">
        <SourceFact label="Games" value={String(repository.catalogCount)} />
        <SourceFact label="System files" value={String(repository.systemFileCount)} />
        <SourceFact label="Version" value={repository.version} />
        {repository.contentHash && <SourceFact label="Hash" value={shortHash(repository.contentHash)} />}
        {repository.maintainer && <SourceFact label="Maintainer" value={repository.maintainer} />}
        {repository.license && <SourceFact label="License" value={repository.license} />}
      </div>
      {repository.homepageUrl && (
        <div className="mt-2 truncate text-xs text-white/[0.36]">{repository.homepageUrl}</div>
      )}
      {repository.lastRefreshedAt && (
        <div className="mt-2 text-[10px] uppercase text-white/[0.28]">Refreshed {formatDateTime(repository.lastRefreshedAt)}</div>
      )}
      {repository.hasExecutableAssets && (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-amber-200/[0.2] bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
          <ShieldAlert className="h-3.5 w-3.5" />
          Executable assets require trust
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onRefreshRepository(repository.id)}
          disabled={busyAction !== null}
          className="inline-flex h-8 items-center gap-2 rounded-sm border border-white/10 px-3 text-xs font-bold text-white/70"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Refresh
        </button>
        <button
          type="button"
          onClick={() => onDisconnect(repository.id)}
          disabled={busyAction !== null}
          className="inline-flex h-8 items-center gap-2 rounded-sm border border-red-300/[0.2] px-3 text-xs font-bold text-red-100/80"
        >
          {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
          Remove
        </button>
      </div>
    </div>
  );
}

function SourceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-black uppercase tracking-wide text-white/[0.30]">{label}</div>
      <div className="mt-0.5 truncate text-white/70">{value}</div>
    </div>
  );
}

function TrustBadge({ trustLevel }: { trustLevel: string }) {
  return (
    <span className={`shrink-0 rounded-sm border px-2 py-1 text-[10px] font-black uppercase ${trustBadgeClass(trustLevel)}`}>
      {trustLevel}
    </span>
  );
}

function UpdateCheckPanel({
  state,
  onCheck,
  onInstall
}: {
  state: UpdatePanelState;
  onCheck: () => Promise<void>;
  onInstall: () => Promise<void>;
}) {
  const checking = state.phase === 'checking';
  const installing = state.phase === 'installing';
  const busy = checking || installing;

  return (
    <div className="rounded-sm border border-white/10 bg-black/[0.34] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-black uppercase">
            <RefreshCcw className="h-4 w-4 text-white/72" />
            Update Check
          </div>
          <div className="mt-1 text-sm text-white/[0.46]">GitHub Releases updater for the Windows MVP build.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCheck} disabled={busy} className="rh-mini-action">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {state.phase === 'error' ? 'Retry' : 'Check'}
          </button>
          {state.phase === 'available' && (
            <button type="button" onClick={onInstall} disabled={busy} className="rh-mini-action">
              {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Update now
            </button>
          )}
        </div>
      </div>
      <div className={`rh-update-status rh-update-status-${state.phase}`}>
        {state.phase === 'idle' && 'Check for updates when you are ready.'}
        {state.phase === 'checking' && 'Checking GitHub Releases...'}
        {state.phase === 'installing' && 'Downloading and installing update...'}
        {state.phase === 'up-to-date' && `RetroHydra is up to date${state.report?.currentVersion ? ` (${state.report.currentVersion})` : ''}.`}
        {state.phase === 'available' && (
          <div>
            <div className="font-black text-white">Version {state.report?.version ?? 'unknown'} available</div>
            {state.report?.body && <div className="mt-1 text-white/50">{state.report.body}</div>}
            {state.report?.date && <div className="mt-1 text-white/[0.36]">Published {state.report.date}</div>}
          </div>
        )}
        {state.phase === 'error' && updateErrorMessage(state.error)}
      </div>
    </div>
  );
}

function HealthGroup({ title, items }: { title: string; items: HealthCheckItem[] }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-wide text-white/[0.42]">{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-white/[0.36]">No records yet.</div>
        ) : items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-sm border border-white/[0.08] bg-black/[0.16] px-3 py-2 text-xs">
            <span className={`mt-1 h-2 w-2 rounded-full ${healthToneClass(item.status)}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-white/[0.82]">{item.label}</div>
              <div className="mt-1 text-white/[0.42]">{item.message ?? item.status}</div>
            </div>
            <span className="rounded-sm border border-white/10 px-2 py-1 uppercase text-white/[0.48]">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ tone, label }: { tone: EmulatorDraftTone; label: string }) {
  return (
    <span className={`shrink-0 rounded-sm border px-2 py-1 text-[10px] font-black uppercase ${statusToneClass(tone)}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/[0.34] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/[0.32]">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function PathCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-white/10 bg-white/[0.025] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/[0.32]">{label}</div>
      <div className="mt-2 truncate text-sm text-white/[0.62]">{value}</div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-black text-white/80">{value}</span>
    </div>
  );
}

function sectionTitle(section: SettingsSection) {
  if (section === 'general') return 'General';
  if (section === 'sources') return 'Sources';
  if (section === 'storage') return 'Storage';
  if (section === 'diagnostics') return 'Diagnostics';
  if (section === 'updates') return 'Updates';
  return 'Emulators';
}

function updatePhaseLabel(phase: UpdatePanelPhase) {
  if (phase === 'up-to-date') return 'Current';
  if (phase === 'available') return 'Available';
  if (phase === 'checking') return 'Checking';
  if (phase === 'installing') return 'Installing';
  if (phase === 'error') return 'Error';
  return 'Idle';
}

function statusToneClass(tone: EmulatorDraftTone) {
  if (tone === 'valid') return 'border-emerald-200/[0.24] bg-emerald-200/10 text-emerald-100';
  if (tone === 'missing') return 'border-amber-200/[0.24] bg-amber-200/10 text-amber-100';
  if (tone === 'invalid') return 'border-red-200/[0.24] bg-red-200/10 text-red-100';
  if (tone === 'unsaved') return 'border-white/[0.24] bg-white/[0.09] text-white/[0.82]';
  return 'border-white/[0.12] bg-white/[0.04] text-white/[0.42]';
}

function updateErrorMessage(error: UpdateCheckError | null) {
  if (error?.kind === 'endpointUnreachable') return 'Could not reach update server';
  if (error?.kind === 'signatureInvalid') return 'Update signature could not be verified.';
  if (error?.kind === 'parseError') return error.message ? `Update metadata is invalid: ${error.message}` : 'Update metadata is invalid.';
  return 'Could not check for updates.';
}

function healthToneClass(status: string) {
  if (status === 'ready') return 'bg-hydra-green';
  if (status === 'corrupt' || status === 'error') return 'bg-red-300';
  return 'bg-amber-300';
}

function formatDateTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function shortHash(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function trustBadgeClass(trustLevel: string) {
  if (trustLevel === 'official') return 'border-emerald-300/[0.24] bg-emerald-300/10 text-emerald-100';
  if (trustLevel === 'community') return 'border-hydra-accent/[0.24] bg-hydra-accent/10 text-violet-100';
  return 'border-amber-300/[0.24] bg-amber-300/10 text-amber-100';
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
}
