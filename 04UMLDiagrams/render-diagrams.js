const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const sourceDir = __dirname;
const outputDir = path.resolve(sourceDir, '..', '08PDFDeliverables', '04UMLDiagrams');
const server = process.env.PLANTUML_SERVER || 'https://www.plantuml.com/plantuml';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

function encodePlantUml(source) {
  const compressed = zlib.deflateRawSync(Buffer.from(source, 'utf8'), { level:9 });
  let encoded = '';
  for (let index = 0; index < compressed.length; index += 3) {
    const first = compressed[index];
    const second = compressed[index + 1] || 0;
    const third = compressed[index + 2] || 0;
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 0x03) << 4) | (second >> 4)];
    encoded += alphabet[((second & 0x0f) << 2) | (third >> 6)];
    encoded += alphabet[third & 0x3f];
  }
  return encoded;
}

async function render(sourceFile, format) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const encoded = encodePlantUml(source);
  const response = await fetch(`${server}/${format}/${encoded}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !body.length) {
    throw new Error(`${path.basename(sourceFile)} failed as ${format}: HTTP ${response.status}`);
  }
  if (format === 'svg') {
    const text = body.toString('utf8');
    if (!text.includes('<svg') || text.includes('Syntax Error?')) {
      throw new Error(`${path.basename(sourceFile)} returned an invalid SVG`);
    }
  }
  if (format === 'png' && !body.subarray(1, 4).equals(Buffer.from('PNG'))) {
    throw new Error(`${path.basename(sourceFile)} returned an invalid PNG`);
  }
  const name = path.basename(sourceFile, '.puml');
  const outputFile = path.join(outputDir, `${name}.${format}`);
  fs.writeFileSync(outputFile, body);
  return outputFile;
}

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function renderPdf(svgFile) {
  const chrome = chromeExecutable();
  if (!chrome) throw new Error('Chrome is required to create diagram PDFs from SVG files.');
  const outputFile = svgFile.replace(/\.svg$/i, '.pdf');
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${outputFile}`,
    pathToFileURL(svgFile).href,
  ], { encoding:'utf8', windowsHide:true });
  if (result.status !== 0) {
    throw new Error(`PDF generation failed for ${path.basename(svgFile)}: ${result.stderr || result.stdout}`);
  }
  const header = fs.readFileSync(outputFile).subarray(0, 4).toString('ascii');
  if (header !== '%PDF') throw new Error(`${path.basename(outputFile)} is not a valid PDF.`);
  return outputFile;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive:true });
  const sources = fs.readdirSync(sourceDir)
    .filter((name) => name.endsWith('.puml'))
    .sort()
    .map((name) => path.join(sourceDir, name));

  for (const source of sources) {
    let svgFile = '';
    for (const format of ['svg', 'png']) {
      const output = await render(source, format);
      if (format === 'svg') svgFile = output;
      process.stdout.write(`Rendered ${path.relative(process.cwd(), output)}\n`);
    }
    const pdf = renderPdf(svgFile);
    process.stdout.write(`Rendered ${path.relative(process.cwd(), pdf)}\n`);
  }
  process.stdout.write(`Rendered ${sources.length} PlantUML diagrams in three formats.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
