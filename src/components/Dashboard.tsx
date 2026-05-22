'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, RefreshCcw, Trash2 } from 'lucide-react';
import { GameDetailsModal } from '@/components/GameDetailsModal';
import type { CatalogGame, RepositorySummary } from '@/types/repository';

interface DashboardProps {
  catalog: CatalogGame[];
  repositories: RepositorySummary[];
  message: string | null;
  onDisconnectRepository: (repositoryId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function Dashboard({
  catalog,
  repositories,
  message,
  onDisconnectRepository,
  onRefresh
}: DashboardProps) {
  const [selectedGame, setSelectedGame] = useState<CatalogGame | null>(null);
  const [activeRepository, setActiveRepository] = useState<string>('all');
  const [busyRepository, setBusyRepository] = useState<string | null>(null);

  const visibleGames = useMemo(() => {
    if (activeRepository === 'all') return catalog;
    return catalog.filter((game) => game.repositoryId === activeRepository);
  }, [activeRepository, catalog]);

  const disconnect = async (repositoryId: string) => {
    setBusyRepository(repositoryId);
    try {
      await onDisconnectRepository(repositoryId);
    } finally {
      setBusyRepository(null);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-[290px_1fr] bg-[#0f0f11] text-white">
      <aside className="border-r border-white/10 bg-[#131316] px-5 py-6">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-hydra-accent text-xs font-black shadow-glow">
            RH
          </div>
          <div>
            <div className="font-black">RetroHydra</div>
            <div className="text-xs text-white/42">BYOR catalog</div>
          </div>
        </div>

        <button
          onClick={() => setActiveRepository('all')}
          className={`mb-3 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
            activeRepository === 'all' ? 'bg-white/10 text-white' : 'text-white/58 hover:bg-white/[0.06]'
          }`}
        >
          <span>All repositories</span>
          <span className="text-xs text-white/38">{catalog.length}</span>
        </button>

        <div className="space-y-2">
          {repositories.map((repository) => (
            <div key={repository.id} className="rounded-md border border-white/8 bg-black/20 p-3">
              <button
                onClick={() => setActiveRepository(repository.id)}
                className="block w-full text-left"
              >
                <div className="truncate text-sm font-bold text-white/88">{repository.name}</div>
                <div className="mt-1 truncate text-xs text-white/36">{repository.url}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-white/42">
                  <Database className="h-3.5 w-3.5" />
                  {repository.catalogCount} games
                </div>
              </button>
              <button
                onClick={() => disconnect(repository.id)}
                disabled={busyRepository === repository.id}
                className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/52 transition hover:text-red-200 disabled:opacity-40"
                title="Disconnect repository"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 px-8 py-7">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Catalog</h1>
            <p className="mt-1 text-sm text-white/46">
              {visibleGames.length} entries from user-connected repositories.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/76 transition hover:bg-white/12"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </header>

        {message && (
          <div className="mb-5 rounded-md border border-amber-300/24 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            {message}
          </div>
        )}

        {visibleGames.length === 0 ? (
          <div className="grid min-h-[420px] place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-sm text-white/48">
            No catalog entries in the selected repository.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
            {visibleGames.map((game) => (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedGame(game)}
                className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-left transition hover:border-hydra-accent/50 hover:bg-white/[0.07]"
              >
                <div className="aspect-[3/4] bg-[#1a1a20]">
                  {game.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-4 text-center text-sm font-bold text-white/32">
                      {game.title}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-bold">{game.title}</div>
                  <div className="mt-1 truncate text-xs text-white/38">{game.platform}</div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {selectedGame && (
        <GameDetailsModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onRefresh={onRefresh}
        />
      )}
    </main>
  );
}
