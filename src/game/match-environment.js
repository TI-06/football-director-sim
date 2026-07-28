import { clamp } from '../core/utils.js';

const WEATHER = ['晴れ', '曇り', '雨', '強雨', '強風', '猛暑', '寒冷'];
const PITCH = ['良好', '乾燥', '重い', '荒れている'];
const CITY_COORDINATES = {
  '札幌': [43.06, 141.35], '仙台': [38.27, 140.87], '東京': [35.68, 139.76], '横浜': [35.44, 139.64],
  '名古屋': [35.18, 136.91], '大阪': [34.69, 135.5], '広島': [34.39, 132.46], '福岡': [33.59, 130.4], '沖縄': [26.21, 127.68]
};

function distanceBetweenCities(homeCity, awayCity) {
  const home = CITY_COORDINATES[homeCity] ?? [35.68, 139.76];
  const away = CITY_COORDINATES[awayCity] ?? [35.68, 139.76];
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(away[0] - home[0]);
  const dLon = rad(away[1] - home[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(home[0])) * Math.cos(rad(away[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function travelFatigue(distanceKm = 0, consecutiveAway = 0, climateDifference = 0) {
  return clamp(distanceKm / 420 + consecutiveAway * 1.8 + Math.abs(climateDifference) * 0.08, 0, 12);
}

export function createMatchEnvironment(rng, homeClub = {}, awayClub = {}, context = {}) {
  const weather = rng.pick(WEATHER);
  const temperature = weather === '猛暑' ? rng.int(31, 38) : weather === '寒冷' ? rng.int(-2, 7) : rng.int(8, 29);
  const travelDistance = distanceBetweenCities(homeClub.city, awayClub.city);
  return {
    weather,
    pitch: weather === '強雨' ? rng.pick(['重い', '荒れている']) : rng.pick(PITCH),
    temperature,
    travelDistance,
    awayFatigue: travelFatigue(travelDistance, context.consecutiveAway ?? 0, context.climateDifference ?? 0),
    homeAdvantage: clamp(2 + Number(homeClub.capacity ?? 0) / 20_000 + Number(homeClub.fanMood ?? 65) / 35, 2, 8),
    referee: {
      name: `主審${rng.int(1, 24)}`,
      foulStrictness: rng.int(30, 90),
      cardTendency: rng.int(25, 92),
      advantageTendency: rng.int(25, 90),
      homePressureResistance: rng.int(30, 95)
    }
  };
}

export function environmentModifiers(environment = {}) {
  let passing = 0;
  let shooting = 0;
  let fatigue = 0;
  let injury = 0;
  let crossing = 0;
  let longBall = 0;
  if (environment.weather === '雨') { passing -= 0.02; crossing -= 0.01; injury += 0.01; }
  if (environment.weather === '強雨') { passing -= 0.06; shooting -= 0.04; fatigue += 0.03; injury += 0.04; longBall += 0.02; }
  if (environment.weather === '強風') { crossing -= 0.06; longBall -= 0.05; shooting -= 0.02; }
  if (environment.weather === '猛暑') fatigue += 0.07;
  if (environment.weather === '寒冷') injury += 0.025;
  if (environment.pitch === '重い') { passing -= 0.03; fatigue += 0.04; }
  if (environment.pitch === '荒れている') { passing -= 0.05; injury += 0.035; }
  const home = clamp(Number(environment.homeAdvantage ?? 0) / 100, 0, 0.08);
  const travel = clamp(Number(environment.travelDistance ?? 0) / 30_000, 0, 0.08);
  const cards = clamp((Number(environment.referee?.cardTendency ?? 50) - 50) / 625, -0.08, 0.08);
  return Object.fromEntries(Object.entries({ passing, shooting, fatigue, injury, crossing, longBall, home, travel, cards }).map(([key, value]) => [key, clamp(value, -0.08, 0.08)]));
}
