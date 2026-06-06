# Changelog

## v0.1.0

RetroHydra MVP release candidate.

### Added

- Tauri-first Windows desktop launcher shell with local-first library storage.
- Bring-your-own-repository catalog preview, connection, refresh, and validation.
- Schema v3 rich metadata support for artwork, tags, genres, platform setup, and user-provided content.
- Automatic portable-emulator setup for NES/Mesen2, SNES/Mesen2, Nintendo 64/RMG, Game Boy Advance/mGBA, PlayStation 2/PCSX2, and PSP/PPSSPP.
- Manual executable and user-provided system-file setup for PlayStation 1 and Nintendo Switch.
- Game setup center with emulator, system file, game file, and launch readiness checks.
- Settings health reporting for repositories, downloads, game files, and platform setup.
- First-party NES smoke repository and package smoke harness without commercial ROM, BIOS, firmware, or key payloads.
- Windows RC gates for QA, preview smoke, visual smoke, Tauri build, NSIS artifact verification, and packaged binary smoke.
- GitHub Releases updater integration with updater-artifact signing for tagged Windows releases.

### Notes

- Only updater signing is required for this RC. Windows Authenticode signing is deferred production hardening.
- The packaged smoke harness verifies the built binary, NSIS artifact presence, clean app data setup, and profile readiness transitions. It does not automate the NSIS installer UI or uninstall flow.
- Users must provide their own legally obtained commercial games, BIOS files, firmware, and keys.
