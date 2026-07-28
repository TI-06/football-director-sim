# Club Life, Scouting, Match Culture Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the verified phase 3–5 football management update from the GitHub design, recovered README, and review evidence on top of `main`, replacing the damaged transfer-only PR branch with a clean tested Git tree.

**Architecture:** Keep deterministic game rules in focused `src/game` modules and expose them through `game-engine.js`. Add Pages Functions cloud-save endpoints backed by D1-compatible storage helpers, while the browser client remains independently testable. Extend the existing renderer/controller rather than introducing parallel application shells.

**Tech Stack:** Node.js 22+, browser ES modules, Node test runner, Cloudflare Pages Functions, D1 SQL, PBKDF2 Web Crypto, plain HTML/CSS/JavaScript.

## Global Constraints

- Preserve all existing 81 tests.
- New save schema may break old saves; new careers are the supported path.
- No real clubs, players, competitions, or licensed assets.
- No browser `alert`, `confirm`, or `prompt`.
- Fitness and morale display as integers, ratings as one decimal, xG as two decimals.
- Added transfer clauses are limited to three per offer.
- Cloud save payload is limited to 4 MiB and one slot per account.
- Five failed logins lock the account for 15 minutes.
- Staff vacancies for head coach, medical chief, or secretary receive an eight-week interim appointment.

---

### Task 1: Formatting, fixed selection, and substitution policy

**Files:**
- Modify: `src/core/utils.js`
- Modify: `src/game/squad.js`
- Modify: `src/game/match-plan.js`
- Modify: `src/game/game-engine.js`
- Test: `tests/formatters.test.js`
- Test: `tests/squad.test.js`
- Test: `tests/match-plan.test.js`

**Interfaces:**
- Produces: `formatInteger(value)`, `formatRating(value)`, `formatXg(value)`.
- Produces: `normalizeSelectionPolicy(player)`, selection-aware `selectBestLineup`.
- Produces: per-player `substitutionPolicies` used by live-match automation.

- [ ] Write failing formatter, fixed-selection, low-fitness fallback, unavailable-player, and substitution-policy tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement minimal formatters and lineup policy rules.
- [ ] Integrate action handlers for selection and substitution policies.
- [ ] Run focused tests and commit.

### Task 2: Club life, staff, player relations, and promises

**Files:**
- Create: `src/game/staff.js`
- Create: `src/game/player-relations.js`
- Modify: `src/game/game-engine.js`
- Modify: `src/game/development.js`
- Modify: `src/game/secretary.js`
- Test: `tests/staff.test.js`
- Test: `tests/player-relations.test.js`
- Test: `tests/club-life-progression.test.js`

**Interfaces:**
- Produces: `createStaffMarket`, `appointStaff`, `releaseStaff`, `applyStaffEffects`, `ensureEssentialStaff`.
- Produces: `initializePlayerRelations`, `holdPlayerMeeting`, `createPromise`, `updatePromises`.

- [ ] Write failing staff effectiveness, wage, vacancy fallback, personality, meeting, promise completion, breach, and group-spread tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement deterministic staff and relations modules.
- [ ] Integrate weekly recovery/training/secretary/action flows.
- [ ] Run focused tests and commit.

### Task 3: Board confidence and manager career

**Files:**
- Create: `src/game/board-confidence.js`
- Create: `src/game/manager-career.js`
- Modify: `src/game/game-engine.js`
- Modify: `src/game/secretary.js`
- Test: `tests/board-confidence.test.js`
- Test: `tests/manager-career.test.js`

**Interfaces:**
- Produces: `createBoardEvaluation`, `updateBoardEvaluation`, `chooseSeasonObjective`.
- Produces: `createManagerProfile`, `recordManagerMatch`, `generateManagerOffers`, `acceptManagerOffer`.

- [ ] Write failing multi-axis evaluation, objective risk/reward, warning/dismissal, reputation, offer, and club-switch tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement board and manager modules.
- [ ] Integrate match/week/season progression and action handlers.
- [ ] Run focused tests and commit.

### Task 4: Regional scouting and transfer negotiation

**Files:**
- Create: `src/game/scouting.js`
- Create: `src/game/transfer-negotiation.js`
- Modify: `src/game/game-engine.js`
- Modify: `src/game/transfers.js`
- Modify: `src/game/secretary.js`
- Test: `tests/scouting.test.js`
- Test: `tests/transfer-negotiation.test.js`

**Interfaces:**
- Produces: regional assignments, knowledge, estimate ranges, shortlist management.
- Produces: two-stage club/agent negotiations, clause validation, loan tracking, and atomic settlement.

- [ ] Write failing regional accuracy, shortlist, three-clause limit, club response, agent response, atomic settlement, loan, and expiry tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement scouting and negotiation modules.
- [ ] Integrate state, actions, weekly deadlines, and secretary proposals.
- [ ] Run focused tests and commit.

### Task 5: Set pieces and match environment

**Files:**
- Create: `src/game/set-pieces.js`
- Create: `src/game/match-environment.js`
- Create: `src/game/rivalries.js`
- Modify: `src/game/match-engine.js`
- Modify: `src/game/live-match.js`
- Modify: `src/game/game-engine.js`
- Test: `tests/set-pieces.test.js`
- Test: `tests/match-environment.test.js`
- Test: `tests/live-match.test.js`

**Interfaces:**
- Produces: normalized set-piece plans and familiarity effects.
- Produces: weather, pitch, travel, home advantage, referee, and derby modifiers capped near ±8%.
- Corrects live-match interval rating accumulation and minute weighting.

- [ ] Write failing set-piece, environment cap, travel, derby, referee, and live-rating regression tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement modules and match integration.
- [ ] Run focused tests and commit.

### Task 6: Cloud save and schema validation

**Files:**
- Create: `src/services/cloud-save.js`
- Create: `functions/api/auth/register.js`
- Create: `functions/api/auth/login.js`
- Create: `functions/api/auth/logout.js`
- Create: `functions/api/save.js`
- Create: `functions/_shared/auth.js`
- Create: `functions/_shared/http.js`
- Create: `migrations/0001_cloud_saves.sql`
- Modify: `src/game/save.js`
- Modify: `wrangler.toml`
- Test: `tests/cloud-save.test.js`

**Interfaces:**
- Produces: browser client register/login/logout/load/save methods.
- Produces: PBKDF2 password hashes, token digests, secure cookies, lockout, session rotation, 4 MiB validation.

- [ ] Write failing auth, lockout, same-ID session replacement, payload limit, and one-slot save tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement shared helpers, Pages Functions, D1 migration, and client.
- [ ] Upgrade save schema validation for all new state boundaries.
- [ ] Run focused tests and commit.

### Task 7: Game shell and integrated UI

**Files:**
- Create: `src/ui/game-shell.js`
- Create: `src/ui/context-panel.js`
- Modify: `src/ui/templates.js`
- Modify: `src/ui/render.js`
- Modify: `src/ui/controller.js`
- Modify: `src/ui/auto-advance.js`
- Modify: `src/styles.css`
- Modify: `index.html`
- Test: `tests/game-shell.test.js`
- Test: `tests/ui-controls.test.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Produces: six desktop categories, three-column shell, right context panel, desktop shortcuts, mobile five actions, and actionable cards.

- [ ] Write failing shell, route, shortcut, context-card, overflow, integer/rating formatting, and auto-stop tests.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement shell/render/controller/style integration.
- [ ] Run focused tests and commit.

### Task 8: Long-run integration, documentation, and clean PR tree

**Files:**
- Create: `tests/three-season-club-life.test.js`
- Modify: `README.md`
- Modify: `docs/code-review.md`
- Modify: `docs/test-report.md`
- Modify: `package.json` only if verification scripts require it.

**Interfaces:**
- Produces: three-season deterministic progression and release evidence.

- [ ] Write failing three-season integration scenarios covering staff, promises, manager, scouting, negotiations, and match culture.
- [ ] Run the focused long-run tests and verify failures before final integration fixes.
- [ ] Implement only the required integration fixes.
- [ ] Run `npm test`, `npm run check`, `npm run smoke`, `npm run build`, and `git diff --check`.
- [ ] Review all changes, remove transfer/recovery artifacts from the proposed tree, commit, publish the clean Git tree to PR #18, and re-run CI.
