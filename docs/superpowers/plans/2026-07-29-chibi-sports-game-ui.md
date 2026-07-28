# デフォルメ・スポーツゲームUI全面刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 承認済み参考画像を基準に、既存のFootball Director全主要画面を3〜4頭身キャラクターとカード編成を中心とするスマートフォン最適化ゲームUIへ刷新する。

**Architecture:** 既存のゲーム状態・計算・コントローラは維持し、表示層だけを段階的に置換する。キャラクター定義とゲームUI部品を独立モジュールへ分離し、`render.js`は状態から画面固有データを組み立てる責務に限定する。

**Tech Stack:** HTML生成、CSS、Vanilla JavaScript、Node.js 22、node:test、Playwright 1.61.1、GitHub Actions、Cloudflare Pages

## Global Constraints

- ビジュアル基準は承認済みの `サッカー管理ゲームの魅力的な広告.png` とする。
- 実在ゲーム・実在キャラクター・実在クラブの素材を複製しない。
- キャラクターは3〜4頭身のオリジナルスポーツアニメ調で統一する。
- 基準画面は390×844、最小320×568、最大1536×864を検証する。
- 文書全体の横スクロールを禁止する。
- 主要操作領域を44×44px以上とする。
- ゲームロジック、試合計算、保存スキーマ、クラウド保存APIを変更しない。
- 正式キャラクターは透明背景WebPを使用し、簡易SVGを正式素材として使わない。

---

## File Structure

### Create

- `src/ui/game-theme.js`: キャラクター、レアリティ、状態色の定義
- `src/ui/game-components.js`: HUD、キャラ画像、選手カード、ゲームボタン、バナーのHTML生成
- `public/assets/game-ui/characters/*.webp`: 正式キャラクターアセット
- `public/assets/game-ui/backgrounds/*.webp`: スタジアムとイベント背景
- `tests/game-components.test.js`: 共通ゲームUI部品のDOM契約
- `tests/game-ui-render.test.js`: 主要画面のDOM契約
- `tests/e2e/chibi-game-ui.spec.mjs`: 7ビューポートの実ブラウザ監査
- `docs/chibi-game-ui-report.md`: 実装・目視確認報告

### Modify

- `src/ui/render.js`: 全主要画面へ共通ゲームUI部品を適用
- `src/ui/context-panel.js`: PC右パネルをゲームHUD化
- `src/ui/templates.js`: アイコンと既存カード互換を維持
- `src/styles.css`: ゲームデザイントークン、画面レイアウト、レスポンシブ規則
- `src/ui/controller.js`: 新しいUI操作を既存コマンドへ接続
- `tests/game-shell.test.js`: ナビゲーションとレスポンシブ契約
- `package.json`: UI監査スクリプト追加
- `.github/workflows/responsive-audit.yml`: 新UI画面の証跡保存

---

### Task 1: キャラクターとゲームテーマ定義

**Files:**
- Create: `src/ui/game-theme.js`
- Create: `tests/game-components.test.js`
- Create: `public/assets/game-ui/characters/*.webp`

**Interfaces:**
- Produces: `GAME_CHARACTERS`, `RARITY_STYLES`, `statusTone(value, thresholds)`

- [ ] **Step 1: Write the failing theme test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CHARACTERS, RARITY_STYLES, statusTone } from '../src/ui/game-theme.js';

test('game theme exposes the approved cast and rarity tiers', () => {
  assert.deepEqual(Object.keys(GAME_CHARACTERS), [
    'assistant', 'starPlayer', 'goalkeeper', 'scout', 'manager', 'mascot'
  ]);
  assert.equal(RARITY_STYLES.legendary.className, 'game-rarity--legendary');
  assert.equal(statusTone(39, { danger: 45, warning: 60 }), 'danger');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/game-components.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/ui/game-theme.js`.

- [ ] **Step 3: Implement the theme module**

```js
export const GAME_CHARACTERS = Object.freeze({
  assistant: { name: 'ミナ', src: '/assets/game-ui/characters/assistant-normal.webp', alt: '戦術アシスタントのミナ' },
  starPlayer: { name: '黒田 蓮', src: '/assets/game-ui/characters/player-star.webp', alt: '主力選手の黒田蓮' },
  goalkeeper: { name: '藤沢 海斗', src: '/assets/game-ui/characters/player-gk.webp', alt: 'ゴールキーパーの藤沢海斗' },
  scout: { name: '神谷', src: '/assets/game-ui/characters/scout.webp', alt: 'スカウト担当の神谷' },
  manager: { name: '監督', src: '/assets/game-ui/characters/manager.webp', alt: 'クラブ監督' },
  mascot: { name: 'ノヴァ', src: '/assets/game-ui/characters/mascot.webp', alt: 'クラブマスコットのノヴァ' }
});

export const RARITY_STYLES = Object.freeze({
  normal: { className: 'game-rarity--normal', label: 'N' },
  rare: { className: 'game-rarity--rare', label: 'R' },
  epic: { className: 'game-rarity--epic', label: 'SR' },
  legendary: { className: 'game-rarity--legendary', label: 'SSR' }
});

export function statusTone(value, { danger, warning }) {
  if (value < danger) return 'danger';
  if (value < warning) return 'warning';
  return 'good';
}
```

- [ ] **Step 4: Optimize generated character assets**

Run:

```bash
python scripts/prepare_game_ui_assets.py \
  --source-dir /mnt/data/game-ui-character-source \
  --output-dir public/assets/game-ui/characters \
  --max-width 768 \
  --format webp \
  --quality 88
```

Expected: Each WebP is below 450 KiB, has transparency, and uses the exact names from the spec.

- [ ] **Step 5: Run the test and commit**

Run: `node --test tests/game-components.test.js`
Expected: PASS.

```bash
git add src/ui/game-theme.js tests/game-components.test.js public/assets/game-ui/characters
git commit -m "feat: add chibi sports game character theme"
```

---

### Task 2: 共通ゲームUIコンポーネント

**Files:**
- Create: `src/ui/game-components.js`
- Modify: `tests/game-components.test.js`

**Interfaces:**
- Consumes: `GAME_CHARACTERS`, `RARITY_STYLES`, `escapeHtml`, `icon`
- Produces: `gameCharacter(key, options)`, `gameHud(items)`, `gamePlayerCard(player, options)`, `gameActionTile(options)`, `gameBanner(options)`

- [ ] **Step 1: Add failing component tests**

```js
import { gameCharacter, gameHud, gamePlayerCard } from '../src/ui/game-components.js';

test('character image uses a real asset and lazy loading', () => {
  const html = gameCharacter('assistant', { pose: 'normal', className: 'hero-character' });
  assert.match(html, /assistant-normal\.webp/);
  assert.match(html, /loading="lazy"/);
  assert.doesNotMatch(html, /<svg/);
});

test('player card exposes position, level and rating', () => {
  const html = gamePlayerCard({ id: 'p1', name: '黒田 蓮', position: 'ST', overall: 78, level: 75 }, { rarity: 'legendary' });
  assert.match(html, /data-player-id="p1"/);
  assert.match(html, />ST</);
  assert.match(html, /Lv\.75/);
  assert.match(html, />78</);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/game-components.test.js`
Expected: FAIL because `game-components.js` does not exist.

- [ ] **Step 3: Implement minimal components**

```js
export function gameCharacter(key, { className = '', eager = false } = {}) {
  const character = GAME_CHARACTERS[key];
  if (!character) return '';
  return `<img class="game-character ${escapeHtml(className)}" src="${character.src}" alt="${escapeHtml(character.alt)}" loading="${eager ? 'eager' : 'lazy'}">`;
}

export function gameHud(items) {
  return `<div class="game-hud">${items.map((item) => `<div class="game-hud__item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</div>`).join('')}</div>`;
}

export function gamePlayerCard(player, { rarity = 'rare', compact = false } = {}) {
  const rarityStyle = RARITY_STYLES[rarity] ?? RARITY_STYLES.rare;
  return `<button class="game-player-card ${rarityStyle.className} ${compact ? 'is-compact' : ''}" type="button" data-player-id="${escapeHtml(player.id)}"><span class="game-player-card__position">${escapeHtml(player.position)}</span><span class="game-player-card__portrait" aria-hidden="true"></span><strong>${escapeHtml(player.name)}</strong><span>Lv.${Math.max(1, Number(player.level ?? player.age ?? 1))}</span><b>${Math.round(player.overall)}</b></button>`;
}
```

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/game-components.test.js`
Expected: PASS.

```bash
git add src/ui/game-components.js tests/game-components.test.js
git commit -m "feat: add reusable sports game UI components"
```

---

### Task 3: デザイントークンとレスポンシブ基盤

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/game-shell.test.js`

**Interfaces:**
- Produces CSS classes prefixed with `game-`, plus responsive behavior at 1280px, 1120px, 680px, and 360px.

- [ ] **Step 1: Add failing CSS contract tests**

```js
test('chibi sports theme provides mobile game navigation and card tiers', () => {
  assert.match(css, /--game-navy-950:\s*#061126/i);
  assert.match(css, /\.game-player-card/);
  assert.match(css, /\.game-rarity--legendary/);
  assert.match(css, /@media \(max-width:\s*680px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/game-shell.test.js`
Expected: FAIL for missing theme variables and classes.

- [ ] **Step 3: Add the game design system**

```css
:root {
  --game-navy-950: #061126;
  --game-navy-900: #0b1f45;
  --game-panel: #102d5b;
  --game-panel-strong: #17457c;
  --game-blue: #168cff;
  --game-cyan: #38d9ff;
  --game-lime: #bffd35;
  --game-gold: #ffd14f;
  --game-danger: #ff536a;
}

.game-player-card {
  min-width: 0;
  border: 2px solid color-mix(in srgb, var(--game-blue) 45%, white 15%);
  border-radius: 12px;
  background: linear-gradient(180deg, #2d75ce, #0d2856);
}

.game-rarity--legendary {
  border-color: var(--game-gold);
  box-shadow: 0 0 0 1px rgba(255, 209, 79, .5), 0 0 18px rgba(255, 209, 79, .28);
}
```

Implement mobile card sizing with `clamp()` and keep 44px minimum actions.

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/game-shell.test.js`
Expected: PASS.

```bash
git add src/styles.css tests/game-shell.test.js
git commit -m "feat: add responsive chibi sports game design system"
```

---

### Task 4: ホーム画面のゲームポータル化

**Files:**
- Modify: `src/ui/render.js`
- Create: `tests/game-ui-render.test.js`

**Interfaces:**
- Consumes: `gameCharacter`, `gameHud`, `gameActionTile`, existing `nextFixture()` and inbox state
- Produces: Dashboard DOM containing `.game-home-hero`, `.game-shortcut-grid`, `.game-event-banner`, and existing commands.

- [ ] **Step 1: Add failing dashboard DOM test**

```js
test('dashboard renders the approved mobile game portal', () => {
  const html = renderDashboardForTest(createGameState());
  assert.match(html, /class="game-home-hero"/);
  assert.match(html, /assistant-normal\.webp/);
  assert.match(html, /data-command="play-week"/);
  assert.match(html, /data-nav="squad"/);
  assert.match(html, /class="game-shortcut-grid"/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-ui-render.test.js`
Expected: FAIL because dashboard still uses the old card grid.

- [ ] **Step 3: Replace dashboard presentation only**

Keep the current fixture, metrics, alerts, inbox, and commands. Render:

```js
return `<div class="game-command-hub game-command-hub--visual">
  ${gameHomeTopBar(state, club)}
  ${gameNextMatchHero({ state, club, fixture, opponent })}
  ${gameHud([...])}
  ${gameShortcutGrid([...])}
  ${gameMissionList(unresolved, alerts)}
  ${gameEventBanner(state)}
</div>`;
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test tests/game-ui-render.test.js
npm test
```

Expected: Focused tests PASS and all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js tests/game-ui-render.test.js
git commit -m "feat: redesign dashboard as a mobile game portal"
```

---

### Task 5: チーム編成を顔付きカードUIへ変更

**Files:**
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `tests/game-ui-render.test.js`

**Interfaces:**
- Reuses existing drag/drop attributes and commands: `data-player-id`, `data-lineup-slot`, `data-action="auto-lineup"`.

- [ ] **Step 1: Add failing lineup contract test**

```js
test('squad uses face cards without removing lineup interactions', () => {
  const html = renderSquadForTest(createGameState());
  assert.match(html, /class="game-team-hud"/);
  assert.match(html, /class="game-lineup-pitch"/);
  assert.match(html, /class="game-player-card/);
  assert.match(html, /data-lineup-slot=/);
  assert.match(html, /data-action="auto-lineup"/);
  assert.match(html, /class="game-bench-strip"/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-ui-render.test.js`
Expected: FAIL for missing game card structure.

- [ ] **Step 3: Render lineup and bench with shared player cards**

Wrap existing slot logic with `gamePlayerCard()` and preserve drag listeners. Use CSS-only rarity assignment derived from overall:

```js
function rarityForOverall(overall) {
  if (overall >= 82) return 'legendary';
  if (overall >= 76) return 'epic';
  if (overall >= 70) return 'rare';
  return 'normal';
}
```

- [ ] **Step 4: Verify existing formation behavior**

Run:

```bash
node --test tests/game-ui-render.test.js tests/squad*.test.js
npm test
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js src/ui/controller.js tests/game-ui-render.test.js
git commit -m "feat: add chibi player cards to squad management"
```

---

### Task 6: ライブ試合HUDとキャラクター演出

**Files:**
- Modify: `src/ui/render.js`
- Modify: `src/styles.css`
- Modify: `tests/game-ui-render.test.js`

**Interfaces:**
- Preserve existing live match commands and interval simulation.
- Add `.game-live-scoreboard`, `.game-live-pitch`, `.game-match-command-dock`, and event character cut-ins.

- [ ] **Step 1: Add failing live-match test**

```js
test('live match retains controls inside the game HUD', () => {
  const html = renderLiveMatchForTest(createLiveMatchState());
  assert.match(html, /class="game-live-scoreboard"/);
  assert.match(html, /class="game-live-pitch"/);
  assert.match(html, /data-command="advance-live-match"/);
  assert.match(html, /data-command="set-live-speed"/);
  assert.match(html, /class="game-match-command-dock"/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-ui-render.test.js`
Expected: FAIL for missing HUD classes.

- [ ] **Step 3: Recompose the existing live match markup**

Do not modify scoring or event calculation. Move statistics and tactics into responsive panels and render the 2D pitch as the visual center.

- [ ] **Step 4: Run match and full regressions**

Run:

```bash
node --test tests/game-ui-render.test.js tests/*match*.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js src/styles.css tests/game-ui-render.test.js
git commit -m "feat: redesign live matches with a sports game HUD"
```

---

### Task 7: 移籍とスカウト画面のキャラクター化

**Files:**
- Modify: `src/ui/render.js`
- Modify: `tests/game-ui-render.test.js`

**Interfaces:**
- Preserve `data-action` and `data-command` values for scouting, shortlist, club negotiation, agent negotiation, and loans.

- [ ] **Step 1: Add failing transfer test**

```js
test('transfer market renders scout tabs and character cards', () => {
  const html = renderTransfersForTest(createGameState());
  assert.match(html, /class="game-scout-banner"/);
  assert.match(html, /scout\.webp/);
  assert.match(html, /class="game-transfer-card"/);
  assert.match(html, /data-action="start-club-negotiation"/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-ui-render.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the visual transfer layer**

Use scout character banners, player portrait cards, rarity, skill chips, and price CTA while keeping the existing negotiation state machine.

- [ ] **Step 4: Run transfer and full tests**

Run:

```bash
node --test tests/game-ui-render.test.js tests/*transfer*.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js tests/game-ui-render.test.js
git commit -m "feat: redesign scouting and transfer screens"
```

---

### Task 8: クラブ・施設・理事会のゲーム画面化

**Files:**
- Modify: `src/ui/render.js`
- Modify: `src/ui/context-panel.js`
- Modify: `tests/game-ui-render.test.js`

**Interfaces:**
- Preserve facility upgrade, staff, board objective, supporter, career, and record commands.

- [ ] **Step 1: Add failing club test**

```js
test('club screen uses facility tiles and manager characters', () => {
  const html = renderClubForTest(createGameState());
  assert.match(html, /class="game-club-hero"/);
  assert.match(html, /manager\.webp/);
  assert.match(html, /mascot\.webp/);
  assert.match(html, /class="game-facility-grid"/);
  assert.match(html, /data-project-id=/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-ui-render.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement club visual hierarchy**

Place finances and board confidence in the top HUD, facilities in colorful tiles, and staff/records/career in menu cards. Use manager and mascot images only in the hero area.

- [ ] **Step 4: Run economy and full tests**

Run:

```bash
node --test tests/game-ui-render.test.js tests/*economy*.test.js tests/*board*.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js src/ui/context-panel.js tests/game-ui-render.test.js
git commit -m "feat: redesign club management screens"
```

---

### Task 9: 補助画面とモーダルの統一

**Files:**
- Modify: `src/ui/render.js`
- Modify: `src/styles.css`
- Modify: `tests/game-ui-render.test.js`

**Interfaces:**
- Covers new game, schedule, tactics, academy, records, secretary, inbox, player detail, cloud dialogs.

- [ ] **Step 1: Add failing secondary screen assertions**

```js
test('secondary screens share the game panel system', () => {
  for (const html of renderSecondaryScreensForTest(createGameState())) {
    assert.match(html, /game-screen|game-panel|game-list-card/);
    assert.doesNotMatch(html, /window\.alert/);
  }
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-ui-render.test.js`
Expected: FAIL.

- [ ] **Step 3: Apply shared panels without changing behavior**

Use the new tokens, panels, tabs, list cards, bottom sheets, and CTA buttons. Do not add new game mechanics in this task.

- [ ] **Step 4: Run all tests and commit**

Run: `npm test`
Expected: All tests PASS.

```bash
git add src/ui/render.js src/styles.css tests/game-ui-render.test.js
git commit -m "feat: unify secondary screens with the game UI"
```

---

### Task 10: 実ブラウザ監査と継続CI

**Files:**
- Create: `tests/e2e/chibi-game-ui.spec.mjs`
- Modify: `playwright.config.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/responsive-audit.yml`

**Interfaces:**
- Produces screenshots for home, team, match, transfer, club, new game, and modal at 7 viewports.

- [ ] **Step 1: Add the browser audit**

```js
const viewports = [
  { name: 'desktop-large', width: 1536, height: 864 },
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-small', width: 360, height: 800 },
  { name: 'mobile-min', width: 320, height: 568 }
];
```

For every screen assert:

```js
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
expect(await findViewportEscapes(page)).toEqual([]);
expect(await findSmallPrimaryActions(page, 44)).toEqual([]);
expect(await findPlayerCardCollisions(page)).toEqual([]);
```

- [ ] **Step 2: Run and fix every failure**

Run: `npm run test:responsive`
Expected: 7 viewports PASS and screenshots are written.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run check
npm run smoke
npm run build
npm run test:responsive
```

Expected: Every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/chibi-game-ui.spec.mjs playwright.config.mjs package.json .github/workflows/responsive-audit.yml
git commit -m "test: audit the chibi sports game UI"
```

---

### Task 11: コードレビュー・証跡・PR

**Files:**
- Create: `docs/chibi-game-ui-report.md`
- Modify: `docs/test-report.md`
- Modify: `docs/code-review.md`

- [ ] **Step 1: Review the complete diff**

Check:

- Existing commands and data attributes were preserved.
- No game model or save schema changes were introduced.
- No copyrighted game assets were included.
- Character assets are optimized and have alt text.
- No mobile horizontal overflow or card collisions remain.

- [ ] **Step 2: Record exact verification evidence**

Document test counts, viewport matrix, screenshot count, asset sizes, and remaining limitations.

- [ ] **Step 3: Open the PR and wait for CI**

PR title: `デフォルメキャラ中心のスポーツゲームUIへ全面刷新`

PR body must include before/after screenshots and confirm that game logic is unchanged.

- [ ] **Step 4: Resolve review findings and merge**

Use squash merge only after all required jobs pass and no unresolved high-priority findings remain.
