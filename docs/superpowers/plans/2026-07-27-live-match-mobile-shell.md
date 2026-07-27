# Live Match and Mobile Game Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add deterministic phase-based live matches, match plans and substitutions, unified game dialogs, and a phone-first navigation shell.

**Architecture:** A pure live-match session module wraps phase simulation and produces the existing final report contract. The weekly engine exposes preparation/completion boundaries, while the controller owns transient sessions and accessible dialogs. Rendering is split into match center, dialog, and mobile shell helpers to keep responsibilities testable.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js built-in test runner, static HTML/CSS, existing deterministic RNG and game engine.

## Global Constraints

- No browser-native `alert`, `confirm`, or `prompt` calls.
- No external runtime dependency.
- All user-facing club and player copy remains Japanese.
- Mobile primary navigation contains exactly five actions.
- Touch controls are at least 44 CSS pixels on narrow screens.
- Existing automatic weekly progression remains available.
- Existing saves are not a compatibility target.

---

### Task 1: Match Plan Model

**Files:**
- Create: `src/game/match-plan.js`
- Modify: `src/game/game-engine.js`
- Test: `tests/match-plan.test.js`

**Interfaces:**
- Produces: `createDefaultMatchPlan()`, `normalizeMatchPlan(plan)`, `selectAutomaticSubstitutions(context)`, `tacticsForScoreState(plan, scoreState, baseTactics)`.

- [x] Write failing tests for defaults, normalization, deterministic substitution priority, and score-state tactics.
- [x] Run `node --test tests/match-plan.test.js` and verify failure because the module does not exist.
- [x] Implement the pure model and add `matchPlan` to new careers and the `update-match-plan` action.
- [x] Run the focused tests and existing game-engine tests.
- [x] Commit the task.

### Task 2: Phase-Based Live Match Engine

**Files:**
- Create: `src/game/live-match.js`
- Modify: `src/game/match-engine.js`
- Modify: `src/game/game-engine.js`
- Test: `tests/live-match.test.js`
- Modify: `tests/match-engine.test.js`

**Interfaces:**
- Consumes: match-plan helpers from Task 1.
- Produces: `createLiveMatchSession(input)`, `advanceLiveMatchSession(session, instruction)`, `makeLiveSubstitution(session, payload)`, `finalizeLiveMatch(session)`.

- [x] Write failing tests for four phases, deterministic aggregation, future-only tactical effects, manual substitutions, automatic substitutions, and final report compatibility.
- [x] Run the focused tests and verify the missing exports fail.
- [x] Refactor shared metric/event helpers from `match-engine.js` and implement live sessions.
- [x] Split weekly progression into `prepareNextWeek` and `completePreparedWeek`; preserve `playNextWeek` as automatic orchestration.
- [x] Run focused and regression tests.
- [x] Commit the task.

### Task 3: Live Match Controller and UI

**Files:**
- Modify: `src/ui/controller.js`
- Modify: `src/ui/render.js`
- Modify: `src/styles.css`
- Test: `tests/live-match-ui.test.js`
- Modify: `tests/ui.test.js`

**Interfaces:**
- Consumes: weekly preparation/completion and live-match session APIs.
- Produces: `renderLiveMatchCenter(state, session, uiState)` and controller commands for phase advance, tactics, substitution, skip, and close.

- [x] Write failing rendering tests for the scoreboard, phase status, tactical controls, player condition, substitutions, and continue action.
- [x] Add controller state for prepared week and live session.
- [x] Implement phase playback, pause points, manual substitution, tactical instruction application, and final completion.
- [x] Preserve report replay mode as read-only.
- [x] Run focused UI tests and regression tests.
- [x] Commit the task.

### Task 4: Unified Dialog and Toast System

**Files:**
- Create: `src/ui/dialogs.js`
- Modify: `src/ui/controller.js`
- Modify: `src/ui/render.js`
- Modify: `src/styles.css`
- Modify: `scripts/quality.mjs`
- Test: `tests/dialogs.test.js`
- Modify: `tests/ui-controls.test.js`

**Interfaces:**
- Produces: `createConfirmDialog(config)`, `createMenuDialog(config)`, `renderGameDialog(dialog)`, controller `openDialog`, `closeDialog`, and `confirmDialog` behavior.

- [x] Write failing tests for dialog copy, destructive style, accessible metadata, and the native-dialog quality guard.
- [x] Implement dialog normalization and rendering.
- [x] Replace reset, sell, release, buy, renew, budget allocation, project investment, and facility upgrade native confirmations.
- [x] Add Escape, backdrop close, focus restoration, and focus trapping.
- [x] Run focused tests and `npm run check`.
- [x] Commit the task.

### Task 5: Mobile Game Shell and Reduced Navigation Fatigue

**Files:**
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `src/styles.css`
- Test: `tests/live-match-ui.test.js`
- Modify: `tests/ui.test.js`

**Interfaces:**
- Consumes: game dialog system for the secondary menu.
- Produces: five-action mobile dock, contextual home command hub, mobile menu sheet, and compact page controls.

- [x] Write failing tests asserting exactly five mobile actions and the required home-hub sections.
- [x] Replace the scrolling mobile nav with Home, Match, Squad, Transfers, and Menu.
- [x] Add the menu sheet and route commands.
- [x] Recompose the dashboard around next match, continue, warnings, inbox, form, and quick actions.
- [x] Add responsive touch sizing, safe-area spacing, mobile cards, and sticky continue controls.
- [x] Run focused UI tests, smoke tests, and regression tests.
- [x] Commit the task.

### Task 6: Documentation, Review, and Release Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/code-review.md`
- Modify: `docs/test-report.md`

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: review evidence and release documentation.

- [x] Update feature and control documentation.
- [x] Run `npm test`.
- [x] Run `npm run check`.
- [x] Run `npm run smoke`.
- [x] Run `npm run build`.
- [x] Review the complete diff for match finalization, duplicated state application, substitution legality, dialog stale callbacks, mobile overflow, and native dialog calls.
- [x] Commit review fixes and documentation.
