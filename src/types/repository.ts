import { z } from 'zod';

const sha256Pattern = /^[a-f0-9]{64}$/i;

export interface RepositorySchema {
  metadata: {
    id: string;
    name: string;
    version: string;
    schemaVersion: 1;
    updatedAt?: string;
  };
  system_files: RepositoryAsset[];
  catalog: RepositoryGame[];
}

export type SourceUri =
  | { kind: 'http'; url: string; sha256: string; sizeBytes?: number }
  | { kind: 'magnet'; uri: string; infoHash?: string; sizeBytes?: number };

export interface RepositoryAsset {
  id: string;
  platform: string;
  assetKind: 'emulator' | 'bios' | 'firmware' | 'keys' | 'patch' | 'runtime';
  displayName: string;
  sources: SourceUri[];
  installHint?: {
    target: 'app_system' | 'emulator_dir' | 'user_selected';
    relativePath?: string;
  };
  executable?: boolean;
}

export interface RepositoryGame {
  id: string;
  platform: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  trailerUrl?: string;
  downloads: SourceUri[];
  requiredSystemFileIds?: string[];
}

export interface RepositorySummary {
  id: string;
  name: string;
  version: string;
  url: string;
  connectedAt: string;
  catalogCount: number;
  systemFileCount: number;
}

export interface CatalogGame {
  id: string;
  sourceId: string;
  repositoryId: string;
  repositoryName: string;
  platform: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  trailerUrl?: string;
  downloads: SourceUri[];
  requiredSystemFileIds: string[];
}

export interface AssetView {
  id: string;
  sourceId: string;
  repositoryId: string;
  platform: string;
  assetKind: RepositoryAsset['assetKind'];
  displayName: string;
  sources: SourceUri[];
  executable: boolean;
}

export interface RequirementItem {
  asset: AssetView;
  downloaded: boolean;
  trusted: boolean;
  localPath?: string;
}

export interface RequirementsReport {
  gameId: string;
  ready: boolean;
  gameDownloaded: boolean;
  requirements: RequirementItem[];
}

export interface DownloadRecord {
  subjectId: string;
  subjectType: 'asset' | 'game';
  status: 'ready' | 'error';
  localPath?: string;
  sha256?: string;
  message?: string;
  updatedAt: string;
}

export interface TrustedExecutable {
  assetId: string;
  localPath: string;
  sha256: string;
  trustedAt: string;
}

export const sourceUriSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('http'),
    url: z.string().url(),
    sha256: z.string().regex(sha256Pattern, 'HTTP sources must include a lowercase or uppercase SHA-256 hash'),
    sizeBytes: z.number().int().positive().optional()
  }),
  z.object({
    kind: z.literal('magnet'),
    uri: z.string().startsWith('magnet:'),
    infoHash: z.string().min(32).optional(),
    sizeBytes: z.number().int().positive().optional()
  })
]);

export const repositoryAssetSchema = z.object({
  id: z.string().min(1),
  platform: z.string().min(1),
  assetKind: z.enum(['emulator', 'bios', 'firmware', 'keys', 'patch', 'runtime']),
  displayName: z.string().min(1),
  sources: z.array(sourceUriSchema).min(1),
  installHint: z.object({
    target: z.enum(['app_system', 'emulator_dir', 'user_selected']),
    relativePath: z.string().min(1).optional()
  }).optional(),
  executable: z.boolean().optional()
});

export const repositoryGameSchema = z.object({
  id: z.string().min(1),
  platform: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  trailerUrl: z.string().url().optional(),
  downloads: z.array(sourceUriSchema).min(1),
  requiredSystemFileIds: z.array(z.string().min(1)).optional()
});

export const repositorySchema = z.object({
  metadata: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    schemaVersion: z.literal(1),
    updatedAt: z.string().optional()
  }),
  system_files: z.array(repositoryAssetSchema),
  catalog: z.array(repositoryGameSchema)
}) satisfies z.ZodType<RepositorySchema>;

export function validateRepositorySchema(input: unknown): RepositorySchema {
  return repositorySchema.parse(input);
}
