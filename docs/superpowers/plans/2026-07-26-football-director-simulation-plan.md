# Football Director Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a polished, deterministic, browser-based football management simulation with a complete season loop and automated verification.

**Architecture:** Pure ES modules isolate simulation rules from DOM rendering. A controller mutates one versioned `GameState`, persists it to localStorage, and renders responsive screens. Node’s built-in test runner verifies the simulation without browser dependencies.

**Tech Stack:** HTML5, CSS3, JavaScript ES2022 modules, Node.js 22 built-in test runner, localStorage.

## Global Constraints

- No backend or external API.
- No licensed clubs, players, logos, or paid assets.
- Desktop and mobile browser support.
- Deterministic seeded simulation.
- Versioned JSON save format.
- All core rules must be testable without the DOM.

---

### Task 1: Project Foundation and Deterministic Core

**Files:**
- Create: `package.json`, `src/core/random.js`, `src/core/utils.js`
- Test: `tests/random.test.js`

**Interfaces:**
- Produces: `createRng(seed)`, `clamp`, `round`, `formatMoney`, `deepClone`.

- [x] Write tests proving equal seeds produce equal sequences and range helpers stay bounded.
- [x] Run tests and confirm failure because modules do not exist.
- [x] Implement deterministic RNG and generic utilities.
- [x] Run tests and confirm pass.

### Task 2: League Fixtures and Standings

**Files:**
- Create: `src/game/fixtures.js`
- Test: `tests/fixtures.test.js`

**Interfaces:**
- Produces: `createDoubleRoundRobin`, `calculateStandings`, `getWeekFixtures`.

- [x] Write tests for 8-team/14-week schedule, one match per club per week, home/away reversal, and standings tie-break order.
- [x] Confirm tests fail.
- [x] Implement fixture generation and standings calculation.
- [x] Confirm tests pass.

### Task 3: Data Generation and Squad Selection

**Files:**
- Create: `src/data/catalog.js`, `src/game/squad.js`
- Test: `tests/squad.test.js`

**Interfaces:**
- Produces: club/player generation, formation definitions, `selectBestLineup`, `validateLineup`, `lineupRating`.

- [x] Write tests for valid 11-player lineups, unavailable-player exclusion, and positional compatibility.
- [x] Confirm tests fail.
- [x] Implement fictional data generation and lineup selection.
- [x] Confirm tests pass.

### Task 4: Match Engine

**Files:**
- Create: `src/game/match-engine.js`
- Test: `tests/match-engine.test.js`

**Interfaces:**
- Produces: `simulateMatch(context)` returning score, stats, events, player ratings, injuries, cards, and xG.

- [x] Write tests for deterministic output, valid score/stat ranges, home advantage over many seeds, and tactical effects.
- [x] Confirm tests fail.
- [x] Implement strength model, chance generation, event timeline, and ratings.
- [x] Confirm tests pass.

### Task 5: Economy, Development, Transfers, and Events

**Files:**
- Create: `src/game/economy.js`, `src/game/development.js`, `src/game/transfers.js`, `src/game/events.js`
- Test: `tests/management.test.js`

**Interfaces:**
- Produces weekly finance settlement, training application, injury recovery, transfer validation/execution, and decision-event generation/resolution.

- [x] Write tests for revenue/wage accounting, fatigue trade-offs, transfer affordability, academy promotion, and event effects.
- [x] Confirm tests fail.
- [x] Implement management systems.
- [x] Confirm tests pass.

### Task 6: Aggregate Game Engine and Persistence

**Files:**
- Create: `src/game/game-engine.js`, `src/game/save.js`
- Test: `tests/game-engine.test.js`

**Interfaces:**
- Produces: `createNewGame`, `playNextWeek`, `startNextSeason`, `performAction`, `serializeGame`, `deserializeGame`.

- [x] Write integration tests for initialization, week progression, full-season completion, and save round trip.
- [x] Confirm tests fail.
- [x] Implement the root state lifecycle and action dispatcher.
- [x] Confirm tests pass.

### Task 7: Polished Browser UI

**Files:**
- Create: `index.html`, `src/styles.css`, `src/ui/templates.js`, `src/ui/render.js`, `src/ui/controller.js`, `src/main.js`, `assets/favicon.svg`

**Interfaces:**
- Consumes all game-engine functions.
- Produces responsive pages for dashboard, squad, tactics, schedule, transfers, academy, club, inbox, and match center.

- [x] Create semantic application shell and new-game screen.
- [x] Implement responsive visual system and navigation.
- [x] Render every management screen and wire actions.
- [x] Implement match animation, notifications, modals, autosave, export, and import.
- [x] Run syntax and import checks.

### Task 8: Review, Documentation, and Verification

**Files:**
- Create: `README.md`, `docs/code-review.md`, `docs/test-report.md`, `scripts/quality.mjs`, `scripts/smoke-server.mjs`

- [x] Review requirements against implemented screens and modules.
- [x] Review logic for mutation safety, deterministic behavior, invalid actions, and accessibility.
- [x] Run `npm test`.
- [x] Run `npm run check`.
- [x] Run `npm run smoke`.
- [x] Record exact results and known limitations.
- [x] Package the project as ZIP.
