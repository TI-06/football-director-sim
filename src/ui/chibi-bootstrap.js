const POSITION_TONES = {
  GK: 'green', CB: 'cyan', LB: 'cyan', RB: 'cyan',
  DM: 'purple', CM: 'purple', AM: 'purple',
  LW: 'red', RW: 'red', ST: 'gold', CF: 'gold'
};

function hashName(name = '') {
  return [...String(name)].reduce((sum, character) => sum + character.codePointAt(0), 0);
}

export function characterPortraitMarkup({ kind = 'player', name = '', tone = 'blue' } = {}) {
  const seed = hashName(name);
  const hairColors = ['#14223b', '#3a241c', '#6c391f', '#25354f', '#5b3047'];
  const hair = hairColors[seed % hairColors.length];
  const eye = ['#17233c', '#173f67', '#4b2d54'][seed % 3];
  const palettes = {
    blue: ['#1d7dff', '#8be9ff', '#091d3c'],
    cyan: ['#0c6bdc', '#36ddff', '#071a34'],
    gold: ['#c98618', '#ffe06c', '#3c2608'],
    purple: ['#7446d8', '#d38cff', '#251441'],
    red: ['#d43c55', '#ff9b87', '#47111d'],
    green: ['#159b69', '#8effb7', '#073c2b']
  };
  const [primary, accent, dark] = palettes[tone] ?? palettes.blue;
  const accessory = kind === 'assistant'
    ? `<path d="M18 38c-7 7-9 20-4 31" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/><path d="M74 37c7 8 8 21 3 32" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/><path d="M76 67c-6 10-14 14-26 14" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><circle cx="48" cy="81" r="3" fill="#d9ff62"/>`
    : kind === 'scout'
      ? `<path d="M16 24c7-14 52-18 65 0l-4 8H20z" fill="#8a5c22"/><path d="M25 19c9-15 39-15 47 0l-3 8H28z" fill="#a67631"/><circle cx="37" cy="48" r="9" fill="none" stroke="#162033" stroke-width="3"/><circle cx="58" cy="48" r="9" fill="none" stroke="#162033" stroke-width="3"/><path d="M46 48h4" stroke="#162033" stroke-width="3"/>`
      : kind === 'director'
        ? `<path d="M25 91 40 70l8 12 9-12 15 21" fill="#f7f9ff"/><path d="m48 82 6 10H42z" fill="#d53a4f"/>`
        : kind === 'keeper'
          ? `<path d="M18 88c4-12 13-20 29-20s26 8 31 20" fill="#d9ff4d" opacity=".35"/><path d="M15 87 5 73l8-8 14 17M79 87l10-14-8-8-14 17" fill="#f5c7a7"/>`
          : `<path d="M16 88 6 76l8-8 15 15M78 88l10-12-8-8-15 15" fill="#f5c7a7"/>`;
  const safeName = String(name).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<span class="character-portrait character-portrait--${kind} character-portrait--${tone}" role="img" aria-label="${safeName || kind}">
    <svg viewBox="0 0 96 112" aria-hidden="true">
      <ellipse cx="48" cy="106" rx="34" ry="5" fill="rgba(0,0,0,.25)"/>
      <path d="M17 111c2-31 12-48 31-52 19 4 29 21 31 52z" fill="${primary}"/>
      <path d="M29 66 48 84 67 66l8 45H21z" fill="${dark}"/>
      <path d="M38 78 48 88 58 78l5 33H33z" fill="${accent}" opacity=".92"/>
      <circle cx="48" cy="42" r="29" fill="#f5c7a7"/>
      <path d="M20 42C20 15 34 4 51 5c21 1 31 16 28 42-11-4-21-14-27-27-8 12-18 19-32 22z" fill="${hair}"/>
      <path d="M21 38c-7 8-8 22-3 31 1-12 3-23 7-31M76 36c7 9 8 22 3 32-1-12-3-23-7-32" fill="${hair}"/>
      <ellipse cx="37" cy="45" rx="4" ry="6" fill="${eye}"/><ellipse cx="59" cy="45" rx="4" ry="6" fill="${eye}"/>
      <circle cx="36" cy="43" r="1.3" fill="#fff"/><circle cx="58" cy="43" r="1.3" fill="#fff"/>
      <path d="M40 58c5 4 11 4 16 0" fill="none" stroke="#ae5f64" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M27 35c4-4 9-6 14-5M55 30c6-1 11 1 14 5" fill="none" stroke="${hair}" stroke-width="3" stroke-linecap="round"/>
      ${accessory}
      <path d="M27 102h42" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
      <circle cx="48" cy="98" r="7" fill="${accent}" opacity=".35"/><path d="m48 93 2 4 4 .6-3 3 .8 4.3-3.8-2-3.8 2 .8-4.3-3-3 4-.6z" fill="${accent}"/>
    </svg>
  </span>`;
}

function iconMarkup(path) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}

function addDashboardHero(root) {
  const hub = root.querySelector('.game-command-hub');
  if (!hub || hub.querySelector('.game-hero')) return;
  const pageHeader = hub.querySelector('.page-header');
  const matchText = root.querySelector('.next-match__top span')?.textContent?.trim() || 'NEXT MATCH';
  const opponent = [...root.querySelectorAll('.next-team strong')].map((item) => item.textContent.trim()).filter(Boolean).at(-1) || '次の対戦相手';
  const hero = document.createElement('section');
  hero.className = 'game-hero';
  hero.innerHTML = `<div class="game-hero__copy"><span class="game-hero__eyebrow">${matchText}</span><h2>勝って、<br>上位へ。</h2><p>vs ${opponent}</p><div class="game-hero__actions"><button class="btn btn--primary" type="button" data-nav="tactics">${iconMarkup('M4 17 10 11l4 4 6-8M4 7h4v4H4z')}試合準備</button><button class="btn btn--secondary" type="button" data-nav="squad">${iconMarkup('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8')}編成確認</button></div></div><div class="game-hero__message"><strong>戦術アシスタント ミナ</strong><span>選手カードとコンディションを確認して、ベストな11人を送り出しましょう。</span></div><div class="game-hero__character">${characterPortraitMarkup({ kind: 'assistant', name: '戦術アシスタント ミナ', tone: 'cyan' })}</div>`;
  pageHeader?.insertAdjacentElement('afterend', hero);
}

function playerTone(position, rating) {
  if (position === 'GK') return 'green';
  if (['CB', 'LB', 'RB'].includes(position)) return 'cyan';
  if (['DM', 'CM', 'AM'].includes(position)) return 'purple';
  return Number(rating) >= 76 ? 'gold' : 'red';
}

function addSquadPortraits(root) {
  for (const player of root.querySelectorAll('.pitch-player')) {
    if (player.querySelector('.pitch-player__portrait')) continue;
    const top = player.querySelector('.pitch-player__top');
    const name = player.querySelector('.pitch-player__name')?.textContent?.trim() || '選手';
    const position = player.querySelector('.pitch-player__pos')?.textContent?.trim() || 'CM';
    const rating = player.querySelector('.pitch-player__rating')?.textContent?.trim() || '70';
    const portrait = document.createElement('div');
    portrait.className = 'pitch-player__portrait';
    portrait.innerHTML = characterPortraitMarkup({ kind: position === 'GK' ? 'keeper' : 'player', name, tone: playerTone(position, rating) });
    top?.insertAdjacentElement('afterend', portrait);
  }
}

function addRoleHero(root, type) {
  const pageHeader = root.querySelector('.page-header');
  if (!pageHeader || root.querySelector(`.role-hero--${type}`)) return;
  const details = type === 'scout'
    ? { kind: 'scout', tone: 'gold', eyebrow: 'SCOUT NETWORK', title: '憧れの選手を獲得し、<br>最強の編成へ。', body: '候補選手の能力・将来性・交渉状況をスカウトが整理します。', name: '榊スカウト' }
    : { kind: 'director', tone: 'blue', eyebrow: 'CLUB MANAGEMENT', title: '勝つクラブを、<br>経営からつくる。', body: '施設、予算、理事会評価を確認し、長期的な成長へ投資します。', name: 'クラブディレクター' };
  const hero = document.createElement('section');
  hero.className = `role-hero role-hero--${type}`;
  hero.innerHTML = `<div class="role-hero__copy"><span class="eyebrow">${details.eyebrow}</span><h2>${details.title}</h2><p>${details.body}</p></div><div class="role-hero__character">${characterPortraitMarkup(details)}</div>`;
  pageHeader.insertAdjacentElement('afterend', hero);
}

function addTransferPortraits(root) {
  for (const row of root.querySelectorAll('[data-market-row]')) {
    const avatar = row.querySelector('.player-avatar');
    if (!avatar || avatar.classList.contains('is-chibi')) continue;
    const name = row.querySelector('.player-name strong')?.textContent?.trim() || '候補選手';
    const position = row.dataset.position || 'CM';
    avatar.classList.add('is-chibi');
    avatar.innerHTML = characterPortraitMarkup({ kind: position === 'GK' ? 'keeper' : 'player', name, tone: playerTone(position, 72) });
  }
}

function addLiveAssistant(root) {
  const panel = root.querySelector('.live-command-panel__title');
  if (!panel || panel.querySelector('.live-assistant')) return;
  const assistant = document.createElement('div');
  assistant.className = 'live-assistant';
  assistant.innerHTML = `${characterPortraitMarkup({ kind: 'assistant', name: '戦術アシスタント ミナ', tone: 'cyan' })}<span><strong>戦術アシスタント</strong><small>試合の流れと選手の体力を見ながら指示を調整しましょう。</small></span>`;
  panel.prepend(assistant);
}

export function enhanceGameUI(root = document) {
  root.documentElement?.classList.add('chibi-game-ui');
  addDashboardHero(root);
  addSquadPortraits(root);
  if (root.querySelector('[data-market-row]')) {
    addRoleHero(root, 'scout');
    addTransferPortraits(root);
  }
  if (root.querySelector('[data-action="upgrade-facility"]')) addRoleHero(root, 'director');
  addLiveAssistant(root);
}

if (typeof document !== 'undefined') {
  let scheduled = false;
  const scheduleEnhancement = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceGameUI(document);
    });
  };
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scheduleEnhancement, { once: true });
  scheduleEnhancement();
}
