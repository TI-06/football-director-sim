# Squad Drag, Roles, Sorting, and Auto-Advance Design

## Goal

Make squad selection understandable and fast: managers can drag players onto formation slots, immediately see captain and penalty assignments, sort/filter the squad by football and status metrics, and automatically simulate consecutive matchweeks until a decision event or season boundary requires attention.

## Scope

- Desktop drag-and-drop from pitch slots or squad rows onto another pitch slot.
- Existing select controls remain as accessible/mobile fallback.
- Explicit captain and penalty-taker indicators on pitch, role summary, and squad table.
- Client-side squad sorting by selection status, position, overall, potential, fitness, morale, age, and wage, with role and position filters.
- Auto-advance control in the top bar and dashboard.
- Auto-advance stops on a newly created unresolved decision event, any already-unresolved decision, manual stop, error, or season completion.
- Decision events become intermittent rather than guaranteed every week so auto-advance can meaningfully cover multiple weeks.

## Architecture

The game engine remains the source of truth. Drag/drop dispatches the existing `replace-starter` action, which already swaps two starters or replaces a starter with a bench/squad player while validating eligibility. Rendering receives a small ephemeral UI state object for auto-advance status; no transient UI state is persisted in saves.

Squad sorting and filtering are DOM-only because they do not change game state. Rows expose normalized numeric/string data attributes, and the controller reorders/hides rows based on controls. This avoids save-schema changes.

Auto-advance is a controller-managed `setTimeout` loop. Each step calls `playNextWeek`, persists and re-renders, then checks for newly unresolved decisions. Manual match playback remains unchanged; auto-advance intentionally skips opening the match modal for speed.

## Interaction Design

- Pitch player cards show position, OVR, name, and visible `C` / `PK` badges.
- Dragging highlights valid formation slots. Dropping onto a slot swaps/replaces players and re-renders.
- Squad rows have a drag handle; unavailable players are not draggable.
- Role summary presents captain and PK taker with position and OVR.
- Active role buttons use selected styling and `aria-pressed`.
- Squad controls include sort key, ascending/descending order, role filter, and position filter.
- Auto-advance button changes to `自動進行を停止` while active and displays a compact status line.

## Event Cadence

`generateWeeklyEvent` creates no new decision while one is unresolved. Otherwise it creates a decision with a deterministic 40% weekly chance. This preserves seeded reproducibility and lets auto-advance run through quiet weeks.

## Error Handling

- Invalid/unavailable drops are rejected by the existing engine validation and surfaced as a toast.
- Auto-advance refuses to start while a decision is unresolved and navigates to the inbox.
- Timers are cleared on manual stop, reset, import, and season completion.
- A failed week simulation stops auto-advance and shows the engine message.

## Testing

- Squad engine tests verify starter swaps and bench-to-starter replacement preserve uniqueness and roles.
- Event tests verify intermittent deterministic generation and unresolved-event blocking.
- UI rendering tests verify drag hooks, role indicators, sorting/filtering controls, and auto-advance status markup.
- Full verification runs unit tests, quality checks, smoke checks, and production build.
