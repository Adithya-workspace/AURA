import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (full.endsWith('.js')) files.push(full);
  }
  return files;
}

let failed = 0;
for (const file of walk(root)) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(`${file}\n${result.stderr}\n`);
  }
}
if (failed) {
  console.error(`${failed} files failed syntax check`);
  process.exit(1);
}
console.log('syntax ok');
