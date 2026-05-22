'use client';

import { useEffect, useState } from 'react';
import { Loader2, Play, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CatalogGame, RequirementsReport } from '@/types/repository';

interface GameDetailsModalProps {
  game: CatalogGame;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function GameDetailsModal({ game, onClose, onRefresh }: GameDetailsModalProps) {
  const [requirements, setRequirements] = useState<RequirementsReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRequirements = async () => {
    try {
      setRequirements(await api.checkRequirements(game.id));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    loadRequirements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setMessage(null);
    try {
      await action();
      await loadRequirements();
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-5">
      <section className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/12 bg-[#141417] shadow-2xl">
        <header className="flex items-start gap-4 border-b border-white/10 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">{game.title}</h2>
            <div className="mt-1 text-sm text-white/46">{game.platform} · {game.repositoryName}</div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/60 transition hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-[210px_1fr] gap-5 p-5">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1a1a20]">
            <div className="aspect-[3/4]">
              {game.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center px-4 text-center text-sm font-bold text-white/32">
                  {game.title}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            {game.description && (
              <p className="mb-5 text-sm leading-6 text-white/66">{game.description}</p>
            )}

            <div className="mb-5 space-y-2">
              {(requirements?.requirements || []).map((item) => (
                <div key={item.asset.id} className="flex items-center justify-between gap-3 rounded-md bg-black/22 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{item.asset.displayName}</div>
                    <div className="mt-1 text-xs text-white/38">{item.asset.assetKind}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.downloaded ? (
                      <ShieldCheck className="h-4 w-4 text-hydra-green" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-200" />
                    )}
                    <button
                      onClick={() => run(`asset:${item.asset.id}`, () => api.downloadAsset(item.asset.id))}
                      disabled={busy !== null}
                      className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-white/72 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {busy === `asset:${item.asset.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Download'}
                    </button>
                    {item.asset.executable && item.downloaded && !item.trusted && (
                      <button
                        onClick={() => run(`trust:${item.asset.id}`, () => api.trustExecutable(item.asset.id))}
                        disabled={busy !== null}
                        className="h-8 rounded-md bg-hydra-accent px-3 text-xs font-bold text-white transition hover:bg-violet-500 disabled:opacity-40"
                      >
                        Trust
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {message && (
              <div className="mb-4 rounded-md border border-amber-300/24 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => run('game-download', () => api.downloadGame(game.id))}
                disabled={busy !== null}
                className="h-10 rounded-md border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/76 transition hover:bg-white/12 disabled:opacity-40"
              >
                {busy === 'game-download' ? 'Downloading' : 'Download'}
              </button>
              <button
                onClick={() => run('launch', () => api.launchGame(game.id))}
                disabled={busy !== null}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-hydra-accent px-4 text-sm font-bold text-white shadow-glow transition hover:bg-violet-500 disabled:opacity-40"
              >
                {busy === 'launch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Play
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
