export function createRivalries(clubs = []) {
  const relationships = [];
  for (let index = 0; index < clubs.length; index += 1) {
    for (let other = index + 1; other < clubs.length; other += 1) {
      if (!clubs[index].city || clubs[index].city !== clubs[other].city) continue;
      relationships.push({ id: `rivalry-${clubs[index].id}-${clubs[other].id}`, clubIds: [clubs[index].id, clubs[other].id], intensity: 70, matches: 0, formedSeason: 1 });
    }
  }
  return relationships;
}

export function isDerby(rivalries = [], clubA, clubB) {
  return rivalries.some((relationship) => relationship.clubIds.includes(clubA) && relationship.clubIds.includes(clubB));
}

export function derbyEffects(rivalries = [], clubA, clubB) {
  const relationship = rivalries.find((item) => item.clubIds.includes(clubA) && item.clubIds.includes(clubB));
  if (!relationship) return { attendance: 1, morale: 1, pressure: 1, cardRate: 1, supporterWeight: 1, managerWeight: 1 };
  const intensity = relationship.intensity / 100;
  return { attendance: 1 + intensity * 0.18, morale: 1 + intensity * 0.08, pressure: 1 + intensity * 0.15, cardRate: 1 + intensity * 0.22, supporterWeight: 1 + intensity * 0.3, managerWeight: 1 + intensity * 0.2 };
}
