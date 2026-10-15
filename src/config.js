// Все игровые данные «Последнего Светоча».
// Баланс, здания, враги, оружие, волны и сюжет меняются здесь — без правки логики.
// Единица длины — одна клетка карты.

export const WORLD = {
  width: 64,
  height: 64,
  heart: { tx: 31, ty: 31 },          // левый верхний угол Сердца (3×3)
  startRadius: 7.5,                    // радиус стартовой территории
  startResources: { wood: 30, planks: 0, stone: 0, gold: 0, shards: 0 },
  storageCap: 400,                     // предел каждого ресурса
  heroRespawnSeconds: 5,
  heroRegenPerSecond: 3,               // восстановление героя между волнами
  repairWoodPerHp: 0.1,                // 1 древесина за 10 ед. прочности
  heartRestoreAfterDefeat: 0.35,       // доля прочности Сердца после поражения
  autoSaveSeconds: 15,
  flowWallPenalty: 10,                 // насколько враги избегают ломать постройки
};

export const RESOURCES = {
  wood:   { name: 'Древесина', color: '#c98a4b' },
  planks: { name: 'Доски',     color: '#e6c27a' },
  stone:  { name: 'Камень',    color: '#a9b0bd' },
  gold:   { name: 'Золото',    color: '#ffd34d' },
  shards: { name: 'Осколки света', color: '#7ff3ff' },
};

// Природные объекты: деревья и камни. Добываются атакой героя.
export const NODES = {
  tree: { name: 'Дерево', hp: 4, yieldRes: 'wood', perHit: 2, onBreak: 4, regrowSeconds: 50 },
  rock: { name: 'Валун',  hp: 6, yieldRes: 'stone', perHit: 1, onBreak: 4, regrowSeconds: 70 },
};

// Уровни: стоимость улучшения = upgradeCost × upgradeCostGrowth^(уровень-1);
// прочность = hp × (1 + hpPerLevel × (уровень-1)).
export const BUILDINGS = {
  heart: {
    name: 'Сердце Светоча', size: 3, hp: 900, buildable: false, maxLevel: 5,
    hpPerLevel: 0.3, upgradeCost: { gold: 60, planks: 20 },
    desc: 'Последний источник света. Если оно падёт — волна проиграна.',
  },
  generator: {
    name: 'Генератор', size: 2, hp: 220, cost: { wood: 30 }, maxLevel: 5,
    hpPerLevel: 0.25, upgradeCost: { gold: 20, planks: 10 },
    energyOut: 6, energyOutPerLevel: 4,
    desc: 'Даёт энергию башням и мастерским.',
  },
  sawmill: {
    name: 'Лесопилка', size: 2, hp: 180, cost: { wood: 25 }, maxLevel: 5,
    hpPerLevel: 0.25, upgradeCost: { gold: 15, planks: 8 },
    energyUse: 1, priority: 1,
    recipe: { input: { wood: 2 }, output: { planks: 1 }, seconds: 3, speedPerLevel: 0.35 },
    desc: 'Перерабатывает древесину в доски.',
  },
  quarry: {
    name: 'Каменоломня', size: 2, hp: 240, cost: { wood: 30, planks: 20, gold: 20 }, maxLevel: 5,
    hpPerLevel: 0.25, upgradeCost: { gold: 25, planks: 10 }, locked: true,
    energyUse: 1, priority: 1,
    recipe: { input: {}, output: { stone: 1 }, seconds: 4, speedPerLevel: 0.35 },
    desc: 'Добывает камень. Открывается Северным маяком.',
  },
  archerTower: {
    name: 'Башня лучников', size: 1, hp: 200, cost: { wood: 15, planks: 10 }, maxLevel: 5,
    hpPerLevel: 0.25, upgradeCost: { gold: 25, planks: 12 },
    energyUse: 3, priority: 2,
    attack: { range: 6, damage: 9, cooldown: 0.85, projectileSpeed: 15, damagePerLevel: 0.35, rangePerLevel: 0.4 },
    desc: 'Быстро стреляет по ближайшему врагу. Работает только с энергией.',
  },
  barracks: {
    name: 'Казарма мечников', size: 2, hp: 300, cost: { wood: 30, planks: 15, gold: 20 }, maxLevel: 5,
    hpPerLevel: 0.25, upgradeCost: { gold: 30, planks: 15 },
    spawns: { unit: 'swordsman', count: 2, countPerLevel: 1, respawnSeconds: 10, statsPerLevel: 0.25 },
    desc: 'Выпускает мечников, которые защищают округу.',
  },
  repairHouse: {
    name: 'Дом ремонтников', size: 2, hp: 200, cost: { wood: 25, planks: 10, gold: 10 }, maxLevel: 5,
    hpPerLevel: 0.25, upgradeCost: { gold: 20, planks: 10 },
    repair: { workers: 1, workersPerLevel: 1, hpPerSecond: 14, speed: 3, perLevel: 0.3 },
    desc: 'После волны ремонтники чинят постройки за древесину.',
  },
  wall: {
    name: 'Стена', size: 1, hp: 160, cost: { wood: 4 }, maxLevel: 5,
    hpPerLevel: 0.5, upgradeCost: { gold: 4, stone: 3 },
    desc: 'Задерживает врагов. Они ломают её, если путь закрыт.',
  },
  beacon: {
    name: 'Маяк', size: 2, hp: 500, buildable: false, maxLevel: 1, hpPerLevel: 0,
    desc: 'Древний маяк. Зажжённый — раздвигает туман.',
  },
};

// Порядок кнопок в меню строительства.
export const BUILD_MENU = ['generator', 'sawmill', 'archerTower', 'barracks', 'repairHouse', 'wall', 'quarry'];

// Союзные юниты.
export const UNITS = {
  hero: { name: 'Хранитель', hp: 120, speed: 4.2, radius: 0.38 },
  swordsman: { name: 'Мечник', hp: 70, speed: 3.2, radius: 0.33, damage: 9, cooldown: 0.9, range: 0.9, aggro: 5, leash: 7 },
  repairer: { name: 'Ремонтник', hp: 40, speed: 3, radius: 0.28 },
};

// Оружие героя. Переключение: 1 — посох, 2 — меч, 3 — лук.
export const WEAPONS = {
  staff: { name: 'Посох', kind: 'fireball', damage: 14, cooldown: 0.9, range: 7, projectileSpeed: 9, aoe: 1.3, nodeDamage: 1 },
  sword: { name: 'Меч', kind: 'slash', damage: 13, cooldown: 0.55, range: 1.7, arc: Math.PI * 2, nodeDamage: 2 },
  bow:   { name: 'Лук', kind: 'arrow', damage: 10, cooldown: 0.5, range: 8, projectileSpeed: 16, nodeDamage: 1 },
};
export const WEAPON_ORDER = ['staff', 'sword', 'bow'];

// Типы врагов. Новый тип = новая запись + рисунок в art.js (по ключу look).
export const ENEMIES = {
  skeleton: {
    name: 'Скелет', look: 'skeleton', hp: 30, speed: 1.7, damage: 6, cooldown: 1, range: 0.75,
    radius: 0.36, armor: 0, points: 1, fromWave: 1, weight: 10, gold: 3, shardChance: 0.08, aggro: 3,
  },
  runner: {
    name: 'Упырь-бегун', look: 'runner', hp: 18, speed: 3, damage: 4, cooldown: 0.7, range: 0.7,
    radius: 0.3, armor: 0, points: 1, fromWave: 2, weight: 6, gold: 2, shardChance: 0.05, aggro: 3.5,
  },
  brute: {
    name: 'Костяной латник', look: 'brute', hp: 95, speed: 1.15, damage: 14, cooldown: 1.3, range: 0.85,
    radius: 0.48, armor: 3, points: 3, fromWave: 4, weight: 4, gold: 6, shardChance: 0.3, aggro: 2.5,
  },
  archer: {
    name: 'Скелет-лучник', look: 'archer', hp: 24, speed: 1.6, damage: 7, cooldown: 1.6, range: 4.5,
    radius: 0.34, armor: 0, points: 2, fromWave: 6, weight: 4, gold: 4, shardChance: 0.2, aggro: 5,
    projectileSpeed: 11,
  },
  boss: {
    name: 'Костяной Колосс', look: 'boss', hp: 900, speed: 0.95, damage: 40, cooldown: 1.6, range: 1.3,
    radius: 0.9, armor: 4, points: 0, fromWave: 999, weight: 0, gold: 80, shardChance: 1, shards: 15, aggro: 3,
    boss: true,
  },
};

export const WAVES = {
  // Очки силы волны: base + perWave·n + quad·n²
  budget: { base: 3, perWave: 2, quad: 0.15 },
  hpGrowth: 0.12,          // +12% здоровья врагов за волну
  damageGrowth: 0.07,      // +7% урона за волну
  bossEvery: 10,
  bossType: 'boss',
  // Число сторон атаки по номеру волны (с какой волны сколько сторон).
  sides: [{ from: 1, count: 1 }, { from: 3, count: 2 }, { from: 6, count: 3 }, { from: 9, count: 4 }],
  kinds: {
    quick:  { name: 'Быстрая',  budget: 0.8, spawnSeconds: 7,  reward: 0.8 },
    normal: { name: 'Обычная',  budget: 1,   spawnSeconds: 18, reward: 1 },
    trial:  { name: 'Испытание', budget: 1.6, spawnSeconds: 40, reward: 1.7 },
  },
  // Как выбирается вид волны: первое совпавшее правило.
  kindRules: [{ every: 5, kind: 'trial' }, { every: 3, kind: 'quick' }],
  rewards: { gold: { base: 10, perWave: 4 }, wood: { base: 8, perWave: 2 }, shards: { base: 2, perWave: 0.5 } },
  // Редкие события. Случайность привязана к номеру волны: повтор волны — то же событие.
  events: [
    { id: 'bloodMoon', name: 'Кровавая луна', fromWave: 4, chance: 0.1, speed: 1.25, hp: 1, budget: 1, reward: 1.5,
      text: 'Луна налилась кровью: враги быстрее, но добыча щедрее.' },
    { id: 'thickFog', name: 'Густой туман', fromWave: 3, chance: 0.08, speed: 1, hp: 1.15, budget: 1.2, reward: 1.4,
      text: 'Туман сгустился. Тварей больше и они крепче.' },
  ],
};

export const BEACONS = [
  {
    id: 'north', name: 'Северный маяк', tx: 31, ty: 17, radius: 8,
    availableAfterWave: 3, cost: { planks: 30, shards: 8 },
    unlocks: ['quarry'], story: 'beacon_north_lit',
    nodes: { tree: 7, rock: 6 },
  },
];

export const STORY = {
  intro: {
    title: 'Последний свет',
    text: 'Когда древние маяки погасли, мир поглотил живой туман. Города, дороги, целые армии исчезли в нём. ' +
      'Сердце Светоча — последний огонь в этих землях. Ты — его Хранитель. Наруби дерева и начни строить.',
  },
  first_wave: {
    title: 'Первая ночь',
    text: 'Твари рассыпались костями у самой кромки света. Они вернутся — и их будет больше. ' +
      'Отстрой оборону: генератор питает башни, лесопилка даёт доски.',
  },
  beacon_north_ready: {
    title: 'Голос с севера',
    text: 'В тумане на севере проступил силуэт: старый маяк поселения Велесград. Его лампа ещё цела. ' +
      'Нужны доски и осколки света, что остаются от тварей.',
  },
  beacon_north_lit: {
    title: 'Северный маяк зажжён',
    text: 'Свет пробил туман. Под ним — руины Велесграда, лес и каменные россыпи. ' +
      'Записи смотрителя говорят: «Туман боится не огня, а тех, кто его поддерживает». Каменоломня теперь доступна.',
  },
  wave5: {
    title: 'Латники',
    text: 'Среди тварей появились закованные в старые доспехи. Это бывшие стражи маяков. ' +
      'Обычные стрелы вязнут в их броне — нужны улучшенные башни и мечники.',
  },
  first_defeat: {
    title: 'Свет дрогнул',
    text: 'Сердце едва не погасло, но выдержало. Твари отступили в туман. ' +
      'Укрепи базу и попробуй снова — разрушенное можно отстроить.',
  },
  boss10: {
    title: 'Колосс пал',
    text: 'Костяной Колосс рассыпался, и туман на миг отступил. Из его праха выпали осколки древнего маяка. ' +
      'Где-то там есть и другие огни.',
  },
};

// Свои спрайты: положите PNG в assets/sprites/ и укажите путь.
// Пока путь null — персонаж рисуется кодом.
export const SPRITE_OVERRIDES = {
  heroHead: null, heroBody: null,
  skeletonHead: null, skeletonBody: null,
  sword: null, bow: null, arrow: null,
};
