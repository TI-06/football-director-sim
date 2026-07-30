import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { characterPortraitMarkup } from '../src/ui/chibi-bootstrap.js';

test('character portrait renders role and tone specific chibi markup', () => {
  const assistant = characterPortraitMarkup({ kind: 'assistant', name: 'ミナ', tone: 'cyan' });
  const scout = characterPortraitMarkup({ kind: 'scout', name: '榊', tone: 'gold' });
  assert.match(assistant, /character-portrait--assistant/);
  assert.match(assistant, /character-portrait--cyan/);
  assert.match(assistant, /戦術|ミナ/);
  assert.match(scout, /character-portrait--scout/);
  assert.match(scout, /circle cx="37" cy="48"/);
});

test('index loads the game character enhancement assets', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /src\/chibi-ui\.css/);
  assert.match(html, /src\/ui\/chibi-bootstrap\.js/);
  assert.match(html, /theme-color" content="#07142a"/);
});

test('character stylesheet defines approved mobile hero and face-card layout', () => {
  const css = fs.readFileSync(new URL('../src/chibi-ui.css', import.meta.url), 'utf8');
  assert.match(css, /--game-cyan:/);
  assert.match(css, /\.game-hero\s*\{/);
  assert.match(css, /\.pitch-player__portrait\s*\{/);
  assert.match(css, /\.role-hero--scout/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.game-hero/);
});
