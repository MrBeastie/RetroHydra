import type { InstallProgressEvent } from '@/types/emulatorProfile';

const STAGE_LABELS: Record<InstallProgressEvent['stage'], string> = {
  emulator: 'Preparing emulator',
  system_files: 'Checking system files',
  game: 'Installing game',
  verify: 'Final verification',
  done: 'Ready to play'
};

export function InstallProgressOverlay({ progress }: { progress: InstallProgressEvent }) {
  const percent = Math.min(Math.max(progress.percent, 0), 100);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-[#0a0a0c]/95 px-6 text-center">
      <p className="text-sm font-bold text-white">{STAGE_LABELS[progress.stage] ?? progress.message}</p>
      <p className="mt-2 max-w-sm text-xs text-white/44">{progress.message}</p>
      <div className="mt-5 h-1 w-64 max-w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-hydra-green transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 font-mono text-xs text-white/40">{percent}%</p>
    </div>
  );
}
