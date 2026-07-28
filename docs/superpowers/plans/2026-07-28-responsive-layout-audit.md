# Responsive Layout Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC 1366×768とスマートフォン360×800を中心に、主要10画面の横はみ出し・重なり・操作不能を解消し、7ビューポートの実ブラウザ監査を自動化する。

**Architecture:** 既存のHTMLレンダリング構造を維持し、共通シェルとレスポンシブCSSを4段階へ整理する。Playwright監査はゲーム状態をブラウザで生成して主要画面へ遷移し、ページ幅、固定UIの衝突、操作到達性、JavaScript例外を計測する。スクリーンショットはCI成果物として保存する。

**Tech Stack:** Node.js 22、ES Modules、CSS Grid/Flexbox、Node Test Runner、Playwright Chromium、GitHub Actions

## Global Constraints

- 基準PCは1366×768、基準スマートフォンは360×800。
- 検証幅は1536×864、1366×768、1024×768、768×1024、390×844、360×800、320×568。
- 1280px以上は左216px・中央`minmax(0,1fr)`・右264px、トップバー64px。
- 1121～1279pxは右パネル非表示・左216px、681～1120pxは左82px、680px以下は下部5等分ナビ。
- ページ全体の横スクロールは禁止し、表は`.table-wrap`内部のみ許可する。
- スマートフォンの主要操作は44×44px以上とし、safe-areaを考慮する。
- ゲームロジック、セーブ形式、試合計算は変更しない。

---

### Task 1: Browser audit harness

**Files:**
- Modify: `package.json`
- Create: `playwright.config.mjs`
- Create: `tests/e2e/responsive-layout.spec.mjs`
- Create: `.github/workflows/responsive-audit.yml`

**Interfaces:**
- Produces: `npm run test:responsive` and `npm run test:responsive:update`.
- Produces: Playwright projects named `desktop-large`, `desktop`, `desktop-small`, `tablet`, `mobile`, `mobile-small`, `mobile-min`.

- [ ] **Step 1: Add a failing package-script test**

Add assertions to `tests/game-shell.test.js` requiring `package.json` to expose `test:responsive` and requiring the Playwright config to declare all seven viewports.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/game-shell.test.js`
Expected: FAIL because the script and config do not exist.

- [ ] **Step 3: Add Playwright configuration and dependencies**

Add `@playwright/test` as a dev dependency, scripts for responsive tests, a web server using `npm run dev`, Chromium-only projects, `trace: retain-on-failure`, and screenshots on failure.

- [ ] **Step 4: Add the first browser audit**

Create a helper that starts a deterministic new game, navigates through `dashboard`, `schedule`, `squad`, `tactics`, `transfers`, `club`, and `records`, then asserts:

```js
const dimensions = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
```

Capture `pageerror` and console errors and fail when either occurs.

- [ ] **Step 5: Run browser audit and record baseline failures**

Run: `npm run test:responsive`
Expected: FAIL on current layout for at least one viewport or layout invariant.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.mjs tests/game-shell.test.js tests/e2e/responsive-layout.spec.mjs .github/workflows/responsive-audit.yml
git commit -m "test: add responsive browser audit"
```

### Task 2: Desktop shell density

**Files:**
- Modify: `src/styles.css`
- Test: `tests/game-shell.test.js`
- Test: `tests/e2e/responsive-layout.spec.mjs`

**Interfaces:**
- Keeps existing `.app-shell`, `.sidebar`, `.context-panel`, `.topbar`, and `.content` class names.
- Produces desktop geometry: `216px minmax(0,1fr) 264px` and `64px` topbar.

- [ ] **Step 1: Add failing desktop geometry assertions**

Require the desktop CSS values and assert at 1366×768 that sidebar, main content, and context panel do not overlap and dashboard quick actions are visible without horizontal scrolling.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/game-shell.test.js && npm run test:responsive -- --project=desktop`
Expected: FAIL with old 238px/300px/76px values.

- [ ] **Step 3: Implement compact desktop shell**

Adjust widths, topbar height, content/card padding, sidebar overflow, context panel overflow, dashboard card minimum heights, and typography. Preserve readable text and avoid hiding actions.

- [ ] **Step 4: Verify GREEN**

Run the focused Node and Playwright tests. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css tests/game-shell.test.js tests/e2e/responsive-layout.spec.mjs
git commit -m "fix: compact desktop game shell"
```

### Task 3: Intermediate and tablet breakpoints

**Files:**
- Modify: `src/styles.css`
- Test: `tests/game-shell.test.js`
- Test: `tests/e2e/responsive-layout.spec.mjs`

**Interfaces:**
- 1121–1279px: two columns with 216px sidebar.
- 681–1120px: two columns with 82px icon sidebar.
- Context panel hidden below 1280px.

- [ ] **Step 1: Add failing breakpoint assertions**
- [ ] **Step 2: Run desktop-small and tablet projects and verify RED**
- [ ] **Step 3: Reorganize breakpoints and grid column counts**
- [ ] **Step 4: Verify 1024×768 and 768×1024 have no page overflow**
- [ ] **Step 5: Commit**

```bash
git add src/styles.css tests/game-shell.test.js tests/e2e/responsive-layout.spec.mjs
git commit -m "fix: stabilize intermediate and tablet layouts"
```

### Task 4: Mobile navigation and common surfaces

**Files:**
- Modify: `src/styles.css`
- Test: `tests/game-shell.test.js`
- Test: `tests/e2e/responsive-layout.spec.mjs`

**Interfaces:**
- Mobile navigation remains `.mobile-nav` with five `.nav__item` children.
- The mobile navigation uses `display:grid; grid-template-columns:repeat(5,minmax(0,1fr))` and no horizontal scrolling.

- [ ] **Step 1: Add failing mobile navigation and target-size tests**
- [ ] **Step 2: Verify RED at 360×800 and 320×568**
- [ ] **Step 3: Implement fixed five-column navigation, safe-area spacing, title truncation, responsive cards, and 44px controls**
- [ ] **Step 4: Verify all mobile projects**
- [ ] **Step 5: Commit**

```bash
git add src/styles.css tests/game-shell.test.js tests/e2e/responsive-layout.spec.mjs
git commit -m "fix: optimize mobile navigation and surfaces"
```

### Task 5: Squad, live match, dialogs, and tables

**Files:**
- Modify: `src/styles.css`
- Modify only if required: `src/ui/render.js`
- Modify only if required: `src/ui/dialogs.js`
- Test: `tests/e2e/responsive-layout.spec.mjs`

**Interfaces:**
- Tables keep `.data-table` minimum width and scroll only inside `.table-wrap`.
- Mobile dialogs keep header/actions reachable while `.game-dialog__body` scrolls.
- Live match retains current event and action APIs.

- [ ] **Step 1: Add failing tests for table containment, squad layout, live-match scoreboard, and dialog actions**
- [ ] **Step 2: Verify RED on affected projects**
- [ ] **Step 3: Apply minimal CSS and markup changes**
- [ ] **Step 4: Verify the focused browser tests and existing dialog/live-match Node tests**
- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/ui/render.js src/ui/dialogs.js tests/e2e/responsive-layout.spec.mjs
git commit -m "fix: make complex game views responsive"
```

### Task 6: Full screenshot review and regression verification

**Files:**
- Modify: `docs/test-report.md`
- Modify: `docs/code-review.md`
- Create: `docs/responsive-layout-report.md`

**Interfaces:**
- CI uploads `playwright-report` and `responsive-screenshots` artifacts.

- [ ] **Step 1: Run full responsive suite**

Run: `npm run test:responsive`
Expected: all seven projects pass.

- [ ] **Step 2: Review screenshots for dashboard, squad, transfers, club, live match, and dialog at all required sizes**

Record every reviewed screenshot and any accepted internal table scrolling in `docs/responsive-layout-report.md`.

- [ ] **Step 3: Run complete regression verification**

```bash
npm test
npm run check
npm run smoke
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Update reports and commit**

```bash
git add docs/test-report.md docs/code-review.md docs/responsive-layout-report.md
git commit -m "docs: record responsive layout verification"
```

### Task 7: PR review and integration

**Files:**
- Review all changed files.

- [ ] **Step 1: Run `git diff --check` and the complete verification again**
- [ ] **Step 2: Inspect PR diff for unrelated game-logic changes**
- [ ] **Step 3: Resolve all critical and important review findings**
- [ ] **Step 4: Open PR against `main`, wait for responsive CI and Cloudflare preview, then merge with expected head SHA**
