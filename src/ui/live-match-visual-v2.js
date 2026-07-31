import { clamp } from '../core/utils.js';

const EVENT_SHIFT = Object.freeze({
  goal: { x: 0, y: -14 },
  shot: { x: 0, y: -10 },
  save: { x: 0, y: -5 },
  pass: { x: 7, y: -4 },
  card: { x: 0, y: 0 },
  injury: { x: 0, y: 0 },
  substitution: { x: 0, y: 0 }
});

function numberFor(player, index) {
  return player?.shirtNumber ?? player?.number ?? index + 1;
}

function latestDisplayEvent(session) {
  return [...(session.events ?? [])].reverse().find((event) => !['kickoff', 'half', 'full'].includes(event.type)) ?? null;
}

export function createLivePitchModel(session) {
  const event = latestDisplayEvent(session);
  const tokens = [];
  for (const sideName of ['home', 'away']) {
    const side = session.sides[sideName];
    const players = new Map(side.players.map((player) => [player.id, player]));
    side.lineup.forEach((entry, index) => {
      const player = players.get(entry.playerId);
      const baseX = clamp(Number(entry.x ?? 50), 5, 95);
      const baseY = clamp(sideName === 'home' ? Number(entry.y ?? 75) : 100 - Number(entry.y ?? 75), 4, 96);
      const involved = event?.playerId === entry.playerId || event?.assistPlayerId === entry.playerId || event?.targetPlayerId === entry.playerId;
      const direction = sideName === 'home' ? -1 : 1;
      const shift = involved ? (EVENT_SHIFT[event?.type] ?? { x: 4, y: -5 }) : { x: 0, y: 0 };
      const toX = clamp(baseX + shift.x * (index % 2 === 0 ? 1 : -1), 4, 96);
      const toY = clamp(baseY + shift.y * direction, 3, 97);
      tokens.push({
        id: entry.playerId,
        side: sideName,
        name: player?.name ?? '選手',
        position: entry.slotPosition ?? player?.position ?? '',
        number: numberFor(player, index),
        fitness: Math.round(session.liveFitness?.[entry.playerId] ?? player?.fitness ?? 0),
        rating: Number(session.liveRatings?.[entry.playerId] ?? 6.5).toFixed(1),
        booked: Boolean(session.bookedIds?.[sideName]?.includes(entry.playerId)),
        injured: Boolean(session.injuredIds?.[sideName]?.includes(entry.playerId)),
        goalkeeper: (entry.slotPosition ?? player?.position) === 'GK',
        involved,
        baseX,
        baseY,
        toX,
        toY
      });
    });
  }
  const focus = tokens.find((token) => token.involved) ?? tokens.find((token) => token.side === session.userSide) ?? tokens[0];
  return {
    event,
    tokens,
    focus,
    ball: {
      x: focus?.toX ?? 50,
      y: focus?.toY ?? 50
    }
  };
}
