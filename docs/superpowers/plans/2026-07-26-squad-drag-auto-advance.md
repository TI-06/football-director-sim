# Squad Drag and Auto-Advance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add draggable formation selection, explicit captain/PK state, rich squad sorting/filtering, and event-aware consecutive matchweek simulation.

**Architecture:** Reuse the existing engine actions for lineup mutation, add only controller-level transient state for auto-advance and DOM sorting, and keep save data compatible. Event generation becomes deterministic but intermittent so consecutive simulation is useful.

**Tech Stack:** Browser-native ES modules, HTML5 drag-and-drop, DOM APIs, Node.js built-in test runner, static Cloudflare Pages build.

## Global Constraints

- No runtime dependencies.
- Preserve the existing save schema and old saves.
- Keep select-based lineup editing as a keyboard/mobile fallback.
- Auto-advance must never continue past an unresolved decision or season completion.
- All new behavior must remain deterministic for a given seed.

---

### Task 1: Lineup mutation coverage

**Files:**
- Modify: `tests/squad.test.js`
- Existing implementation: `src/game/squad.js`

**Interfaces:**
- Consumes: `replaceStarter(lineup, slotId, playerId, players, formationId)`
- Produces: verified swap/replacement behavior used by drag/drop

- [ ] Add a failing test that swaps two starters by dropping one starter onto another slot.
- [ ] Run `node --test tests/squad.test.js` and confirm the new assertion fails only if swap behavior is missing.
- [ ] Add a failing test that promotes a bench player to a slot while moving the replaced starter to the bench and preserving 11 unique starters.
- [ ] Run the squad tests and confirm expected failure/pass behavior.

### Task 2: Event-aware simulation cadence

**Files:**
- Modify: `tests/management.test.js`
- Modify: `src/game/events.js`

**Interfaces:**
- Consumes: `generateWeeklyEvent(state, rng)`
- Produces: zero or one new decision event per week, blocked by unresolved decisions

- [ ] Add tests proving unresolved decisions block additional events and seeded quiet weeks can produce no event.
- [ ] Run `node --test tests/management.test.js` and verify the quiet-week test fails against guaranteed generation.
- [ ] Implement deterministic 40% generation and unresolved blocking.
- [ ] Re-run management tests and confirm green.

### Task 3: Squad and auto-advance rendering

**Files:**
- Modify: `tests/ui.test.js`
- Modify: `src/ui/render.js`

**Interfaces:**
- Consumes: `renderApplication(state, currentView, uiState)`
- Produces: drag/drop data hooks, explicit role badges, squad sort/filter controls, auto-advance controls/status

- [ ] Add failing UI assertions for drag hooks, role indicators, sort controls, and active auto-advance copy.
- [ ] Run `node --test tests/ui.test.js` and confirm failures reflect missing markup.
- [ ] Extend rendering with optional `uiState = { autoAdvanceActive: false, autoAdvanceMessage: '' }`.
- [ ] Add pitch/row drag attributes, role badges/summary, sortable row data, filters, and auto controls.
- [ ] Re-run UI tests and confirm green.

### Task 4: Controller interactions

**Files:**
- Modify: `src/ui/controller.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `replace-starter`, squad DOM data attributes, `playNextWeek`
- Produces: drag/drop dispatch, client-side sorting/filtering, start/stop auto-advance loop

- [ ] Add controller drag state and handlers for `dragstart`, `dragover`, `dragleave`, `drop`, and `dragend`.
- [ ] Implement squad sorting/filtering from normalized row datasets.
- [ ] Implement `startAutoAdvance`, `runAutoAdvanceStep`, and `stopAutoAdvance` with unresolved-event and season stop conditions.
- [ ] Pass auto-advance UI state into every render and clear timers on reset/import.
- [ ] Add visual states for drag targets, active roles, control bar, and auto-progress.

### Task 5: Full verification and delivery

**Files:**
- Modify: `README.md`
- Verify: all source and tests

**Interfaces:**
- Produces: documented, deployable feature branch

- [ ] Update README feature and control descriptions.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run smoke`.
- [ ] Run `npm run build`.
- [ ] Review diff for save compatibility, timer cleanup, accessibility, and accidental unrelated changes.
- [ ] Commit and publish the feature branch, open a PR, verify CI, and merge to `main`.
