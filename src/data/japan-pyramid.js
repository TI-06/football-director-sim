const DIVISION_NAMES = {
  1: '日本1部',
  2: '日本2部',
  3: '日本3部'
};

const CLUB_ROWS = [
  // 日本1部
  [1, '東京蒼天FC', '蒼天', '東京都', '蒼天スタジアム', '#0ea5e9', '#082f49', 'possession'],
  [1, '横浜港星SC', '港星', '神奈川県', 'みなと競技場', '#2563eb', '#172554', 'technical'],
  [1, '大阪浪花ユナイテッド', '浪花', '大阪府', '浪花アリーナ', '#dc2626', '#450a0a', 'pressing'],
  [1, '名古屋金鯱FC', '金鯱', '愛知県', '金鯱スタジアム', '#f59e0b', '#451a03', 'balanced'],
  [1, '神戸六甲アスレチック', '六甲', '兵庫県', '六甲フィールド', '#7c3aed', '#2e1065', 'technical'],
  [1, '広島紅葉クラブ', '紅葉', '広島県', '紅葉パーク', '#b91c1c', '#450a0a', 'counter'],
  [1, '福岡玄海FC', '玄海', '福岡県', '玄海ドーム', '#0f766e', '#042f2e', 'pressing'],
  [1, '札幌雪嶺SC', '雪嶺', '北海道', '雪嶺ドーム', '#e11d48', '#4c0519', 'direct'],
  [1, '仙台青葉ユナイテッド', '青葉', '宮城県', '青葉の森競技場', '#16a34a', '#052e16', 'youth'],
  [1, '鹿島潮騒FC', '潮騒', '茨城県', '潮騒スタジアム', '#be123c', '#4c0519', 'balanced'],
  [1, '浦和紅獅子', '紅獅子', '埼玉県', '紅獅子パーク', '#ef4444', '#450a0a', 'pressing'],
  [1, '川崎多摩フロンティア', '多摩', '神奈川県', '多摩フロンティア場', '#38bdf8', '#082f49', 'possession'],
  [1, '千葉房総SC', '房総', '千葉県', '房総グリーン', '#eab308', '#422006', 'counter'],
  [1, '京都紫苑FC', '紫苑', '京都府', '紫苑御苑', '#9333ea', '#3b0764', 'technical'],
  [1, '新潟白鳥クラブ', '白鳥', '新潟県', '白鳥ビッグフィールド', '#f8fafc', '#1e3a8a', 'balanced'],
  [1, '静岡富士FC', '富士', '静岡県', '富士総合競技場', '#0284c7', '#0c4a6e', 'youth'],
  [1, '長野アルプスSC', 'アルプス', '長野県', 'アルプスパーク', '#22c55e', '#052e16', 'direct'],
  [1, '金沢加賀ユナイテッド', '加賀', '石川県', '加賀百万石競技場', '#991b1b', '#fbbf24', 'counter'],
  [1, '岡山吉備FC', '吉備', '岡山県', '吉備スタジアム', '#1d4ed8', '#172554', 'balanced'],
  [1, '熊本火国クラブ', '火国', '熊本県', '火の国フィールド', '#dc2626', '#111827', 'direct'],
  // 日本2部
  [2, '大宮鉄道SC', '鉄道', '埼玉県', '鉄道公園競技場', '#f97316', '#431407', 'balanced'],
  [2, '柏若葉FC', '若葉', '千葉県', '若葉台スタジアム', '#facc15', '#166534', 'pressing'],
  [2, '相模原緑風', '緑風', '神奈川県', '緑風フィールド', '#16a34a', '#14532d', 'youth'],
  [2, '甲府葡萄ユナイテッド', '葡萄', '山梨県', '葡萄の丘競技場', '#7e22ce', '#facc15', 'counter'],
  [2, '富山立山FC', '立山', '富山県', '立山パーク', '#1d4ed8', '#f8fafc', 'direct'],
  [2, '岐阜清流SC', '清流', '岐阜県', '清流スタジアム', '#22c55e', '#1e3a8a', 'balanced'],
  [2, '奈良大和クラブ', '大和', '奈良県', '大和歴史競技場', '#7c2d12', '#fef3c7', 'technical'],
  [2, '和歌山紀州FC', '紀州', '和歌山県', '紀州みかん場', '#f97316', '#14532d', 'counter'],
  [2, '徳島藍潮SC', '藍潮', '徳島県', '藍潮フィールド', '#1e40af', '#172554', 'possession'],
  [2, '高松讃岐ユナイテッド', '讃岐', '香川県', '讃岐の森競技場', '#0ea5e9', '#f8fafc', 'balanced'],
  [2, '松山伊予FC', '伊予', '愛媛県', '伊予オレンジパーク', '#ea580c', '#7c2d12', 'technical'],
  [2, '長崎出島クラブ', '出島', '長崎県', '出島スタジアム', '#2563eb', '#f97316', 'possession'],
  [2, '大分豊後SC', '豊後', '大分県', '豊後ドーム', '#0ea5e9', '#1e3a8a', 'counter'],
  [2, '宮崎日向FC', '日向', '宮崎県', '日向サンフィールド', '#f59e0b', '#dc2626', 'youth'],
  [2, '鹿児島桜島ユナイテッド', '桜島', '鹿児島県', '桜島競技場', '#dc2626', '#111827', 'direct'],
  [2, '山口維新FC', '維新', '山口県', '維新パーク', '#fb7185', '#4c0519', 'pressing'],
  [2, '鳥取砂丘SC', '砂丘', '鳥取県', '砂丘フィールド', '#d97706', '#1e3a8a', 'direct'],
  [2, '島根石見クラブ', '石見', '島根県', '石見銀山競技場', '#64748b', '#1e293b', 'counter'],
  [2, '秋田竿燈FC', '竿燈', '秋田県', '竿燈スタジアム', '#facc15', '#111827', 'physical'],
  [2, '山形紅花SC', '紅花', '山形県', '紅花パーク', '#dc2626', '#f8fafc', 'balanced'],
  // 日本3部
  [3, '青森ねぶたFC', 'ねぶた', '青森県', 'ねぶたフィールド', '#ef4444', '#facc15', 'direct'],
  [3, '盛岡北上SC', '北上', '岩手県', '北上川競技場', '#1d4ed8', '#f8fafc', 'youth'],
  [3, '福島磐梯クラブ', '磐梯', '福島県', '磐梯パーク', '#16a34a', '#f8fafc', 'balanced'],
  [3, '水戸梅郷FC', '梅郷', '茨城県', '梅郷スタジアム', '#dc2626', '#f8fafc', 'technical'],
  [3, '栃木雷都SC', '雷都', '栃木県', '雷都フィールド', '#eab308', '#1f2937', 'pressing'],
  [3, '群馬赤城ユナイテッド', '赤城', '群馬県', '赤城山競技場', '#b91c1c', '#111827', 'direct'],
  [3, '八王子高尾FC', '高尾', '東京都', '高尾の森競技場', '#15803d', '#f8fafc', 'youth'],
  [3, '湘南潮風SC', '潮風', '神奈川県', '潮風ビーチパーク', '#0ea5e9', '#facc15', 'technical'],
  [3, '沼津駿河クラブ', '駿河', '静岡県', '駿河湾フィールド', '#0284c7', '#f8fafc', 'counter'],
  [3, '浜松遠州FC', '遠州', '静岡県', '遠州スタジアム', '#f97316', '#1e3a8a', 'pressing'],
  [3, '福井越前SC', '越前', '福井県', '越前パーク', '#16a34a', '#f8fafc', 'balanced'],
  [3, '滋賀琵琶湖ユナイテッド', '琵琶湖', '滋賀県', '湖畔競技場', '#38bdf8', '#172554', 'possession'],
  [3, '堺古墳FC', '古墳', '大阪府', '百舌鳥競技場', '#7c3aed', '#f8fafc', 'technical'],
  [3, '姫路白鷺SC', '白鷺', '兵庫県', '白鷺城フィールド', '#f8fafc', '#1e40af', 'balanced'],
  [3, '高知黒潮クラブ', '黒潮', '高知県', '黒潮スタジアム', '#1e3a8a', '#f8fafc', 'counter'],
  [3, '北九州門司港FC', '門司港', '福岡県', '門司港パーク', '#eab308', '#dc2626', 'direct'],
  [3, '佐賀有明SC', '有明', '佐賀県', '有明海競技場', '#0f766e', '#f8fafc', 'youth'],
  [3, '沖縄琉球ユナイテッド', '琉球', '沖縄県', '琉球サンスタジアム', '#be123c', '#facc15', 'technical'],
  [3, '函館海峡FC', '海峡', '北海道', '海峡フィールド', '#2563eb', '#f8fafc', 'direct'],
  [3, '松本城下クラブ', '城下', '長野県', '城下町競技場', '#166534', '#111827', 'pressing']
];

function slug(index, division) {
  return `jp${division}-${String(index + 1).padStart(2, '0')}`;
}

export const JAPANESE_CLUB_TEMPLATES = CLUB_ROWS.map((row, index) => {
  const [division, name, shortName, city, stadium, primary, secondary, style] = row;
  const divisionIndex = CLUB_ROWS.slice(0, index).filter((item) => item[0] === division).length;
  const reputationBase = division === 1 ? 72 : division === 2 ? 58 : 44;
  const reputation = reputationBase + Math.max(0, 9 - Math.floor(divisionIndex / 2));
  const capacityBase = division === 1 ? 28_000 : division === 2 ? 17_000 : 9_000;
  return {
    id: slug(divisionIndex, division),
    division,
    divisionName: DIVISION_NAMES[division],
    name,
    shortName,
    city,
    stadium,
    primary,
    secondary,
    style,
    reputation,
    capacity: capacityBase + (19 - divisionIndex) * (division === 1 ? 650 : division === 2 ? 420 : 220)
  };
});

export const JAPANESE_FIRST_NAMES = [
  '蓮', '湊', '大翔', '悠真', '蒼', '陽翔', '樹', '颯太', '朝陽', '律', '海斗', '陸', '新', '健太', '拓海',
  '翔', '直人', '優斗', '隼人', '航', '亮', '雄大', '和也', '慎太郎', '一樹', '俊介', '昌平', '圭吾', '凌', '琉生',
  '颯', '晴人', '悠人', '瑛太', '駿', '大和', '誠', '宏樹', '智也', '啓介'
];

export const JAPANESE_LAST_NAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本',
  '井上', '木村', '林', '斎藤', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '前田', '藤田', '小川', '後藤',
  '岡田', '長谷川', '村上', '近藤', '石井', '坂本', '遠藤', '青木', '藤井', '西村', '福田', '太田', '三浦', '岡本', '松田'
];

export function createOriginalClub({ name, city, primary, philosophy = 'balanced' }) {
  const safeName = String(name || '新設クラブ').trim().slice(0, 32) || '新設クラブ';
  const safeCity = String(city || '日本').trim().slice(0, 24) || '日本';
  const styles = new Set(['balanced', 'youth', 'pressing', 'counter', 'possession', 'technical', 'direct']);
  const style = styles.has(philosophy) ? philosophy : 'balanced';
  return {
    id: 'created-club',
    division: 3,
    divisionName: DIVISION_NAMES[3],
    name: safeName,
    shortName: safeName.replace(/[ＦＦ][ＣＣ]|FC|SC|クラブ|ユナイテッド/gi, '').slice(0, 3) || '新設',
    city: safeCity,
    stadium: `${safeCity}市民競技場`,
    primary: /^#[0-9a-f]{6}$/i.test(primary || '') ? primary : '#16a34a',
    secondary: '#052e16',
    style,
    reputation: 42,
    capacity: 8_500,
    isCreated: true
  };
}

export { DIVISION_NAMES };
