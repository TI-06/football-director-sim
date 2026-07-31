import spritePart1 from './character-sprite/part-1.js';
import spritePart2 from './character-sprite/part-2.js';
import spritePart3 from './character-sprite/part-3.js';

const SPRITE_DATA = `data:image/webp;base64,${spritePart1}${spritePart2}${spritePart3}`;

export const CHARACTERS_V2 = Object.freeze({
  mina: {
    name: 'ミナ',
    role: '戦術アシスタント',
    position: '0% 0%',
    message: '次に必要な判断だけ、分かりやすく整理します。'
  },
  sota: {
    name: 'ソータ',
    role: 'エースストライカー',
    position: '100% 0%',
    message: 'ベストな11人で、次の勝利を取りに行こう。'
  },
  rei: {
    name: 'レイ',
    role: 'チーフスカウト',
    position: '0% 100%',
    message: '予算と戦術に合う補強候補を絞り込みました。'
  },
  kazuo: {
    name: 'カズオ',
    role: 'クラブディレクター',
    position: '100% 100%',
    message: '短期の勝利と、クラブの持続的な成長を両立させます。'
  }
});

export function characterArt(key, { className = '', compact = false, eager = false } = {}) {
  const character = CHARACTERS_V2[key];
  if (!character) return '';
  const classes = ['fd2-character', compact ? 'fd2-character--compact' : '', className].filter(Boolean).join(' ');
  return `<span class="${classes}" role="img" aria-label="${character.role} ${character.name}" style="--fd2-character-image:url('${SPRITE_DATA}');--fd2-character-position:${character.position}" data-character="${key}" data-loading="${eager ? 'eager' : 'lazy'}"></span>`;
}

export function characterHero(key, { eyebrow = '', title = '', body = '', message = '' } = {}) {
  const character = CHARACTERS_V2[key];
  if (!character) return '';
  return `<section class="fd2-character-hero fd2-character-hero--${key}">
    <div class="fd2-character-hero__copy">
      ${eyebrow ? `<span class="fd2-eyebrow">${eyebrow}</span>` : ''}
      <h2>${title}</h2>
      <p>${body}</p>
      <div class="fd2-character-hero__message"><strong>${character.role} ${character.name}</strong><span>${message || character.message}</span></div>
    </div>
    <div class="fd2-character-hero__art">${characterArt(key, { eager: true })}</div>
  </section>`;
}
