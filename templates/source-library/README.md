# RetroHydra Source Library Template

This directory is a starter source library for RetroHydra. Copy it into a new
repository, edit `repository.json`, host the JSON file, and connect that URL or
local file in RetroHydra.

The canonical starter template is published by RetroHydra at:

```text
https://mrbeastie.github.io/RetroHydra/source-library-template/repository.json
```

## Quick Start

1. Copy this directory into a new GitHub repository, including the
   `.github/workflows` folder.
2. Replace the metadata in `repository.json`.
3. Replace the sample catalog entries with your own entries.
4. Replace `YOUR_ORG_OR_USER/RetroHydra` in the copied workflows with the
   RetroHydra validator repository, usually `MrBeastie/RetroHydra`.
5. Run the validator from the RetroHydra project:

```powershell
npm run source:validate -- templates/source-library/repository.json
```

For a standalone source repository, keep the same command in CI after checking
out the RetroHydra validator, as shown in `.github/workflows/validate.yml`.

## Publish with GitHub Pages

1. In the new source repository, open Settings > Pages.
2. Set Build and deployment to GitHub Actions.
3. Push to `main` or run `Publish RetroHydra source library` manually.
4. Paste this URL into RetroHydra Settings > Sources:

```text
https://<owner>.github.io/<repo>/repository.json
```

## Source Modes

- `downloadable`: content you are allowed to distribute, using `http` or
  `magnet` sources.
- `user_provided`: content the user must import locally, such as ROMs, disc
  images, BIOS files, firmware, and keys.
- `metadata_only`: catalog metadata and setup hints without payload
  distribution.

RetroHydra supports community and private source libraries. The library author
is responsible for every URL, magnet URI, checksum, and legal claim they
publish. RetroHydra only labels this template as a community source and checks
that the JSON shape can be loaded.

## Hosting

You can host `repository.json` through GitHub Pages, a raw GitHub URL, a static
CDN, or a private HTTPS endpoint. Local JSON import is available in the
RetroHydra desktop build.
