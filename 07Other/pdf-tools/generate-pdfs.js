const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const zlib = require('zlib');

const repoRoot = path.resolve(__dirname, '..', '..');
const outputRoot = path.join(repoRoot, '08PDFDeliverables');
const buildRoot = path.join(outputRoot, '.build');
const htmlRoot = path.join(buildRoot, 'html');
const generatedMarkdownRoot = path.join(buildRoot, 'generated-md');
const stylePath = path.join(__dirname, 'pdf-style.html');

const markdownSources = [
  'README.md',
  '01Definition/project-definition.md',
  '02Requirements/requirements.md',
  '03Documentation/api-documentation.md',
  '03Documentation/api-validation-report.md',
  '03Documentation/architecture.md',
  '03Documentation/aws-deployment-guide.md',
  '03Documentation/business-rules-api-test-report.md',
  '03Documentation/clean-code-solid.md',
  '03Documentation/database.md',
  '03Documentation/oauth-session.md',
  '03Documentation/postman-token-auth-proof.md',
  '03Documentation/security-guide.md',
  '03Documentation/technology-stack.md',
  '03Documentation/testing-guide.md',
  '03Documentation/uri-design.md',
  '05UnitTests/test-plan.md',
  '07Other/codex-cloud-handoff-prompt.md',
  '07Other/final-compliance-review.md',
  '07Other/README.md',
  'postman/README.md',
  'postman/evidence/postman-local-jwt-auth-evidence.md',
];

const plantUmlSources = [
  '04UMLDiagrams/attendance-sequence.puml',
  '04UMLDiagrams/aws-deployment.puml',
  '04UMLDiagrams/class-diagram.puml',
  '04UMLDiagrams/component-diagram.puml',
  '04UMLDiagrams/oauth-sequence.puml',
  '04UMLDiagrams/use-case.puml',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function titleFromPath(relativePath) {
  const base = path.basename(relativePath, path.extname(relativePath));
  return base
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function displayPath(value) {
  return String(value).replace(/\\/g, '/');
}

function outputPdfPath(relativePath) {
  const parsed = path.parse(relativePath);
  return path.join(outputRoot, parsed.dir || '00Root', `${parsed.name}.pdf`);
}

function htmlPathFor(relativePath) {
  const parsed = path.parse(relativePath);
  return path.join(htmlRoot, parsed.dir || '00Root', `${parsed.name}.html`);
}

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a headless-capable browser.');
  }

  return found;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result;
}

function renderHtmlToPdf(chromePath, htmlPath, pdfPath) {
  ensureDir(path.dirname(pdfPath));

  run(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ]);
}

function convertMarkdownToPdf(chromePath, relativePath, pdfPathOverride) {
  const sourcePath = path.join(repoRoot, relativePath);
  const htmlPath = htmlPathFor(relativePath);
  const pdfPath = pdfPathOverride || outputPdfPath(relativePath);

  ensureDir(path.dirname(htmlPath));
  ensureDir(path.dirname(pdfPath));

  run('pandoc', [
    sourcePath,
    '--from',
    'gfm',
    '--to',
    'html5',
    '--standalone',
    '--embed-resources',
    '--toc',
    '--toc-depth=3',
    '--metadata',
    `title=${titleFromPath(relativePath)}`,
    '--include-in-header',
    stylePath,
    '--output',
    htmlPath,
  ]);

  renderHtmlToPdf(chromePath, htmlPath, pdfPath);
  return pdfPath;
}

function plantUmlEncode(text) {
  const data = zlib.deflateRawSync(Buffer.from(text, 'utf8'));
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  let encoded = '';

  for (let index = 0; index < data.length; index += 3) {
    const b1 = data[index];
    const b2 = index + 1 < data.length ? data[index + 1] : 0;
    const b3 = index + 2 < data.length ? data[index + 2] : 0;
    encoded += alphabet[b1 >> 2];
    encoded += alphabet[((b1 & 0x3) << 4) | (b2 >> 4)];
    encoded += alphabet[((b2 & 0xf) << 2) | (b3 >> 6)];
    encoded += alphabet[b3 & 0x3f];
  }

  return encoded;
}

async function fetchPlantUmlSvg(source) {
  const encoded = plantUmlEncode(source);
  const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PlantUML server returned ${response.status}`);
  }

  return response.text();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function convertPlantUmlToPdf(chromePath, relativePath) {
  const sourcePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const title = titleFromPath(relativePath);
  const htmlPath = htmlPathFor(relativePath);
  const pdfPath = outputPdfPath(relativePath);
  const style = fs.readFileSync(stylePath, 'utf8');
  let body;

  try {
    const svg = await fetchPlantUmlSvg(source);
    const svgBase64 = Buffer.from(svg, 'utf8').toString('base64');
    body = `
      <h1>${escapeHtml(title)}</h1>
      <p><strong>Source:</strong> <code>${escapeHtml(relativePath)}</code></p>
      <div class="plantuml-diagram">
        <img alt="${escapeHtml(title)}" src="data:image/svg+xml;base64,${svgBase64}">
      </div>
      <h2>PlantUML Source</h2>
      <pre><code>${escapeHtml(source)}</code></pre>
    `;
  } catch (error) {
    body = `
      <h1>${escapeHtml(title)}</h1>
      <p><strong>Source:</strong> <code>${escapeHtml(relativePath)}</code></p>
      <blockquote>Rendered diagram could not be fetched, so this PDF contains the PlantUML source.</blockquote>
      <pre><code>${escapeHtml(source)}</code></pre>
    `;
  }

  ensureDir(path.dirname(htmlPath));
  ensureDir(path.dirname(pdfPath));

  fs.writeFileSync(
    htmlPath,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  ${style}
</head>
<body>${body}</body>
</html>`,
    'utf8',
  );

  renderHtmlToPdf(chromePath, htmlPath, pdfPath);
  return pdfPath;
}

function collectPostmanRequests(items, folder = []) {
  const rows = [];

  for (const item of items || []) {
    if (item.request) {
      rows.push({
        folder: folder.join(' / ') || 'Root',
        name: item.name || 'Unnamed request',
        method: item.request.method || 'GET',
        url: item.request.url?.raw || '',
      });
      continue;
    }

    rows.push(...collectPostmanRequests(item.item, [...folder, item.name || 'Unnamed folder']));
  }

  return rows;
}

function maskEnvironmentValue(key, value) {
  if (/token|secret|password|session|cookie/i.test(key)) {
    return value ? '[masked]' : '';
  }

  return value ?? '';
}

function writePostmanSummaryMarkdown() {
  const collectionPath = path.join(repoRoot, 'postman', 'American-Latin-Class-API.postman_collection.json');
  const environmentPath = path.join(repoRoot, 'postman', 'American-Latin-Class.postman_environment.json');
  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
  const requests = collectPostmanRequests(collection.item);
  const folders = [...new Set(requests.map((request) => request.folder))];
  const outputPath = path.join(generatedMarkdownRoot, 'postman-collection-summary.md');

  ensureDir(path.dirname(outputPath));

  const requestRows = requests
    .map((request) => `| ${request.folder} | \`${request.method}\` | ${request.name} | \`${request.url}\` |`)
    .join('\n');

  const envRows = (environment.values || [])
    .map((entry) => `| \`${entry.key}\` | \`${maskEnvironmentValue(entry.key, entry.value)}\` | ${entry.enabled === false ? 'No' : 'Yes'} |`)
    .join('\n');

  fs.writeFileSync(
    outputPath,
    `# Postman Collection Summary

## Overview

- Collection: ${collection.info?.name || 'American Latin Class API'}
- Total requests: ${requests.length}
- Folders: ${folders.length}
- Environment: ${environment.name || 'American Latin Class'}

## Environment Variables

| Variable | Value | Enabled |
| --- | --- | --- |
${envRows}

## Requests

| Folder | Method | Request | URL |
| --- | --- | --- | --- |
${requestRows}
`,
    'utf8',
  );

  return outputPath;
}

function writeIndexMarkdown(generatedPdfs) {
  const outputPath = path.join(generatedMarkdownRoot, 'documentation-package-index.md');
  const grouped = generatedPdfs.reduce((groups, item) => {
    const group = path.dirname(item.relativePdf).split(path.sep)[0] || '00Root';
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});

  const sections = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => {
      const rows = items
        .sort((a, b) => a.relativePdf.localeCompare(b.relativePdf))
        .map((item) => `| ${item.title} | \`${displayPath(item.source)}\` | \`${displayPath(item.relativePdf)}\` |`)
        .join('\n');

      return `## ${group}

| Document | Source | PDF |
| --- | --- | --- |
${rows}`;
    })
    .join('\n\n');

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(
    outputPath,
    `# Documentation PDF Package Index

Generated: ${new Date().toISOString()}

This index lists the academic-professional PDF package generated from the repository documentation, reports, Postman verification assets and UML diagrams.

## Summary

- Total PDFs generated: ${generatedPdfs.length}
- Markdown documents converted: ${markdownSources.length}
- PlantUML diagrams converted: ${plantUmlSources.length}
- Generated Postman summary PDFs: 1

${sections}
`,
    'utf8',
  );

  return outputPath;
}

function writeDeliverablesReadme(generatedPdfs) {
  const outputPath = path.join(outputRoot, 'README.md');
  const rows = generatedPdfs
    .sort((a, b) => a.relativePdf.localeCompare(b.relativePdf))
    .map((item) => `| ${item.title} | \`${displayPath(item.relativePdf)}\` | \`${displayPath(item.source)}\` |`)
    .join('\n');

  fs.writeFileSync(
    outputPath,
    `# PDF Deliverables

Generated: ${new Date().toISOString()}

This folder contains the academic-professional PDF package for the American Latin Class Attendance System.

Open this file first:

- \`00_INDEX/documentation-package-index.pdf\`

Regenerate the full package with:

\`\`\`bash
node 07Other/pdf-tools/generate-pdfs.js
\`\`\`

## PDFs

| Document | PDF | Source |
| --- | --- | --- |
${rows}
| Documentation Package Index | \`00_INDEX/documentation-package-index.pdf\` | generated index |
`,
    'utf8',
  );
}

async function main() {
  const chromePath = findChrome();
  removeDir(outputRoot);
  ensureDir(outputRoot);
  ensureDir(htmlRoot);
  ensureDir(generatedMarkdownRoot);

  const generatedPdfs = [];

  for (const source of markdownSources) {
    const pdfPath = convertMarkdownToPdf(chromePath, source);
    generatedPdfs.push({
      title: titleFromPath(source),
      source,
      relativePdf: path.relative(outputRoot, pdfPath),
    });
    console.log(`PDF: ${path.relative(repoRoot, pdfPath)}`);
  }

  const postmanSummary = writePostmanSummaryMarkdown();
  const postmanPdfPath = path.join(outputRoot, 'postman', 'postman-collection-summary.pdf');
  convertMarkdownToPdf(chromePath, path.relative(repoRoot, postmanSummary), postmanPdfPath);
  generatedPdfs.push({
    title: 'Postman Collection Summary',
    source: 'generated from postman/American-Latin-Class-API.postman_collection.json and postman/American-Latin-Class.postman_environment.json',
    relativePdf: path.relative(outputRoot, postmanPdfPath),
  });
  console.log(`PDF: ${path.relative(repoRoot, postmanPdfPath)}`);

  for (const source of plantUmlSources) {
    const pdfPath = await convertPlantUmlToPdf(chromePath, source);
    generatedPdfs.push({
      title: titleFromPath(source),
      source,
      relativePdf: path.relative(outputRoot, pdfPath),
    });
    console.log(`PDF: ${path.relative(repoRoot, pdfPath)}`);
  }

  const indexMarkdown = writeIndexMarkdown(generatedPdfs);
  const indexPdfPath = path.join(outputRoot, '00_INDEX', 'documentation-package-index.pdf');
  convertMarkdownToPdf(chromePath, path.relative(repoRoot, indexMarkdown), indexPdfPath);
  console.log(`PDF: ${path.relative(repoRoot, indexPdfPath)}`);

  writeDeliverablesReadme(generatedPdfs);
  removeDir(buildRoot);
  console.log(`Generated ${generatedPdfs.length + 1} PDFs in ${path.relative(repoRoot, outputRoot)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
