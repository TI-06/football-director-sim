# Football Director Simulation - Design Specification

## 1. Goal

Build a polished, single-player browser football management simulation that can be committed to Git and run without a backend. The player manages a fictional club through league fixtures while controlling tactics, squad selection, training, transfers, youth development, facilities, finances, and event decisions.

## 2. Product Direction

The game combines these proven management-game loops:

- Long-term club building: squad, transfer market, training, scouting, finances.
- Match-day decision making: lineup, formation, tactical instructions, live commentary.
- Accessible daily/weekly progression: one clear “advance” action and prioritized inbox tasks.
- Dynamic stories: injuries, morale, board pressure, sponsor offers, player requests, and youth breakthroughs.

All clubs and players are fictional. No licensed names, logos, or external assets are used.

## 3. Core Game Loop

1. Review dashboard, inbox, injuries, and upcoming opponent.
2. Adjust lineup and tactics.
3. Select weekly training focus.
4. Handle transfers, academy, and club upgrades.
5. Play the next fixture with live simulation.
6. Apply results: standings, fatigue, morale, finances, injuries, board confidence, and events.
7. Repeat through a 14-match double round-robin season.
8. Review the season result and begin the next season with refreshed fixtures, market, player ages, and season statistics.

## 4. Functional Scope

### 4.1 New Game
- Club name and manager name.
- Choice of one of eight fictional clubs.
- Three difficulty levels affecting starting budget, board tolerance, and opponent strength.
- Deterministic seed displayed in settings for reproducible saves.

### 4.2 Dashboard
- Season/week, league position, form, board confidence, cash balance, wage usage.
- Next opponent scouting summary.
- Priority inbox items.
- Recent results and key squad alerts.

### 4.3 Squad Management
- 22-player first-team roster.
- Position, overall, potential, age, form, morale, fatigue, wage, value, contract, injury status.
- Starting XI and seven-player bench.
- Automatic best-XI selection with formation compatibility.
- Captain and penalty taker selection.

### 4.4 Tactics
- Formations: 4-3-3, 4-2-3-1, 4-4-2, 3-4-2-1, 5-3-2.
- Mentality, tempo, passing, width, pressing, defensive line, attacking focus.
- Tactical familiarity and risk/reward trade-offs.
- Match engine reacts to tactical matchup rather than only overall ratings.

### 4.5 Match Simulation
- 90-minute event simulation with goals, shots, saves, cards, injuries, substitutions, and tactical commentary.
- Team strength built from lineup quality, role suitability, morale, fatigue, form, home advantage, tactical matchup, and randomness.
- xG, possession, shots, shots on target, cards, player ratings, and man of the match.
- All other league fixtures simulated in the same week.

### 4.6 Training and Medical
- Weekly focuses: balanced, attacking, defending, fitness, recovery, youth.
- Attribute growth, fatigue, injury risk, morale, and tactical familiarity.
- Injuries have severity and recovery weeks.

### 4.7 Transfers
- Rotating market of fictional players.
- Scouting reveals more accurate ability/potential estimates.
- Buy, sell-list, sale negotiation, and contract-release actions.
- Budget, wages, squad-size, and transfer-window validation.

### 4.8 Youth Academy
- Six academy prospects.
- Two-player academy intake every four completed matchweeks.
- Promote eligible prospects to first team.
- Youth-focused training accelerates development.

### 4.9 Club and Finances
- Cash, transfer budget, weekly wages, attendance, ticket revenue, sponsor income, prize money.
- Facility upgrades: training, academy, scouting, stadium.
- Weekly finance ledger.

### 4.10 Dynamic Events and Inbox
- Player requests, sponsor proposals, press questions, staff recommendations, board warnings, injury crises, fan reactions.
- Each decision displays explicit financial, morale, fitness, familiarity, board, fan, or academy effects.
- Unresolved priority items are highlighted but never hard-lock progress.

### 4.11 Save System
- Autosave to localStorage after meaningful actions.
- Manual save, reset, JSON export, and JSON import.
- Versioned save schema with validation and safe fallback.

## 5. Architecture

- `src/core`: deterministic random number generation and generic utilities.
- `src/data`: fictional names, clubs, formations, and event templates.
- `src/game`: pure simulation modules for fixtures, matches, economy, development, transfers, events, and the aggregate game engine.
- `src/ui`: DOM rendering, navigation, modal/dialog handling, match presentation, and notifications.
- `src/main.js`: application bootstrap and controller wiring.
- `tests`: Node built-in test runner tests against pure modules.

The core simulation stays independent from the DOM so it can be tested deterministically and later moved to a server or multiplayer architecture.

## 6. Data Model

The root `GameState` includes:

- metadata: schema version, seed, difficulty, season, week, date.
- user club id and manager identity.
- clubs, players, academy prospects, transfer market.
- fixtures, standings derived from fixture results.
- tactics, lineup, training plan.
- finances and ledger.
- inbox and event history.
- match reports and season history.

IDs are stable strings. Currency is stored as integer yen. Percent-like values use integer 0-100 ranges.

## 7. Error Handling

- Invalid saves are rejected without overwriting the current game.
- Invalid actions return `{ ok: false, message }` and are shown as UI notifications.
- Match simulation validates eleven eligible starters and falls back to auto-selection.
- Financial actions prevent negative cash unless an event explicitly allows emergency debt.
- UI rendering tolerates missing optional fields from older save versions.

## 8. UX and Visual Design

- Premium dark sports-broadcast visual language with emerald accent, restrained gradients, strong typography, and clear information hierarchy.
- Desktop sidebar and mobile bottom navigation.
- Dashboard cards, compact tables, pitch-shaped formation board, transfer/player detail panels, inbox decision cards, and a live match center.
- No external images are required; badges and pitch visuals are generated with CSS and inline SVG.
- Keyboard-focus-visible controls and semantic buttons, tables, labels, and dialogs.

## 9. Testing Strategy

- Unit tests: seeded RNG, fixture generation, standings, squad selection, tactical strength, match determinism, economy, training, transfers, events, serialization.
- Integration tests: initialize game, play full week, complete a season, save/load round trip.
- Static checks: JavaScript syntax validation, HTML structure checks, broken module import scan.
- Browser smoke test: run local server and verify HTTP routes and critical source assets.

## 10. Non-Goals for Version 1

- Real clubs, players, leagues, or licensed assets.
- Online multiplayer, authentication, backend database, cloud save, or payment.
- Real-time 3D match rendering.
- Multiple national league pyramids, promotion/relegation, and cup competitions.

These are compatible future expansions because simulation logic and UI are separated.
