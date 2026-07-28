import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { createNewGame } from '../src/game/game-engine.js';
import { createClubOffer, respondToClubOffer, submitAgentOffer } from '../src/game/transfer-negotiation.js';

test('club offer rejects more than three additional clauses without changing state', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'clauses-limit' });
  const player = state.transferMarket[0];
  const result = createClubOffer(state, {
    playerId: player.id,
    immediateFee: player.askingPrice,
    clauses: { installments: 10, appearanceBonus: 10, promotionBonus: 10, sellOnPercent: 10 }
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
});

test('acceptable club offer advances negotiation to agent stage', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'club-stage' });
  const player = state.transferMarket[0];
  const created = createClubOffer(state, { playerId: player.id, immediateFee: player.askingPrice, clauses: {} });
  const answered = respondToClubOffer(created.state, created.negotiation.id, createRng('club-answer'));
  assert.equal(answered.ok, true);
  assert.equal(answered.state.transferNegotiations[0].stage, 'agent');
});

test('agent agreement atomically settles fee and registers the player once', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'agent-stage' });
  const player = state.transferMarket[0];
  const club = state.clubs.find((item) => item.id === state.userClubId);
  club.cash = Math.max(club.cash, player.askingPrice * 3);
  club.transferBudget = Math.max(club.transferBudget, player.askingPrice * 3);
  club.wageBudget = Math.max(club.wageBudget, 100_000_000);
  const beforeCash = club.cash;
  const created = createClubOffer(state, { playerId: player.id, immediateFee: player.askingPrice, clauses: {} });
  const answered = respondToClubOffer(created.state, created.negotiation.id, createRng('agent-club-answer'));
  const settled = submitAgentOffer(answered.state, answered.negotiation.id, {
    wage: player.askingWage,
    years: 3,
    signingBonus: player.askingWage * 8,
    role: 'important'
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.state.players.filter((item) => item.id === player.id).length, 1);
  assert.equal(settled.state.transferMarket.some((item) => item.id === player.id), false);
  assert.equal(settled.state.clubs.find((item) => item.id === state.userClubId).cash, beforeCash - player.askingPrice - player.askingWage * 8);
});

test('loan agreement records wage share appearances and purchase option', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'loan-stage' });
  const player = state.transferMarket[0];
  const created = createClubOffer(state, {
    playerId: player.id,
    immediateFee: 5_000_000,
    offerType: 'loan',
    clauses: { wageShare: 60, purchaseOption: player.askingPrice }
  });
  const answered = respondToClubOffer(created.state, created.negotiation.id, createRng('loan-answer'));
  const settled = submitAgentOffer(answered.state, answered.negotiation.id, { wage: player.askingWage, years: 1, signingBonus: 0, role: 'rotation' });
  assert.equal(settled.ok, true);
  assert.equal(settled.state.loans[0].wageShare, 60);
  assert.equal(settled.state.loans[0].appearances, 0);
  assert.equal(settled.state.loans[0].purchaseOption, player.askingPrice);
});
