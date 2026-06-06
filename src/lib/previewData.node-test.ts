import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { previewApi } from './previewData.ts';

describe('preview one-click setup support', () => {
  it('installs the recommended NES emulator in preview mode', async () => {
    await previewApi.deleteEmulatorConfig('nes');

    const before = await previewApi.getRecommendedEmulators();
    assert.equal(before.find((item) => item.platform === 'nes')?.status, 'available');

    const config = await previewApi.installRecommendedEmulator('nes');
    const after = await previewApi.getRecommendedEmulators();

    assert.equal(config.platform, 'nes');
    assert.equal(config.status, 'valid');
    assert.equal(after.find((item) => item.platform === 'nes')?.status, 'installed');
  });

  it('can prepare the preview demo download for launch', async () => {
    await previewApi.installRecommendedEmulator('nes');

    const report = await previewApi.startGameDownload('retrohydra_nes_smoke');
    const launch = await previewApi.launchGame('retrohydra_nes_smoke');

    assert.equal(report.sourceKind, 'bundled');
    assert.equal(report.torrent?.status, 'completed');
    assert.equal(launch.executable, 'preview://emulators/Mesen2-2.1.1/Mesen.exe');
  });

  it('runs the full zero-friction install flow', async () => {
    await previewApi.deleteEmulatorConfig('nes');
    await previewApi.removeGame('retrohydra_nes_smoke', true);

    const result = await previewApi.installGame('retrohydra_nes_smoke');
    const emulator = await previewApi.getEmulatorStatus('nes');
    const setup = await previewApi.getGameSetupState('retrohydra_nes_smoke');

    assert.equal(result.status, 'ready');
    assert.equal(emulator.installed, true);
    assert.equal(setup.launch.status, 'ready');
  });

  it('keeps Switch emulator selection manual', async () => {
    await previewApi.deleteEmulatorConfig('switch');

    const result = await previewApi.installGame('star-orbit');

    assert.equal(result.status, 'error');
    assert.equal(result.errorCode, 'switch_emulator_not_configured');
  });
});
