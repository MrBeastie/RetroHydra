import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { launchFailureView, normalizeLaunchFailure } from './launchErrors.ts';

describe('launch error mapping', () => {
  it('normalizes structured launch failures', () => {
    const failure = normalizeLaunchFailure({
      kind: 'SystemFilesMissing',
      gameId: 'repo::game',
      assets: ['prod.keys']
    });

    assert.equal(failure.kind, 'SystemFilesMissing');
    assert.deepEqual(failure.assets, ['prod.keys']);
  });

  it('maps missing system files to details action', () => {
    const view = launchFailureView({
      kind: 'SystemFilesMissing',
      gameId: 'repo::game',
      assets: ['SCPH1001.bin']
    });

    assert.equal(view.actionKind, 'details');
    assert.match(view.message, /SCPH1001\.bin/);
  });

  it('maps corrupt game files to re-download action', () => {
    const view = launchFailureView({
      kind: 'GameFileCorrupt',
      gameId: 'repo::game',
      assets: [],
      message: 'NES game file does not contain a valid iNES header'
    });

    assert.equal(view.actionKind, 'retry-download');
    assert.match(view.message, /iNES header/);
  });

  it('maps string errors to spawn failures', () => {
    const failure = normalizeLaunchFailure('boom');

    assert.equal(failure.kind, 'SpawnFailed');
    assert.equal(failure.message, 'boom');
  });
});
