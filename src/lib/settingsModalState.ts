import { getEmulatorConfig, getEmulatorPath, setEmulatorPath, type AppSettings } from './settings.ts';
import { MVP_PLATFORMS, type MvpPlatform } from '../types/platform.ts';

export type EmulatorSaveIntent = 'unchanged' | 'save' | 'delete';
export type EmulatorDraftTone = 'empty' | 'unsaved' | 'valid' | 'missing' | 'invalid';

export interface EmulatorDraftState {
  label: string;
  tone: EmulatorDraftTone;
  saveIntent: EmulatorSaveIntent;
  detail: string;
}

export function updateDraftEmulatorPath(
  settings: AppSettings,
  platform: MvpPlatform,
  executablePath: string
): AppSettings {
  return setEmulatorPath(settings, platform, executablePath);
}

export function getEmulatorSaveIntent(
  draftSettings: AppSettings,
  savedSettings: AppSettings,
  platform: MvpPlatform
): EmulatorSaveIntent {
  const draftPath = getEmulatorPath(draftSettings, platform);
  const savedPath = getEmulatorPath(savedSettings, platform);

  if (draftPath === savedPath) return 'unchanged';
  return draftPath ? 'save' : 'delete';
}

export function getEmulatorDraftState(
  draftSettings: AppSettings,
  savedSettings: AppSettings,
  platform: MvpPlatform
): EmulatorDraftState {
  const draftPath = getEmulatorPath(draftSettings, platform);
  const savedPath = getEmulatorPath(savedSettings, platform);
  const saveIntent = getEmulatorSaveIntent(draftSettings, savedSettings, platform);

  if (!draftPath && savedPath) {
    return {
      label: 'Remove on save',
      tone: 'unsaved',
      saveIntent,
      detail: 'This platform path will be cleared when changes are saved.'
    };
  }

  if (!draftPath) {
    return {
      label: 'Not set',
      tone: 'empty',
      saveIntent,
      detail: 'Select an executable before launching this platform.'
    };
  }

  if (draftPath !== savedPath) {
    return {
      label: 'Unsaved',
      tone: 'unsaved',
      saveIntent,
      detail: 'Selected locally. Save changes to validate and persist it.'
    };
  }

  const savedConfig = getEmulatorConfig(savedSettings, platform);
  if (savedConfig?.status === 'valid') {
    return {
      label: 'Ready',
      tone: 'valid',
      saveIntent,
      detail: 'Executable is saved and available.'
    };
  }

  if (savedConfig?.status === 'missing') {
    return {
      label: 'File moved',
      tone: 'missing',
      saveIntent,
      detail: 'The saved executable can no longer be found.'
    };
  }

  if (savedConfig?.status === 'invalid') {
    return {
      label: 'Invalid',
      tone: 'invalid',
      saveIntent,
      detail: 'The saved executable failed validation.'
    };
  }

  return {
    label: 'Saved',
    tone: 'valid',
    saveIntent,
    detail: 'Executable path is saved.'
  };
}

export function hasEmulatorDraftChanges(
  draftSettings: AppSettings,
  savedSettings: AppSettings
): boolean {
  return MVP_PLATFORMS.some((platform) => (
    getEmulatorPath(draftSettings, platform) !== getEmulatorPath(savedSettings, platform)
  ));
}

export function countConfiguredEmulators(settings: AppSettings): number {
  return MVP_PLATFORMS.filter((platform) => Boolean(getEmulatorPath(settings, platform))).length;
}
