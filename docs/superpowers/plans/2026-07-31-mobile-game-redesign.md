# Football Director スマホゲーム全面刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存のリーグ・試合・移籍・育成・経営ロジックを活かしながら、スマホ向け5ナビ、正式統合された4キャラクター、軽量な縦型2D試合センター、新セーブ境界、改善済みゲームテンポを備えた新しいFootball Directorを完成させる。

**Architecture:** `src/core`・`src/data`・`src/game`の既存責務を維持し、`src/ui/render.js`を画面ディスパッチャへ縮小して、シェル、共通部品、画面別レンダラー、試合表示モデルへ分割する。試合結果は既存エンジンが確定し、UIは計算済みイベントを○・●・背番号とCSS `transform`で可視化するだけにする。新セーブはスキーマ4と新ローカルキーを使い、旧形式は明確な互換対象外エラーにする。

**Tech Stack:** Vanilla JavaScript ES Modules、HTML文字列レンダリング、CSS、Node.js 22、`node:test`、Playwright 1.61.1、Cloudflare Pages、Cloudflare D1

## Global Constraints

- スマホ主対象幅は320px〜430pxとし、横スクロールを発生させない。
- スマホ下部ナビは「ホーム・試合・編成・移籍・メニュー」の5項目とする。
- 起動後および新規キャリア作成後の初期表示はホームとする。
- 日本1部・2部・3部、昇降格、全国王者杯、育成、移籍、経営の基本ルールを維持する。
- 旧ローカル、旧JSON、旧クラウドセーブとは互換を持たない。
- 通常試合は2〜4分、重要試合は4〜6分、1シーズンは5〜8時間を目安とする。
- 試合介入はハーフタイム、負傷、退場、60分、75分、特定の戦術判断イベントに限定する。
- 試合はスマホ縦画面の上から見たフルコートで表示する。
- ピッチ上の22人は画像を使わず、自チーム○、相手●、背番号常時表示とする。
- 試合中の位置更新はイベント単位とし、常時物理演算を行わない。
- ミナ、ソータ、レイ、カズオは最新の青基調2Dデザインで、正式レンダリング処理へ統合する。
- キャラクター画像は透過WebPまたは透過PNGとし、試合中の22人には使用しない。
- タップ領域は原則44px以上とし、色だけで警告・負傷・選択状態を表現しない。
- Node.jsは22以上、追加ランタイム依存パッケージは導入しない。
- 完了前に `npm test`、`npm run check`、`npm run smoke`、`npm run build`、`npm run test:responsive` をすべて成功させる。

---

## File Structure

### Create

- `src/ui/storage.js`: 新ローカル保存キーと保存エラーメッセージ
- `src/ui/characters.js`: ミナ、ソータ、レイ、カズオの定義と画像HTML
- `src/ui/components.js`: HUD、状態バッジ、カード、ボトムシート、キャラクターヒーロー
- `src/ui/shell.js`: 5ナビ、共通ヘッダー、メイン領域、PC補助ナビ
- `src/ui/selectors/dashboard.js`: ホーム表示用データの抽出と重要度順整理
- `src/ui/screens/dashboard.js`: ホーム画面
- `src/ui/screens/schedule.js`: 次戦、日程、結果画面
- `src/ui/screens/squad.js`: 編成、選手一覧、選手詳細
- `src/ui/screens/transfers.js`: スカウト、候補、交渉、放出
- `src/ui/screens/menu.js`: 戦術、育成、経営、記録、受信箱、秘書レポートの画面群
- `src/ui/squad-interaction.js`: タップ選択と配置アクションの純粋関数
- `src/ui/live-match-visual.js`: 試合イベントからピッチ位置・移動対象への変換
- `src/ui/live-match-view.js`: 縦型フルコート、選手詳細、実況、判断パネル
- `src/game/balance.js`: テンポ・成長・財務・昇格後補正の定数
- `scripts/simulate-balance.mjs`: 複数シード・複数シーズンの集計
- `src/mobile-game.css`: 新デザインの正式スタイル
- `assets/characters/mina.webp`
- `assets/characters/sota.webp`
- `assets/characters/rei.webp`
- `assets/characters/kazuo.webp`
- `tests/save-v4.test.js`
- `tests/mobile-components.test.js`
- `tests/mobile-shell-v2.test.js`
- `tests/mobile-dashboard.test.js`
- `tests/mobile-squad.test.js`
- `tests/live-match-visual.test.js`
- `tests/mobile-secondary-screens.test.js`
- `tests/balance-calibration.test.js`
- `tests/e2e/mobile-redesign.spec.mjs`
- `docs/mobile-redesign-report.md`
- `docs/balance-calibration-report.md`

### Modify

- `index.html`: 新CSSだけを正式読込し、後付けキャラクタースクリプトを除去
- `src/game/save.js`: スキーマ4、新フォーマット、旧形式専用エラー
- `src/game/game-engine.js`: 新スキーマ、バランス定数、テンポ調整
- `src/game/live-match.js`: UIが利用する判断理由とイベント情報を明示
- `src/game/match-engine.js`: 自チーム優位補正と昇格後難易度の上限調整
- `src/game/development.js`: 若手成長と高齢選手衰退の調整
- `src/game/economy.js`: 移籍予算・給与予算・昇格後収支の調整
- `src/ui/render.js`: 画面ディスパッチャへ縮小
- `src/ui/controller.js`: 新UI状態、5ナビ、ボトムシート、試合表示キュー、新保存キー
- `src/ui/dialogs.js`: メニューと確認ダイアログを新共通部品へ合わせる
- `src/ui/game-shell.js`: デスクトップショートカット互換だけを残す
- `src/styles.css`: 基礎リセットと既存互換スタイルだけに整理
- `tests/live-match-ui.test.js`
- `tests/game-shell.test.js`
- `tests/ui.test.js`
- `tests/game-engine.test.js`
- `tests/three-season-club-life.test.js`
- `tests/e2e/responsive-layout.spec.mjs`
- `package.json`
- `.github/workflows/responsive-audit.yml`
- `README.md`

### Delete after replacement is verified

- `src/chibi-ui.css`
- `src/chibi-ui-mobile.css`
- `src/approved-character-art.css`
- `src/ui/chibi-bootstrap.js`
- `src/ui/approved-character-art.js`
- `src/ui/character-sprite/part-1.js`
- `src/ui/character-sprite/part-2.js`
- `src/ui/character-sprite/part-3.js`

---

### Task 1: 新セーブ境界と新ローカル保存キー

**Files:**
- Create: `src/ui/storage.js`
- Create: `tests/save-v4.test.js`
- Modify: `src/game/save.js`
- Modify: `src/ui/controller.js`
- Modify: `tests/game-engine.test.js`

**Interfaces:**
- Produces: `STORAGE_KEY`, `SAVE_SCHEMA_VERSION`, `LEGACY_SAVE_MESSAGE`, `serializeGame(state)`, `deserializeGame(text)`
- Consumes: `createNewGame()`が`SAVE_SCHEMA_VERSION`を状態へ設定する既存構造

- [ ] **Step 1: Write the failing save boundary tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/game/game-engine.js';
import {
  LEGACY_SAVE_MESSAGE,
  SAVE_SCHEMA_VERSION,
  deserializeGame,
  serializeGame
} from '../src/game/save.js';
import { STORAGE_KEY } from '../src/ui/storage.js';

test('redesign save uses schema 4 and a new local storage key', () => {
  const state = createNewGame({ seed: 'save-v4', clubId: 'jp1-01' });
  assert.equal(SAVE_SCHEMA_VERSION, 4);
  assert.equal(state.schemaVersion, 4);
  assert.equal(STORAGE_KEY, 'football-director-save-v4');
  const envelope = JSON.parse(serializeGame(state));
  assert.equal(envelope.format, 'football-director-save-v4');
  assert.equal(envelope.schemaVersion, 4);
});

test('legacy save receives the explicit unsupported-version message', () => {
  const legacy = JSON.stringify({ format: 'football-director-save', schemaVersion: 3, encoding: 'lzw-base64', data: '' });
  assert.throws(() => deserializeGame(legacy), new RegExp(LEGACY_SAVE_MESSAGE));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/save-v4.test.js`

Expected: FAIL because `src/ui/storage.js` and `LEGACY_SAVE_MESSAGE` do not exist and the current schema is 3.

- [ ] **Step 3: Implement the storage constants**

```js
// src/ui/storage.js
export const STORAGE_KEY = 'football-director-save-v4';
export const STORAGE_WRITE_ERROR = '自動保存に失敗しました。ブラウザの保存容量を確認してください。';
```

- [ ] **Step 4: Implement the schema 4 envelope and legacy rejection**

```js
// src/game/save.js
export const SAVE_SCHEMA_VERSION = 4;
export const LEGACY_SAVE_MESSAGE = '旧バージョンのセーブデータはこの版では読み込めません。';

const SAVE_FORMAT = 'football-director-save-v4';
const LEGACY_SAVE_FORMAT = 'football-director-save';

export function deserializeGame(text) {
  let parsed;
  try {
    parsed = typeof text === 'string' ? JSON.parse(text) : structuredClone(text);
    if (parsed?.format === LEGACY_SAVE_FORMAT || Number(parsed?.schemaVersion) < SAVE_SCHEMA_VERSION) {
      throw new Error(LEGACY_SAVE_MESSAGE);
    }
    if (parsed?.format === SAVE_FORMAT) {
      if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION || parsed.encoding !== SAVE_ENCODING || typeof parsed.data !== 'string') {
        throw new Error('Unsupported save encoding.');
      }
      parsed = JSON.parse(decompressLzw(parsed.data));
    }
  } catch (error) {
    if (error?.message === LEGACY_SAVE_MESSAGE || /Unsupported/.test(error?.message ?? '')) throw error;
    throw new Error('Invalid save data.');
  }
  return validateState(parsed);
}
```

Preserve the existing compression helpers and `validateState` required fields. Change only the version, format, legacy detection, and exported message.

- [ ] **Step 5: Replace the controller-local storage key**

```js
import { STORAGE_KEY, STORAGE_WRITE_ERROR } from './storage.js';
```

Remove `const STORAGE_KEY = 'football-director-save-v2';` from `controller.js`. Use `STORAGE_WRITE_ERROR` in the autosave failure toast. Do not delete or read the old browser key.

- [ ] **Step 6: Run focused and full save tests**

Run:

```bash
node --test tests/save-v4.test.js tests/game-engine.test.js tests/cloud-save.test.js tests/cloud-operation-flow.test.js
```

Expected: PASS. Cloud transport remains unchanged because it stores the serialized string without interpreting schema content.

- [ ] **Step 7: Commit**

```bash
git add src/ui/storage.js src/game/save.js src/ui/controller.js tests/save-v4.test.js tests/game-engine.test.js
git commit -m "feat: establish redesign save boundary"
```

---

### Task 2: キャラクター定義・共通部品・正式デザイントークン

**Files:**
- Create: `src/ui/characters.js`
- Create: `src/ui/components.js`
- Create: `src/mobile-game.css`
- Create: `tests/mobile-components.test.js`
- Add: `assets/characters/mina.webp`
- Add: `assets/characters/sota.webp`
- Add: `assets/characters/rei.webp`
- Add: `assets/characters/kazuo.webp`
- Modify: `index.html`

**Interfaces:**
- Produces: `CHARACTERS`, `renderCharacter(key, options)`, `renderCharacterHero(options)`, `renderStatusBadge(options)`, `renderMetricStrip(items)`, `renderBottomSheet(options)`
- Consumes: `escapeHtml()` and `icon()` from `src/ui/templates.js`

- [ ] **Step 1: Write the failing component contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, renderCharacter } from '../src/ui/characters.js';
import { renderBottomSheet, renderStatusBadge } from '../src/ui/components.js';

test('approved cast is defined with optimized static assets', () => {
  assert.deepEqual(Object.keys(CHARACTERS), ['mina', 'sota', 'rei', 'kazuo']);
  assert.equal(CHARACTERS.mina.role, '戦術アシスタント');
  assert.match(renderCharacter('mina', { eager: true }), /assets\/characters\/mina\.webp/);
  assert.match(renderCharacter('mina', { eager: true }), /loading="eager"/);
  assert.doesNotMatch(renderCharacter('mina'), /data:image/);
});

test('status badges and bottom sheets expose accessible text contracts', () => {
  assert.match(renderStatusBadge({ tone: 'warning', label: '警告あり', iconName: 'warning' }), /警告あり/);
  const sheet = renderBottomSheet({ id: 'player-detail', title: '選手詳細', body: '<p>山田 太郎</p>' });
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /data-command="close-bottom-sheet"/);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/mobile-components.test.js`

Expected: FAIL with module-not-found errors for the new UI modules.

- [ ] **Step 3: Implement the character registry**

```js
// src/ui/characters.js
import { escapeHtml } from './templates.js';

export const CHARACTERS = Object.freeze({
  mina: { name: 'ミナ', role: '戦術アシスタント', src: './assets/characters/mina.webp', alt: '戦術アシスタントのミナ' },
  sota: { name: 'ソータ', role: 'エース選手', src: './assets/characters/sota.webp', alt: 'エース選手のソータ' },
  rei: { name: 'レイ', role: 'スカウト', src: './assets/characters/rei.webp', alt: 'スカウトのレイ' },
  kazuo: { name: 'カズオ', role: 'クラブディレクター', src: './assets/characters/kazuo.webp', alt: 'クラブディレクターのカズオ' }
});

export function renderCharacter(key, { className = '', eager = false } = {}) {
  const character = CHARACTERS[key];
  if (!character) return '';
  return `<img class="game-character ${escapeHtml(className)}" src="${character.src}" alt="${escapeHtml(character.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-character="${key}">`;
}
```

- [ ] **Step 4: Implement the reusable UI components**

```js
// src/ui/components.js
import { renderCharacter } from './characters.js';
import { escapeHtml, icon } from './templates.js';

export function renderStatusBadge({ tone = 'neutral', label, iconName = 'pulse' }) {
  return `<span class="status-badge status-badge--${escapeHtml(tone)}">${icon(iconName, 13)}<span>${escapeHtml(label)}</span></span>`;
}

export function renderMetricStrip(items) {
  return `<dl class="metric-strip">${items.map(({ label, value, detail = '' }) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</div>`).join('')}</dl>`;
}

export function renderCharacterHero({ character, eyebrow, title, message, actions = '', eager = false }) {
  return `<section class="character-hero character-hero--${character}"><div class="character-hero__copy"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${actions}</div><div class="character-hero__art">${renderCharacter(character, { eager })}</div></section>`;
}

export function renderBottomSheet({ id, title, body }) {
  return `<section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(id)}-title" data-bottom-sheet="${escapeHtml(id)}"><header><h2 id="${escapeHtml(id)}-title">${escapeHtml(title)}</h2><button type="button" data-command="close-bottom-sheet" aria-label="閉じる">${icon('close', 18)}</button></header><div class="bottom-sheet__body">${body}</div></section>`;
}
```

- [ ] **Step 5: Add the optimized character assets**

Use these exact output constraints:

| File | Maximum dimensions | Maximum size | Alpha |
|---|---:|---:|---|
| `mina.webp` | 512×768 | 240 KiB | required |
| `sota.webp` | 512×768 | 240 KiB | required |
| `rei.webp` | 512×768 | 240 KiB | required |
| `kazuo.webp` | 512×768 | 240 KiB | required |

Run:

```bash
file assets/characters/*.webp
python - <<'PY'
from pathlib import Path
for path in Path('assets/characters').glob('*.webp'):
    assert path.stat().st_size <= 240 * 1024, f'{path} is too large'
print('character asset size check passed')
PY
```

Expected: four WebP files, each under 240 KiB. The image design must match the approved blue 2D direction and retain the names and roles above.

- [ ] **Step 6: Add the formal design token stylesheet**

Define in `src/mobile-game.css`:

```css
:root {
  --fd-bg: #061126;
  --fd-panel: #0b1c36;
  --fd-panel-strong: #102a50;
  --fd-line: rgba(130, 184, 255, .22);
  --fd-text: #f5f9ff;
  --fd-muted: #9eb4cc;
  --fd-cyan: #36ddff;
  --fd-blue: #2d7fff;
  --fd-gold: #ffd45f;
  --fd-danger: #ff667a;
  --fd-success: #54d89a;
  --fd-radius-lg: 22px;
  --fd-tap: 44px;
}

.game-character { display: block; max-width: 100%; height: auto; object-fit: contain; }
.status-badge { min-height: 28px; display: inline-flex; align-items: center; gap: 6px; }
.bottom-sheet { position: fixed; inset: auto 0 0; z-index: 80; max-height: min(78dvh, 680px); overflow: auto; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

Add `<link rel="stylesheet" href="./src/mobile-game.css">` after `styles.css` in `index.html`. Keep legacy CSS and scripts loaded until Task 8, so intermediate commits remain usable.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
node --test tests/mobile-components.test.js
npm run build
```

Expected: PASS and `dist/assets/characters/*.webp` exists.

```bash
git add src/ui/characters.js src/ui/components.js src/mobile-game.css assets/characters index.html tests/mobile-components.test.js
git commit -m "feat: add formal mobile game design system"
```

---

### Task 3: 5ナビシェル・ホーム・メニュー導線

**Files:**
- Create: `src/ui/shell.js`
- Create: `src/ui/selectors/dashboard.js`
- Create: `src/ui/screens/dashboard.js`
- Create: `tests/mobile-shell-v2.test.js`
- Create: `tests/mobile-dashboard.test.js`
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `src/ui/game-shell.js`
- Modify: `src/ui/dialogs.js`
- Modify: `tests/game-shell.test.js`

**Interfaces:**
- Produces: `PRIMARY_NAV`, `normalizeView(view)`, `renderShell(state, currentView, content, uiState)`, `selectDashboardViewModel(state)`, `renderDashboardScreen(state, uiState)`
- Consumes: `renderCharacterHero`, `renderMetricStrip`, existing `autoAdvance` commands, existing `open-game-menu` command

- [ ] **Step 1: Write the failing shell tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/game/game-engine.js';
import { PRIMARY_NAV, normalizeView } from '../src/ui/shell.js';
import { renderApplication } from '../src/ui/render.js';

test('primary navigation is exactly the approved five actions', () => {
  assert.deepEqual(PRIMARY_NAV.map((item) => item.label), ['ホーム', '試合', '編成', '移籍', 'メニュー']);
  assert.equal(normalizeView('unknown-view'), 'dashboard');
});

test('dashboard renders the command-first home layout', () => {
  const state = createNewGame({ seed: 'dashboard-v2', clubId: 'jp1-01' });
  const html = renderApplication(state, 'dashboard');
  assert.match(html, /data-screen="dashboard"/);
  assert.match(html, /data-character="mina"/);
  assert.match(html, /data-dashboard-section="next-fixture"/);
  assert.match(html, /data-dashboard-section="attention"/);
  assert.match(html, /data-command="begin-live-week"/);
  assert.equal((html.match(/class="primary-nav__item/g) ?? []).length, 5);
});
```

- [ ] **Step 2: Write the failing dashboard selector tests**

```js
import { selectDashboardViewModel } from '../src/ui/selectors/dashboard.js';

test('dashboard limits attention items to five and sorts critical items first', () => {
  const state = createNewGame({ seed: 'attention', clubId: 'jp1-01' });
  state.inbox = [
    { id: 'm1', kind: 'decision', category: '理事会', title: '理事会警告', resolved: false },
    { id: 'm2', kind: 'decision', category: '契約', title: '契約満了', resolved: false },
    { id: 'm3', kind: 'message', category: '一般', title: '通常連絡', resolved: false },
    { id: 'm4', kind: 'decision', category: '負傷', title: '負傷者', resolved: false },
    { id: 'm5', kind: 'decision', category: '交渉', title: '交渉回答', resolved: false },
    { id: 'm6', kind: 'decision', category: '選手', title: '不満', resolved: false }
  ];
  const model = selectDashboardViewModel(state);
  assert.equal(model.attention.length, 5);
  assert.equal(model.attention[0].title, '理事会警告');
});
```

- [ ] **Step 3: Run both tests and verify RED**

Run:

```bash
node --test tests/mobile-shell-v2.test.js tests/mobile-dashboard.test.js
```

Expected: FAIL because the shell, selector, and dashboard screen modules do not exist.

- [ ] **Step 4: Implement the shell contract**

```js
// src/ui/shell.js
import { escapeHtml, icon } from './templates.js';

export const PRIMARY_NAV = Object.freeze([
  { id: 'dashboard', label: 'ホーム', icon: 'dashboard', type: 'view' },
  { id: 'schedule', label: '試合', icon: 'calendar', type: 'view' },
  { id: 'squad', label: '編成', icon: 'squad', type: 'view' },
  { id: 'transfers', label: '移籍', icon: 'transfer', type: 'view' },
  { id: 'menu', label: 'メニュー', icon: 'menu', type: 'command' }
]);

const VALID_VIEWS = new Set(['dashboard', 'schedule', 'squad', 'transfers', 'tactics', 'academy', 'club', 'records', 'secretary', 'inbox']);
export function normalizeView(view) { return VALID_VIEWS.has(view) ? view : 'dashboard'; }

export function renderShell(state, currentView, content, { unresolvedCount = 0 } = {}) {
  const view = normalizeView(currentView);
  const nav = PRIMARY_NAV.map((item) => {
    const active = item.type === 'view' ? item.id === view : !PRIMARY_NAV.some((entry) => entry.type === 'view' && entry.id === view);
    const action = item.type === 'view' ? `data-nav="${item.id}"` : 'data-command="open-game-menu"';
    return `<button class="primary-nav__item ${active ? 'is-active' : ''}" type="button" ${action} aria-current="${active ? 'page' : 'false'}">${icon(item.icon, 19)}<span>${escapeHtml(item.label)}</span>${item.id === 'menu' && unresolvedCount ? `<b>${unresolvedCount}</b>` : ''}</button>`;
  }).join('');
  return `<div class="mobile-game-shell" data-current-view="${view}"><header class="mobile-game-header"><strong>Football Director</strong><span>S${state.season} · W${state.week}</span></header><main class="mobile-game-main">${content}</main><nav class="primary-nav" aria-label="メインメニュー">${nav}</nav></div>`;
}
```

- [ ] **Step 5: Implement the dashboard selector**

In `src/ui/selectors/dashboard.js`, export `selectDashboardViewModel(state)` returning:

```js
{
  club,
  position,
  nextFixture,
  recentResults,
  attention,
  metrics: {
    morale,
    fitness,
    overall,
    injuries,
    cash,
    transferBudget
  }
}
```

Use one severity function with this exact order: `理事会` 100, `負傷` 90, `契約` 80, `交渉` 70, `選手` 60, everything else 10. Filter resolved items, sort descending, and slice to five.

- [ ] **Step 6: Implement the home screen and render dispatcher**

`renderDashboardScreen(state, uiState)` must emit these stable hooks:

```html
<section data-screen="dashboard">
  <section class="character-hero" data-character-hero="mina">...</section>
  <section data-dashboard-section="next-fixture">...</section>
  <section data-dashboard-section="attention">...</section>
  <section data-dashboard-section="team-state">...</section>
  <section data-dashboard-section="recent-results">...</section>
  <div class="dashboard-primary-actions">
    <button data-command="begin-live-week">試合開始</button>
    <button data-command="toggle-auto-advance">次の判断まで進行</button>
  </div>
</section>
```

Update `renderApplication` to call `normalizeView`, select the screen renderer, and wrap it with `renderShell`. Keep the existing screen renderers as temporary fallbacks until Tasks 4–6 replace them.

- [ ] **Step 7: Update controller navigation safety**

Before assigning `currentView`, normalize it:

```js
function navigate(view) {
  currentView = normalizeView(view);
  render();
}
```

Use `navigate()` for `data-nav`, keyboard shortcuts, cloud-load completion, import completion, and invalid routes. Preserve `currentView = 'dashboard'` after new career creation.

- [ ] **Step 8: Run shell tests and commit**

Run:

```bash
node --test tests/mobile-shell-v2.test.js tests/mobile-dashboard.test.js tests/game-shell.test.js tests/ui.test.js
npm run smoke
```

Expected: PASS. Existing secondary screens remain reachable through the menu dialog.

```bash
git add src/ui/shell.js src/ui/selectors/dashboard.js src/ui/screens/dashboard.js src/ui/render.js src/ui/controller.js src/ui/game-shell.js src/ui/dialogs.js tests/mobile-shell-v2.test.js tests/mobile-dashboard.test.js tests/game-shell.test.js
git commit -m "feat: rebuild mobile shell and dashboard"
```

---

### Task 4: 編成画面・タップ配置・選手詳細ボトムシート

**Files:**
- Create: `src/ui/squad-interaction.js`
- Create: `src/ui/screens/squad.js`
- Create: `tests/mobile-squad.test.js`
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `src/mobile-game.css`
- Modify: `tests/squad.test.js`
- Modify: `tests/ui-controls.test.js`

**Interfaces:**
- Produces: `selectSquadPlayer(currentId, nextId)`, `createPlacementAction(playerId, slotPosition)`, `renderSquadScreen(state, uiState)`
- Consumes: existing `replaceStarter` game action, drag-and-drop handlers, `renderCharacterHero`, `renderBottomSheet`

- [ ] **Step 1: Write failing pure interaction tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlacementAction, selectSquadPlayer } from '../src/ui/squad-interaction.js';

test('tap selection toggles the same player and replaces a different selection', () => {
  assert.equal(selectSquadPlayer(null, 'p1'), 'p1');
  assert.equal(selectSquadPlayer('p1', 'p1'), null);
  assert.equal(selectSquadPlayer('p1', 'p2'), 'p2');
});

test('placement action uses the existing lineup action contract', () => {
  assert.deepEqual(createPlacementAction('p1', 'ST'), {
    type: 'replace-starter',
    payload: { playerId: 'p1', slotPosition: 'ST' }
  });
});
```

- [ ] **Step 2: Write failing squad markup tests**

```js
import { createNewGame } from '../src/game/game-engine.js';
import { renderSquadScreen } from '../src/ui/screens/squad.js';

test('squad screen uses Sota, vertical pitch, selection hooks, and player sheet', () => {
  const state = createNewGame({ seed: 'squad-v2', clubId: 'jp1-01' });
  const selected = state.lineup.starters[0].playerId;
  const html = renderSquadScreen(state, { selectedSquadPlayerId: selected, playerDetailId: selected });
  assert.match(html, /data-character="sota"/);
  assert.match(html, /class="squad-pitch squad-pitch--vertical"/);
  assert.match(html, /data-command="select-squad-player"/);
  assert.match(html, /data-command="place-selected-player"/);
  assert.match(html, /data-bottom-sheet="player-detail"/);
  assert.match(html, /固定起用/);
  assert.match(html, /交代可否/);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/mobile-squad.test.js`

Expected: FAIL because the interaction and screen modules do not exist.

- [ ] **Step 4: Implement the interaction helpers**

```js
export function selectSquadPlayer(currentId, nextId) {
  return currentId === nextId ? null : nextId;
}

export function createPlacementAction(playerId, slotPosition) {
  if (!playerId || !slotPosition) return null;
  return { type: 'replace-starter', payload: { playerId, slotPosition } };
}
```

- [ ] **Step 5: Implement the squad screen**

The screen must render, in order:

1. Sota character hero
2. Formation selector using `data-tactic="formation"`
3. Vertical pitch with starter slots
4. Bench cards
5. Filter and sort controls
6. Full player list
7. Player detail bottom sheet when `uiState.playerDetailId` is set

Each slot button must include:

```html
<button type="button"
  class="squad-slot"
  data-command="place-selected-player"
  data-slot-position="ST"
  data-player-id="player-id"
  aria-label="ST 山田太郎を配置">
</button>
```

Each player row must include both:

```html
<button data-command="select-squad-player" data-player-id="player-id">選択</button>
<button data-command="open-player-detail" data-player-id="player-id">詳細</button>
```

Show text or icon labels for injury, suspension, low fitness, dissatisfaction, captain, PK, fixed starter, and substitution permission. Do not rely on color alone.

- [ ] **Step 6: Connect controller UI state**

Add:

```js
let selectedSquadPlayerId = null;
let playerDetailId = null;
```

Pass both values into `renderApplication`. Handle commands:

```js
case 'select-squad-player':
  selectedSquadPlayerId = selectSquadPlayer(selectedSquadPlayerId, target.dataset.playerId);
  render();
  break;
case 'place-selected-player': {
  const action = createPlacementAction(selectedSquadPlayerId, target.dataset.slotPosition);
  if (action && applyAction(action.type, action.payload)) selectedSquadPlayerId = null;
  break;
}
case 'open-player-detail':
  playerDetailId = target.dataset.playerId;
  render();
  break;
case 'close-bottom-sheet':
  playerDetailId = null;
  render();
  break;
```

Preserve existing pointer drag handlers and keyboard accessibility.

- [ ] **Step 7: Run squad tests and commit**

Run:

```bash
node --test tests/mobile-squad.test.js tests/squad.test.js tests/ui-controls.test.js tests/ui.test.js
```

Expected: PASS for drag placement and tap placement.

```bash
git add src/ui/squad-interaction.js src/ui/screens/squad.js src/ui/render.js src/ui/controller.js src/mobile-game.css tests/mobile-squad.test.js tests/squad.test.js tests/ui-controls.test.js
git commit -m "feat: rebuild squad management for mobile"
```

---

### Task 5: 試合一覧・縦型試合センター・イベント連動表示

**Files:**
- Create: `src/ui/screens/schedule.js`
- Create: `src/ui/live-match-visual.js`
- Create: `src/ui/live-match-view.js`
- Create: `tests/live-match-visual.test.js`
- Modify: `src/game/live-match.js`
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `src/mobile-game.css`
- Modify: `tests/live-match-ui.test.js`
- Modify: `tests/live-match.test.js`

**Interfaces:**
- Produces: `renderScheduleScreen(state)`, `buildPitchModel(session, selectedPlayerId)`, `buildVisualSequence(session, fromEventIndex)`, `renderLiveMatchView(state, session, uiState)`
- Consumes: `session.sides`, `session.participants`, `session.liveFitness`, `session.liveRatings`, `session.bookedIds`, `session.injuredIds`, `session.events`

- [ ] **Step 1: Write failing pitch model tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, prepareNextWeek } from '../src/game/game-engine.js';
import { createLiveMatchSession } from '../src/game/live-match.js';
import { buildPitchModel, buildVisualSequence } from '../src/ui/live-match-visual.js';

function sessionFixture() {
  const state = createNewGame({ seed: 'visual-match', clubId: 'jp1-01' });
  const prepared = prepareNextWeek(state);
  return createLiveMatchSession({ seed: prepared.matchSeed, home: prepared.home, away: prepared.away, userSide: prepared.userSide, matchPlan: state.matchPlan });
}

test('pitch model contains 22 numbered tokens and one ball', () => {
  const model = buildPitchModel(sessionFixture(), null);
  assert.equal(model.players.length, 22);
  assert.ok(model.players.every((player) => Number.isInteger(player.number)));
  assert.deepEqual(Object.keys(model.ball).sort(), ['x', 'y']);
});

test('visual sequence moves only event-related players', () => {
  const session = sessionFixture();
  const attacker = Object.values(session.participants)[0];
  session.events.push({ minute: 12, type: 'shot', side: attacker.side, playerId: attacker.playerId, text: 'シュート' });
  const [step] = buildVisualSequence(session, 1);
  assert.equal(step.type, 'shot');
  assert.ok(step.actorIds.includes(attacker.playerId));
  assert.ok(step.actorIds.length <= 6);
  assert.ok(step.durationMs >= 300 && step.durationMs <= 900);
});
```

- [ ] **Step 2: Write failing live view tests**

```js
import { renderLiveMatchView } from '../src/ui/live-match-view.js';

test('live match view uses lightweight accessible player buttons', () => {
  const session = sessionFixture();
  const html = renderLiveMatchView(null, session, { selectedLivePlayerId: null, playbackSpeed: 'standard' });
  assert.equal((html.match(/class="pitch-token /g) ?? []).length, 22);
  assert.match(html, /class="match-ball"/);
  assert.match(html, /data-command="select-live-player"/);
  assert.doesNotMatch(html, /<img[^>]+pitch-token/);
  assert.match(html, /data-command="live-speed" data-speed="fast"/);
  assert.match(html, /data-command="live-next-decision"/);
  assert.match(html, /data-command="live-skip"/);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
node --test tests/live-match-visual.test.js tests/live-match-ui.test.js
```

Expected: FAIL because the visual model and new view do not exist.

- [ ] **Step 4: Implement deterministic formation positions**

`buildPitchModel(session, selectedPlayerId)` must:

- create 11 home and 11 away tokens from active participants
- map `slotPosition` to normalized `x` and `y` percentages
- mirror the away side vertically
- use `player.number ?? index + 1`
- expose `fitness`, `rating`, `booked`, `injured`, `selected`, and an accessible label
- return `{ players, ball: { x: 50, y: 50 } }`

Use this exact output shape:

```js
{
  players: [{ id, side, number, name, position, x, y, fitness, rating, booked, injured, selected, ariaLabel }],
  ball: { x, y }
}
```

- [ ] **Step 5: Implement event-to-animation mapping**

`buildVisualSequence(session, fromEventIndex)` returns one step per new event:

```js
{
  eventIndex,
  type,
  minute,
  actorIds,
  positions: { [playerId]: { x, y } },
  ball: { x, y },
  durationMs
}
```

Use exact maximum actor counts:

| Event | Maximum actor tokens | Duration |
|---|---:|---:|
| `pass` | 4 | 450ms |
| `shot` | 6 | 650ms |
| `goal` | 6 | 800ms |
| `save` | 4 | 600ms |
| `card` | 2 | 400ms |
| `injury` | 2 | 400ms |
| `corner` | 8 | 800ms |
| `kickoff`, `half`, `full` | 0 | 300ms |
| other | 3 | 450ms |

When an event lacks a target player, select nearby active participants deterministically by lineup order; never use random numbers in the UI layer.

- [ ] **Step 6: Add explicit live-match decision metadata**

In `src/game/live-match.js`, add to each returned session:

```js
session.decision = {
  required: !session.completed && ['前半終了', '60分', '75分'].includes(PHASES[session.phaseIndex - 1]?.label),
  reason: session.completed ? 'full-time' : PHASES[session.phaseIndex - 1]?.label ?? null
};
```

For injury and red-card events, set `required: true` and `reason: 'injury'` or `'dismissal'`. Existing automatic match-plan behavior remains the fallback when the user chooses the next phase without manual changes.

- [ ] **Step 7: Implement the vertical match view and schedule screen**

The match view must include:

- score, minute, possession, shots, speed controls
- `div.match-pitch.match-pitch--vertical`
- 22 `button.pitch-token` elements with visible number and descriptive `aria-label`
- one `span.match-ball`
- selected-player panel containing name, position, number, fitness, rating, card/injury status, and available event statistics
- commentary log without `aria-live` on every line
- Mina decision card only while `session.decision.required` is true
- tactical and substitution controls preserved from the current live match view

The schedule screen must show the next fixture first, then future fixtures and results in chronological cards, with derby, promotion, relegation, and cup badges where applicable.

- [ ] **Step 8: Connect playback state in the controller**

Add:

```js
let selectedLivePlayerId = null;
let livePlaybackSpeed = 'standard';
let liveVisualEventIndex = 0;
let liveVisualTimer = null;
```

Use exact speed durations:

```js
const LIVE_SPEED_MULTIPLIER = Object.freeze({ standard: 1, fast: 0.45 });
```

After `advanceLiveMatchSession`, build a sequence starting at `liveVisualEventIndex`, render each step by setting CSS custom properties on the affected tokens, then update the index. If a rendering step throws, catch it, set `liveVisualEventIndex = session.events.length`, render the final session state, and notify `試合演出を省略して進行を続けました。`; do not modify the session result.

Handle `visibilitychange` by clearing `liveVisualTimer` while hidden and rendering the current event state when visible again.

- [ ] **Step 9: Run live match tests and commit**

Run:

```bash
node --test tests/live-match-visual.test.js tests/live-match-ui.test.js tests/live-match.test.js
npm run check
```

Expected: PASS. The pitch contains exactly 22 player nodes and no player images.

```bash
git add src/ui/screens/schedule.js src/ui/live-match-visual.js src/ui/live-match-view.js src/game/live-match.js src/ui/render.js src/ui/controller.js src/mobile-game.css tests/live-match-visual.test.js tests/live-match-ui.test.js tests/live-match.test.js
git commit -m "feat: add lightweight vertical live match center"
```

---

### Task 6: 移籍・経営・育成・記録・受信箱の画面再編

**Files:**
- Create: `src/ui/screens/transfers.js`
- Create: `src/ui/screens/menu.js`
- Create: `tests/mobile-secondary-screens.test.js`
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `src/mobile-game.css`
- Modify: `tests/ui.test.js`
- Modify: `tests/management.test.js`
- Modify: `tests/scouting.test.js`
- Modify: `tests/transfer-negotiation.test.js`

**Interfaces:**
- Produces: `renderTransfersScreen(state, uiState)`, `renderMenuScreen(state, view, uiState)`, `TRANSFER_TABS`
- Consumes: existing transfer, scouting, negotiation, staff, academy, club project, inbox, and record actions

- [ ] **Step 1: Write failing transfer and secondary-screen tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/game/game-engine.js';
import { renderTransfersScreen, TRANSFER_TABS } from '../src/ui/screens/transfers.js';
import { renderMenuScreen } from '../src/ui/screens/menu.js';

test('transfer screen uses the approved five tabs and Rei', () => {
  const state = createNewGame({ seed: 'transfer-v2', clubId: 'jp1-01' });
  assert.deepEqual(TRANSFER_TABS.map((tab) => tab.label), ['おすすめ', '候補リスト', '交渉中', '放出', 'スカウト地域']);
  const html = renderTransfersScreen(state, { transferTab: 'recommended' });
  assert.match(html, /data-character="rei"/);
  assert.match(html, /data-transfer-priority/);
  assert.match(html, /能力/);
  assert.match(html, /移籍金/);
  assert.match(html, /給与/);
  assert.match(html, /適合度/);
});

test('club screen uses Kazuo and exposes decision cost, effect, timing, and risk', () => {
  const state = createNewGame({ seed: 'club-v2', clubId: 'jp1-01' });
  const html = renderMenuScreen(state, 'club', {});
  assert.match(html, /data-character="kazuo"/);
  assert.match(html, /現金/);
  assert.match(html, /移籍予算/);
  assert.match(html, /給与予算/);
  assert.match(html, /効果/);
  assert.match(html, /完了時期/);
  assert.match(html, /リスク/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/mobile-secondary-screens.test.js`

Expected: FAIL because the screen modules do not exist.

- [ ] **Step 3: Implement transfer tab state**

```js
export const TRANSFER_TABS = Object.freeze([
  { id: 'recommended', label: 'おすすめ' },
  { id: 'shortlist', label: '候補リスト' },
  { id: 'negotiations', label: '交渉中' },
  { id: 'outgoing', label: '放出' },
  { id: 'regions', label: 'スカウト地域' }
]);
```

Add `let transferTab = 'recommended';` to `controller.js`. Handle `data-command="set-transfer-tab"` by validating against `TRANSFER_TABS` and rendering. Keep transfer actions routed through existing `performAction` contracts.

- [ ] **Step 4: Implement the transfer screen**

Render in this order:

1. Rei character hero
2. squad weakness summary and `data-transfer-priority`
3. five-tab control
4. one content panel for the selected tab
5. current transfer and wage budget strip

Candidate cards must show `overall`, `potential`, `age`, `position`, `marketEstimate`, wage expectation, scouting confidence, and a computed fit score from 0 to 100. Club negotiation buttons and agent negotiation buttons must remain separate.

- [ ] **Step 5: Implement the menu-owned screens**

`renderMenuScreen(state, view, uiState)` must dispatch:

```js
const MENU_RENDERERS = {
  tactics: renderTactics,
  academy: renderAcademy,
  club: renderClub,
  records: renderRecords,
  secretary: renderSecretary,
  inbox: renderInbox
};
```

Requirements by view:

| View | Required character/section |
|---|---|
| `tactics` | Mina compact advice card, existing match-plan inputs |
| `academy` | prospect cards, development focus, promotion action |
| `club` | Kazuo hero, cash, transfer budget, wage budget, board evaluation, facilities, projects, objective |
| `records` | season and career records with compact tables |
| `secretary` | Mina report grouped by next match, health, contracts, budget |
| `inbox` | unresolved decisions first, clear resolved state, existing decision actions |

Every investment card must show effect, cost, completion time, and risk text before the existing confirmation dialog is opened.

- [ ] **Step 6: Run secondary-screen tests and commit**

Run:

```bash
node --test tests/mobile-secondary-screens.test.js tests/management.test.js tests/scouting.test.js tests/transfer-negotiation.test.js tests/ui.test.js
```

Expected: PASS and every existing management action remains reachable.

```bash
git add src/ui/screens/transfers.js src/ui/screens/menu.js src/ui/render.js src/ui/controller.js src/mobile-game.css tests/mobile-secondary-screens.test.js tests/management.test.js tests/scouting.test.js tests/transfer-negotiation.test.js tests/ui.test.js
git commit -m "feat: reorganize transfer and club management screens"
```

---

### Task 7: 進行テンポとゲームバランスの校正

**Files:**
- Create: `src/game/balance.js`
- Create: `scripts/simulate-balance.mjs`
- Create: `tests/balance-calibration.test.js`
- Create: `docs/balance-calibration-report.md`
- Modify: `src/game/match-engine.js`
- Modify: `src/game/game-engine.js`
- Modify: `src/game/development.js`
- Modify: `src/game/economy.js`
- Modify: `src/game/career.js`
- Modify: `tests/game-engine.test.js`
- Modify: `tests/three-season-club-life.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `BALANCE`, `TEMPO`, `estimateSeasonMinutes(profile)`, `runBalanceSimulation(options)`
- Consumes: existing seeded match simulation, season progression, finances, player lifecycle

- [ ] **Step 1: Write failing balance constant and duration tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, TEMPO, estimateSeasonMinutes } from '../src/game/balance.js';

test('normal season interaction estimate stays inside five to eight hours', () => {
  const minutes = estimateSeasonMinutes({
    normalMatches: 32,
    importantMatches: 8,
    normalWeeks: 34,
    transferWindows: 2
  });
  assert.ok(minutes >= 300 && minutes <= 480, `estimated ${minutes} minutes`);
});

test('balance constants cap user advantage and slow excessive growth', () => {
  assert.ok(BALANCE.userStrengthBonus <= 0.03);
  assert.ok(BALANCE.youngGrowthMultiplier < 1);
  assert.ok(BALANCE.promotedClubDifficulty >= 1);
  assert.equal(TEMPO.visual.standard, 1);
  assert.equal(TEMPO.visual.fast, 0.45);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/balance-calibration.test.js`

Expected: FAIL because `src/game/balance.js` does not exist.

- [ ] **Step 3: Implement explicit calibration constants**

```js
export const TEMPO = Object.freeze({
  normalMatchMinutes: 3,
  importantMatchMinutes: 5,
  normalWeekDecisionMinutes: 4,
  transferWindowMinutes: 30,
  visual: Object.freeze({ standard: 1, fast: 0.45 })
});

export const BALANCE = Object.freeze({
  userStrengthBonus: 0.02,
  promotedClubDifficulty: 1.06,
  youngGrowthMultiplier: 0.86,
  veteranDeclineMultiplier: 1.08,
  fixedStarterFatigueMultiplier: 1.12,
  youthMinutesGrowthBonus: 0.08,
  wageInflationPerSeason: 0.035,
  promotionRevenueMultiplier: 1.18,
  relegationRevenueMultiplier: 0.82
});

export function estimateSeasonMinutes({ normalMatches, importantMatches, normalWeeks, transferWindows }) {
  return normalMatches * TEMPO.normalMatchMinutes
    + importantMatches * TEMPO.importantMatchMinutes
    + normalWeeks * TEMPO.normalWeekDecisionMinutes
    + transferWindows * TEMPO.transferWindowMinutes;
}
```

- [ ] **Step 4: Apply constants at exact calculation boundaries**

- In `match-engine.js`, cap any user-side hidden strength assistance at `BALANCE.userStrengthBonus`; multiply opponent effective strength by `BALANCE.promotedClubDifficulty` only when the user club was promoted into its current division in the previous season.
- In `development.js`, multiply positive growth deltas for players aged 23 or younger by `BALANCE.youngGrowthMultiplier`; then add `BALANCE.youthMinutesGrowthBonus` only when season minutes exceed 900.
- In `career.js`, multiply negative age decline for players aged 31 or older by `BALANCE.veteranDeclineMultiplier`.
- In `game-engine.js`, multiply match fatigue for a player marked fixed starter by `BALANCE.fixedStarterFatigueMultiplier` unless the player began on the bench.
- In `economy.js`, apply `wageInflationPerSeason` at contract market generation, `promotionRevenueMultiplier` after promotion, and `relegationRevenueMultiplier` after relegation. Preserve cash, transfer budget, and wage budget as separate values.

Add or reuse explicit state metadata:

```js
club.lastDivisionChange = { season: state.season, type: 'promotion' | 'relegation', from, to };
```

- [ ] **Step 5: Implement the seeded balance simulation script**

`scripts/simulate-balance.mjs` must export `runBalanceSimulation({ seeds, seasons, clubIds })` and print JSON with:

```js
{
  runs,
  userTitleRate,
  userPromotionRate,
  userRelegationRate,
  averagePointsPerGame,
  averageCash,
  negativeCashRate,
  averageSquadAge,
  averageGrowthUnder23,
  averageDeclineOver31
}
```

Default command:

```json
"balance": "node scripts/simulate-balance.mjs --seeds 12 --seasons 5"
```

Use fixed seed names `balance-01` through `balance-12` and clubs from all three starting divisions.

- [ ] **Step 6: Add acceptance assertions**

```js
test('seeded five-season calibration remains within target ranges', async () => {
  const report = await runBalanceSimulation({
    seeds: ['balance-01', 'balance-02', 'balance-03', 'balance-04'],
    seasons: 3,
    clubIds: ['jp1-10', 'jp2-10', 'jp3-10']
  });
  assert.ok(report.averagePointsPerGame >= 0.8 && report.averagePointsPerGame <= 2.2);
  assert.ok(report.userTitleRate <= 0.45);
  assert.ok(report.negativeCashRate <= 0.25);
  assert.ok(report.averageGrowthUnder23 <= 3.5);
  assert.ok(report.averageDeclineOver31 >= -5.0);
});
```

The ranges are broad regression guards. Record the 12-seed, five-season values and before/after comparison in `docs/balance-calibration-report.md`.

- [ ] **Step 7: Run balance and long-term tests**

Run:

```bash
node --test tests/balance-calibration.test.js tests/game-engine.test.js tests/three-season-club-life.test.js
npm run balance
```

Expected: tests PASS and the generated report satisfies all acceptance ranges.

- [ ] **Step 8: Commit**

```bash
git add src/game/balance.js src/game/match-engine.js src/game/game-engine.js src/game/development.js src/game/economy.js src/game/career.js scripts/simulate-balance.mjs tests/balance-calibration.test.js tests/game-engine.test.js tests/three-season-club-life.test.js docs/balance-calibration-report.md package.json
git commit -m "balance: calibrate season pace and long-term difficulty"
```

---

### Task 8: レスポンシブ・アクセシビリティ・旧後付け層撤去・最終検証

**Files:**
- Create: `tests/e2e/mobile-redesign.spec.mjs`
- Create: `docs/mobile-redesign-report.md`
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/mobile-game.css`
- Modify: `tests/e2e/responsive-layout.spec.mjs`
- Modify: `.github/workflows/responsive-audit.yml`
- Modify: `README.md`
- Delete: `src/chibi-ui.css`
- Delete: `src/chibi-ui-mobile.css`
- Delete: `src/approved-character-art.css`
- Delete: `src/ui/chibi-bootstrap.js`
- Delete: `src/ui/approved-character-art.js`
- Delete: `src/ui/character-sprite/part-1.js`
- Delete: `src/ui/character-sprite/part-2.js`
- Delete: `src/ui/character-sprite/part-3.js`

**Interfaces:**
- Consumes: all completed UI modules and game changes from Tasks 1–7
- Produces: final production bundle, browser audit evidence, implementation report

- [ ] **Step 1: Write the failing browser audit**

```js
import { test, expect } from '@playwright/test';

const widths = [320, 360, 390, 430, 768, 1366, 1536];

for (const width of widths) {
  test(`mobile redesign has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    await page.goto('/');
    await page.locator('#new-game-form button[type="submit"]').click();
    await expect(page.locator('[data-screen="dashboard"]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('live match uses 22 lightweight tokens and keyboard-accessible selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#new-game-form button[type="submit"]').click();
  await page.locator('[data-command="begin-live-week"]').click();
  await expect(page.locator('.pitch-token')).toHaveCount(22);
  await page.locator('.pitch-token').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-live-player-detail]')).toBeVisible();
  await expect(page.locator('.match-pitch img')).toHaveCount(0);
});
```

- [ ] **Step 2: Add static regression tests for removed post-processing**

Add to `tests/mobile-shell-v2.test.js`:

```js
import { readFile } from 'node:fs/promises';

test('production entrypoint has no legacy mutation observer UI scripts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /chibi-bootstrap/);
  assert.doesNotMatch(html, /approved-character-art/);
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  assert.doesNotMatch(controller, /MutationObserver/);
});
```

- [ ] **Step 3: Run audits and verify RED before cleanup**

Run:

```bash
node --test tests/mobile-shell-v2.test.js
npx playwright test tests/e2e/mobile-redesign.spec.mjs
```

Expected: FAIL because legacy script references remain and final responsive rules are incomplete.

- [ ] **Step 4: Remove legacy stylesheet and script references**

Final `index.html` stylesheet and script order:

```html
<link rel="stylesheet" href="./src/styles.css">
<link rel="stylesheet" href="./src/mobile-game.css">
<script type="module" src="./src/main.js"></script>
```

Delete the listed legacy files. Ensure `render.js` and screen modules directly render all character and layout markup.

- [ ] **Step 5: Complete responsive and accessibility rules**

Implement exact breakpoints:

- `max-width: 430px`: single-column content, fixed five-item bottom nav, 72px safe content padding
- `max-width: 360px`: compact typography and 10px card gaps without reducing controls below 44px
- `min-width: 768px`: centered content up to 760px and two-column secondary cards
- `min-width: 1180px`: desktop rail plus content up to 1180px; bottom nav may remain hidden while keyboard shortcuts remain available

Required CSS contracts:

```css
.primary-nav { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.primary-nav__item { min-width: 0; min-height: 56px; }
.match-pitch { contain: layout paint; }
.pitch-token { width: 32px; height: 32px; will-change: transform; }
@media (max-width: 360px) { .pitch-token { width: 29px; height: 29px; } }
```

Add visible text or icon+accessible label for warnings, injuries, selected state, fixed starters, and disabled actions. Maintain focus return after modal and bottom-sheet close.

- [ ] **Step 6: Update CI and documentation**

Update the responsive workflow to run:

```bash
npm ci
npm run verify
npm run build
npm run test:responsive
```

Upload Playwright HTML report and screenshots for 320, 360, 390, 430, 768, 1366, and 1536 widths.

Update `README.md` with:

- the five primary navigation items
- vertical lightweight match center behavior
- new save incompatibility notice
- character roles
- `npm run balance`

Write `docs/mobile-redesign-report.md` with changed files, test totals, screenshot review results, asset sizes, known limitations, and the final commit SHA.

- [ ] **Step 7: Run the complete verification suite**

Run:

```bash
npm test
npm run check
npm run smoke
npm run build
npm run test:responsive
npm run balance
git diff --check
```

Expected:

- all commands exit 0
- 320px viewport has no horizontal overflow
- primary navigation has exactly five items
- live match has exactly 22 token buttons and one ball
- no `MutationObserver` remains in the active UI path
- no legacy save is accepted
- all four character assets remain below 240 KiB

- [ ] **Step 8: Review the final diff**

Review by responsibility:

1. save boundary and cloud-local separation
2. controller state and double-action prevention
3. UI screen isolation and stable data hooks
4. match event visualization without result mutation
5. balance constants and seeded simulation evidence
6. responsive, keyboard, focus, and reduced-motion behavior

Fix every correctness or maintainability issue found, rerun the complete verification suite, and update the report with the final results.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: complete mobile football director redesign"
```

---

## Final Acceptance Checklist

- [ ] A saved or newly created career opens on the home screen.
- [ ] The mobile primary navigation is exactly Home, Match, Squad, Transfers, Menu in Japanese labels.
- [ ] Home presents next fixture, up to five prioritized attention items, team state, recent results, and primary progression actions.
- [ ] Mina, Sota, Rei, and Kazuo are rendered directly by screen modules with optimized static assets.
- [ ] Squad supports both drag placement and tap-select then slot-tap placement.
- [ ] Player detail opens in an accessible bottom sheet.
- [ ] The match center is a vertical full pitch with 22 numbered circle tokens and one ball.
- [ ] Only event-related tokens move, and animation failure never changes the calculated match result.
- [ ] Player token selection shows name, position, number, fitness, rating, warning, injury, and available match statistics.
- [ ] Intervention occurs only at approved decision points, with automatic fallback behavior preserved.
- [ ] Transfer, club, academy, tactics, records, secretary, and inbox operations remain available.
- [ ] Legacy local, JSON, and cloud saves are rejected with the explicit old-version message.
- [ ] Seeded calibration remains inside the declared broad balance guardrails.
- [ ] 320px through 1536px audited widths have no unintended horizontal overflow.
- [ ] All required verification commands pass and the final report records evidence.
