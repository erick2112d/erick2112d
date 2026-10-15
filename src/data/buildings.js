// Постройки. Все числа редактируются здесь.
// unlock — нужный уровень Сердца; cost — цена постройки; upgrade — база цены улучшения
// (растёт ×upgradeGrowth за уровень, с 10 и 20 уровня добавляются металлы и кристаллы — см. tierExtras).
// Уровень здания не может превышать уровень Сердца.
// evolutions — выбор пути на 10, 20 и 30 уровне (по два варианта); mods см. в core/stats.js.

export const BUILD_CATEGORIES = [
  { id: 'economy', name: 'Хозяйство' },
  { id: 'production', name: 'Производство' },
  { id: 'defense', name: 'Оборона' },
  { id: 'army', name: 'Армия' },
  { id: 'hero', name: 'Снаряжение' },
];

export const UPGRADE_GROWTH = 1.18;
export const DEFAULT_TIER_EXTRAS = { 10: { iron: 4, bricks: 6 }, 20: { crystal: 3, mithril: 2 } };

const towerEvo = (a1, a2, b1, b2, c1, c2) => ({ 10: [a1, a2], 20: [b1, b2], 30: [c1, c2] });

export const BUILDINGS = {
  heart: {
    name: 'Сердце Светоча', category: 'special', size: 3, hp: 900, buildable: false, maxLevel: 100, inset: 0.15,
    desc: 'Последний источник света. Улучшай его, чтобы раздвинуть мглу и открыть новые земли.',
  },

  // ---------- хозяйство ----------
  workerCamp: {
    name: 'Лагерь рабочих', category: 'economy', size: 2, hp: 220, unlock: 1, maxLevel: 30, inset: 0.18,
    cost: { wood: 25 }, upgrade: { gold: 15, wood: 20 },
    workers: { count: 2, every: 3, carry: 5, speed: 2.8, foodCost: 8, respawn: 6 },
    desc: 'Рабочие с топором и киркой сами добывают деревья, камни и руду на освещённой земле.',
    evolutions: {
      10: [
        { id: 'lumber', name: 'Артель лесорубов', desc: '+2 рабочих', mods: { workers: 2 } },
        { id: 'miners', name: 'Горная артель', desc: 'Несут вдвое больше', mods: { carry: 2 } },
      ],
      20: [
        { id: 'swift', name: 'Быстроногие', desc: '+40% скорости рабочих', mods: { speed: 1.4 } },
        { id: 'guild', name: 'Гильдия добытчиков', desc: '+3 рабочих', mods: { workers: 3 } },
      ],
      30: [
        { id: 'masters', name: 'Мастера недр', desc: 'Двойная добыча с удара', mods: { gather: 2 } },
        { id: 'legion', name: 'Легион труда', desc: '+5 рабочих', mods: { workers: 5 } },
      ],
    },
  },
  farm: {
    name: 'Ферма', category: 'economy', size: 2, hp: 180, unlock: 1, maxLevel: 30, inset: 0.15,
    cost: { wood: 20 }, upgrade: { gold: 10, wood: 15 },
    recipes: [{ id: 'food', name: 'Урожай', input: {}, output: { food: 1 }, seconds: 3 }],
    speedPerLevel: 0.12,
    desc: 'Выращивает еду. Еда нужна, чтобы нанимать воинов и рабочих и улучшать Сердце.',
    evolutions: {
      10: [
        { id: 'mill', name: 'Ферма с мельницей', desc: '+60% урожая', mods: { output: 1.6 } },
        { id: 'apiary', name: 'Пасека', desc: 'Урожай и мёд: +1 монета за цикл', mods: { bonusGold: 1 } },
      ],
      20: [
        { id: 'orchard', name: 'Сады Светоча', desc: '+80% урожая', mods: { output: 1.8 } },
        { id: 'market', name: 'Ярмарочное подворье', desc: '+2 монеты за цикл', mods: { bonusGold: 2 } },
      ],
      30: [
        { id: 'eden', name: 'Сияющие поля', desc: 'Урожай ×2', mods: { output: 2 } },
        { id: 'guildhall', name: 'Купеческий двор', desc: '+4 монеты за цикл', mods: { bonusGold: 4 } },
      ],
    },
  },
  storehouse: {
    name: 'Склад', category: 'economy', size: 2, hp: 260, unlock: 2, maxLevel: 30, inset: 0.12,
    cost: { wood: 40, stone: 15 }, upgrade: { gold: 15, planks: 10 },
    storage: 250,
    desc: 'Увеличивает предел хранения каждого материала на 250 за уровень.',
  },
  generator: {
    name: 'Генератор', category: 'economy', size: 2, hp: 220, unlock: 1, maxLevel: 30, inset: 0.2,
    cost: { wood: 30 }, upgrade: { gold: 20, planks: 10 },
    energyOut: 6, energyOutPerLevel: 3,
    desc: 'Даёт энергию башням и мастерским. Если энергии мало, часть зданий отключится.',
    evolutions: {
      10: [
        { id: 'rune', name: 'Рунный генератор', desc: '+50% энергии', mods: { energyOut: 1.5 } },
        { id: 'thunder', name: 'Громовой столп', desc: 'Бьёт молнией врагов рядом', mods: { zap: 30 } },
      ],
      20: [
        { id: 'astral', name: 'Астральный источник', desc: '+60% энергии', mods: { energyOut: 1.6 } },
        { id: 'tempest', name: 'Колонна бурь', desc: 'Молнии сильнее и бьют цепью', mods: { zap: 60, chain: 2 } },
      ],
      30: [
        { id: 'sun', name: 'Малое солнце', desc: 'Энергия ×2', mods: { energyOut: 2 } },
        { id: 'zeus', name: 'Шпиль громовержца', desc: 'Мощные цепные молнии', mods: { zap: 120, chain: 4 } },
      ],
    },
  },
  market: {
    name: 'Рынок', category: 'economy', size: 2, hp: 200, unlock: 6, maxLevel: 30, inset: 0.15,
    cost: { wood: 60, planks: 25, gold: 40 }, upgrade: { gold: 30, planks: 10 },
    market: { buyMarkup: 3, sellBonusPerLevel: 0.03 },
    desc: 'Продажа материалов за монеты и покупка простых материалов. Чем выше уровень, тем выгоднее.',
  },
  repairHouse: {
    name: 'Дом ремонтников', category: 'economy', size: 2, hp: 200, unlock: 3, maxLevel: 30, inset: 0.15,
    cost: { wood: 25, planks: 10, gold: 10 }, upgrade: { gold: 20, planks: 10 },
    repair: { workers: 1, every: 4, hpPerSecond: 14, speed: 3, perLevel: 0.12 },
    desc: 'После волны ремонтники обходят базу и чинят постройки за древесину.',
  },

  // ---------- производство ----------
  sawmill: {
    name: 'Лесопилка', category: 'production', size: 2, hp: 180, unlock: 1, maxLevel: 30, inset: 0.15,
    cost: { wood: 25 }, upgrade: { gold: 15, planks: 8 }, energyUse: 1, priority: 1,
    recipes: [{ id: 'planks', name: 'Доски', input: { wood: 2 }, output: { planks: 1 }, seconds: 3 }],
    speedPerLevel: 0.15, reserve: 10,
    desc: 'Перерабатывает древесину в доски.',
  },
  quarry: {
    name: 'Каменоломня', category: 'production', size: 2, hp: 240, unlock: 4, maxLevel: 30, inset: 0.15,
    cost: { wood: 40, planks: 15, gold: 20 }, upgrade: { gold: 20, planks: 10 }, energyUse: 1, priority: 1,
    recipes: [{ id: 'stone', name: 'Камень', input: {}, output: { stone: 1 }, seconds: 4 }],
    speedPerLevel: 0.15,
    desc: 'Добывает камень без участия героя.',
  },
  stonecutter: {
    name: 'Каменотёс', category: 'production', size: 2, hp: 240, unlock: 6, maxLevel: 30, inset: 0.15,
    cost: { wood: 40, stone: 30, gold: 25 }, upgrade: { gold: 20, stone: 15 }, energyUse: 1, priority: 1,
    recipes: [{ id: 'bricks', name: 'Каменные блоки', input: { stone: 2 }, output: { bricks: 1 }, seconds: 4 }],
    speedPerLevel: 0.15, reserve: 10,
    desc: 'Вытёсывает каменные блоки для укреплений и Сердца.',
  },
  charcoal: {
    name: 'Углежогня', category: 'production', size: 2, hp: 200, unlock: 10, maxLevel: 30, inset: 0.15,
    cost: { wood: 60, bricks: 20, gold: 40 }, upgrade: { gold: 25, bricks: 8 }, energyUse: 1, priority: 1,
    recipes: [{ id: 'coal', name: 'Уголь', input: { wood: 3 }, output: { coal: 1 }, seconds: 5 }],
    speedPerLevel: 0.15, reserve: 20,
    desc: 'Пережигает древесину в уголь.',
  },
  mine: {
    name: 'Шахта', category: 'production', size: 2, hp: 300, unlock: 11, maxLevel: 30, inset: 0.15,
    cost: { planks: 50, bricks: 30, gold: 60 }, upgrade: { gold: 30, bricks: 10 }, energyUse: 2, priority: 1,
    recipes: [
      { id: 'ore', name: 'Железная руда', input: {}, output: { ore: 1 }, seconds: 5 },
      { id: 'coal', name: 'Уголь', input: {}, output: { coal: 1 }, seconds: 5 },
      { id: 'silver', name: 'Лунное серебро', input: {}, output: { silver: 1 }, seconds: 9, minLevel: 10 },
      { id: 'mithrilOre', name: 'Мифриловая руда', input: {}, output: { mithrilOre: 1 }, seconds: 14, minLevel: 20 },
    ],
    speedPerLevel: 0.12,
    desc: 'Добывает руду из глубины. Рецепт выбирается в карточке.',
  },
  smelter: {
    name: 'Плавильня', category: 'production', size: 2, hp: 300, unlock: 12, maxLevel: 30, inset: 0.15,
    cost: { bricks: 50, planks: 30, gold: 80 }, upgrade: { gold: 35, bricks: 12 }, energyUse: 2, priority: 1,
    recipes: [
      { id: 'iron', name: 'Железо', input: { ore: 2, coal: 1 }, output: { iron: 1 }, seconds: 5 },
      { id: 'mithril', name: 'Мифрил', input: { mithrilOre: 2, coal: 2 }, output: { mithril: 1 }, seconds: 9, minLevel: 10 },
    ],
    speedPerLevel: 0.12,
    desc: 'Плавит руду в слитки. Мифрил — с 10 уровня.',
  },
  workshop: {
    name: 'Мастерская', category: 'production', size: 2, hp: 260, unlock: 18, maxLevel: 30, inset: 0.15,
    cost: { iron: 30, planks: 40, gold: 120 }, upgrade: { gold: 40, iron: 8 }, energyUse: 2, priority: 1,
    recipes: [{ id: 'parts', name: 'Механизмы', input: { iron: 1, planks: 2 }, output: { parts: 1 }, seconds: 7 }],
    speedPerLevel: 0.12,
    desc: 'Собирает механизмы для баллист, арбалетов и высоких уровней башен.',
  },

  // ---------- оборона ----------
  wall: {
    name: 'Забор', category: 'defense', size: 1, hp: 160, unlock: 1, maxLevel: 20, inset: 0,
    cost: { wood: 4 }, upgrade: { gold: 3, wood: 4 }, tierExtras: { 5: { stone: 2 }, 10: { bricks: 2 }, 15: { iron: 1 } },
    hpPerLevel: 0.5, wall: true,
    desc: 'Соседние секции одного уровня сливаются в цельный забор с общей прочностью. Тяни, чтобы поставить ряд.',
  },
  gate: {
    name: 'Ворота', category: 'defense', size: 1, hp: 220, unlock: 4, maxLevel: 20, inset: 0,
    cost: { wood: 15, stone: 10 }, upgrade: { gold: 6, wood: 6 }, tierExtras: { 5: { stone: 3 }, 10: { bricks: 3 }, 15: { iron: 2 } },
    hpPerLevel: 0.5, wall: true, gate: true,
    desc: 'Часть забора: герой и союзники проходят, враги — только ломают.',
  },
  spikes: {
    name: 'Шипастая ловушка', category: 'defense', size: 1, hp: 300, unlock: 5, maxLevel: 30, inset: 0,
    cost: { wood: 20, stone: 10 }, upgrade: { gold: 10, stone: 6 }, trap: { damage: 14, cooldown: 1 },
    desc: 'Враги проходят по ней и получают урон. Не мешает пути.',
  },
  archerTower: {
    name: 'Башня лучников', category: 'defense', size: 1, hp: 200, unlock: 1, maxLevel: 30, inset: 0.12,
    cost: { wood: 15, planks: 10 }, upgrade: { gold: 20, planks: 10 }, energyUse: 3, priority: 2,
    attack: { range: 6, damage: 9, cooldown: 0.85, projectile: 'arrow', speed: 15 },
    desc: 'Быстро стреляет по ближайшему врагу.',
    evolutions: towerEvo(
      { id: 'sniper', name: 'Башня снайперов', desc: '+40% урона, +1.5 дальности', mods: { damage: 1.4, range: 1.5 } },
      { id: 'volley', name: 'Залповая башня', desc: 'Стреляет по 2 целям', mods: { multishot: 1 } },
      { id: 'eagle', name: 'Орлиное гнездо', desc: 'Крит 25%: урон ×2.5', mods: { crit: 0.25 } },
      { id: 'rain', name: 'Ливень стрел', desc: '+1 цель, перезарядка −15%', mods: { multishot: 1, cooldown: 0.85 } },
      { id: 'storm', name: 'Око бури', desc: 'Урон ×1.8', mods: { damage: 1.8 } },
      { id: 'thousand', name: 'Цитадель тысячи стрел', desc: '+2 цели', mods: { multishot: 2 } },
    ),
  },
  ballista: {
    name: 'Баллиста', category: 'defense', size: 1, hp: 260, unlock: 12, maxLevel: 30, inset: 0.12,
    cost: { planks: 40, iron: 15, gold: 60 }, upgrade: { gold: 30, iron: 5 }, energyUse: 4, priority: 2,
    attack: { range: 8.5, damage: 45, cooldown: 2.6, projectile: 'bolt', speed: 20, pierce: 2, armorPierce: true },
    desc: 'Медленный мощный болт пробивает броню и нескольких врагов.',
    evolutions: towerEvo(
      { id: 'heavy', name: 'Тяжёлая баллиста', desc: 'Урон ×1.5', mods: { damage: 1.5 } },
      { id: 'repeater', name: 'Скорострельная баллиста', desc: 'Перезарядка −35%', mods: { cooldown: 0.65 } },
      { id: 'skewer', name: 'Нанизыватель', desc: '+3 пробития', mods: { pierce: 3 } },
      { id: 'siegebreaker', name: 'Сокрушитель осад', desc: 'Урон ×1.6', mods: { damage: 1.6 } },
      { id: 'dragonslayer', name: 'Драконобой', desc: 'Урон ×2', mods: { damage: 2 } },
      { id: 'scorpion', name: 'Скорпион', desc: 'Перезарядка −40%, +2 пробития', mods: { cooldown: 0.6, pierce: 2 } },
    ),
  },
  mageTower: {
    name: 'Башня магии', category: 'defense', size: 1, hp: 220, unlock: 15, maxLevel: 30, inset: 0.12,
    cost: { bricks: 40, crystal: 10, gold: 80 }, upgrade: { gold: 35, crystal: 3 }, energyUse: 5, priority: 2,
    attack: { range: 6.5, damage: 16, cooldown: 1.6, projectile: 'orb', speed: 9, splash: 1.4, magic: true },
    desc: 'Магические сферы бьют по области и игнорируют броню.',
    evolutions: towerEvo(
      { id: 'arcane', name: 'Шпиль чародея', desc: 'Урон ×1.4, область +0.5', mods: { damage: 1.4, splash: 0.5 } },
      { id: 'storm', name: 'Башня молний', desc: 'Цепная молния на 3 цели', mods: { chain: 3 } },
      { id: 'void', name: 'Око пустоты', desc: 'Урон ×1.5', mods: { damage: 1.5 } },
      { id: 'tesla', name: 'Громовой маяк', desc: '+3 цели цепи', mods: { chain: 3 } },
      { id: 'archmage', name: 'Обитель архимага', desc: 'Урон ×2, область +1', mods: { damage: 2, splash: 1 } },
      { id: 'heaven', name: 'Гнев небес', desc: '+5 целей цепи, перезарядка −20%', mods: { chain: 5, cooldown: 0.8 } },
    ),
  },
  fireTower: {
    name: 'Огненная жаровня', category: 'defense', size: 1, hp: 240, unlock: 25, maxLevel: 30, inset: 0.12,
    cost: { bricks: 60, iron: 30, coal: 40, gold: 120 }, upgrade: { gold: 40, coal: 10 }, energyUse: 4, priority: 2,
    attack: { range: 3.6, damage: 7, cooldown: 0.5, projectile: 'flame', splash: 3.6, burn: 6, magic: true },
    desc: 'Обдаёт пламенем всех врагов рядом и поджигает их.',
    evolutions: towerEvo(
      { id: 'inferno', name: 'Пекло', desc: 'Горение ×2', mods: { burn: 2 } },
      { id: 'wide', name: 'Огненное кольцо', desc: '+1.5 дальности', mods: { range: 1.5 } },
      { id: 'magma', name: 'Магмовая чаша', desc: 'Урон ×1.6', mods: { damage: 1.6 } },
      { id: 'phoenix', name: 'Гнездо феникса', desc: 'Горение ×2', mods: { burn: 2 } },
      { id: 'sun', name: 'Солнечный горн', desc: 'Урон ×2', mods: { damage: 2 } },
      { id: 'hell', name: 'Врата пекла', desc: '+2 дальности, горение ×1.5', mods: { range: 2, burn: 1.5 } },
    ),
  },
  frostTower: {
    name: 'Морозный шпиль', category: 'defense', size: 1, hp: 220, unlock: 20, maxLevel: 30, inset: 0.12,
    cost: { bricks: 50, crystal: 15, silver: 10, gold: 100 }, upgrade: { gold: 35, crystal: 3 }, energyUse: 3, priority: 2,
    attack: { range: 5.5, damage: 6, cooldown: 1.2, projectile: 'frost', speed: 11, splash: 1.6, slow: 0.4, slowTime: 2, magic: true },
    desc: 'Замедляет группы врагов ледяными осколками.',
    evolutions: towerEvo(
      { id: 'glacier', name: 'Ледник', desc: 'Замедление сильнее', mods: { slow: 0.15 } },
      { id: 'shards', name: 'Ледяные иглы', desc: 'Урон ×2', mods: { damage: 2 } },
      { id: 'blizzard', name: 'Буран', desc: 'Область +1.2', mods: { splash: 1.2 } },
      { id: 'freeze', name: 'Вечный холод', desc: 'Замедление дольше', mods: { slowTime: 1.5, slow: 0.1 } },
      { id: 'winter', name: 'Сердце зимы', desc: 'Урон ×2.5', mods: { damage: 2.5 } },
      { id: 'absolute', name: 'Абсолютный ноль', desc: 'Замедление и область максимальны', mods: { slow: 0.15, splash: 1.5 } },
    ),
  },
  watchTower: {
    name: 'Сторожевая башня', category: 'defense', size: 1, hp: 200, unlock: 22, maxLevel: 30, inset: 0.12,
    cost: { bricks: 40, silver: 10, gold: 100 }, upgrade: { gold: 30, silver: 3 }, energyUse: 2, priority: 3,
    aura: { radius: 5, damage: 0.2, range: 1 },
    desc: 'Усиливает башни в радиусе 5: +20% урона и +1 дальности (растёт с уровнем).',
  },

  // ---------- армия ----------
  barracks: {
    name: 'Казарма мечников', category: 'army', size: 2, hp: 300, unlock: 2, maxLevel: 30, inset: 0.15,
    cost: { wood: 30, planks: 15, gold: 20 }, upgrade: { gold: 30, planks: 15 },
    spawns: { unit: 'swordsman', count: 2, every: 4, respawn: 10, foodCost: 5, statsPerLevel: 0.15 },
    desc: 'Выпускает мечников. Враги в первую очередь нападают на них.',
    evolutions: {
      10: [
        { id: 'guards', name: 'Казарма стражей', desc: 'Здоровье воинов ×1.6', mods: { unitHp: 1.6 } },
        { id: 'berserk', name: 'Логово берсерков', desc: 'Урон воинов ×1.6', mods: { unitDmg: 1.6 } },
      ],
      20: [
        { id: 'paladins', name: 'Орден паладинов', desc: 'Здоровье ×1.6, +1 воин', mods: { unitHp: 1.6, units: 1 } },
        { id: 'blades', name: 'Школа клинков', desc: 'Урон ×1.7', mods: { unitDmg: 1.7 } },
      ],
      30: [
        { id: 'templars', name: 'Храм рыцарей Света', desc: 'Здоровье и урон ×1.5, +2 воина', mods: { unitHp: 1.5, unitDmg: 1.5, units: 2 } },
        { id: 'warlords', name: 'Чертог полководцев', desc: 'Урон ×2.2', mods: { unitDmg: 2.2 } },
      ],
    },
  },
  archeryRange: {
    name: 'Стрельбище', category: 'army', size: 2, hp: 260, unlock: 8, maxLevel: 30, inset: 0.15,
    cost: { wood: 60, planks: 30, gold: 50 }, upgrade: { gold: 30, planks: 15 },
    spawns: { unit: 'archer', count: 2, every: 5, respawn: 12, foodCost: 6, statsPerLevel: 0.15 },
    desc: 'Обучает лучников, которые стреляют из-за спин мечников.',
    evolutions: {
      10: [
        { id: 'rangers', name: 'Дом следопытов', desc: 'Дальность +1.5', mods: { unitRange: 1.5 } },
        { id: 'crossbows', name: 'Арбалетная школа', desc: 'Урон ×1.7', mods: { unitDmg: 1.7 } },
      ],
      20: [
        { id: 'hawks', name: 'Соколиные стрелки', desc: '+2 лучника', mods: { units: 2 } },
        { id: 'heavy', name: 'Тяжёлые арбалетчики', desc: 'Урон ×1.8', mods: { unitDmg: 1.8 } },
      ],
      30: [
        { id: 'elves', name: 'Лесные призраки', desc: '+3 лучника, дальность +1', mods: { units: 3, unitRange: 1 } },
        { id: 'siege', name: 'Стрелки осады', desc: 'Урон ×2.4', mods: { unitDmg: 2.4 } },
      ],
    },
  },
  sanctum: {
    name: 'Магическая обитель', category: 'army', size: 2, hp: 280, unlock: 30, maxLevel: 30, inset: 0.15,
    cost: { bricks: 80, crystal: 30, silver: 20, gold: 200 }, upgrade: { gold: 50, crystal: 5 },
    spawns: { unit: 'mage', count: 1, every: 6, respawn: 15, foodCost: 12, statsPerLevel: 0.15 },
    desc: 'Призывает боевых магов, бьющих по области.',
    evolutions: {
      10: [
        { id: 'pyro', name: 'Круг пиромантов', desc: 'Урон магов ×1.7', mods: { unitDmg: 1.7 } },
        { id: 'cryo', name: 'Круг криомантов', desc: '+1 маг, здоровье ×1.5', mods: { units: 1, unitHp: 1.5 } },
      ],
      20: [
        { id: 'conclave', name: 'Конклав', desc: '+2 мага', mods: { units: 2 } },
        { id: 'archons', name: 'Архонты', desc: 'Урон ×1.8', mods: { unitDmg: 1.8 } },
      ],
      30: [
        { id: 'ascended', name: 'Вознесённые', desc: 'Урон ×2.2', mods: { unitDmg: 2.2 } },
        { id: 'council', name: 'Совет Света', desc: '+3 мага', mods: { units: 3 } },
      ],
    },
  },

  // ---------- снаряжение героя ----------
  forge: {
    name: 'Кузня', category: 'hero', size: 2, hp: 280, unlock: 3, maxLevel: 30, inset: 0.15,
    cost: { wood: 40, stone: 30, gold: 30 }, upgrade: { gold: 30, stone: 15 },
    crafting: 'melee',
    desc: 'Изучает оружие ближнего боя: мечи, булавы, кинжалы, косы и алебарды.',
  },
  bowyer: {
    name: 'Мастерская стрелка', category: 'hero', size: 2, hp: 240, unlock: 6, maxLevel: 30, inset: 0.15,
    cost: { wood: 60, planks: 25, gold: 40 }, upgrade: { gold: 30, planks: 12 },
    crafting: 'ranged',
    desc: 'Изучает луки и арбалеты.',
  },
  arcanum: {
    name: 'Чародейская башня', category: 'hero', size: 2, hp: 240, unlock: 9, maxLevel: 30, inset: 0.15,
    cost: { planks: 40, stone: 40, gold: 60 }, upgrade: { gold: 35, essence: 2 },
    crafting: 'magic',
    desc: 'Изучает посохи огня, льда и молний.',
  },
  armory: {
    name: 'Бронная мастерская', category: 'hero', size: 2, hp: 280, unlock: 5, maxLevel: 30, inset: 0.15,
    cost: { wood: 50, stone: 40, gold: 50 }, upgrade: { gold: 30, stone: 15 },
    crafting: 'gear',
    desc: 'Куёт доспехи, амулеты и кольца для героя.',
  },
  trainingHall: {
    name: 'Тренировочный зал', category: 'hero', size: 2, hp: 240, unlock: 4, maxLevel: 30, inset: 0.15,
    cost: { wood: 50, planks: 20, gold: 30 }, upgrade: { gold: 25, food: 15 },
    training: { hp: 12, regen: 0.15, speed: 0.012, damage: 0.03 },
    desc: 'Каждый уровень: +12 здоровья, +3% урона, быстрее восстановление и бег героя.',
  },
};

export const BUILD_ORDER = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].buildable !== false);
