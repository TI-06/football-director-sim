import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}

const files = await walk(root);
const jsFiles = files.filter((file) => /\.(js|mjs)$/.test(file));
let failures = 0;

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    console.error(`[syntax] ${path.relative(root, file)}\n${result.stderr}`);
  }
}

const importPattern = /(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/g;
for (const file of jsFiles) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const target = path.resolve(path.dirname(file), match[1]);
    try {
      await stat(target);
    } catch {
      failures += 1;
      console.error(`[import] ${path.relative(root, file)} -> ${match[1]} not found`);
    }
  }
  if (!file.endsWith('quality.mjs') && /\b(TODO|TBD|FIXME)\b/.test(source)) {
    failures += 1;
    console.error(`[placeholder] ${path.relative(root, file)} contains TODO/TBD/FIXME`);
  }
  if (file.includes(`${path.sep}src${path.sep}`) && /(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(source)) {
    failures += 1;
    console.error(`[dialog] ${path.relative(root, file)} uses a browser-native dialog`);
  }
}

const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const required of ['id="app"', 'src="./src/main.js"', 'href="./src/styles.css"', 'lang="ja"']) {
  if (!html.includes(required)) {
    failures += 1;
    console.error(`[html] Missing ${required}`);
  }
}

if (failures) {
  console.error(`Quality check failed: ${failures} issue(s).`);
  process.exit(1);
}
console.log(`Quality check passed: ${jsFiles.length} JavaScript files, ${files.length} total files.`);
