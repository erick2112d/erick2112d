// Характеристики построек с учётом уровня, эволюций и ауры сторожевых башен.
import { BUILDINGS } from '../data/index.js';

const MUL_KEYS = new Set(['damage', 'cooldown', 'energyOut', 'output', 'unitHp', 'unitDmg', 'speed', 'gather', 'carry', 'burn', 'slowTime']);

export function evoMods(b) {
  const cfg = BUILDINGS[b.type];
  const mods = {};
  if (!cfg.evolutions || !b.evo) return mods;
  for (const [tier, choice] of Object.entries(b.evo)) {
    const opt = cfg.evolutions[tier]?.find((o) => o.id === choice);
    if (!opt) continue;
    for (const [k, v] of Object.entries(opt.mods)) {
      if (MUL_KEYS.has(k)) mods[k] = (mods[k] ?? 1) * v;
      else mods[k] = (mods[k] ?? 0) + v;
    }
  }
  return mods;
}

export const mod = (m, k) => (MUL_KEYS.has(k) ? (m[k] ?? 1) : (m[k] ?? 0));

// Текущее название с учётом последней выбранной эволюции.
export function buildingName(b) {
  const cfg = BUILDINGS[b.type];
  if (!cfg.evolutions || !b.evo) return cfg.name;
  let name = cfg.name;
  for (const tier of [10, 20, 30]) {
    const id = b.evo[tier];
    const opt = id && cfg.evolutions[tier]?.find((o) => o.id === id);
    if (opt) name = opt.name;
  }
  return name;
}

export function evoPath(b) {
  // 'a' или 'b' по первому выбору — для оттенка в графике
  const cfg = BUILDINGS[b.type];
  const first = b.evo?.[10];
  if (!first || !cfg.evolutions) return null;
  return cfg.evolutions[10][0].id === first ? 'a' : 'b';
}

export function towerStats(b) {
  const cfg = BUILDINGS[b.type];
  const a = cfg.attack;
  if (!a) return null;
  const m = evoMods(b);
  const L = b.level;
  const aura = b.aura || { damage: 0, range: 0 };
  return {
    range: a.range + 0.08 * (L - 1) + mod(m, 'range') + aura.range,
    damage: a.damage * (1 + 0.15 * (L - 1)) * mod(m, 'damage') * (1 + aura.damage),
    cooldown: a.cooldown * mod(m, 'cooldown'),
    projectile: a.projectile,
    speed: a.speed || 12,
    splash: (a.splash || 0) + mod(m, 'splash'),
    slow: Math.min(0.85, (a.slow || 0) + mod(m, 'slow')),
    slowTime: (a.slowTime || 0) * mod(m, 'slowTime'),
    burn: (a.burn || 0) * (1 + 0.15 * (L - 1)) * mod(m, 'burn'),
    pierce: (a.pierce || 0) + mod(m, 'pierce'),
    multishot: 1 + mod(m, 'multishot'),
    crit: mod(m, 'crit'),
    chain: mod(m, 'chain'),
    armorPierce: !!a.armorPierce,
    magic: !!a.magic,
  };
}

export function hpFor(type, level) {
  const cfg = BUILDINGS[type];
  if (type === 'heart') return 0; // считается в heartMaxHp
  return Math.round(cfg.hp * (1 + (cfg.hpPerLevel ?? 0.2) * (level - 1)));
}
