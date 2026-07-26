import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);
const distRoot = new URL('../dist/', import.meta.url);

test('production build creates only deployable static assets', () => {
  rmSync(distRoot, { recursive: true, force: true });

  const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(new URL('index.html', distRoot)), true);
  assert.equal(existsSync(new URL('src/main.js', distRoot)), true);
  assert.equal(existsSync(new URL('assets/favicon.svg', distRoot)), true);
  assert.equal(existsSync(new URL('_headers', distRoot)), true);
  assert.equal(existsSync(new URL('tests/', distRoot)), false);
  assert.equal(existsSync(new URL('docs/', distRoot)), false);

  const html = readFileSync(new URL('index.html', distRoot), 'utf8');
  assert.match(html, /src\/main\.js/);
});
