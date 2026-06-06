import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateSourceLibraryObject } from './validate-source-library.mjs';

const PUBLIC_TEMPLATE_URL = 'https://mrbeastie.github.io/RetroHydra/source-library-template/repository.json';
const TEMPLATE_DIR = path.resolve('templates/source-library');
const DEFAULT_OUTPUT_DIR = path.resolve('out');
const CHECK_OUTPUT_DIR = path.resolve('.tmp/source-library-template-pages-check');

async function main(args = process.argv.slice(2)) {
  const mode = args.includes('--check') ? 'check' : 'build';
  const outputRoot = mode === 'check' ? CHECK_OUTPUT_DIR : DEFAULT_OUTPUT_DIR;
  const artifact = await buildSourceTemplateArtifact(outputRoot);

  if (mode === 'check') {
    assertArtifact(artifact);
    console.log(`[ok] source library template artifact is reproducible at ${path.relative(process.cwd(), outputRoot)}`);
    return;
  }

  console.log(`[ok] source library template published at ${path.relative(process.cwd(), artifact.directory)}`);
  console.log(`[ok] ${PUBLIC_TEMPLATE_URL}`);
}

async function buildSourceTemplateArtifact(outputRoot) {
  const repositoryPath = path.join(TEMPLATE_DIR, 'repository.json');
  const readmePath = path.join(TEMPLATE_DIR, 'README.md');
  const repositoryRaw = await readFile(repositoryPath, 'utf8');
  const readmeRaw = await readFile(readmePath, 'utf8');
  const repository = JSON.parse(repositoryRaw);
  const report = validateSourceLibraryObject(repository, { filePath: repositoryPath });

  if (report.errors.length > 0) {
    throw new Error(`Source template is invalid:\n${report.errors.join('\n')}`);
  }

  const artifactDirectory = path.join(outputRoot, 'source-library-template');
  const repositoryHash = createHash('sha256').update(repositoryRaw).digest('hex');
  const manifest = {
    name: repository.metadata.name,
    templateId: repository.metadata.id,
    version: repository.metadata.version,
    schemaVersion: repository.metadata.schemaVersion,
    trustLevel: repository.metadata.trustLevel,
    publicUrl: PUBLIC_TEMPLATE_URL,
    repositoryJson: './repository.json',
    readme: './README.md',
    repositorySha256: repositoryHash,
    catalogCount: repository.catalog.length,
    systemFileCount: repository.system_files.length,
    updatedAt: repository.metadata.updatedAt
  };

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(path.join(outputRoot, '.nojekyll'), '');
  await writeFile(path.join(artifactDirectory, 'repository.json'), repositoryRaw);
  await writeFile(path.join(artifactDirectory, 'README.md'), readmeRaw);
  await writeFile(path.join(artifactDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(artifactDirectory, 'index.html'), renderIndexHtml(manifest));

  return {
    directory: artifactDirectory,
    manifest,
    repository,
    repositoryRaw,
    readmeRaw
  };
}

function assertArtifact(artifact) {
  if (artifact.manifest.publicUrl !== PUBLIC_TEMPLATE_URL) {
    throw new Error(`Unexpected public URL: ${artifact.manifest.publicUrl}`);
  }
  if (artifact.manifest.templateId !== 'retrohydra-source-template') {
    throw new Error(`Unexpected template id: ${artifact.manifest.templateId}`);
  }
  if (artifact.manifest.trustLevel !== 'community') {
    throw new Error(`Template trustLevel must stay community, got ${artifact.manifest.trustLevel}`);
  }
  if (artifact.manifest.catalogCount !== artifact.repository.catalog.length) {
    throw new Error('Manifest catalogCount does not match repository.json');
  }
  if (artifact.manifest.systemFileCount !== artifact.repository.system_files.length) {
    throw new Error('Manifest systemFileCount does not match repository.json');
  }
}

function renderIndexHtml(manifest) {
  const escapedName = escapeHtml(manifest.name);
  const escapedUrl = escapeHtml(manifest.publicUrl);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedName}</title>
  <style>
    body { background: #050507; color: #f5f5f5; font-family: system-ui, sans-serif; margin: 0; padding: 32px; }
    main { max-width: 760px; }
    a { color: #9ee7ff; }
    code { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); padding: 2px 6px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapedName}</h1>
    <p>Paste this source URL into RetroHydra Settings &gt; Sources:</p>
    <p><code>${escapedUrl}</code></p>
    <p><a href="./repository.json">repository.json</a> | <a href="./README.md">README.md</a> | <a href="./manifest.json">manifest.json</a></p>
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

await main();
