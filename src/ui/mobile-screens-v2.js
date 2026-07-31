import { average, formatMoney } from '../core/utils.js';
import { characterHero } from './characters-v2.js';
import { actionButton, emptyPanel, legacyPanel, matchCard, metricTile, sectionHeader, statusBadge } from './mobile-components-v2.js';
import { clubBadge, escapeHtml, icon } from './templates.js';

function clubById(state, id) {
  return state.clubs.find((club) => club.id === id);
}

function userClub(state) {
  return clubById(state, state.userClubId);
}

function userPlayers(state) {
  return state.players.filter((player) => player.clubId === state.userClubId);
}

function currentPosition(state) {
  const division = userClub(state)?.division;
  const standings = state.standingsByDivision?.[division] ?? state.standings ?? [];
  const index = standings.findIndex((row) => (row.teamId ?? row.clubId) === state.userClubId);
  return index >= 0 ? index + 1 : '–';
}

function nextFixture(state) {
  return [...(state.fixtures ?? []), ...(state.cup?.fixtures ?? [])]
    .filter((fixture) => !fixture.played && fixture.week >= state.week && [fixture.homeId, fixture.awayId].includes(state.userClubId))
    .sort((left, right) => left.week - right.week)[0] ?? null;
}

function fixtureTeams(state, fixture) {
  if (!fixture) return {};
  return { home: clubById(state, fixture.homeId), away: clubById(state, fixture.awayId) };
}

function hasTransferRequest(player) {
  return Boolean(player.transferRequest || player.transferRequested);
}

function urgentItems(state) {
  const players = userPlayers(state);
  const items = [];
  for (const player of players.filter((item) => item.injuryWeeks > 0).slice(0, 2)) {
    items.push({ tone: 'danger', label: '負傷', title: player.name, detail: `復帰まで${player.injuryWeeks}週` });
  }
  for (const player of players.filter((item) => hasTransferRequest(item) || item.happiness < 45).slice(0, 2)) {
    items.push({ tone: 'warning', label: hasTransferRequest(player) ? '移籍希望' : '不満', title: player.name, detail: player.unhappinessReason || player.concerns?.[0] || '起用状況を確認' });
  }
  for (const item of (state.inbox ?? []).filter((entry) => entry.kind === 'decision' && !entry.resolved).slice(0, 3)) {
    items.push({ tone: 'warning', label: '判断', title: item.title, detail: item.category || '受信トレイ' });
  }
  return items.slice(0, 5);
}

function recentResults(state) {
  return (state.matchReports ?? []).filter((report) => [report.homeClubId, report.awayClubId].includes(state.userClubId)).slice(-5).reverse();
}

function resultLabel(report, clubId) {
  const isHome = report.homeClubId === clubId;
  const scored = isHome ? report.homeGoals : report.awayGoals;
  const conceded = isHome ? report.awayGoals : report.homeGoals;
  return scored > conceded ? ['WIN', 'good'] : scored === conceded ? ['DRAW', 'neutral'] : ['LOSE', 'danger'];
}

export function renderDashboardV2(state, uiState = {}) {
  const club = userClub(state);
  const players = userPlayers(state);
  const fixture = nextFixture(state);
  const teams = fixtureTeams(state, fixture);
  const urgent = urgentItems(state);
  const results = recentResults(state);
  const fitness = Math.round(average(players.map((player) => player.fitness)) || 0);
  const morale = Math.round(average(players.map((player) => player.morale)) || 0);
  const overall = Math.round(average(players.map((player) => player.overall)) || 0);
  return `<div class="fd2-screen fd2-dashboard">
    ${characterHero('mina', {
      eyebrow: 'WEEKLY COMMAND',
      title: '勝つための判断を、ここから。',
      body: `日本${club.division}部 ${currentPosition(state)}位。次戦準備と要対応を一画面に集約しました。`,
      message: urgent.length ? `${urgent[0].title}の対応を優先しましょう。` : '大きな問題はありません。次戦へ進めます。'
    })}
    <section class="fd2-metrics">
      ${metricTile('現在順位', `${currentPosition(state)}位`, club.divisionName, 'accent')}
      ${metricTile('総合戦力', overall, `平均体力 ${fitness}%`, fitness < 65 ? 'warning' : 'neutral')}
      ${metricTile('チーム士気', `${morale}%`, players.some(hasTransferRequest) ? '移籍希望あり' : '安定', morale < 55 ? 'warning' : 'good')}
      ${metricTile('移籍予算', formatMoney(club.transferBudget), `現金 ${formatMoney(club.cash)}`, 'neutral')}
    </section>
    ${fixture ? matchCard({ fixture, home: teams.home, away: teams.away, userClubId: state.userClubId, detail: `WEEK ${fixture.week}` }) : emptyPanel('次戦はありません', 'シーズン終了または日程確定待ちです。')}
    <section class="fd2-section">
      ${sectionHeader('要対応', '重要度順に最大5件を表示', `<button type="button" data-nav="inbox">すべて見る</button>`)}
      <div class="fd2-alert-list">${urgent.length ? urgent.map((item) => `<button type="button" data-nav="inbox" class="fd2-alert fd2-alert--${item.tone}">${statusBadge(item.label, item.tone)}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span>${icon('chevron', 16)}</button>`).join('') : `<div class="fd2-alert fd2-alert--good">${statusBadge('良好', 'good')}<span><strong>対応が必要な項目はありません</strong><small>編成と次戦準備を確認できます。</small></span></div>`}</div>
    </section>
    <section class="fd2-section">
      ${sectionHeader('最近の結果', '直近5試合')}
      <div class="fd2-result-list">${results.length ? results.map((report) => {
        const opponentId = report.homeClubId === state.userClubId ? report.awayClubId : report.homeClubId;
        const opponent = clubById(state, opponentId);
        const [label, tone] = resultLabel(report, state.userClubId);
        return `<button type="button" class="fd2-result" data-open-report="${report.id}">${clubBadge(opponent, 'sm')}<span><strong>${escapeHtml(opponent?.shortName || opponent?.name || '対戦相手')}</strong><small>W${report.week ?? '–'} · ${report.homeGoals}-${report.awayGoals}</small></span>${statusBadge(label, tone)}</button>`;
      }).join('') : emptyPanel('試合結果はまだありません', '最初の試合を進めるとここに表示されます。')}</div>
    </section>
    <div class="fd2-command-dock game-command-hub mobile-continue-bar">
      ${actionButton({ label: uiState.autoAdvanceActive ? '自動進行を停止' : '次の判断まで', command: 'toggle-auto-advance', iconName: uiState.autoAdvanceActive ? 'pause' : 'play', tone: uiState.autoAdvanceActive ? 'danger' : 'secondary' })}
      ${actionButton({ label: fixture ? '試合を開始' : '次週へ進む', command: 'play-week', iconName: 'play', tone: 'primary' })}
    </div>
  </div>`;
}

export function renderScheduleV2(state) {
  const fixture = nextFixture(state);
  const teams = fixtureTeams(state, fixture);
  const reports = recentResults(state);
  const upcoming = [...(state.fixtures ?? []), ...(state.cup?.fixtures ?? [])]
    .filter((item) => !item.played && item.week >= state.week && [item.homeId, item.awayId].includes(state.userClubId))
    .sort((left, right) => left.week - right.week)
    .slice(0, 6);
  return `<div class="fd2-screen fd2-schedule">
    <header class="fd2-page-title"><span class="fd2-eyebrow">MATCH CENTER</span><h1>試合</h1><p>次戦、今後の日程、過去の結果をまとめて確認します。</p></header>
    ${fixture ? matchCard({ fixture, home: teams.home, away: teams.away, userClubId: state.userClubId }) : emptyPanel('次戦はありません', 'シーズン終了または日程確定待ちです。')}
    <section class="fd2-section">${sectionHeader('今後の日程', '直近6試合')}<div class="fd2-fixture-list">${upcoming.map((item) => {
      const opponentId = item.homeId === state.userClubId ? item.awayId : item.homeId;
      const opponent = clubById(state, opponentId);
      const venue = item.homeId === state.userClubId ? 'HOME' : 'AWAY';
      return `<article class="fd2-fixture"><span>W${item.week}</span>${clubBadge(opponent, 'sm')}<div><strong>${escapeHtml(opponent?.name || '対戦相手')}</strong><small>${venue} · ${item.competition === 'cup' ? '全国王者杯' : 'リーグ戦'}</small></div></article>`;
    }).join('')}</div></section>
    <section class="fd2-section">${sectionHeader('試合結果', 'タップして詳細を確認')}<div class="fd2-result-list">${reports.length ? reports.map((report) => {
      const opponentId = report.homeClubId === state.userClubId ? report.awayClubId : report.homeClubId;
      const opponent = clubById(state, opponentId);
      const [label, tone] = resultLabel(report, state.userClubId);
      return `<button type="button" class="fd2-result" data-open-report="${report.id}">${clubBadge(opponent, 'sm')}<span><strong>${escapeHtml(opponent?.name || '対戦相手')}</strong><small>${report.homeGoals}-${report.awayGoals}</small></span>${statusBadge(label, tone)}</button>`;
    }).join('') : emptyPanel('結果はまだありません', '試合終了後に表示されます。')}</div></section>
  </div>`;
}

export function decorateLegacyView(currentView, legacyContent) {
  const hero = currentView === 'squad'
    ? characterHero('sota', { eyebrow: 'MAIN SQUAD', title: '勝負を決める11人。', body: '体力、役割、相性を見ながら先発と控えを組み上げます。' })
    : currentView === 'transfers'
      ? characterHero('rei', { eyebrow: 'SCOUTING ROOM', title: '必要な補強だけを、正確に。', body: '能力、年齢、費用、戦術適合度を一つの判断軸にまとめます。' })
      : currentView === 'club'
        ? characterHero('kazuo', { eyebrow: 'CLUB OFFICE', title: '勝てるクラブを、長く育てる。', body: '予算、理事会、施設、投資を同じ画面で判断します。' })
        : '';
  return `<div class="fd2-screen fd2-legacy-screen fd2-legacy-screen--${escapeHtml(currentView)}">${hero}${legacyPanel(legacyContent, `fd2-legacy-panel--${currentView}`)}</div>`;
}
