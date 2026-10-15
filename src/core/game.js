// Игровая симуляция «Последнего Светоча». Не знает ничего о DOM и отрисовке:
// презентация читает состояние и забирает события через drainEvents().
import {
  WORLD, BUILDINGS, NODES, UNITS, WEAPONS, ENEMIES, BEACONS, STORY, RESOURCES,
} from '../config.js';
import { createRng } from './rng.js';
import { allocateEnergy } from './energy.js';
import { buildFlowField, nextCell, findPath } from './flowfield.js';
import { generateWave, SIDE_VECTORS } from './waves.js';

export const SAVE_VERSION = 1;
const CAPPED = ['wood', 'planks', 'stone'];
const UPGRADE_GROWTH = 1.6;

export class Game {
  constructor(saveData = null) {
    this.W = WORLD.width;
    this.H = WORLD.height;
    this.time = 0;
    this.nextId = 1;
    this.events = [];
    this.res = { ...WORLD.startResources };
    this.buildings = [];
    this.nodes = [];
    this.enemies = [];
    this.allies = [];
    this.repairers = [];
    this.projectiles = [];
    this.grid = new Int32Array(this.W * this.H);      // id постройки
    this.nodeGrid = new Int32Array(this.W * this.H);  // id дерева/камня
    this.phase = 'build';
    this.wave = null;
    this.lastResult = null;
    this.progress = { highestCleared: 0, nextWave: 1, defeats: 0 };
    this.unlocked = new Set(Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].buildable !== false && !BUILDINGS[k].locked));
    this.story = { seen: [], unread: [] };
    this.settings = { auto: true };
    this.energy = { supply: 0, demand: 0, deficit: 0, used: 0 };
    this.beacons = BEACONS.map((cfg) => ({ id: cfg.id, cfg, state: 'hidden', buildingId: 0 }));
    this.flowDirty = true;
    this.flow = null;
    this.repairBlocked = false;
    this.hero = this.makeHero();

    if (saveData) this.load(saveData);
    else this.newGame();
    this.recomputeEnergy();
  }

  // ---------- создание мира ----------

  newGame() {
    const h = WORLD.heart;
    this.addBuilding('heart', h.tx, h.ty, { free: true });
    const c = this.heartCenter();
    const rng = createRng(4242);
    this.scatterNodes(rng, 'tree', 12, c.x, c.y, 3.6, WORLD.startRadius - 0.8);
    this.unlockStory('intro');
    this.hero.x = c.x;
    this.hero.y = c.y + 2.6;
  }

  scatterNodes(rng, kind, count, cx, cy, rMin, rMax) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 60; tries++) {
      const a = rng.next() * Math.PI * 2;
      const r = rng.range(rMin, rMax);
      const tx = Math.floor(cx + Math.cos(a) * r);
      const ty = Math.floor(cy + Math.sin(a) * r);
      if (!this.inBounds(tx, ty)) continue;
      const i = this.idx(tx, ty);
      if (this.grid[i] || this.nodeGrid[i]) continue;
      // не ставим вплотную друг к другу, чтобы оставались проходы
      let crowded = false;
      for (let dy = -1; dy <= 1 && !crowded; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (this.inBounds(tx + dx, ty + dy) && this.nodeGrid[this.idx(tx + dx, ty + dy)]) { crowded = true; break; }
        }
      }
      if (crowded) continue;
      this.addNode(kind, tx, ty);
      placed++;
    }
  }

  addNode(kind, tx, ty, hp) {
    const cfg = NODES[kind];
    const n = { id: this.nextId++, kind, tx, ty, x: tx + 0.5, y: ty + 0.5, hp: hp ?? cfg.hp, maxHp: cfg.hp, regrow: 0, hitTime: -9 };
    if (n.hp <= 0) n.regrow = cfg.regrowSeconds;
    this.nodes.push(n);
    this.nodeGrid[this.idx(tx, ty)] = n.id;
    this.flowDirty = true;
    return n;
  }

  makeHero() {
    return {
      id: 0, x: 0, y: 0, vx: 0, vy: 0, r: UNITS.hero.radius, hp: UNITS.hero.hp, maxHp: UNITS.hero.hp,
      weapon: 'sword', cd: 0, facing: 1, aimX: 1, aimY: 0, dead: false, respawn: 0,
      input: { x: 0, y: 0 }, moveTarget: null, attackAt: null, attackHeld: false,
      attackTime: -9, hitTime: -9, moving: false, kind: 'hero',
    };
  }

  // ---------- вспомогательное ----------

  idx(tx, ty) { return tx + ty * this.W; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H; }
  heart() { return this.buildings[0]; }
  heartCenter() { return this.center(this.heart()); }
  center(b) { const s = b.size; return { x: b.tx + s / 2, y: b.ty + s / 2 }; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  byId(id) { return this.buildings.find((b) => b.id === id); }
  nodeById(id) { return this.nodes.find((n) => n.id === id); }

  territory() {
    const c = this.heartCenter();
    const circles = [{ x: c.x, y: c.y, r: WORLD.startRadius }];
    for (const bc of this.beacons) {
      if (bc.state === 'lit') circles.push({ x: bc.cfg.tx + 1, y: bc.cfg.ty + 1, r: bc.cfg.radius });
    }
    return circles;
  }

  inTerritory(x, y) {
    return this.territory().some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r);
  }

  buildingAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    const id = this.grid[this.idx(tx, ty)];
    return id ? this.byId(id) : null;
  }

  nodeAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    const id = this.nodeGrid[this.idx(tx, ty)];
    return id ? this.nodeById(id) : null;
  }

  isSolidCell(i) {
    const bid = this.grid[i];
    if (bid) {
      const b = this.byId(bid);
      if (b && !b.destroyed) return true;
    }
    const nid = this.nodeGrid[i];
    if (nid) {
      const n = this.nodeById(nid);
      if (n && n.hp > 0) return true;
    }
    return false;
  }

  distToRect(x, y, b) {
    const dx = Math.max(b.tx - x, 0, x - (b.tx + b.size));
    const dy = Math.max(b.ty - y, 0, y - (b.ty + b.size));
    return Math.hypot(dx, dy);
  }

  canAfford(cost) {
    return Object.entries(cost).every(([k, v]) => (this.res[k] || 0) >= v);
  }

  missing(cost) {
    return Object.entries(cost)
      .filter(([k, v]) => (this.res[k] || 0) < v)
      .map(([k, v]) => `${RESOURCES[k].name.toLowerCase()} ${v - Math.floor(this.res[k] || 0)}`);
  }

  pay(cost) {
    for (const [k, v] of Object.entries(cost)) this.res[k] -= v;
  }

  addRes(k, v) {
    const cap = CAPPED.includes(k) ? WORLD.storageCap : Infinity;
    this.res[k] = Math.min(cap, (this.res[k] || 0) + v);
  }

  // ---------- постройки ----------

  addBuilding(type, tx, ty, { free = false } = {}) {
    const cfg = BUILDINGS[type];
    const b = {
      id: this.nextId++, type, tx, ty, size: cfg.size, level: 1,
      maxHp: cfg.hp, hp: cfg.hp, destroyed: false, enabled: true,
      priority: cfg.priority ?? 1, powered: !cfg.energyUse, status: 'working',
      progress: 0, cd: 0, spawnTimer: 1, builtTime: this.time, hitTime: -9, workTime: -9,
      reserve: cfg.recipe?.reserve ?? 0,
    };
    this.buildings.push(b);
    for (let y = ty; y < ty + cfg.size; y++) {
      for (let x = tx; x < tx + cfg.size; x++) this.grid[this.idx(x, y)] = b.id;
    }
    this.flowDirty = true;
    if (!free) this.emit('built', { id: b.id, x: tx + cfg.size / 2, y: ty + cfg.size / 2, building: type });
    return b;
  }

  canPlace(type, tx, ty) {
    const cfg = BUILDINGS[type];
    if (!cfg || cfg.buildable === false) return { ok: false, reason: 'Это нельзя построить' };
    if (!this.unlocked.has(type)) return { ok: false, reason: 'Ещё не открыто' };
    if (this.phase === 'wave' && type !== 'wall') {
      // строить можно и в бою — это часть тактики, ограничений нет
    }
    for (let y = ty; y < ty + cfg.size; y++) {
      for (let x = tx; x < tx + cfg.size; x++) {
        if (!this.inBounds(x, y)) return { ok: false, reason: 'За краем карты' };
        if (!this.inTerritory(x + 0.5, y + 0.5)) return { ok: false, reason: 'Только на освещённой земле' };
        if (this.grid[this.idx(x, y)]) return { ok: false, reason: 'Место занято' };
        if (this.nodeGrid[this.idx(x, y)]) return { ok: false, reason: 'Мешает дерево или камень' };
      }
    }
    if (!this.canAfford(cfg.cost)) return { ok: false, reason: 'Не хватает: ' + this.missing(cfg.cost).join(', '), noMoney: true };
    return { ok: true };
  }

  // Ближайшее к точке место, где постройку можно поставить (без учёта цены).
  findSpot(type, x, y, minDist = 0) {
    const size = BUILDINGS[type].size;
    let best = null;
    let bd = Infinity;
    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
        const d = Math.hypot(tx + size / 2 - x, ty + size / 2 - y);
        if (d >= bd || d < minDist) continue;
        const check = this.canPlace(type, tx, ty);
        if (check.ok || check.noMoney) { bd = d; best = { tx, ty }; }
      }
    }
    return best;
  }

  build(type, tx, ty) {
    const check = this.canPlace(type, tx, ty);
    if (!check.ok) {
      this.emit('toast', { text: check.reason, bad: true });
      return null;
    }
    this.pay(BUILDINGS[type].cost);
    const b = this.addBuilding(type, tx, ty);
    // всех, кто стоит на месте стройки, отодвигаем к ближайшей свободной клетке
    for (const u of [this.hero, ...this.allies, ...this.repairers]) {
      if (u.dead || this.distToRect(u.x, u.y, b) > u.r) continue;
      const p = this.approachPoint(b, u.x, u.y);
      u.x = p.x; u.y = p.y;
      u.moveTarget = null;
    }
    this.recomputeEnergy();
    this.emit('save');
    return b;
  }

  upgradeCost(b) {
    const cfg = BUILDINGS[b.type];
    const k = Math.pow(UPGRADE_GROWTH, b.level - 1);
    const cost = {};
    for (const [r, v] of Object.entries(cfg.upgradeCost || {})) cost[r] = Math.ceil(v * k);
    return cost;
  }

  canUpgrade(b) {
    const cfg = BUILDINGS[b.type];
    if (b.level >= cfg.maxLevel) return { ok: false, reason: 'Максимальный уровень' };
    if (b.destroyed) return { ok: false, reason: 'Сначала нужен ремонт' };
    const cost = this.upgradeCost(b);
    if (!this.canAfford(cost)) return { ok: false, reason: 'Не хватает: ' + this.missing(cost).join(', ') };
    return { ok: true, cost };
  }

  upgrade(id) {
    const b = this.byId(id);
    if (!b) return false;
    const check = this.canUpgrade(b);
    if (!check.ok) {
      this.emit('toast', { text: check.reason, bad: true });
      return false;
    }
    this.pay(check.cost);
    b.level++;
    const oldMax = b.maxHp;
    b.maxHp = this.maxHpFor(b.type, b.level);
    b.hp += b.maxHp - oldMax;
    this.emit('upgraded', { id: b.id, x: this.center(b).x, y: this.center(b).y, level: b.level });
    this.recomputeEnergy();
    this.emit('save');
    return true;
  }

  maxHpFor(type, level) {
    const cfg = BUILDINGS[type];
    return Math.round(cfg.hp * (1 + (cfg.hpPerLevel || 0) * (level - 1)));
  }

  changeReserve(id, delta) {
    const b = this.byId(id);
    const r = b && BUILDINGS[b.type].recipe;
    if (!r) return;
    b.reserve = Math.max(0, Math.min(WORLD.storageCap, b.reserve + delta * (r.reserveStep || 10)));
    this.emit('save');
  }

  toggleEnabled(id) {
    const b = this.byId(id);
    if (!b) return;
    b.enabled = !b.enabled;
    this.recomputeEnergy();
    this.emit('save');
  }

  changePriority(id, delta) {
    const b = this.byId(id);
    if (!b) return;
    b.priority = Math.max(0, Math.min(5, b.priority + delta));
    this.recomputeEnergy();
    this.emit('save');
  }

  energyOut(b) {
    const cfg = BUILDINGS[b.type];
    return cfg.energyOut ? cfg.energyOut + cfg.energyOutPerLevel * (b.level - 1) : 0;
  }

  recomputeEnergy() {
    let supply = 0;
    const consumers = [];
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (b.destroyed) continue;
      if (cfg.energyOut) supply += this.energyOut(b);
      if (cfg.energyUse) consumers.push({ id: b.id, demand: cfg.energyUse, priority: b.priority, enabled: b.enabled, order: b.id });
    }
    const result = allocateEnergy(supply, consumers);
    for (const b of this.buildings) {
      if (BUILDINGS[b.type].energyUse) b.powered = result.powered.has(b.id);
    }
    this.energy = { supply: result.supply, demand: result.demand, deficit: result.deficit, used: result.used };
  }

  // Причина, по которой здание не работает, — текстом для игрока.
  statusOf(b) {
    const cfg = BUILDINGS[b.type];
    if (b.destroyed) return { code: 'destroyed', text: 'Разрушено — ремонтники восстановят после волны', bad: true };
    if (!b.enabled) return { code: 'disabled', text: 'Отключено вручную', bad: true };
    if (cfg.energyUse && !b.powered) {
      return { code: 'no_power', text: `Нет энергии: нужно ${cfg.energyUse}, дефицит сети ${this.energy.deficit}`, bad: true };
    }
    if (cfg.recipe) {
      const r = cfg.recipe;
      if (!this.canAfford(r.input)) {
        return { code: 'no_input', text: 'Нет сырья: нужно ' + Object.entries(r.input).map(([k, v]) => `${v} ${RESOURCES[k].name.toLowerCase()}`).join(', '), bad: true };
      }
      const low = Object.entries(r.input).find(([k, v]) => this.res[k] - v < b.reserve);
      if (low) {
        return { code: 'reserve', text: `Ждёт: ${RESOURCES[low[0]].name.toLowerCase()} не ниже резерва ${b.reserve} — запас для стройки` };
      }
      const full = Object.keys(r.output).some((k) => CAPPED.includes(k) && this.res[k] >= WORLD.storageCap);
      if (full) return { code: 'full', text: 'Склад полон', bad: true };
      return { code: 'working', text: 'Работает' };
    }
    if (cfg.spawns) {
      const have = this.allies.filter((a) => a.home === b.id).length;
      const max = this.squadSize(b);
      if (have < max) return { code: 'working', text: `Мечники ${have}/${max}, следующий через ${Math.ceil(b.spawnTimer)} с` };
      return { code: 'working', text: `Мечники ${have}/${max} на посту` };
    }
    if (cfg.repair) {
      if (this.repairBlocked) return { code: 'no_input', text: 'Ремонт стоит: нет древесины', bad: true };
      if (this.phase === 'wave') return { code: 'working', text: 'Ремонтники укрылись до конца волны' };
      return { code: 'working', text: 'Готов к ремонту' };
    }
    if (b.hp < b.maxHp) return { code: 'damaged', text: 'Повреждено, но работает' };
    return { code: 'working', text: 'Работает' };
  }

  squadSize(b) {
    const s = BUILDINGS[b.type].spawns;
    return s.count + s.countPerLevel * (b.level - 1);
  }

  repairEstimate() {
    let missingHp = 0;
    for (const b of this.buildings) {
      if (b.type === 'heart' || b.hp < b.maxHp) missingHp += b.maxHp - b.hp;
    }
    return { hp: Math.round(missingHp), wood: Math.ceil(missingHp * WORLD.repairWoodPerHp) };
  }

  manualRepairCost(b) {
    return { wood: Math.ceil((b.maxHp - b.hp) * WORLD.repairWoodPerHp * WORLD.manualRepairMultiplier) };
  }

  // Мгновенный ремонт за древесину между волнами — на случай, если ремонтников нет.
  repairNow(id) {
    const b = this.byId(id);
    if (!b || b.hp >= b.maxHp) return false;
    if (this.phase !== 'build') {
      this.emit('toast', { text: 'Чинить вручную можно только между волнами', bad: true });
      return false;
    }
    const cost = this.manualRepairCost(b);
    if (!this.canAfford(cost)) {
      this.emit('toast', { text: 'Не хватает: ' + this.missing(cost).join(', '), bad: true });
      return false;
    }
    this.pay(cost);
    b.hp = b.maxHp;
    if (b.destroyed) {
      b.destroyed = false;
      this.flowDirty = true;
      this.recomputeEnergy();
    }
    const c = this.center(b);
    this.emit('repaired', { x: c.x, y: c.y, id: b.id });
    this.emit('save');
    return true;
  }

  // ---------- маяки ----------

  restoreBeacon(id) {
    const bc = this.beacons.find((b) => b.id === id);
    if (!bc || bc.state !== 'ready') return false;
    if (!this.canAfford(bc.cfg.cost)) {
      this.emit('toast', { text: 'Не хватает: ' + this.missing(bc.cfg.cost).join(', '), bad: true });
      return false;
    }
    this.pay(bc.cfg.cost);
    this.lightBeacon(bc, true);
    this.emit('save');
    return true;
  }

  lightBeacon(bc, fresh) {
    bc.state = 'lit';
    const cfg = bc.cfg;
    // Узлы — до постройки маяка: сам маяк занимает клетки и их нельзя трогать.
    for (let y = cfg.ty; y < cfg.ty + 2; y++) {
      for (let x = cfg.tx; x < cfg.tx + 2; x++) this.removeNodeAt(x, y);
    }
    const b = this.addBuilding('beacon', cfg.tx, cfg.ty, { free: !fresh });
    bc.buildingId = b.id;
    for (const u of cfg.unlocks) this.unlocked.add(u);
    if (fresh) {
      const rng = createRng(cfg.tx * 131 + cfg.ty);
      const cx = cfg.tx + 1;
      const cy = cfg.ty + 1;
      for (const [kind, count] of Object.entries(cfg.nodes)) this.scatterNodes(rng, kind, count, cx, cy, 2, cfg.radius - 1);
      this.unlockStory(cfg.story);
      this.emit('beaconLit', { id: bc.id, x: cx, y: cy });
    }
  }

  removeNodeAt(tx, ty) {
    const i = this.idx(tx, ty);
    const id = this.nodeGrid[i];
    if (!id) return;
    this.nodeGrid[i] = 0;
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.flowDirty = true;
  }

  updateBeaconAvailability() {
    for (const bc of this.beacons) {
      if (bc.state === 'hidden' && this.progress.highestCleared >= bc.cfg.availableAfterWave) {
        bc.state = 'ready';
        this.unlockStory('beacon_' + bc.id + '_ready');
      }
    }
  }

  unlockStory(id) {
    if (!STORY[id] || this.story.seen.includes(id)) return;
    this.story.seen.push(id);
    this.story.unread.push(id);
    this.emit('story', { id });
  }

  // ---------- волны ----------

  wavePreview(n = this.progress.nextWave) {
    return generateWave(n);
  }

  setNextWave(n) {
    if (this.phase !== 'build') return;
    const max = this.progress.highestCleared + 1;
    this.progress.nextWave = Math.max(1, Math.min(max, n));
    this.emit('save');
  }

  startWave() {
    if (this.phase !== 'build') return false;
    const plan = generateWave(this.progress.nextWave);
    this.snapshot = this.serialize();
    this.phase = 'wave';
    this.lastResult = null;
    this.wave = { plan, t: 0, idx: 0, killed: 0, loot: { gold: 0, shards: 0 } };
    for (const r of this.repairers) this.emit('poof', { x: r.x, y: r.y });
    this.repairers = [];
    this.repairBlocked = false;
    this.emit('waveStart', { number: plan.number, sides: plan.sides, boss: plan.boss });
    return true;
  }

  spawnPoint(side, offset) {
    const [vx, vy] = SIDE_VECTORS[side];
    const c = this.heartCenter();
    let ext = 0;
    for (const t of this.territory()) ext = Math.max(ext, (t.x - c.x) * vx + (t.y - c.y) * vy + t.r);
    const d = ext + 6;
    let x = c.x + vx * d + -vy * offset;
    let y = c.y + vy * d + vx * offset;
    x = Math.max(1.5, Math.min(this.W - 1.5, x));
    y = Math.max(1.5, Math.min(this.H - 1.5, y));
    // сдвигаемся, пока не найдём свободную клетку
    for (let k = 0; k < 10 && this.isSolidCell(this.idx(Math.floor(x), Math.floor(y))); k++) {
      x -= vx; y -= vy;
    }
    return { x, y };
  }

  spawnEnemy(type, side, offset) {
    const cfg = ENEMIES[type];
    const plan = this.wave.plan;
    const p = this.spawnPoint(side, offset);
    const hp = Math.round(cfg.hp * plan.hpMult);
    const e = {
      id: this.nextId++, type, kind: 'enemy', x: p.x, y: p.y, r: cfg.radius, hp, maxHp: hp,
      damage: cfg.damage * plan.damageMult, speed: cfg.speed * plan.speedMult, cd: 0.5,
      retarget: 0, target: null, vx: 0, vy: 0, kx: 0, ky: 0, hitTime: -9, attackTime: -9, born: this.time,
      seed: Math.random() * 10,
    };
    this.enemies.push(e);
    this.emit('spawn', { x: e.x, y: e.y, type });
    return e;
  }

  updateWave(dt) {
    const w = this.wave;
    w.t += dt;
    const spawns = w.plan.spawns;
    while (w.idx < spawns.length && spawns[w.idx].at <= w.t) {
      const s = spawns[w.idx++];
      this.spawnEnemy(s.type, s.side, s.offset);
    }
    if (this.heart().hp <= 0) return this.endWave(false);
    if (w.idx >= spawns.length && this.enemies.length === 0) this.endWave(true);
  }

  endWave(victory) {
    const plan = this.wave.plan;
    const n = plan.number;
    const result = { victory, wave: n, loot: { ...this.wave.loot }, rewards: null };
    if (victory) {
      const r = plan.rewards;
      this.addRes('gold', r.gold);
      this.addRes('wood', r.wood);
      this.addRes('shards', r.shards);
      result.rewards = r;
      this.progress.highestCleared = Math.max(this.progress.highestCleared, n);
      this.progress.nextWave = this.progress.highestCleared + 1;
      if (n === 1) this.unlockStory('first_wave');
      if (n >= 5) this.unlockStory('wave5');
      if (n >= 10) this.unlockStory('boss10');
    } else {
      for (const e of this.enemies) this.emit('poof', { x: e.x, y: e.y, big: true });
      this.enemies = [];
      const heart = this.heart();
      heart.hp = Math.round(heart.maxHp * WORLD.heartRestoreAfterDefeat);
      heart.destroyed = false;
      this.progress.defeats++;
      this.progress.nextWave = n;
      this.unlockStory('first_defeat');
    }
    this.projectiles = this.projectiles.filter((p) => p.faction === 'player');
    this.phase = 'build';
    this.wave = null;
    this.snapshot = null;
    this.lastResult = result;
    this.updateBeaconAvailability();
    this.emit(victory ? 'victory' : 'defeat', { wave: n });
    this.emit('save');
  }

  grantBonus() {
    // Награда за просмотр рекламы: ещё раз золото последней победы.
    const r = this.lastResult;
    if (!r || !r.victory || r.bonusTaken) return false;
    r.bonusTaken = true;
    this.addRes('gold', r.rewards.gold);
    this.emit('toast', { text: `+${r.rewards.gold} золота` });
    this.emit('save');
    return true;
  }

  // ---------- главный цикл ----------

  update(dt) {
    this.time += dt;
    if (this.flowDirty) this.rebuildFlow();
    this.recomputeEnergy();
    this.updateNodes(dt);
    this.updateProduction(dt);
    this.updateHero(dt);
    this.updateTowers(dt);
    this.updateBarracks(dt);
    this.updateAllies(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateRepairers(dt);
    this.separateUnits();
    this.cleanup();
    if (this.phase === 'wave') this.updateWave(dt);
  }

  rebuildFlow() {
    const heart = this.heart();
    const goals = [];
    for (let y = heart.ty; y < heart.ty + heart.size; y++) {
      for (let x = heart.tx; x < heart.tx + heart.size; x++) goals.push(this.idx(x, y));
    }
    const solid = (i) => this.isSolidCell(i);
    this.flow = buildFlowField(this.W, this.H, goals, (i) => {
      const nid = this.nodeGrid[i];
      if (nid) {
        const n = this.nodeById(nid);
        if (n && n.hp > 0) return Infinity;
      }
      const bid = this.grid[i];
      if (bid) {
        const b = this.byId(bid);
        if (b && !b.destroyed) return 1 + WORLD.flowWallPenalty;
      }
      return 1;
    }, solid);
    this.flowDirty = false;
  }

  updateNodes(dt) {
    for (const n of this.nodes) {
      if (n.hp > 0) continue;
      n.regrow -= dt;
      if (n.regrow <= 0) {
        n.hp = n.maxHp;
        n.grownTime = this.time;
        this.flowDirty = true;
      }
    }
  }

  hitNode(n, dmg) {
    if (n.hp <= 0) return;
    const cfg = NODES[n.kind];
    n.hp -= dmg;
    n.hitTime = this.time;
    let gain = cfg.perHit * dmg;
    if (n.hp <= 0) {
      n.hp = 0;
      n.regrow = cfg.regrowSeconds;
      gain += cfg.onBreak;
      this.flowDirty = true;
      this.emit('nodeBreak', { x: n.x, y: n.y, kind: n.kind });
    }
    this.addRes(cfg.yieldRes, gain);
    this.emit('gain', { x: n.x, y: n.y - 0.6, res: cfg.yieldRes, amount: gain });
    this.emit('nodeHit', { x: n.x, y: n.y, kind: n.kind });
  }

  updateProduction(dt) {
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (!cfg.recipe) continue;
      const st = this.statusOf(b);
      b.status = st.code;
      if (st.code !== 'working') continue;
      const r = cfg.recipe;
      b.progress += dt * (1 + r.speedPerLevel * (b.level - 1));
      b.workTime = this.time;
      if (b.progress >= r.seconds) {
        b.progress = 0;
        this.pay(r.input);
        const c = this.center(b);
        for (const [k, v] of Object.entries(r.output)) {
          this.addRes(k, v);
          this.emit('gain', { x: c.x, y: c.y - 1, res: k, amount: v });
        }
      }
    }
  }

  // ---------- герой ----------

  heroWeapon() { return WEAPONS[this.hero.weapon]; }

  setWeapon(w) {
    if (!WEAPONS[w]) return;
    this.hero.weapon = w;
    this.emit('weapon', { weapon: w });
  }

  toggleAuto() {
    this.settings.auto = !this.settings.auto;
    this.emit('toast', { text: this.settings.auto ? 'Автоатака: ближайший враг' : 'Ручной бой: целься и атакуй' });
  }

  updateHero(dt) {
    const h = this.hero;
    if (h.dead) {
      h.respawn -= dt;
      if (h.respawn <= 0) {
        const c = this.heartCenter();
        h.dead = false;
        h.hp = h.maxHp;
        h.x = c.x;
        h.y = c.y + 2.2;
        this.emit('respawn', { x: h.x, y: h.y });
      }
      return;
    }
    const len = Math.hypot(h.input.x, h.input.y);
    if (len > 0.1) h.moveTarget = null;
    if (h.moveTarget) {
      // движение касанием: идём в точку, обходя препятствия
      const t = h.moveTarget;
      const cell = this.idx(Math.floor(t.x), Math.floor(t.y));
      // к дереву или постройке подходим вплотную и останавливаемся
      const stop = this.inBounds(Math.floor(t.x), Math.floor(t.y)) && this.isSolidCell(cell) ? 0.5 + h.r + 0.15 : 0.15;
      this.navigate(h, t.x, t.y, UNITS.hero.speed, stop, dt);
      // застрял (упёрся в препятствие у самой точки) — тоже прибыли
      t.check = (t.check ?? 0) + dt;
      if (t.check >= 0.4) {
        t.stuck = t.from && Math.hypot(h.x - t.from.x, h.y - t.from.y) < 0.1;
        t.from = { x: h.x, y: h.y };
        t.check = 0;
      }
      if (Math.hypot(t.x - h.x, t.y - h.y) <= stop + 0.1 || !h.moving || t.stuck) {
        h.moveTarget = null;
        h.vx = 0; h.vy = 0; h.moving = false;
      }
    } else {
      const ix = len > 1 ? h.input.x / len : h.input.x;
      const iy = len > 1 ? h.input.y / len : h.input.y;
      h.vx = ix * UNITS.hero.speed;
      h.vy = iy * UNITS.hero.speed;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.moving = len > 0.1;
      if (Math.abs(ix) > 0.1) h.facing = ix > 0 ? 1 : -1;
      this.resolveSolids(h);
    }
    if (this.phase === 'build') h.hp = Math.min(h.maxHp, h.hp + WORLD.heroRegenPerSecond * dt);

    h.cd -= dt;
    if (h.cd > 0) return;
    const wpn = this.heroWeapon();
    let target = null;
    if (h.attackAt) {
      target = { x: h.attackAt.x, y: h.attackAt.y, manual: true };
      if (!h.attackHeld) h.attackAt = null;
    } else if (this.settings.auto) {
      const e = this.nearestEnemy(h.x, h.y, wpn.range + 0.3);
      if (e) target = { x: e.x, y: e.y, enemy: e };
      else {
        const n = this.nearestNode(h.x, h.y, 2.1);
        if (n) target = { x: n.x, y: n.y, node: n };
      }
    }
    if (target) this.heroAttack(target);
  }

  heroAttack(target) {
    const h = this.hero;
    const wpn = this.heroWeapon();
    let dx = target.x - h.x;
    let dy = target.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    h.aimX = dx; h.aimY = dy;
    if (Math.abs(dx) > 0.05) h.facing = dx > 0 ? 1 : -1;
    h.cd = wpn.cooldown;
    h.attackTime = this.time;

    if (wpn.kind === 'slash') {
      let hitSomething = false;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - h.x, e.y - h.y) <= wpn.range + e.r) {
          this.damageEnemy(e, wpn.damage, dx, dy);
          hitSomething = true;
        }
      }
      // Мечом рубим ближайшее дерево, если врагов рядом нет или цель — дерево.
      if (!hitSomething || target.node) {
        const n = target.node || this.nearestNode(h.x + dx * 0.6, h.y + dy * 0.6, 1.4);
        if (n && Math.hypot(n.x - h.x, n.y - h.y) <= wpn.range + 0.6) this.hitNode(n, wpn.nodeDamage);
      }
      this.emit('slash', { x: h.x, y: h.y, angle: Math.atan2(dy, dx), range: wpn.range });
      return;
    }

    // Снаряд вылетает из оружия, которое парит сбоку от героя.
    const ox = h.x + h.facing * 0.42;
    const oy = h.y - 0.15;
    let tx = target.x - ox;
    let ty = target.y - oy;
    const td = Math.hypot(tx, ty) || 1;
    tx /= td; ty /= td;
    this.projectiles.push({
      id: this.nextId++, faction: 'player', kind: wpn.kind, x: ox, y: oy,
      vx: tx * wpn.projectileSpeed, vy: ty * wpn.projectileSpeed, speed: wpn.projectileSpeed,
      damage: wpn.damage, aoe: wpn.aoe || 0, life: (wpn.range + 1) / wpn.projectileSpeed,
      nodeTarget: target.node ? target.node.id : 0, hitsNodes: !!target.manual, nodeDamage: wpn.nodeDamage,
      targetId: target.enemy ? target.enemy.id : 0, homing: false, born: this.time,
    });
    this.emit('shoot', { x: ox, y: oy, kind: wpn.kind });
  }

  nearestEnemy(x, y, range) {
    let best = null;
    let bd = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  nearestNode(x, y, range) {
    let best = null;
    let bd = range;
    for (const n of this.nodes) {
      if (n.hp <= 0) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  damageEnemy(e, amount, kx = 0, ky = 0) {
    const cfg = ENEMIES[e.type];
    const dmg = Math.max(1, amount - cfg.armor);
    e.hp -= dmg;
    e.hitTime = this.time;
    if (!cfg.boss) { e.kx += kx * 4; e.ky += ky * 4; }
    this.emit('damage', { x: e.x, y: e.y - e.r - 0.3, amount: Math.round(dmg), armor: cfg.armor > 0 });
    if (e.hp <= 0 && !e.dead) this.killEnemy(e);
  }

  killEnemy(e) {
    const cfg = ENEMIES[e.type];
    e.dead = true;
    this.addRes('gold', cfg.gold);
    if (this.wave) this.wave.loot.gold += cfg.gold;
    this.emit('gain', { x: e.x, y: e.y - 0.5, res: 'gold', amount: cfg.gold });
    // Осколки: детерминированно от id, чтобы не зависеть от порядка случайных чисел.
    const roll = ((e.id * 2654435761) >>> 0) / 4294967296;
    if (roll < cfg.shardChance) {
      const s = cfg.shards || 1;
      this.addRes('shards', s);
      if (this.wave) this.wave.loot.shards += s;
      this.emit('gain', { x: e.x, y: e.y - 1, res: 'shards', amount: s });
    }
    if (this.wave) this.wave.killed++;
    this.emit('death', { x: e.x, y: e.y, type: e.type, boss: !!cfg.boss });
  }

  damageUnit(u, amount) {
    if (u.dead) return;
    u.hp -= amount;
    u.hitTime = this.time;
    this.emit('damage', { x: u.x, y: u.y - 0.8, amount: Math.round(amount), friendly: true });
    if (u.hp <= 0) {
      u.hp = 0;
      if (u === this.hero) {
        u.dead = true;
        u.respawn = WORLD.heroRespawnSeconds;
        this.emit('heroDown', { x: u.x, y: u.y });
      } else {
        u.dead = true;
        this.emit('allyDown', { x: u.x, y: u.y });
      }
    }
  }

  damageBuilding(b, amount) {
    if (b.destroyed) return;
    b.hp -= amount;
    b.hitTime = this.time;
    const c = this.center(b);
    this.emit('buildingHit', { x: c.x, y: c.y, id: b.id });
    if (b.hp <= 0) {
      b.hp = 0;
      if (b.type === 'heart') return; // поражение проверит updateWave
      b.destroyed = true;
      this.flowDirty = true;
      this.recomputeEnergy();
      this.emit('collapse', { x: c.x, y: c.y, size: b.size, building: b.type });
    }
  }

  // ---------- оборона ----------

  updateTowers(dt) {
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (!cfg.attack) continue;
      b.status = this.statusOf(b).code;
      b.cd -= dt;
      if (b.status !== 'working' && b.status !== 'damaged') continue;
      if (b.cd > 0) continue;
      const a = cfg.attack;
      const range = a.range + a.rangePerLevel * (b.level - 1);
      const c = this.center(b);
      const e = this.nearestEnemy(c.x, c.y, range);
      if (!e) continue;
      b.cd = a.cooldown;
      b.workTime = this.time;
      const oy = c.y - 0.9;
      this.projectiles.push({
        id: this.nextId++, faction: 'player', kind: 'arrow', x: c.x, y: oy, vx: 0, vy: 0, speed: a.projectileSpeed,
        damage: a.damage * (1 + a.damagePerLevel * (b.level - 1)), aoe: 0, life: 2,
        targetId: e.id, homing: true, born: this.time,
      });
      this.emit('shoot', { x: c.x, y: oy, kind: 'tower' });
    }
  }

  updateBarracks(dt) {
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (!cfg.spawns || b.destroyed) continue;
      const have = this.allies.filter((a) => a.home === b.id).length;
      const max = this.squadSize(b);
      if (have >= max) { b.spawnTimer = cfg.spawns.respawnSeconds; continue; }
      b.spawnTimer -= dt;
      if (b.spawnTimer > 0) continue;
      b.spawnTimer = cfg.spawns.respawnSeconds;
      const u = UNITS[cfg.spawns.unit];
      const mult = 1 + cfg.spawns.statsPerLevel * (b.level - 1);
      const c = this.center(b);
      const slot = this.allies.filter((a) => a.home === b.id).map((a) => a.slot);
      let s = 0;
      while (slot.includes(s)) s++;
      const ally = {
        id: this.nextId++, kind: 'ally', type: cfg.spawns.unit, home: b.id, slot: s,
        x: c.x, y: c.y + b.size / 2 + 0.4, r: u.radius, hp: u.hp * mult, maxHp: u.hp * mult,
        damage: u.damage * mult, cd: 0, target: null, retarget: 0, vx: 0, vy: 0, facing: 1,
        hitTime: -9, attackTime: -9, born: this.time,
      };
      this.allies.push(ally);
      this.emit('spawnAlly', { x: ally.x, y: ally.y });
    }
  }

  guardPoint(a) {
    const b = this.byId(a.home);
    if (!b) return { x: a.x, y: a.y };
    const c = this.center(b);
    const heart = this.heartCenter();
    // встают между казармой и тьмой: со стороны от Сердца
    let dx = c.x - heart.x;
    let dy = c.y - heart.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const spread = (a.slot - 1) * 0.9;
    return { x: c.x + dx * (b.size / 2 + 1.2) - dy * spread, y: c.y + dy * (b.size / 2 + 1.2) + dx * spread };
  }

  updateAllies(dt) {
    const u = UNITS.swordsman;
    for (const a of this.allies) {
      if (a.dead) continue;
      a.cd -= dt;
      a.retarget -= dt;
      const g = this.guardPoint(a);
      if (a.retarget <= 0) {
        a.retarget = 0.3;
        if (a.target && (a.target.dead || Math.hypot(a.target.x - g.x, a.target.y - g.y) > u.leash)) a.target = null;
        if (!a.target) {
          const e = this.nearestEnemy(g.x, g.y, u.aggro);
          if (e) a.target = e;
        }
      }
      let tx = g.x;
      let ty = g.y;
      let stop = 0.15;
      if (a.target) {
        tx = a.target.x; ty = a.target.y;
        stop = u.range + a.target.r;
        const d = Math.hypot(tx - a.x, ty - a.y);
        if (d <= stop + 0.05 && a.cd <= 0) {
          a.cd = u.cooldown;
          a.attackTime = this.time;
          const k = 1 / (d || 1);
          this.damageEnemy(a.target, a.damage, (tx - a.x) * k * 0.5, (ty - a.y) * k * 0.5);
          this.emit('allyHit', { x: a.target.x, y: a.target.y });
        }
      }
      this.navigate(a, tx, ty, u.speed, stop, dt);
      if (this.phase === 'build') a.hp = Math.min(a.maxHp, a.hp + 4 * dt);
    }
  }

  // Прямая видимость между точками для тела радиуса r.
  clearLine(x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 0.3);
    for (let k = 1; k <= steps; k++) {
      const x = x0 + ((x1 - x0) * k) / steps;
      const y = y0 + ((y1 - y0) * k) / steps;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        const cx = Math.floor(x + ox * 0.9);
        const cy = Math.floor(y + oy * 0.9);
        if (!this.inBounds(cx, cy) || this.isSolidCell(this.idx(cx, cy))) return false;
      }
    }
    return true;
  }

  // Движение с обходом препятствий. false — цель недостижима.
  navigate(u, tx, ty, speed, stop, dt) {
    const d = Math.hypot(tx - u.x, ty - u.y);
    if (d <= stop || this.clearLine(u.x, u.y, tx, ty, u.r)) {
      u.path = null;
      this.moveToward(u, tx, ty, speed, stop, dt);
      return true;
    }
    const goal = this.idx(Math.floor(tx), Math.floor(ty));
    if (!u.path || u.pathGoal !== goal || this.time - u.pathTime > 1) {
      const start = this.idx(Math.floor(u.x), Math.floor(u.y));
      u.path = findPath(this.W, this.H, start, goal, (i) => this.isSolidCell(i));
      u.pathGoal = goal;
      u.pathTime = this.time;
    }
    if (!u.path) {
      this.moveToward(u, tx, ty, speed, stop, dt);
      return false;
    }
    const cellX = (i) => (i % this.W) + 0.5;
    const cellY = (i) => Math.floor(i / this.W) + 0.5;
    while (u.path.length > 1 && (Math.hypot(cellX(u.path[0]) - u.x, cellY(u.path[0]) - u.y) < 0.35
      || this.clearLine(u.x, u.y, cellX(u.path[1]), cellY(u.path[1]), u.r))) u.path.shift();
    if (u.path.length <= 1) {
      this.moveToward(u, tx, ty, speed, stop, dt);
      return true;
    }
    this.moveToward(u, cellX(u.path[0]), cellY(u.path[0]), speed, 0, dt);
    return true;
  }

  // Свободная клетка у стены здания, ближайшая к точке (x, y).
  approachPoint(b, x, y) {
    let best = null;
    let bd = Infinity;
    for (let ty = b.ty - 1; ty <= b.ty + b.size; ty++) {
      for (let tx = b.tx - 1; tx <= b.tx + b.size; tx++) {
        if (!this.inBounds(tx, ty) || this.isSolidCell(this.idx(tx, ty))) continue;
        if (tx >= b.tx && tx < b.tx + b.size && ty >= b.ty && ty < b.ty + b.size) continue;
        const corner = (tx === b.tx - 1 || tx === b.tx + b.size) && (ty === b.ty - 1 || ty === b.ty + b.size);
        if (corner) continue;
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d < bd) { bd = d; best = { x: tx + 0.5, y: ty + 0.5 }; }
      }
    }
    return best || this.center(b);
  }

  moveToward(u, tx, ty, speed, stop, dt) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d > stop) {
      const s = Math.min(speed * dt, d - stop);
      u.vx = (dx / d) * speed;
      u.vy = (dy / d) * speed;
      u.x += (dx / d) * s;
      u.y += (dy / d) * s;
      if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
      u.moving = true;
    } else {
      u.vx = 0; u.vy = 0;
      u.moving = false;
    }
    this.resolveSolids(u);
  }

  // ---------- враги ----------

  updateEnemies(dt) {
    const h = this.hero;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cfg = ENEMIES[e.type];
      e.cd -= dt;
      e.retarget -= dt;
      // отбрасывание
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);

      if (e.retarget <= 0) {
        e.retarget = 0.25;
        e.target = this.chooseEnemyTarget(e, cfg);
      }
      const t = e.target;
      if (t && t.unit && (t.unit.dead || (t.unit === h && h.dead))) e.target = null;
      if (t && t.building && t.building.destroyed) e.target = null;

      if (e.target && e.target.unit) {
        const u = e.target.unit;
        const d = Math.hypot(u.x - e.x, u.y - e.y);
        const reach = cfg.range + u.r + e.r;
        if (d <= reach) this.enemyAttack(e, cfg, { unit: u });
        else if (!this.navigate(e, u.x, u.y, e.speed, reach * 0.9, dt)) {
          // недостижим (за стенами) — забываем о нём на время
          e.target = null;
          e.ignoreUnitsUntil = this.time + 2;
        }
        continue;
      }
      if (e.target && e.target.building) {
        const b = e.target.building;
        if (this.distToRect(e.x, e.y, b) <= cfg.range + e.r) {
          this.enemyAttack(e, cfg, { building: b });
          continue;
        }
      }
      this.followFlow(e, cfg, dt);
    }
  }

  chooseEnemyTarget(e, cfg) {
    // 1) союзники в досягаемости — приоритет, 2) герой, 3) постройки у дороги
    let best = null;
    let bd = cfg.aggro;
    if (e.ignoreUnitsUntil > this.time) bd = 0;
    for (const a of this.allies) {
      if (a.dead) continue;
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) return { unit: best };
    const h = this.hero;
    if (!h.dead && bd > 0 && Math.hypot(h.x - e.x, h.y - e.y) < cfg.aggro) return { unit: h };
    // ближайшая постройка (кроме стен) в радиусе атаки
    const reach = cfg.range + e.r + 0.3;
    const r = Math.ceil(reach) + 1;
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    let bb = null;
    let bbd = reach;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const b = this.buildingAt(x, y);
        if (!b || b.destroyed || b.type === 'wall') continue;
        const d = this.distToRect(e.x, e.y, b);
        if (d < bbd) { bbd = d; bb = b; }
      }
    }
    return bb ? { building: bb } : null;
  }

  followFlow(e, cfg, dt) {
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    const heart = this.heart();
    if (this.distToRect(e.x, e.y, heart) <= cfg.range + e.r) {
      this.enemyAttack(e, cfg, { building: heart });
      return;
    }
    if (!this.inBounds(cx, cy) || !this.flow) {
      const c = this.heartCenter();
      this.moveToward(e, c.x, c.y, e.speed, 0, dt);
      return;
    }
    const i = this.idx(cx, cy);
    const n = nextCell(this.flow, this.W, this.H, i, (k) => this.isSolidCell(k));
    if (n < 0 || this.flow[i] === Infinity) {
      const c = this.heartCenter();
      this.moveToward(e, c.x, c.y, e.speed, 0, dt);
      return;
    }
    const nb = this.grid[n] ? this.byId(this.grid[n]) : null;
    if (nb && !nb.destroyed) {
      // путь перекрыт постройкой — ломаем её
      e.target = { building: nb };
      if (this.distToRect(e.x, e.y, nb) <= cfg.range + e.r) {
        this.enemyAttack(e, cfg, { building: nb });
        return;
      }
    }
    const nx = (n % this.W) + 0.5;
    const ny = Math.floor(n / this.W) + 0.5;
    this.moveToward(e, nx, ny, e.speed, 0, dt);
  }

  enemyAttack(e, cfg, target) {
    e.vx = 0; e.vy = 0; e.moving = false;
    const tx = target.unit ? target.unit.x : this.center(target.building).x;
    if (Math.abs(tx - e.x) > 0.05) e.facing = tx > e.x ? 1 : -1;
    if (e.cd > 0) return;
    e.cd = cfg.cooldown;
    e.attackTime = this.time;
    if (cfg.projectileSpeed) {
      const c = target.unit || this.center(target.building);
      this.projectiles.push({
        id: this.nextId++, faction: 'enemy', kind: 'boneArrow', x: e.x, y: e.y - 0.2,
        vx: 0, vy: 0, speed: cfg.projectileSpeed, damage: e.damage, life: 2.5, homing: true,
        targetUnit: target.unit || null, targetBuilding: target.building || null, tx: c.x, ty: c.y, born: this.time,
      });
      this.emit('shoot', { x: e.x, y: e.y, kind: 'enemy' });
      return;
    }
    if (target.unit) this.damageUnit(target.unit, e.damage);
    else this.damageBuilding(target.building, e.damage);
    this.emit('enemyHit', { x: e.x, y: e.y, boss: !!cfg.boss });
  }

  // ---------- снаряды ----------

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.homing) {
        let tx = p.tx;
        let ty = p.ty;
        if (p.faction === 'player') {
          const t = this.enemies.find((e) => e.id === p.targetId && !e.dead);
          if (t) { tx = t.x; ty = t.y; p.tx = tx; p.ty = ty; }
        } else if (p.targetUnit && !p.targetUnit.dead) {
          tx = p.targetUnit.x; ty = p.targetUnit.y;
        }
        if (tx !== undefined) {
          const dx = tx - p.x;
          const dy = ty - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.vx = (dx / d) * p.speed;
          p.vy = (dy / d) * p.speed;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.faction === 'player') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= e.r + 0.2) {
            this.projectileHit(p, e);
            break;
          }
        }
        if (!p.dead && (p.nodeTarget || p.hitsNodes)) {
          const n = this.nodeAt(Math.floor(p.x), Math.floor(p.y));
          if (n && n.hp > 0 && (p.hitsNodes || n.id === p.nodeTarget)) {
            this.hitNode(n, p.nodeDamage || 1);
            this.projectileHit(p, null);
          }
        }
        if (p.homing && !p.dead && p.tx !== undefined && Math.hypot(p.tx - p.x, p.ty - p.y) < 0.25) p.dead = true;
      } else {
        const u = p.targetUnit;
        if (u && !u.dead && Math.hypot(u.x - p.x, u.y - p.y) <= u.r + 0.2) {
          this.damageUnit(u, p.damage);
          p.dead = true;
        } else if (p.targetBuilding && this.distToRect(p.x, p.y, p.targetBuilding) < 0.15) {
          this.damageBuilding(p.targetBuilding, p.damage);
          p.dead = true;
        } else if (Math.hypot(p.tx - p.x, p.ty - p.y) < 0.2) {
          p.dead = true;
        }
      }
      if (p.life <= 0 && !p.dead) {
        if (p.kind === 'fireball') this.projectileHit(p, null);
        p.dead = true;
      }
    }
  }

  projectileHit(p, e) {
    p.dead = true;
    if (p.aoe) {
      for (const o of this.enemies) {
        if (o.dead) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d <= p.aoe + o.r) {
          const k = 1 / (d || 1);
          this.damageEnemy(o, p.damage, (o.x - p.x) * k, (o.y - p.y) * k);
        }
      }
      this.emit('explode', { x: p.x, y: p.y, r: p.aoe });
    } else if (e) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      this.damageEnemy(e, p.damage, (p.vx / sp) * 0.6, (p.vy / sp) * 0.6);
      this.emit('arrowHit', { x: p.x, y: p.y });
    }
  }

  // ---------- ремонт ----------

  updateRepairers(dt) {
    if (this.phase !== 'build') return;
    const R = UNITS.repairer;
    const damaged = this.buildings.filter((b) => b.hp < b.maxHp);
    let anyBlocked = false;
    for (const house of this.buildings) {
      const cfg = BUILDINGS[house.type];
      if (!cfg.repair || house.destroyed || !house.enabled) continue;
      const rc = cfg.repair;
      const mult = 1 + rc.perLevel * (house.level - 1);
      const want = rc.workers + rc.workersPerLevel * (house.level - 1);
      const mine = this.repairers.filter((r) => r.home === house.id);
      if (damaged.length && mine.length < want) {
        house.spawnTimer -= dt;
        if (house.spawnTimer <= 0) {
          house.spawnTimer = 0.6;
          const c = this.center(house);
          const r = {
            id: this.nextId++, kind: 'repairer', home: house.id, x: c.x, y: c.y + house.size / 2 + 0.3,
            r: R.radius, hp: R.hp, maxHp: R.hp, task: 0, vx: 0, vy: 0, facing: 1, workTime: -9, hitTime: -9, born: this.time,
          };
          this.repairers.push(r);
          this.emit('spawnAlly', { x: r.x, y: r.y });
        }
      }
      for (const r of mine) {
        let b = r.task ? this.byId(r.task) : null;
        if (!b || b.hp >= b.maxHp) {
          r.task = 0;
          const taken = new Set(this.repairers.map((o) => o.task));
          const free = damaged.filter((d) => d.hp < d.maxHp && !taken.has(d.id));
          const pool = free.length ? free : damaged.filter((d) => d.hp < d.maxHp);
          pool.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
          b = pool[0] || null;
          r.task = b ? b.id : 0;
        }
        if (!b) {
          const door = this.approachPoint(house, r.x, r.y);
          this.navigate(r, door.x, door.y, rc.speed * mult, 0.2, dt);
          if (Math.hypot(r.x - door.x, r.y - door.y) < 0.5) r.gone = true;
          continue;
        }
        const c = this.center(b);
        if (this.distToRect(r.x, r.y, b) > 0.8) {
          const p = this.approachPoint(b, r.x, r.y);
          this.navigate(r, p.x, p.y, rc.speed * mult, 0.1, dt);
          continue;
        }
        r.vx = 0; r.vy = 0; r.moving = false;
        r.facing = c.x > r.x ? 1 : -1;
        const amount = Math.min(rc.hpPerSecond * mult * dt, b.maxHp - b.hp);
        const wood = amount * WORLD.repairWoodPerHp;
        if (this.res.wood < wood) { anyBlocked = true; continue; }
        this.res.wood -= wood;
        b.hp += amount;
        r.workTime = this.time;
        if (b.hp >= b.maxHp) {
          b.hp = b.maxHp;
          if (b.destroyed) {
            b.destroyed = false;
            this.flowDirty = true;
            this.recomputeEnergy();
          }
          this.emit('repaired', { x: c.x, y: c.y, id: b.id });
        }
      }
    }
    if (anyBlocked && !this.repairBlocked) this.emit('toast', { text: 'Ремонт остановлен: не хватает древесины', bad: true });
    this.repairBlocked = anyBlocked;
  }

  // ---------- физика ----------

  resolveSolids(u) {
    const r = u.r;
    u.x = Math.max(r, Math.min(this.W - r, u.x));
    u.y = Math.max(r, Math.min(this.H - r, u.y));
    const x0 = Math.floor(u.x - r);
    const x1 = Math.floor(u.x + r);
    const y0 = Math.floor(u.y - r);
    const y1 = Math.floor(u.y + r);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.inBounds(cx, cy) || !this.isSolidCell(this.idx(cx, cy))) continue;
        const px = Math.max(cx, Math.min(u.x, cx + 1));
        const py = Math.max(cy, Math.min(u.y, cy + 1));
        let dx = u.x - px;
        let dy = u.y - py;
        const d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d < 1e-6) {
          // центр внутри клетки — выталкиваем по кратчайшей оси
          const left = u.x - cx; const right = cx + 1 - u.x;
          const top = u.y - cy; const bottom = cy + 1 - u.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) u.x = cx - r; else if (m === right) u.x = cx + 1 + r;
          else if (m === top) u.y = cy - r; else u.y = cy + 1 + r;
          continue;
        }
        dx /= d; dy /= d;
        u.x = px + dx * r;
        u.y = py + dy * r;
      }
    }
  }

  separateUnits() {
    const list = [];
    if (!this.hero.dead) list.push(this.hero);
    for (const a of this.allies) if (!a.dead) list.push(a);
    for (const e of this.enemies) if (!e.dead) list.push(e);
    for (const r of this.repairers) list.push(r);
    const buckets = new Map();
    for (const u of list) {
      const k = Math.floor(u.x) + Math.floor(u.y) * 1000;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(u);
    }
    for (const u of list) {
      const bx = Math.floor(u.x);
      const by = Math.floor(u.y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = buckets.get(bx + dx + (by + dy) * 1000);
          if (!cell) continue;
          for (const o of cell) {
            if (o === u || o.id < u.id) continue;
            const ox = o.x - u.x;
            const oy = o.y - u.y;
            const min = u.r + o.r;
            const d2 = ox * ox + oy * oy;
            if (d2 >= min * min || d2 < 1e-8) continue;
            const d = Math.sqrt(d2);
            const push = (min - d) * 0.5;
            const wu = u.r * u.r;
            const wo = o.r * o.r;
            const fu = wo / (wu + wo);
            const fo = wu / (wu + wo);
            u.x -= (ox / d) * push * fu * 2;
            u.y -= (oy / d) * push * fu * 2;
            o.x += (ox / d) * push * fo * 2;
            o.y += (oy / d) * push * fo * 2;
          }
        }
      }
    }
    for (const u of list) this.resolveSolids(u);
  }

  cleanup() {
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.allies.some((a) => a.dead)) this.allies = this.allies.filter((a) => !a.dead);
    if (this.repairers.some((r) => r.gone)) this.repairers = this.repairers.filter((r) => !r.gone);
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ---------- подсказка-цель для игрока ----------

  objective() {
    const has = (t) => this.buildings.some((b) => b.type === t);
    const tower = has('archerTower');
    if (!has('generator') && this.res.wood < BUILDINGS.generator.cost.wood) {
      const n = this.nearestNode(this.hero.x, this.hero.y, 99);
      return { text: `Подойди к дереву и бей его — нужно ${BUILDINGS.generator.cost.wood} древесины`, target: n ? { x: n.x, y: n.y } : null };
    }
    if (!has('generator')) return { text: 'Построй Генератор — он даёт энергию', build: 'generator' };
    if (!has('sawmill')) return { text: 'Построй Лесопилку — она делает доски из древесины', build: 'sawmill' };
    if (this.energy.deficit > 0) return { text: `Не хватает энергии (${this.energy.deficit}) — улучши или построй генератор`, build: 'generator' };
    const saw = this.buildings.find((b) => b.type === 'sawmill');
    if (!tower && saw && this.res.planks < BUILDINGS.archerTower.cost.planks && ['reserve', 'no_input'].includes(this.statusOf(saw).code)) {
      const n = this.nearestNode(this.hero.x, this.hero.y, 99);
      return { text: `Наруби ещё древесины: лесопилка не трогает последние ${saw.reserve} — это запас на стройку`, target: n ? { x: n.x, y: n.y } : null };
    }
    if (!tower) return { text: 'Накопи доски и поставь Башню лучников у Сердца', build: 'archerTower' };
    if (this.progress.highestCleared === 0) return { text: 'Готово! Нажми «Начать волну» — враги придут с отмеченной стороны', wave: true };
    if (!has('barracks')) return { text: 'Построй Казарму мечников — они встретят врагов', build: 'barracks' };
    if (!has('repairHouse')) return { text: 'Построй Дом ремонтников — он чинит базу после волн', build: 'repairHouse' };
    const ready = this.beacons.find((b) => b.state === 'ready');
    if (ready) {
      return { text: `${ready.cfg.name} ждёт: подойди и зажги его`, target: { x: ready.cfg.tx + 1, y: ready.cfg.ty + 1 }, beacon: ready.id };
    }
    const hidden = this.beacons.find((b) => b.state === 'hidden');
    if (hidden) return { text: `Отрази волну ${hidden.cfg.availableAfterWave}, чтобы добраться до маяка в тумане`, wave: true };
    return { text: `Готовься к волне ${this.progress.nextWave}. Улучшай постройки в их карточках`, wave: true };
  }

  // ---------- сохранение ----------

  serialize() {
    if (this.snapshot) return this.snapshot; // во время волны храним состояние до её начала
    return {
      v: SAVE_VERSION,
      res: { ...this.res },
      progress: { ...this.progress },
      buildings: this.buildings.map((b) => ({
        type: b.type, tx: b.tx, ty: b.ty, level: b.level, hp: Math.round(b.hp), destroyed: b.destroyed,
        enabled: b.enabled, priority: b.priority, reserve: b.reserve,
      })),
      nodes: this.nodes.map((n) => ({ kind: n.kind, tx: n.tx, ty: n.ty, hp: n.hp, regrow: Math.round(n.regrow) })),
      beacons: this.beacons.map((b) => ({ id: b.id, state: b.state })),
      unlocked: [...this.unlocked],
      story: { seen: [...this.story.seen], unread: [...this.story.unread] },
      hero: { weapon: this.hero.weapon },
      settings: { ...this.settings },
    };
  }

  load(s) {
    if (!s || s.v !== SAVE_VERSION) throw new Error('Несовместимое сохранение');
    this.res = { ...WORLD.startResources, ...s.res };
    this.progress = { ...this.progress, ...s.progress };
    for (const sb of s.buildings) {
      if (sb.type === 'beacon') continue; // маяки восстанавливаются ниже
      const b = this.addBuilding(sb.type, sb.tx, sb.ty, { free: true });
      b.level = sb.level;
      b.maxHp = this.maxHpFor(b.type, b.level);
      b.hp = Math.min(b.maxHp, sb.hp);
      b.destroyed = !!sb.destroyed;
      b.enabled = sb.enabled !== false;
      b.priority = sb.priority ?? b.priority;
      b.reserve = sb.reserve ?? b.reserve;
    }
    for (const sb of s.beacons || []) {
      const bc = this.beacons.find((b) => b.id === sb.id);
      if (!bc) continue;
      if (sb.state === 'lit') this.lightBeacon(bc, false);
      else bc.state = sb.state;
    }
    for (const b of this.buildings) {
      const saved = s.buildings.find((x) => x.type === 'beacon' && x.tx === b.tx && x.ty === b.ty);
      if (b.type === 'beacon' && saved) {
        b.hp = Math.min(b.maxHp, saved.hp);
        b.destroyed = !!saved.destroyed;
      }
    }
    for (const n of s.nodes) {
      const node = this.addNode(n.kind, n.tx, n.ty, n.hp);
      if (n.hp <= 0) node.regrow = n.regrow;
    }
    this.unlocked = new Set(s.unlocked);
    this.story = { seen: [...s.story.seen], unread: [...s.story.unread] };
    this.hero.weapon = s.hero?.weapon || 'sword';
    this.settings = { ...this.settings, ...s.settings };
    const c = this.heartCenter();
    this.hero.x = c.x;
    this.hero.y = c.y + 2.6;
    this.updateBeaconAvailability();
  }
}
