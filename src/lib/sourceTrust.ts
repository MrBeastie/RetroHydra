import type { RepositoryPreview, RepositorySummary, RepositoryTrustLevel } from '@/types/repository';

type SourceTrustTarget = Pick<RepositoryPreview, 'name' | 'url' | 'catalogCount' | 'systemFileCount'>;

export function sourceTrustLabel(trustLevel: RepositoryTrustLevel | string) {
  if (trustLevel === 'official') return 'Official source';
  if (trustLevel === 'community') return 'Community source';
  return 'User source';
}

export function unknownSourcePrompt(source: SourceTrustTarget | RepositorySummary) {
  return [
    'Connect user source?',
    '',
    source.name,
    source.url,
    `${source.catalogCount} games, ${source.systemFileCount} system files.`,
    '',
    'RetroHydra has not verified this source. Connect it only if you trust the maintainer and are allowed to use the referenced files.'
  ].join('\n');
}
