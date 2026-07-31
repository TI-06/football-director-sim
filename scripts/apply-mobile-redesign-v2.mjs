import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relative) {
  return readFile(path.join(root, relative), 'utf8');
}

async function write(relative, content) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

function requireReplace(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Migration pattern not found: ${label}`);
  return content.replace(search, replacement);
}

let index = await read('index.html');
index = index
  .replace('  <link rel="stylesheet" href="./src/chibi-ui.css">\n', '')
  .replace('  <link rel="stylesheet" href="./src/chibi-ui-mobile.css">\n', '')
  .replace('  <link rel="stylesheet" href="./src/approved-character-art.css">\n', '')
  .replace('  <script type="module" src="./src/ui/chibi-bootstrap.js"></script>\n', '')
  .replace('  <script type="module" src="./src/ui/approved-character-art.js"></script>\n', '');
index = requireReplace(index, '  <link rel="stylesheet" href="./src/styles.css">', '  <link rel="stylesheet" href="./src/styles.css">\n  <link rel="stylesheet" href="./src/mobile-game-v2.css">', 'index stylesheet');
index = requireReplace(index, '  <script type="module" src="./src/main.js"></script>', '  <script type="module" src="./src/main.js"></script>\n  <script type="module" src="./src/ui/mobile-interactions-v2.js"></script>', 'index interaction script');
await write('index.html', index);

let controller = await read('src/ui/controller.js');
controller = requireReplace(controller, "from './render.js';", "from './render-v2.js';", 'controller render import');
controller = requireReplace(controller, "const STORAGE_KEY = 'football-director-save-v2';", "const STORAGE_KEY = 'football-director-save-v4';", 'storage key');
await write('src/ui/controller.js', controller);

let save = await read('src/game/save.js');
save = requireReplace(save, 'export const SAVE_SCHEMA_VERSION = 3;', 'export const SAVE_SCHEMA_VERSION = 4;', 'save schema');
save = requireReplace(save, "const SAVE_FORMAT = 'football-director-save';", "const SAVE_FORMAT = 'football-director-save-v4';", 'save format');
save = requireReplace(save, "if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('Unsupported save schema version.');", "if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('旧バージョンのセーブデータはこの版では読み込めません。');", 'schema error');
save = requireReplace(save, "    if (parsed?.format === SAVE_FORMAT) {", "    if (parsed?.format && parsed.format !== SAVE_FORMAT) throw new Error('旧バージョンのセーブデータはこの版では読み込めません。');\n    if (parsed?.format === SAVE_FORMAT) {", 'legacy wrapper guard');
await write('src/game/save.js', save);

let engine = await read('src/game/game-engine.js');
engine = requireReplace(engine, "import { clamp, deepClone, dateForWeek } from '../core/utils.js';", "import { clamp, deepClone, dateForWeek } from '../core/utils.js';\nimport { BALANCE_V2, moraleDeltaForMatch } from './balance-v2.js';", 'balance import');
engine = requireReplace(engine, 'player.fitness = clamp(player.fitness - fatigue * Math.max(0.25, minutes / 90), 18, 100);', 'player.fitness = clamp(player.fitness - fatigue * Math.max(0.25, minutes / 90), BALANCE_V2.fitnessFloor, 100);', 'fitness floor');
engine = requireReplace(engine, "const resultDelta = result === 'win' ? 4 : result === 'draw' ? 1 : -4;", "const resultDelta = BALANCE_V2.moraleResultDelta[result] ?? 0;", 'result delta');
engine = requireReplace(engine, "player.morale = clamp(player.morale + resultDelta + (rating.rating >= 7.5 ? 2 : rating.rating < 5.8 ? -2 : 0), 20, 100);", "player.morale = clamp(player.morale + moraleDeltaForMatch(result, rating.rating), 20, 100);", 'morale calibration');
await write('src/game/game-engine.js', engine);

let screens = await read('src/ui/mobile-screens-v2.js');
screens = screens.replace("icon('chevron-right', 16)", "icon('chevron', 16)");
await write('src/ui/mobile-screens-v2.js', screens);

let liveView = await read('src/ui/live-match-view-v2.js');
liveView = liveView.replace("icon('swap', 17)", "icon('transfer', 17)");
await write('src/ui/live-match-view-v2.js', liveView);

await write('docs/mobile-redesign-report.md', `# スマホゲーム全面刷新 実装報告\n\n- 実装日: 2026-07-31\n- 対象: Football Director\n- 初期画面: ホーム\n- 下部ナビ: ホーム・試合・編成・移籍・メニュー\n- 試合表示: 縦型フルコート、○・●、背番号常時表示\n- 選手操作: タップで詳細、編成はタップ選択から配置可能\n- キャラクター: ミナ・ソータ・レイ・カズオを正式レンダリングへ統合\n- セーブ: スキーマ4、旧セーブ互換なし\n- バランス: 士気変動と疲労下限を再調整\n\n## 検証\n\nGitHub Actionsで次を実行する。\n\n- npm test\n- npm run check\n- npm run smoke\n- npm run build\n- npm run test:responsive\n`);

await rm(path.join(root, '.github/workflows/apply-mobile-redesign-v2.yml'), { force: true });
await rm(fileURLToPath(import.meta.url), { force: true });
console.log('Mobile redesign v2 migration applied.');
