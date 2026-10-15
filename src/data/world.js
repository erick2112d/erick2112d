// Карта, зоны, природные ресурсы и рост Сердца Светоча.

export const WORLD = {
  width: 80,
  height: 80,
  heart: { tx: 39, ty: 39 },          // левый верхний угол Сердца (3×3), центр — 40.5
  startResources: { gold: 20, gems: 10, food: 30, wood: 30 },
  baseStorage: 300,                    // предел каждого материала
  storagePerHeartLevel: 40,
  heroRespawnSeconds: 5,
  heroRegenPerSecond: 3,
  repairWoodPerHp: 0.1,
  demolishRefund: 0.5,
  manualRepairMultiplier: 1.5,
  heartRestoreAfterDefeat: 0.35,
  autoSaveSeconds: 15,
  flowWallPenalty: 10,
  gemDropWeights: [50, 35, 15],        // шанс 0 / 1 / 2 самоцветов за победу (в процентах)
  gemPerValue: 8,                      // 1 самоцвет ≈ 8 монет ценности при постройке за самоцветы
};

// Сердце Светоча: 100 уровней, на 100-м свет покрывает всю карту.
export const HEART = {
  maxLevel: 100,
  radiusStart: 7.5,
  radiusEnd: 58,
  hp: 900,
  hpPerLevel: 60,
  // цена улучшения L→L+1: база(L) × вес материала текущего «пояса» (+ половина весов прошлого пояса)
  base: { amount: 25, growth: 1.045 },
  gold: { amount: 40, growth: 1.05 },
  food: { amount: 20, growth: 1.045 },
  bands: [
    { from: 1, mats: { wood: 1, stone: 0.6 } },
    { from: 10, mats: { planks: 0.7, bricks: 0.5 } },
    { from: 25, mats: { iron: 0.4, coal: 0.4 } },
    { from: 45, mats: { crystal: 0.25, silver: 0.25 } },
    { from: 65, mats: { mithril: 0.12, essence: 0.15 } },
    { from: 85, mats: { starmetal: 0.06, mithril: 0.08 } },
  ],
};

export function heartRadius(level) {
  const k = (Math.min(level, HEART.maxLevel) - 1) / (HEART.maxLevel - 1);
  return HEART.radiusStart + (HEART.radiusEnd - HEART.radiusStart) * k;
}

// Природные ресурсы. tool — чем добывают рабочие; collider — радиус ствола/камня.
export const NODES = {
  tree:     { name: 'Дерево',              res: 'wood',       hp: 4,  perHit: 2, onBreak: 4, tool: 'axe',     collider: 0.26 },
  bush:     { name: 'Ягодный куст',        res: 'food',       hp: 2,  perHit: 2, onBreak: 3, tool: 'axe',     collider: 0.24 },
  rock:     { name: 'Валун',               res: 'stone',      hp: 6,  perHit: 1, onBreak: 4, tool: 'pickaxe', collider: 0.36 },
  ironVein: { name: 'Железная жила',       res: 'ore',        hp: 8,  perHit: 1, onBreak: 5, tool: 'pickaxe', collider: 0.38 },
  coalSeam: { name: 'Угольный пласт',      res: 'coal',       hp: 8,  perHit: 1, onBreak: 5, tool: 'pickaxe', collider: 0.38 },
  crystal:  { name: 'Друза светокристаллов', res: 'crystal',  hp: 10, perHit: 1, onBreak: 4, tool: 'pickaxe', collider: 0.36 },
  silver:   { name: 'Жила лунного серебра', res: 'silver',    hp: 10, perHit: 1, onBreak: 4, tool: 'pickaxe', collider: 0.38 },
  mithril:  { name: 'Мифриловая жила',     res: 'mithrilOre', hp: 12, perHit: 1, onBreak: 4, tool: 'pickaxe', collider: 0.4 },
  meteor:   { name: 'Обломок звезды',      res: 'starmetal',  hp: 16, perHit: 1, onBreak: 3, tool: 'pickaxe', collider: 0.42 },
};

// Кольца карты вокруг Сердца. Узлы появляются только на освещённой земле, до предела cap.
export const ZONES = [
  { id: 1, name: 'Последний приют',  rMin: 0,  rMax: 13, ground: '#26352a', nodes: { tree: 22, bush: 6, rock: 7 } },
  { id: 2, name: 'Ржавые холмы',      rMin: 13, rMax: 22, ground: '#33302a', nodes: { tree: 14, rock: 8, ironVein: 8, coalSeam: 8, bush: 4 } },
  { id: 3, name: 'Лунные пустоши',    rMin: 22, rMax: 32, ground: '#2a2f3d', nodes: { tree: 10, rock: 6, crystal: 8, silver: 8, bush: 3 } },
  { id: 4, name: 'Мифриловые кряжи',  rMin: 32, rMax: 44, ground: '#24343a', nodes: { tree: 10, rock: 6, mithril: 10, crystal: 4 } },
  { id: 5, name: 'Кратер Звезды',     rMin: 44, rMax: 60, ground: '#33263a', nodes: { tree: 8, meteor: 9, mithril: 5, silver: 4 } },
];

export const NODE_RESPAWN_SECONDS = 9; // раз в столько секунд в каждой зоне может вырасти новый узел
