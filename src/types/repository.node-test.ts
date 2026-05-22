import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateRepositorySchema } from './repository.ts';

const hash = 'a'.repeat(64);

describe('repository schema', () => {
  it('accepts a strict BYOR repository', () => {
    const repo = validateRepositorySchema({
      metadata: {
        id: 'community-index',
        name: 'Community Index',
        version: '1.0.0',
        schemaVersion: 1
      },
      system_files: [
        {
          id: 'emu-1',
          platform: 'nes',
          assetKind: 'emulator',
          displayName: 'User Emulator',
          executable: true,
          sources: [{ kind: 'http', url: 'https://example.com/emulator.zip', sha256: hash }]
        }
      ],
      catalog: [
        {
          id: 'game-1',
          platform: 'nes',
          title: 'Homebrew Game',
          downloads: [{ kind: 'magnet', uri: 'magnet:?xt=urn:btih:abcdef' }],
          requiredSystemFileIds: ['emu-1']
        }
      ]
    });

    assert.equal(repo.metadata.id, 'community-index');
  });

  it('rejects HTTP assets without sha256', () => {
    assert.throws(() => validateRepositorySchema({
      metadata: { id: 'bad', name: 'Bad', version: '1', schemaVersion: 1 },
      system_files: [
        {
          id: 'asset',
          platform: 'switch',
          assetKind: 'keys',
          displayName: 'Keys',
          sources: [{ kind: 'http', url: 'https://example.com/keys.zip' }]
        }
      ],
      catalog: []
    }));
  });

  it('rejects unsupported URL-shaped protocols', () => {
    assert.throws(() => validateRepositorySchema({
      metadata: { id: 'bad', name: 'Bad', version: '1', schemaVersion: 1 },
      system_files: [],
      catalog: [
        {
          id: 'game',
          platform: 'nes',
          title: 'Game',
          downloads: [{ kind: 'magnet', uri: 'file:///game.rom' }]
        }
      ]
    }));
  });
});
