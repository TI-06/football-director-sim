import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);

test('narrow squad pitch uses compact non-overlapping cards', async () => {
  const css = await readFile(new URL('src/mobile-game-v2-compat.css', root), 'utf8');
  assert.match(css, /@media \(max-width:\s*390px\)/);
  assert.match(css, /\.fd2-legacy-panel--squad \.pitch-slot\s*\{[\s\S]*?width:\s*40px\s*!important/);
  assert.match(css, /\.fd2-legacy-panel--squad \.pitch-player\s*\{[\s\S]*?max-height:\s*42px/);
  assert.match(css, /\.pitch-player__select[\s\S]*?display:\s*none\s*!important/);
});
