import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { CLUB_TEMPLATES, generateLeague } from '../src/data/catalog.js';
import { createNewGame } from '../src/game/game-engine.js';

test('japanese pyramid contains sixty fictional clubs across three equal divisions', () => {
  assert.equal(CLUB_TEMPLATES.length, 60);
  for (const division of [1, 2, 3]) {
    assert.equal(CLUB_TEMPLATES.filter((club) => club.division === division).length, 20);
  }
  assert.equal(CLUB_TEMPLATES.every((club) => /[ぁ-んァ-ヶ一-龠]/.test(club.name)), true);
});

test('generated league gives every club a japanese named twenty-two player squad', () => {
  const league = generateLeague(createRng('jp-pyramid'));
  assert.equal(league.clubs.length, 60);
  assert.equal(league.players.length, 60 * 22);
  for (const club of league.clubs) {
    const squad = league.players.filter((player) => player.clubId === club.id);
    assert.equal(squad.length, 22);
    assert.equal(squad.every((player) => /[ぁ-んァ-ヶ一-龠]/.test(player.name)), true);
  }
});

test('original club replaces one third division club and starts in division three', () => {
  const state = createNewGame({
    seed: 'original-club',
    managerName: '山田 太郎',
    clubMode: 'created',
    clubName: '東京つばさFC',
    homeCity: '東京都',
    primaryColor: '#16a34a',
    clubPhilosophy: 'youth'
  });
  assert.equal(state.clubs.length, 60);
  assert.equal(state.clubs.filter((club) => club.division === 3).length, 20);
  const club = state.clubs.find((item) => item.id === state.userClubId);
  assert.equal(club.name, '東京つばさFC');
  assert.equal(club.city, '東京都');
  assert.equal(club.division, 3);
  assert.equal(club.isCreated, true);
});
