// Снаряжение героя. Оружие изучается в зданиях (кузня, мастерская стрелка, чародейская башня),
// доспехи и украшения — в бронной мастерской. Изученный предмет навсегда лежит в инвентаре.

// Как бьёт каждый вид оружия.
export const WEAPON_TYPES = {
  sword:    { name: 'Меч',      kind: 'slash',  arc: Math.PI * 2, range: 1.7, cooldown: 0.55, nodeDamage: 2, desc: 'Круговой удар по всем рядом.' },
  mace:     { name: 'Булава',   kind: 'smash',  arc: Math.PI * 1.1, range: 1.8, cooldown: 0.95, nodeDamage: 3, stun: 0.35, desc: 'Тяжёлый удар перед собой, может оглушить.' },
  daggers:  { name: 'Кинжалы',  kind: 'stab',   arc: Math.PI * 0.8, range: 1.35, cooldown: 0.32, nodeDamage: 1, crit: 0.25, hits: 2, desc: 'Два быстрых укола, частые критические удары.' },
  scythe:   { name: 'Коса',     kind: 'reap',   arc: Math.PI * 2, range: 2.3, cooldown: 0.85, nodeDamage: 1, lifesteal: 0.08, desc: 'Широкий взмах, лечит героя от урона.' },
  halberd:  { name: 'Алебарда', kind: 'thrust', arc: 0, range: 2.9, cooldown: 0.75, nodeDamage: 2, width: 0.7, desc: 'Длинный выпад пронзает всех на линии.' },
  bow:      { name: 'Лук',      kind: 'arrow',  range: 8, cooldown: 0.5, speed: 16, nodeDamage: 1, desc: 'Быстрые стрелы издалека.' },
  crossbow: { name: 'Арбалет',  kind: 'bolt',   range: 9, cooldown: 1.1, speed: 22, nodeDamage: 1, pierce: 3, desc: 'Медленный болт пробивает троих.' },
  fireStaff:      { name: 'Посох огня',   kind: 'fireball', range: 7, cooldown: 0.9, speed: 9, nodeDamage: 1, aoe: 1.3, desc: 'Огненный шар взрывается по области.' },
  frostStaff:     { name: 'Посох льда',   kind: 'ice',      range: 7, cooldown: 0.8, speed: 11, nodeDamage: 1, aoe: 1.1, slow: 0.45, desc: 'Ледяной снаряд замедляет врагов.' },
  lightningStaff: { name: 'Посох молний', kind: 'lightning', range: 6.5, cooldown: 0.75, nodeDamage: 1, chain: 3, desc: 'Молния перескакивает на соседних врагов.' },
};

// Множитель силы по тиру предмета.
export const TIER_POWER = [0, 1, 1.6, 2.6, 4.2, 6.8, 11, 18];

const w = (id, wtype, tier, name, building, level, cost, extra = {}) =>
  ({ id, slot: 'weapon', wtype, tier, name, building, level, cost, ...extra });

// damage — базовый урон до множителя тира.
export const BASE_DAMAGE = {
  sword: 12, mace: 22, daggers: 7, scythe: 15, halberd: 16, bow: 10, crossbow: 26, fireStaff: 14, frostStaff: 10, lightningStaff: 11,
};

export const ITEMS = {
  // мечи
  swordWood:   w('swordWood', 'sword', 1, 'Деревянный меч', 'forge', 1, null),
  swordSteel:  w('swordSteel', 'sword', 2, 'Закалённый меч', 'forge', 1, { planks: 15, stone: 15, gold: 25 }),
  swordIron:   w('swordIron', 'sword', 3, 'Железный меч', 'forge', 5, { iron: 15, planks: 10, gold: 80 }),
  swordSilver: w('swordSilver', 'sword', 4, 'Серебряный клинок', 'forge', 10, { silver: 20, iron: 15, gold: 200 }),
  swordMithril: w('swordMithril', 'sword', 5, 'Мифриловый меч', 'forge', 15, { mithril: 20, silver: 10, gold: 450 }),
  swordStar:   w('swordStar', 'sword', 6, 'Звёздный клинок', 'forge', 20, { starmetal: 20, mithril: 15, gold: 900 }),
  swordDawn:   w('swordDawn', 'sword', 7, '«Последний Рассвет»', 'forge', 30, { starmetal: 60, essence: 60, crystal: 40, gold: 2500 }),
  // булавы
  maceClub:    w('maceClub', 'mace', 2, 'Окованная дубина', 'forge', 2, { planks: 20, stone: 20, gold: 30 }),
  maceIron:    w('maceIron', 'mace', 3, 'Железная булава', 'forge', 6, { iron: 20, gold: 90 }),
  maceSilver:  w('maceSilver', 'mace', 4, 'Серебряный моргенштерн', 'forge', 11, { silver: 22, iron: 15, gold: 220 }),
  maceMithril: w('maceMithril', 'mace', 5, 'Мифриловый молот', 'forge', 16, { mithril: 22, gold: 480 }),
  maceAnvil:   w('maceAnvil', 'mace', 7, '«Гнев Наковальни»', 'forge', 28, { starmetal: 55, mithril: 30, gold: 2300 }),
  // парные кинжалы
  daggersKnives: w('daggersKnives', 'daggers', 2, 'Пара ножей', 'forge', 3, { planks: 10, stone: 20, gold: 35 }),
  daggersIron:  w('daggersIron', 'daggers', 3, 'Железные кинжалы', 'forge', 7, { iron: 18, gold: 100 }),
  daggersMoon:  w('daggersMoon', 'daggers', 4, 'Лунные клыки', 'forge', 12, { silver: 25, crystal: 8, gold: 240 }),
  daggersMithril: w('daggersMithril', 'daggers', 5, 'Мифриловые жала', 'forge', 17, { mithril: 20, essence: 10, gold: 500 }),
  daggersMist:  w('daggersMist', 'daggers', 6, '«Шёпот Мглы»', 'forge', 24, { starmetal: 25, essence: 40, gold: 1200 }),
  // косы
  scytheSickle: w('scytheSickle', 'scythe', 2, 'Серп жнеца', 'forge', 4, { planks: 20, stone: 15, gold: 40 }),
  scytheIron:  w('scytheIron', 'scythe', 3, 'Железная коса', 'forge', 8, { iron: 20, planks: 10, gold: 110 }),
  scytheMoon:  w('scytheMoon', 'scythe', 4, 'Коса лунного жнеца', 'forge', 13, { silver: 25, essence: 10, gold: 260 }),
  scytheMithril: w('scytheMithril', 'scythe', 5, 'Мифриловая коса', 'forge', 18, { mithril: 24, essence: 15, gold: 520 }),
  scytheStars: w('scytheStars', 'scythe', 7, '«Жатва Звёзд»', 'forge', 30, { starmetal: 60, essence: 70, gold: 2600 }),
  // алебарды
  halberdSpear: w('halberdSpear', 'halberd', 2, 'Рогатина', 'forge', 4, { planks: 25, stone: 10, gold: 40 }),
  halberdIron: w('halberdIron', 'halberd', 3, 'Железная алебарда', 'forge', 9, { iron: 22, planks: 10, gold: 120 }),
  halberdSilver: w('halberdSilver', 'halberd', 4, 'Серебряная глефа', 'forge', 14, { silver: 26, iron: 10, gold: 280 }),
  halberdMithril: w('halberdMithril', 'halberd', 5, 'Мифриловая алебарда', 'forge', 19, { mithril: 26, gold: 540 }),
  halberdDawn: w('halberdDawn', 'halberd', 7, '«Страж Рассвета»', 'forge', 29, { starmetal: 58, crystal: 40, gold: 2500 }),
  // луки
  bowSimple:   w('bowSimple', 'bow', 1, 'Простой лук', 'bowyer', 1, { wood: 20, planks: 10, gold: 15 }),
  bowHunter:   w('bowHunter', 'bow', 2, 'Охотничий лук', 'bowyer', 2, { planks: 25, bones: 15, gold: 40 }),
  bowComposite: w('bowComposite', 'bow', 3, 'Композитный лук', 'bowyer', 6, { iron: 12, planks: 20, gold: 100 }),
  bowMoon:     w('bowMoon', 'bow', 4, 'Лунный лук', 'bowyer', 11, { silver: 22, crystal: 8, gold: 240 }),
  bowMithril:  w('bowMithril', 'bow', 5, 'Мифриловый лук', 'bowyer', 16, { mithril: 20, gold: 480 }),
  bowStar:     w('bowStar', 'bow', 7, '«Падающая звезда»', 'bowyer', 28, { starmetal: 55, crystal: 40, gold: 2400 }),
  // арбалеты
  crossLight:  w('crossLight', 'crossbow', 3, 'Лёгкий арбалет', 'bowyer', 8, { iron: 15, parts: 4, gold: 120 }),
  crossHeavy:  w('crossHeavy', 'crossbow', 4, 'Тяжёлый арбалет', 'bowyer', 12, { iron: 20, parts: 10, silver: 10, gold: 260 }),
  crossMithril: w('crossMithril', 'crossbow', 5, 'Мифриловый арбалет', 'bowyer', 18, { mithril: 22, parts: 15, gold: 520 }),
  crossThunder: w('crossThunder', 'crossbow', 7, '«Гром Бастиона»', 'bowyer', 30, { starmetal: 60, parts: 40, gold: 2600 }),
  // посохи
  staffEmber:  w('staffEmber', 'fireStaff', 2, 'Посох углей', 'arcanum', 1, { planks: 20, bones: 20, gold: 40 }),
  staffFlame:  w('staffFlame', 'fireStaff', 4, 'Пламенный посох', 'arcanum', 10, { crystal: 20, essence: 15, gold: 240 }),
  staffPhoenix: w('staffPhoenix', 'fireStaff', 7, '«Сердце Феникса»', 'arcanum', 28, { starmetal: 50, essence: 70, gold: 2400 }),
  staffIce:    w('staffIce', 'frostStaff', 3, 'Ледяной жезл', 'arcanum', 4, { crystal: 10, essence: 6, gold: 110 }),
  staffWinter: w('staffWinter', 'frostStaff', 5, 'Посох зимы', 'arcanum', 15, { crystal: 25, silver: 15, essence: 20, gold: 480 }),
  staffFrozen: w('staffFrozen', 'frostStaff', 7, '«Вечная Мерзлота»', 'arcanum', 29, { starmetal: 50, crystal: 50, gold: 2400 }),
  staffSpark:  w('staffSpark', 'lightningStaff', 3, 'Посох искр', 'arcanum', 6, { crystal: 10, iron: 10, gold: 120 }),
  staffStorm:  w('staffStorm', 'lightningStaff', 5, 'Посох бури', 'arcanum', 17, { silver: 25, crystal: 25, essence: 20, gold: 500 }),
  staffHeaven: w('staffHeaven', 'lightningStaff', 7, '«Гнев Небес»', 'arcanum', 30, { starmetal: 60, essence: 60, gold: 2600 }),

  // доспехи: armor — снижение урона (в единицах), hp — к здоровью
  armorQuilt:  { id: 'armorQuilt', slot: 'armor', tier: 1, name: 'Стёганка', building: 'armory', level: 1, cost: { wood: 10, food: 15, gold: 20 }, stats: { armor: 1, hp: 20 } },
  armorLeather: { id: 'armorLeather', slot: 'armor', tier: 2, name: 'Кожаный доспех', building: 'armory', level: 3, cost: { bones: 30, planks: 10, gold: 60 }, stats: { armor: 2, hp: 45 } },
  armorChain:  { id: 'armorChain', slot: 'armor', tier: 3, name: 'Кольчуга', building: 'armory', level: 7, cost: { iron: 25, gold: 150 }, stats: { armor: 4, hp: 90 } },
  armorPlate:  { id: 'armorPlate', slot: 'armor', tier: 4, name: 'Латы лунной стражи', building: 'armory', level: 12, cost: { silver: 30, iron: 20, gold: 320 }, stats: { armor: 7, hp: 170 } },
  armorMithril: { id: 'armorMithril', slot: 'armor', tier: 5, name: 'Мифриловые латы', building: 'armory', level: 17, cost: { mithril: 30, gold: 600 }, stats: { armor: 11, hp: 300 } },
  armorDawn:   { id: 'armorDawn', slot: 'armor', tier: 7, name: '«Доспех Светоносца»', building: 'armory', level: 30, cost: { starmetal: 60, mithril: 40, crystal: 40, gold: 2800 }, stats: { armor: 24, hp: 900, regen: 6 } },
  // амулеты
  amuletLife:  { id: 'amuletLife', slot: 'amulet', tier: 2, name: 'Амулет жизни', building: 'armory', level: 2, cost: { bones: 20, food: 30, gold: 50 }, stats: { hp: 40, regen: 1 } },
  amuletRage:  { id: 'amuletRage', slot: 'amulet', tier: 3, name: 'Амулет ярости', building: 'armory', level: 6, cost: { iron: 10, essence: 8, gold: 140 }, stats: { damage: 0.15 } },
  amuletMoon:  { id: 'amuletMoon', slot: 'amulet', tier: 4, name: 'Лунный амулет', building: 'armory', level: 11, cost: { silver: 20, crystal: 15, gold: 300 }, stats: { damage: 0.2, hp: 80, regen: 2 } },
  amuletStar:  { id: 'amuletStar', slot: 'amulet', tier: 6, name: 'Слеза звезды', building: 'armory', level: 22, cost: { starmetal: 25, crystal: 30, gold: 1200 }, stats: { damage: 0.4, hp: 250, regen: 4 } },
  // кольца
  ringSwift:   { id: 'ringSwift', slot: 'ring', tier: 2, name: 'Кольцо странника', building: 'armory', level: 3, cost: { stone: 20, bones: 15, gold: 60 }, stats: { speed: 0.1 } },
  ringLuck:    { id: 'ringLuck', slot: 'ring', tier: 3, name: 'Кольцо удачи', building: 'armory', level: 8, cost: { iron: 12, crystal: 5, gold: 160 }, stats: { goldFind: 0.25, crit: 0.08 } },
  ringHaste:   { id: 'ringHaste', slot: 'ring', tier: 4, name: 'Кольцо быстроты', building: 'armory', level: 13, cost: { silver: 20, essence: 12, gold: 320 }, stats: { attackSpeed: 0.2, speed: 0.08 } },
  ringMithril: { id: 'ringMithril', slot: 'ring', tier: 5, name: 'Мифриловый перстень', building: 'armory', level: 18, cost: { mithril: 18, essence: 20, gold: 600 }, stats: { crit: 0.15, attackSpeed: 0.15, damage: 0.15 } },
  ringDawn:    { id: 'ringDawn', slot: 'ring', tier: 7, name: '«Печать Рассвета»', building: 'armory', level: 29, cost: { starmetal: 40, essence: 50, gold: 2400 }, stats: { crit: 0.3, attackSpeed: 0.35, damage: 0.35, goldFind: 0.5 } },

  // особые (магазин)
  swordFounder: w('swordFounder', 'sword', 4, 'Клинок Основателя', null, 0, null, { special: true }),
};

export const CRAFT_LINES = {
  melee: { name: 'Ближний бой', types: ['sword', 'mace', 'daggers', 'scythe', 'halberd'] },
  ranged: { name: 'Стрелковое', types: ['bow', 'crossbow'] },
  magic: { name: 'Посохи', types: ['fireStaff', 'frostStaff', 'lightningStaff'] },
  gear: { name: 'Снаряжение', slots: ['armor', 'amulet', 'ring'] },
};

export const EQUIP_SLOTS = [
  { id: 'weapon', name: 'Оружие' },
  { id: 'armor', name: 'Доспех' },
  { id: 'amulet', name: 'Амулет' },
  { id: 'ring', name: 'Кольцо' },
];

export const STARTING_ITEMS = ['swordWood'];
