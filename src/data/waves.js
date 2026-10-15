// Волны. Состав определяется номером волны — повтор даёт тот же состав.
export const WAVES = {
  budget: { base: 3, perWave: 2, quad: 0.15 },
  hpGrowth: 0.12,
  damageGrowth: 0.07,
  bossEvery: 10,
  bossCycleHp: 1.8,        // каждый следующий круг боссов крепче
  sides: [{ from: 1, count: 1 }, { from: 3, count: 2 }, { from: 6, count: 3 }, { from: 9, count: 4 }],
  kinds: {
    quick:  { name: 'Быстрая',   budget: 0.8, spawnSeconds: 7,  reward: 0.8 },
    normal: { name: 'Обычная',   budget: 1,   spawnSeconds: 18, reward: 1 },
    trial:  { name: 'Испытание', budget: 1.6, spawnSeconds: 40, reward: 1.7 },
  },
  kindRules: [{ every: 5, kind: 'trial' }, { every: 3, kind: 'quick' }],
  rewards: {
    gold: { base: 10, perWave: 4 },
    food: { base: 5, perWave: 1.5 },
    wood: { base: 8, perWave: 2 },
  },
  events: [
    { id: 'bloodMoon', name: 'Кровавая луна', fromWave: 4, chance: 0.1, speed: 1.25, hp: 1, budget: 1, reward: 1.5,
      text: 'Луна налилась кровью: враги быстрее, но добыча щедрее.' },
    { id: 'thickFog', name: 'Густая мгла', fromWave: 3, chance: 0.08, speed: 1, hp: 1.15, budget: 1.2, reward: 1.4,
      text: 'Мгла сгустилась. Тварей больше, и они крепче.' },
    { id: 'starfall', name: 'Звездопад', fromWave: 15, chance: 0.06, speed: 1, hp: 1, budget: 1, reward: 1.2, gems: 2,
      text: 'С неба падают звёзды: за победу — ещё 2 самоцвета.' },
  ],
};
