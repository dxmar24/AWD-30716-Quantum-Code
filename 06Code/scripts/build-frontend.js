const path = require('path');
const { spawnSync } = require('child_process');

const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd:path.join(__dirname, '..'),
  env:{ ...process.env, NODE_ENV:'production' },
  stdio:'inherit',
});

if (result.error) throw result.error;
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
