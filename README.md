# RetroHydra

RetroHydra is a Windows-first desktop MVP for managing emulator-ready game
libraries from bring-your-own-repository metadata. It is built with Next.js,
Tauri 2, Rust, and local-first storage.

The MVP focuses on:

- repository preview, connection, refresh, and catalog validation;
- schema v3 rich catalog metadata for artwork, genres, tags, and
  user-provided game setup;
- emulator path setup and launch preflight checks;
- direct, bundled, and torrent-aware download state tracking;
- user-provided game, BIOS, firmware, and key import paths for content users
  legally provide themselves;
- a built-in first-party NES smoke-test repository for validation without
  commercial content;
- diagnostics, health checks, and GitHub Releases updater integration.

## First User Path

The public MVP supports a one-pass playable demo setup on Windows:

1. Install RetroHydra.
2. Click **Set up demo** on first launch.
3. RetroHydra connects the built-in demo repository, installs the latest
   supported Mesen2 release, downloads the first-party NES smoke ROM, and
   enables **Play Demo**.

Automatic portable-emulator setup is available for NES, SNES, Nintendo 64,
Game Boy Advance, PlayStation 2, and PSP. PlayStation 1 and Nintendo Switch use
manual executable selection. Platform-owned BIOS, firmware, and keys always
remain user-provided.

## Legal content model

RetroHydra does not ship commercial ROMs, BIOS files, firmware, keys, or
third-party game payloads. Users are expected to provide only content they are
legally allowed to use.

The bundled `public/demo-content/retrohydra-smoke.nes` asset is first-party
RetroHydra smoke-test content and is documented in
`public/demo-content/LICENSE.txt`.

## Development

Prerequisites:

- Node.js 22
- Rust stable
- Windows build tools for Tauri desktop builds

Install and check the project:

```powershell
npm ci
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

Run the full local hardening gate:

```powershell
npm run qa
```

Validate a community or private source library:

```powershell
npm run source:validate -- templates/source-library/repository.json
```

Build and check the public source-library starter URL artifact:

```powershell
npm run source:template:check
npm run pages:build
```

After the GitHub Pages workflow deploys, the starter template is available at:

```text
https://mrbeastie.github.io/RetroHydra/source-library-template/repository.json
```

See `docs/source-library-template.md` for the starter source library template,
hosting guidance, and content mode rules.

Run the MVP release smoke gate:

```powershell
npm run mvp:release
```

`npm run mvp:smoke` validates the preview source/catalog/download/launch/health
path, including user-provided game import. `npm run mvp:visual` captures Home,
Library search, Game Setup, import flow, Collections, Downloads, and Settings
Sources screenshots under `.tmp/mvp-visual`.

Run the Windows RC package gate:

```powershell
npm run mvp:release:windows
```

Without `TAURI_SIGNING_PRIVATE_KEY`, this builds a local NSIS smoke package
without updater artifacts, then runs the packaged binary harness against clean
`.tmp/package-smoke` data. With `TAURI_SIGNING_PRIVATE_KEY`, it builds the normal
updater-artifact package and runs the same packaged smoke.

See `docs/repository-authoring.md` and
`examples/repositories/showcase.metadata.json` for the schema v3 rich metadata
and user-provided content model.

Run the web shell:

```powershell
npm run dev
```

Build the Windows desktop app:

```powershell
npm run tauri:build
```

When updater artifacts are enabled, Tauri requires `TAURI_SIGNING_PRIVATE_KEY`
and optionally `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to sign updater packages.
The GitHub Actions release workflow expects these secrets to be configured in
the repository before publishing a tagged release. The private key must never be
committed.

## Release

The Windows release workflow runs on tags matching `vX.Y.Z` and uploads:

- NSIS installer;
- updater zip;
- updater signature;
- `latest.json` for the Tauri updater.

Tagged Windows releases first run `npm run qa`, `npm run mvp:smoke`, Playwright
Chromium install, `npm run mvp:visual`, signed Tauri build, and packaged smoke
against `src-tauri/target/x86_64-pc-windows-msvc/release`. Updater signing is
required for tagged releases through `TAURI_SIGNING_PRIVATE_KEY`; Windows
Authenticode signing is deferred production hardening and is not part of the RC
gate.

See `docs/mvp-windows-install.md` for the internal MVP install checklist.
See `docs/release-checklist.md` for the tagged Windows release handoff.

## License

No source license has been granted yet. The repository is public for MVP review
and validation unless a separate license file is added. Demo smoke-test content
is covered separately in `public/demo-content/LICENSE.txt`.
