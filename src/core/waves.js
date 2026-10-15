import { createRng } from './rng.js';
import { WAVES, ENEMIES } from '../config.js';

export const SIDES = ['N', 'E', 'S', 'W'];
export const SIDE_NAMES = { N: 'север', E: 'восток', S: 'юг', W: 'запад' };
export const SIDE_VECTORS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

// План волны полностью определяется её номером: повтор волны — тот же состав.
export function generateWave(n, cfg = WAVES, enemies = ENEMIES) {
  const rng = createRng(n * 7919 + 17);

  const rule = cfg.kindRules.find((r) => n % r.every === 0);
  const kindId = rule ? rule.kind : 'normal';
  const kind = cfg.kinds[kindId];

  let event = null;
  for (const e of cfg.events) {
    if (n >= e.fromWave && rng.next() < e.chance) {
      event = e;
      break;
    }
  }

  const sideCount = cfg.sides.filter((s) => n >= s.from).pop().count;
  const sides = [...SIDES];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  const activeSides = sides.slice(0, sideCount).sort((a, b) => SIDES.indexOf(a) - SIDES.indexOf(b));

  const b = cfg.budget;
  let budget = (b.base + b.perWave * n + b.quad * n * n) * kind.budget * (event ? event.budget : 1);
  const pool = Object.entries(enemies).filter(([, e]) => e.weight > 0 && n >= e.fromWave);
  const counts = {};
  const order = [];
  while (budget > 0.5 && pool.length) {
    const affordable = pool.filter(([, e]) => e.points <= budget + 0.5);
    if (!affordable.length) break;
    const total = affordable.reduce((s, [, e]) => s + e.weight, 0);
    let roll = rng.next() * total;
    let picked = affordable[0];
    for (const p of affordable) {
      roll -= p[1].weight;
      if (roll <= 0) { picked = p; break; }
    }
    counts[picked[0]] = (counts[picked[0]] || 0) + 1;
    order.push(picked[0]);
    budget -= picked[1].points;
  }

  const boss = n % cfg.bossEvery === 0;
  const spawns = order.map((type, i) => ({
    type,
    side: activeSides[i % activeSides.length],
    at: order.length > 1 ? (i / (order.length - 1)) * kind.spawnSeconds + rng.range(-0.3, 0.3) : 0,
    offset: rng.range(-3, 3),
  }));
  if (boss) {
    counts[cfg.bossType] = 1;
    spawns.push({ type: cfg.bossType, side: activeSides[0], at: kind.spawnSeconds * 0.5, offset: 0 });
  }
  spawns.sort((a, c) => a.at - c.at);
  for (const s of spawns) s.at = Math.max(0, s.at);

  const rewardMult = kind.reward * (event ? event.reward : 1);
  const r = cfg.rewards;
  return {
    number: n,
    kind: kindId,
    kindName: kind.name,
    event,
    boss,
    sides: activeSides,
    counts,
    spawns,
    total: spawns.length,
    hpMult: (1 + cfg.hpGrowth * (n - 1)) * (event ? event.hp : 1),
    damageMult: 1 + cfg.damageGrowth * (n - 1),
    speedMult: event ? event.speed : 1,
    rewards: {
      gold: Math.round((r.gold.base + r.gold.perWave * n) * rewardMult),
      wood: Math.round((r.wood.base + r.wood.perWave * n) * rewardMult),
      shards: Math.round((r.shards.base + r.shards.perWave * n) * rewardMult),
    },
  };
}
