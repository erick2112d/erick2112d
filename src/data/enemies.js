// Твари мглы. fromWave — с какой волны появляются; weight — частота в составе волны; points — «стоимость» в бюджете волны.
// Особые черты: ranged, flying (летит над заборами), summon, explode, heal, siege (бьёт только постройки).
// look — внешний вид в render/looks.js.

export const ENEMIES = {
  skeleton: {
    name: 'Скелет', look: 'skeleton', hp: 30, speed: 1.7, damage: 6, cooldown: 1, range: 0.75, radius: 0.34,
    armor: 0, points: 1, fromWave: 1, weight: 10, gold: 3, drops: { bones: [1, 0.6] }, aggro: 3,
    desc: 'Поднятый мглой воин. Слаб поодиночке, опасен толпой.',
  },
  hound: {
    name: 'Гниющий пёс', look: 'hound', hp: 20, speed: 3.2, damage: 4, cooldown: 0.6, range: 0.7, radius: 0.3,
    armor: 0, points: 1, fromWave: 2, weight: 7, gold: 2, drops: { bones: [1, 0.5] }, aggro: 4,
    desc: 'Быстрый падальщик, первым добегает до стен.',
  },
  brute: {
    name: 'Костяной латник', look: 'brute', hp: 95, speed: 1.15, damage: 14, cooldown: 1.3, range: 0.85, radius: 0.46,
    armor: 3, points: 3, fromWave: 4, weight: 4, gold: 6, drops: { bones: [3, 1] }, aggro: 2.5,
    desc: 'Бывший страж маяков в ржавых латах.',
  },
  archer: {
    name: 'Скелет-лучник', look: 'skelArcher', hp: 24, speed: 1.6, damage: 7, cooldown: 1.6, range: 4.5, radius: 0.33,
    armor: 0, points: 2, fromWave: 5, weight: 4, gold: 4, drops: { bones: [1, 0.8] }, aggro: 5, ranged: true, projectileSpeed: 11,
    desc: 'Стреляет костяными стрелами из-за спин.',
  },
  shieldbearer: {
    name: 'Щитоносец', look: 'shieldbearer', hp: 70, speed: 1.3, damage: 8, cooldown: 1.1, range: 0.8, radius: 0.42,
    armor: 7, points: 3, fromWave: 8, weight: 4, gold: 6, drops: { bones: [2, 1] }, aggro: 2.5,
    desc: 'Огромный щит гасит слабые удары. Нужны баллисты и магия.',
  },
  wraith: {
    name: 'Призрак', look: 'wraith', hp: 35, speed: 2.2, damage: 7, cooldown: 1, range: 0.8, radius: 0.34,
    armor: 0, points: 2, fromWave: 10, weight: 4, gold: 5, drops: { essence: [1, 0.4] }, aggro: 3, flying: true,
    desc: 'Летит сквозь заборы прямо к Сердцу.',
  },
  necromancer: {
    name: 'Некромант', look: 'necromancer', hp: 60, speed: 1.3, damage: 8, cooldown: 1.8, range: 4, radius: 0.36,
    armor: 1, points: 5, fromWave: 12, weight: 3, gold: 10, drops: { essence: [2, 0.8], bones: [2, 1] }, aggro: 5,
    ranged: true, projectileSpeed: 9, summon: { type: 'skeleton', count: 2, every: 6 },
    desc: 'Поднимает скелетов, пока жив.',
  },
  plague: {
    name: 'Чумной толстяк', look: 'plague', hp: 140, speed: 1, damage: 10, cooldown: 1.2, range: 0.9, radius: 0.5,
    armor: 1, points: 4, fromWave: 14, weight: 3, gold: 8, drops: { bones: [3, 1] }, aggro: 2,
    explode: { radius: 2, damage: 60 },
    desc: 'Лопается при гибели и рушит всё рядом. Бей издалека.',
  },
  bat: {
    name: 'Тенекрыл', look: 'bat', hp: 22, speed: 3.6, damage: 5, cooldown: 0.7, range: 0.7, radius: 0.3,
    armor: 0, points: 2, fromWave: 16, weight: 5, gold: 4, drops: { essence: [1, 0.3] }, aggro: 4, flying: true,
    desc: 'Стремительная летучая тварь.',
  },
  golem: {
    name: 'Осадный голем', look: 'golem', hp: 420, speed: 0.8, damage: 60, cooldown: 2, range: 0.9, radius: 0.62,
    armor: 5, points: 8, fromWave: 18, weight: 2, gold: 20, drops: { stone: [10, 1], essence: [2, 0.6] }, aggro: 0, siege: true,
    desc: 'Не замечает воинов — крушит постройки и заборы.',
  },
  witch: {
    name: 'Ведьма мглы', look: 'witch', hp: 70, speed: 1.4, damage: 12, cooldown: 1.7, range: 5, radius: 0.36,
    armor: 1, points: 5, fromWave: 22, weight: 3, gold: 12, drops: { essence: [3, 1] }, aggro: 5, ranged: true, projectileSpeed: 8,
    heal: { amount: 14, every: 2, radius: 3.5 },
    desc: 'Лечит тварей вокруг. Убивай первой.',
  },
  deathKnight: {
    name: 'Рыцарь смерти', look: 'deathKnight', hp: 320, speed: 1.5, damage: 30, cooldown: 1.2, range: 1, radius: 0.48,
    armor: 9, points: 8, fromWave: 26, weight: 2, gold: 25, drops: { essence: [4, 1], bones: [4, 1] }, aggro: 3.5,
    desc: 'Элитный воин мглы в чёрных латах.',
  },
  drake: {
    name: 'Костяной дракончик', look: 'drake', hp: 200, speed: 1.8, damage: 18, cooldown: 1.6, range: 4, radius: 0.5,
    armor: 3, points: 9, fromWave: 32, weight: 2, gold: 25, drops: { essence: [4, 1], bones: [5, 1] }, aggro: 5,
    flying: true, ranged: true, projectileSpeed: 10,
    desc: 'Летает над стенами и плюётся огнём мглы.',
  },
  devourer: {
    name: 'Пожиратель', look: 'devourer', hp: 900, speed: 0.9, damage: 50, cooldown: 1.6, range: 1.1, radius: 0.8,
    armor: 10, points: 15, fromWave: 40, weight: 1, gold: 50, drops: { essence: [8, 1], bones: [8, 1] }, aggro: 2.5,
    desc: 'Ходячая пасть. Проглатывает воинов целиком.',
  },

  // боссы — по очереди каждые 10 волн
  colossus: {
    name: 'Костяной Колосс', look: 'colossus', hp: 1100, speed: 0.95, damage: 45, cooldown: 1.6, range: 1.3, radius: 0.9,
    armor: 4, points: 0, fromWave: 999, weight: 0, gold: 100, drops: { essence: [10, 1], bones: [20, 1] }, aggro: 3, boss: true, gems: 3,
    desc: 'Гора костей с короной павшего короля.',
  },
  mistQueen: {
    name: 'Королева Мглы', look: 'mistQueen', hp: 1600, speed: 1.3, damage: 35, cooldown: 1.2, range: 1.2, radius: 0.85,
    armor: 3, points: 0, fromWave: 999, weight: 0, gold: 160, drops: { essence: [20, 1] }, aggro: 4, boss: true, gems: 4,
    flying: true, summon: { type: 'wraith', count: 2, every: 7 },
    desc: 'Владычица тумана, призывает призраков.',
  },
  lich: {
    name: 'Древний Лич', look: 'lich', hp: 2200, speed: 1, damage: 40, cooldown: 1.6, range: 5, radius: 0.8,
    armor: 6, points: 0, fromWave: 999, weight: 0, gold: 220, drops: { essence: [30, 1], crystal: [10, 1] }, aggro: 6, boss: true, gems: 5,
    ranged: true, projectileSpeed: 9, summon: { type: 'skeleton', count: 4, every: 6 },
    desc: 'Смотритель погасшего маяка, ставший повелителем мертвецов.',
  },
  boneDragon: {
    name: 'Костяной Дракон', look: 'boneDragon', hp: 3200, speed: 1.2, damage: 60, cooldown: 1.8, range: 5, radius: 1,
    armor: 8, points: 0, fromWave: 999, weight: 0, gold: 320, drops: { essence: [40, 1], starmetal: [3, 1] }, aggro: 6, boss: true, gems: 6,
    flying: true, ranged: true, projectileSpeed: 11,
    desc: 'Древний ужас, проснувшийся в Кратере Звезды.',
  },
};

export const BOSS_ROTATION = ['colossus', 'mistQueen', 'lich', 'boneDragon'];
