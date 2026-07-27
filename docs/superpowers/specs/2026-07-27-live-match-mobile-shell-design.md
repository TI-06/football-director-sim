# Live Match, Match Plans, and Mobile Game Shell Design

## Goal

Turn match day into an interactive management experience while reducing navigation fatigue, especially on phones. The release adds phase-based live matches, manual and automatic substitutions, in-match tactical instructions, a shared game-styled modal system, and a more focused mobile shell.

## Scope

This release changes four connected areas:

1. Match simulation becomes phase-based for the user fixture.
2. Match plans define automatic tactical reactions and substitution priorities.
3. Browser-native `alert`, `confirm`, and `prompt` calls are prohibited and replaced with accessible game UI dialogs and toasts.
4. Mobile navigation is reduced to five primary destinations with a contextual home hub and a secondary menu sheet.

The existing Japanese three-division career, cup, records, finance, and save systems remain intact. Existing saves are not a compatibility target.

## Match Architecture

The match engine exposes a live session API instead of requiring the UI to mutate a completed report.

- `createLiveMatchSession` creates a deterministic session from two teams and a seed.
- `advanceLiveMatchSession` simulates one phase: 1–45, 46–60, 61–75, or 76–90.
- Each phase uses the current lineup and current tactics, so instructions only affect future phases.
- The session aggregates score, xG, shots, possession, cards, injuries, substitutions, commentary, player minutes, and ratings.
- The final phase produces the same report shape consumed by career statistics, standings, finances, and history.

The weekly engine is split into preparation and completion:

- `prepareNextWeek` applies recovery and training, simulates fixtures that do not involve the user, and returns a pending user fixture when one exists.
- `completePreparedWeek` applies the final user report, updates competitions and finances, generates events, advances the calendar, and rebuilds the secretary report.
- `playNextWeek` remains as the automatic path and completes the prepared week with the saved match plan.

A manual match session is transient UI state. Closing or reloading before full time does not commit the prepared week.

## Decision Points

The live match pauses at half-time, 60 minutes, and 75 minutes. Injuries and cards are surfaced at the next decision point, where the saved plan can replace affected players automatically. At a pause, the user can change mentality, pressing, tempo, passing, defensive line, focus, width, and formation; make substitutions; or continue. Instructions affect only later phases.

## Match Plans

Each career stores `matchPlan` with tactical reactions for leading, drawing, and trailing; substitution start minute; fitness threshold; maximum automatic substitutions; and toggles for protecting booked players, prioritizing youth, preserving key players, and stopping important matches during auto-advance.

Automatic substitution ranking is deterministic and follows injury, booked-player protection, low fitness, low live rating, tactical positional need, then youth or key-player preference. Automatic progression uses the same plan without opening the match UI.

## Dialog System

`src/ui/dialogs.js` owns dialog normalization and rendering data. The controller owns one active dialog and routes confirmation to a command callback. Dialogs use the existing modal root and support confirmation, destructive confirmation, information, and menu-sheet variants; Escape and backdrop close; initial focus and focus trapping; and clear consequence summaries. All native dialog calls are removed and guarded by automated quality tests.

## Mobile Game Shell

Phones use five bottom actions: Home, Match, Squad, Transfers, and Menu. Menu opens a bottom sheet containing tactics, academy, records, secretary, club, inbox, save tools, and reset.

The home screen becomes a command hub with a prominent next-match card, one primary continue action, lineup and fitness warnings, unread decisions, league position and form, and compact quick actions. Touch targets are at least 44 CSS pixels, tables use card summaries where practical, and sticky controls account for safe-area insets.

## Error Handling

Invalid tactical changes and substitutions return structured errors and display an error toast. Injuries are ranked first by the automatic substitution plan; manual substitutions validate the selected starter, bench player, and five-player limit. Duplicate-player lineups are prevented by the live session model. A prepared week cannot be completed twice. Dialog callbacks are cleared on close.

## Testing

Tests cover deterministic phase simulation and aggregation; future-only tactical effects; substitution limits and priorities; prepared-week completion; match plan persistence; live match and mobile rendering; dialog accessibility and absence of native dialog calls; desktop and mobile navigation; the existing regression suite; quality checks; smoke checks; and the production build.
