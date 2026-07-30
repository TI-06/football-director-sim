function spriteMarkup(key, alt, extraClass = '') {
  return `<span class="approved-character-sprite approved-character-sprite--${key} ${extraClass}" role="img" aria-label="${alt}"></span>`;
}

function replaceCharacter(container, key, alt, extraClass = '') {
  if (!container || container.dataset.approvedCharacter === key) return;
  container.dataset.approvedCharacter = key;
  container.innerHTML = spriteMarkup(key, alt, extraClass);
}

function enhanceDashboard(root) {
  replaceCharacter(root.querySelector('.game-hero__character'), 'mina', '戦術アシスタント ミナ');
}

function enhanceRoleHeroes(root) {
  replaceCharacter(root.querySelector('.role-hero--scout .role-hero__character'), 'rei', 'スカウト レイ');
  replaceCharacter(root.querySelector('.role-hero--director .role-hero__character'), 'kazuo', 'クラブディレクター カズオ');
}

function enhanceLiveAssistant(root) {
  const assistant = root.querySelector('.live-assistant');
  if (!assistant || assistant.dataset.approvedCharacter === 'mina') return;
  const portrait = assistant.querySelector('.character-portrait');
  if (!portrait) return;
  assistant.dataset.approvedCharacter = 'mina';
  portrait.outerHTML = spriteMarkup('mina', '戦術アシスタント ミナ');
}

function enhanceSquadHero(root) {
  const layout = root.querySelector('.squad-layout');
  const pageHeader = root.querySelector('.page-header');
  if (!layout || !pageHeader || root.querySelector('.approved-squad-hero')) return;
  const hero = document.createElement('section');
  hero.className = 'approved-squad-hero';
  hero.innerHTML = `<div class="approved-squad-hero__copy"><span class="eyebrow">MAIN SQUAD</span><h2>勝負を決める11人。</h2><p>エースのソータを中心に、コンディションと相性を見ながら先発と控えを組み上げましょう。</p><div class="approved-squad-hero__message"><strong>エース ソータ</strong><span>俺が決める。ベストメンバーで次の試合に行こう。</span></div></div><div class="approved-squad-hero__character">${spriteMarkup('sota', 'エースストライカー ソータ')}</div>`;
  pageHeader.insertAdjacentElement('afterend', hero);
}

function enhanceAceCard(root) {
  const cards = [...root.querySelectorAll('.pitch-player')];
  const ace = cards.find((card) => ['ST', 'CF'].includes(card.querySelector('.pitch-player__pos')?.textContent?.trim()));
  if (!ace || ace.dataset.approvedAce === 'true') return;
  const portrait = ace.querySelector('.pitch-player__portrait');
  if (!portrait) return;
  ace.dataset.approvedAce = 'true';
  ace.classList.add('pitch-player--approved-ace');
  portrait.innerHTML = spriteMarkup('sota', 'エースストライカー ソータ');
}

export function applyApprovedCharacterArt(root = document) {
  root.documentElement?.classList.add('approved-character-ui');
  enhanceDashboard(root);
  enhanceRoleHeroes(root);
  enhanceLiveAssistant(root);
  enhanceSquadHero(root);
  enhanceAceCard(root);
}

if (typeof document !== 'undefined') {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyApprovedCharacterArt(document);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
}
