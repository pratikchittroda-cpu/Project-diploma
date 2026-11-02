const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
// Rules tests require real emulators and run explicitly via npm run test:rules in CI.
const files = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.cjs') && name !== 'backend-rules.test.cjs')
  .sort().map(name => path.join('tests', name));
if (!files.length) throw new Error('No unit tests found.');
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
