'use client';

import {
  Download,
  FolderHeart,
  Gamepad2,
  type LucideIcon,
  MoreHorizontal,
  Play,
  RotateCw
} from 'lucide-react';
import { GameArt, GamePoster } from './GamePoster';
import { PLATFORM_LABELS } from '../../types/platform.ts';
import type { GameLibraryItem, LibraryFilter, LibrarySort } from '../../lib/libraryStatus.ts';
import type { CatalogGame } from '../../types/repository.ts';

export interface CollectionTarget {
  filter: LibraryFilter;
  query: string;
  sort: LibrarySort;
}

interface HeroPanelProps {
  heroItem: GameLibraryItem | null;
  rails: HomeRail[];
  busyAction: string | null;
  onPrimaryAction: (item: GameLibraryItem) => void;
  onOpenDetails: (game: CatalogGame) => void;
  onOpenSettings: () => void;
  onFocus: (focusId: string) => void;
}

export interface HomeRail {
  title: string;
  testId: string;
  zone: string;
  items: GameLibraryItem[];
}

export function HeroPanel({
  heroItem,
  rails,
  busyAction,
  onPrimaryAction,
  onOpenDetails,
  onOpenSettings,
  onFocus
}: HeroPanelProps) {
  const visibleRails = rails.filter((rail) => rail.items.length > 0).slice(0, 4);

  if (!heroItem) {
    return (
      <section className="rh-hero-panel rh-hero-empty-panel" data-testid="home-hero">
        <div className="rh-home-empty">
          <Gamepad2 className="h-8 w-8 text-hydra-accent" />
          <div>
            <div className="rh-home-empty-title">No games yet</div>
            <p className="rh-home-empty-copy">Open Settings to connect a repository or restore the built-in demo source.</p>
          </div>
          <button
            data-focus-id="home:settings"
            data-focus-zone="hero"
            onFocus={() => onFocus('home:settings')}
            onClick={onOpenSettings}
            className="rh-primary-action rh-focusable"
          >
            Open Settings
          </button>
        </div>
      </section>
    );
  }

  const progressVisible = heroItem.isDownloading || heroItem.isPaused || heroItem.hasError
    || (heroItem.progressPercent > 0 && heroItem.progressPercent < 100);
  const metaItems = [
    `Status: ${heroItem.statusLabel}`,
    `Source: ${heroItem.game.repositoryName}`,
    progressVisible ? `Progress: ${heroItem.progressPercent.toFixed(0)}%` : null
  ].filter((item): item is string => Boolean(item));
  const setupHint = heroItem.missingRequirements[0] ?? null;

  return (
    <section className="rh-hero-panel" data-testid="home-hero">
      <div className="rh-hero-bg">
        <GameArt game={heroItem.game} className="h-full w-full" hero />
      </div>
      <div className="rh-hero-scrim" />

      <div className="rh-hero-content">
        <div className="rh-hero-copy-stack">
          <div className="rh-hero-kicker">
            <span className="rh-platform-chip">{heroItem.game.platform}</span>
            <span>{heroItem.game.metadata?.releaseYear ?? 'MVP Demo'}</span>
            <span>/</span>
            <span>{heroItem.game.metadata?.genres?.[0] ?? PLATFORM_LABELS[heroItem.game.platform]}</span>
          </div>
          <h1 className="rh-hero-title">
            {heroItem.game.title}
          </h1>
          {heroItem.game.description && (
            <p className="rh-hero-description">{heroItem.game.description}</p>
          )}
          {setupHint && (
            <div className="rh-hero-alert">
              <RotateCw className="h-3.5 w-3.5" />
              <span>{setupHint}</span>
            </div>
          )}
          <div className="rh-hero-actions">
            <button
              data-focus-id={`action:${encodeURIComponent(heroItem.game.id)}`}
              data-focus-zone="hero"
              onFocus={() => onFocus(`action:${encodeURIComponent(heroItem.game.id)}`)}
              onClick={() => onPrimaryAction(heroItem)}
              disabled={busyAction !== null}
              className="rh-primary-action rh-focusable"
            >
              {heroItem.primaryAction === 'play' ? <Play className="h-4 w-4" /> : heroItem.primaryAction === 'download' || heroItem.primaryAction === 'import' ? <Download className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
              {heroItem.primaryActionLabel}
            </button>
            <button
              data-focus-id={`details:${encodeURIComponent(heroItem.game.id)}`}
              data-focus-zone="hero"
              onFocus={() => onFocus(`details:${encodeURIComponent(heroItem.game.id)}`)}
              onClick={() => onOpenDetails(heroItem.game)}
              className="rh-square-action rh-focusable"
              title="Details"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="rh-hero-meta">
            {metaItems.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>

        <div className="rh-home-rails">
          {visibleRails.map((rail) => (
            <MiniRail
              key={rail.testId}
              title={rail.title}
              testId={rail.testId}
              items={rail.items}
              zone={rail.zone}
              onOpenDetails={onOpenDetails}
              onPrimaryAction={onPrimaryAction}
              onFocus={onFocus}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CollectionsPanel({
  items,
  onOpenCollection,
  onFocus
}: {
  items: GameLibraryItem[];
  onOpenCollection: (target: CollectionTarget) => void;
  onFocus: (focusId: string) => void;
}) {
  const byPlatform = new Map<string, number>();
  items.forEach((item) => byPlatform.set(item.game.platform, (byPlatform.get(item.game.platform) ?? 0) + 1));
  const readyCount = items.filter((item) => item.readyToPlay).length;
  const downloadCount = items.filter((item) => item.isDownloading || item.isPaused || item.hasError).length;
  const missingCount = items.filter((item) => item.missingRequirements.length > 0).length;
  const collectionCards: Array<{
    id: string;
    label: string;
    count: number;
    icon: LucideIcon;
    active?: boolean;
  }> = [
    { id: 'all', label: 'All Games', count: items.length, icon: FolderHeart, active: true },
    { id: 'ready', label: 'Ready to Play', count: readyCount, icon: Play },
    { id: 'downloads', label: 'Downloads', count: downloadCount, icon: Download },
    { id: 'missing', label: 'Needs Setup', count: missingCount, icon: RotateCw },
    ...Array.from(byPlatform.entries()).slice(0, 6).map(([platform, count]) => ({
      id: `platform:${platform}`,
      label: PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform,
      count,
      icon: Gamepad2
    }))
  ];

  return (
    <section className="rh-collections-panel" data-testid="collections-panel">
      <PanelTitle icon={FolderHeart} title="Collections" />
      <div className="rh-collections-grid">
        {collectionCards.slice(0, 8).map((card) => {
          const Icon = card.icon;
          const focusId = `collection:${card.id}`;
          return (
            <button
              key={card.label}
              data-testid="collection-card"
              data-focus-id={focusId}
              data-focus-zone="collections"
              onFocus={() => onFocus(focusId)}
              onClick={() => onOpenCollection(collectionTargetForId(card.id))}
              className={`rh-collection-card rh-focusable ${card.active ? 'rh-collection-card-active' : ''}`}
            >
              <Icon className="h-4 w-4" />
              <span className="mt-3 block text-[11px] font-black uppercase">{card.label}</span>
              <span className="mt-1 block text-[10px] text-white/48">{card.count} games</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function collectionTargetForId(id: string): CollectionTarget {
  if (id.startsWith('platform:')) {
    return { filter: 'all', query: id.slice('platform:'.length), sort: 'title' };
  }
  if (id === 'ready') return { filter: 'all', query: 'ready to play', sort: 'status' };
  if (id === 'downloads') return { filter: 'downloading', query: '', sort: 'status' };
  if (id === 'missing') return { filter: 'missing', query: '', sort: 'status' };
  return { filter: 'all', query: '', sort: 'title' };
}

function MiniRail({
  title,
  testId,
  items,
  zone,
  onOpenDetails,
  onPrimaryAction,
  onFocus
}: {
  title: string;
  testId: string;
  items: GameLibraryItem[];
  zone: string;
  onOpenDetails: (game: CatalogGame) => void;
  onPrimaryAction: (item: GameLibraryItem) => void;
  onFocus: (focusId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rh-mini-rail" data-testid={testId}>
      <div className="rh-mini-rail-title">{title}</div>
      <div className="rh-mini-rail-track">
        {items.slice(0, 8).map((item) => (
          <GamePoster
            key={`${zone}:${item.game.id}`}
            item={item}
            compact
            focusId={`game:${zone}:${encodeURIComponent(item.game.id)}`}
            zone={zone}
            onOpen={onOpenDetails}
            onAction={onPrimaryAction}
            onFocus={onFocus}
          />
        ))}
      </div>
    </div>
  );
}

export function mergeRailItems(primaryItems: GameLibraryItem[], fallbackItems: GameLibraryItem[], limit: number) {
  const seen = new Set<string>();
  const result: GameLibraryItem[] = [];

  for (const item of [...primaryItems, ...fallbackItems]) {
    if (seen.has(item.game.id)) continue;
    seen.add(item.game.id);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em]">
      <Icon className="h-4 w-4 text-white/52" />
      {title}
    </div>
  );
}
