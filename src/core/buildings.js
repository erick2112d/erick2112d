// Постройки: размещение, улучшения, эволюции, заборы с общей прочностью, статусы, ремонт.
import { BUILDINGS, WORLD, UPGRADE_GROWTH, DEFAULT_TIER_EXTRAS, UNITS } from '../data/index.js';
import { evoMods, mod, hpFor, buildingName } from './stats.js';
import { resName } from './economy.js';

export const buildingsMixin = {
  addBuilding(type, tx, ty, { free = false } = {}) {
    const cfg = BUILDINGS[type];
    const b = {
      id: this.nextId++, type, tx, ty, size: cfg.size, level: 1, maxHp: 0, hp: 0, destroyed: false, enabled: true,
      priority: cfg.priority ?? 1, powered: !cfg.energyUse, status: 'working', progress: 0, cd: 0, spawnTimer: 1,
      builtTime: this.time, hitTime: -9, workTime: -9, reserve: cfg.reserve ?? 0, recipe: cfg.recipes?.[0].id ?? null,
      evo: {}, filter: 'all', wallGroup: 0,
    };
    b.maxHp = this.maxHpOf(b);
    b.hp = b.maxHp;
    this.buildings.push(b);
    this.bMap.set(b.id, b);
    for (let y = ty; y < ty + cfg.size; y++) {
      for (let x = tx; x < tx + cfg.size; x++) {
        this.grid[this.idx(x, y)] = b.id;
        this.removeNodeAt(x, y);
      }
    }
    this.flowDirty = true;
    this.auraDirty = true;
    if (cfg.wall) this.wallsDirty = true;
    if (!free) this.emit('built', { id: b.id, x: tx + cfg.size / 2, y: ty + cfg.size / 2, building: type });
    return b;
  },

  maxHpOf(b) {
    return b.type === 'heart' ? this.heartMaxHp(b.level) : hpFor(b.type, b.level);
  },

  isUnlocked(type) {
    const cfg = BUILDINGS[type];
    return cfg.buildable !== false && this.heartLevel >= (cfg.unlock ?? 1);
  },

  canPlace(type, tx, ty) {
    const cfg = BUILDINGS[type];
    if (!cfg || cfg.buildable === false) return { ok: false, reason: 'Это нельзя построить' };
    if (!this.isUnlocked(type)) return { ok: false, reason: `Нужен ${cfg.unlock} уровень Сердца` };
    for (let y = ty; y < ty + cfg.size; y++) {
      for (let x = tx; x < tx + cfg.size; x++) {
        if (!this.inBounds(x, y)) return { ok: false, reason: 'За краем карты' };
        if (!this.inTerritory(x + 0.5, y + 0.5, 0.4)) return { ok: false, reason: 'Только на освещённой земле' };
        const i = this.idx(x, y);
        if (this.grid[i]) return { ok: false, reason: 'Место занято' };
        if (this.nodeGrid[i]) return { ok: false, reason: 'Мешает дерево, камень или жила' };
      }
    }
    if (!this.canAfford(cfg.cost)) return { ok: false, reason: 'Не хватает: ' + this.missing(cfg.cost).join(', '), noMoney: true };
    return { ok: true };
  },

  findSpot(type, x, y, minDist = 0) {
    const size = BUILDINGS[type].size;
    let best = null;
    let bd = Infinity;
    const R = Math.ceil(this.radius()) + 2;
    const c = this.heartCenter();
    for (let ty = Math.max(0, Math.floor(c.y - R)); ty < Math.min(this.H, c.y + R); ty++) {
      for (let tx = Math.max(0, Math.floor(c.x - R)); tx < Math.min(this.W, c.x + R); tx++) {
        const d = Math.hypot(tx + size / 2 - x, ty + size / 2 - y);
        if (d >= bd || d < minDist) continue;
        const check = this.canPlace(type, tx, ty);
        if (check.ok || check.noMoney) { bd = d; best = { tx, ty }; }
      }
    }
    return best;
  },

  build(type, tx, ty, { useGems = false, quiet = false } = {}) {
    const cfg = BUILDINGS[type];
    const check = this.canPlace(type, tx, ty);
    if (!check.ok && !(check.noMoney && useGems)) {
      if (!quiet) this.emit('toast', { text: check.reason, bad: true });
      return null;
    }
    if (!this.spend(cfg.cost, useGems)) return null;
    const b = this.addBuilding(type, tx, ty);
    // всех, кто стоит на месте стройки, отодвигаем
    for (const u of [this.hero, ...this.allies, ...this.workers, ...this.repairers]) {
      if (u.dead || this.distToRect(u.x, u.y, b) > u.r) continue;
      const p = this.approachPoint(b, u.x, u.y);
      u.x = p.x; u.y = p.y;
      u.moveTarget = null;
    }
    this.stats.built++;
    if (cfg.wall) this.stats.walls++;
    if (type === 'trainingHall') this.refreshHeroStats();
    this.recomputeEnergy();
    this.emit('save');
    return b;
  },

  // Ряд секций от (x0,y0) до (x1,y1): сначала по горизонтали, затем по вертикали.
  wallLineCells(x0, y0, x1, y1) {
    const cells = [];
    const sx = Math.sign(x1 - x0) || 1;
    const sy = Math.sign(y1 - y0) || 1;
    for (let x = x0; x !== x1 + sx; x += sx) cells.push([x, y0]);
    for (let y = y0 + sy; y !== y1 + sy; y += sy) cells.push([x1, y]);
    return cells;
  },

  buildLine(type, x0, y0, x1, y1) {
    let placed = 0;
    let reason = null;
    for (const [x, y] of this.wallLineCells(x0, y0, x1, y1)) {
      const check = this.canPlace(type, x, y);
      if (!check.ok) { if (check.noMoney) { reason = check.reason; break; } continue; }
      if (this.build(type, x, y, { quiet: true })) placed++;
    }
    if (reason && !placed) this.emit('toast', { text: reason, bad: true });
    else if (reason) this.emit('toast', { text: `Поставлено ${placed}. ${reason}`, bad: true });
    return placed;
  },

  // ---------- улучшения и эволюции ----------

  levelCap(b) {
    if (b.type === 'heart') return BUILDINGS.heart.maxLevel;
    return Math.min(BUILDINGS[b.type].maxLevel, this.heartLevel);
  },

  upgradeCost(b) {
    const cfg = BUILDINGS[b.type];
    const k = Math.pow(UPGRADE_GROWTH, b.level - 1);
    const cost = {};
    for (const [r, v] of Object.entries(cfg.upgrade || {})) cost[r] = Math.ceil(v * k);
    const extras = cfg.tierExtras || DEFAULT_TIER_EXTRAS;
    for (const [from, mats] of Object.entries(extras)) {
      const f = Number(from);
      if (b.level < f) continue;
      const kk = Math.pow(1.12, b.level - f);
      for (const [r, v] of Object.entries(mats)) cost[r] = (cost[r] || 0) + Math.ceil(v * kk);
    }
    return cost;
  },

  pendingEvolution(b) {
    const cfg = BUILDINGS[b.type];
    if (!cfg.evolutions) return null;
    for (const tier of [10, 20, 30]) {
      if (b.level >= tier && cfg.evolutions[tier] && !b.evo[tier]) return tier;
    }
    return null;
  },

  canUpgrade(b) {
    if (b.type === 'heart') return this.canUpgradeHeart();
    const cfg = BUILDINGS[b.type];
    if (b.level >= cfg.maxLevel) return { ok: false, reason: 'Максимальный уровень' };
    if (b.level >= this.levelCap(b)) return { ok: false, reason: `Нужен ${b.level + 1} уровень Сердца`, heart: true };
    if (b.destroyed) return { ok: false, reason: 'Сначала нужен ремонт' };
    if (this.pendingEvolution(b)) return { ok: false, reason: 'Сначала выбери эволюцию', evo: true };
    const cost = this.upgradeCost(b);
    if (!this.canAfford(cost)) return { ok: false, reason: 'Не хватает: ' + this.missing(cost).join(', '), cost, noMoney: true };
    return { ok: true, cost };
  },

  upgrade(id, useGems = false) {
    const b = this.byId(id);
    if (!b) return false;
    if (b.type === 'heart') return this.upgradeHeart(useGems);
    const check = this.canUpgrade(b);
    if (!check.ok && !(check.noMoney && useGems)) {
      this.emit('toast', { text: check.reason, bad: true });
      return false;
    }
    if (!this.spend(this.upgradeCost(b), useGems)) return false;
    this.applyLevel(b, b.level + 1);
    return true;
  },

  applyLevel(b, level) {
    const oldMax = b.maxHp;
    b.level = level;
    b.maxHp = this.maxHpOf(b);
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp - oldMax));
    if (BUILDINGS[b.type].wall) this.wallsDirty = true;
    if (b.type === 'trainingHall') this.refreshHeroStats();
    this.auraDirty = true;
    const c = this.center(b);
    this.emit('upgraded', { id: b.id, x: c.x, y: c.y, level: b.level });
    if (this.pendingEvolution(b)) this.emit('evolutionReady', { id: b.id });
    this.recomputeEnergy();
    this.emit('save');
  },

  // Улучшает весь сцепленный забор (все секции одного уровня).
  wallSegment(b) {
    const g = this.wallGroups.get(b.wallGroup);
    return g ? g.members.map((id) => this.byId(id)).filter(Boolean) : [b];
  },

  segmentUpgradeCost(b) {
    const parts = this.wallSegment(b);
    const one = this.upgradeCost(b);
    const cost = {};
    for (const [k, v] of Object.entries(one)) cost[k] = v * parts.length;
    return { cost, count: parts.length };
  },

  upgradeSegment(id, useGems = false) {
    const b = this.byId(id);
    if (!b) return false;
    const check = this.canUpgrade(b);
    if (!check.ok && !(check.noMoney && useGems)) {
      this.emit('toast', { text: check.reason, bad: true });
      return false;
    }
    const { cost } = this.segmentUpgradeCost(b);
    if (!this.spend(cost, useGems)) return false;
    for (const w of this.wallSegment(b)) this.applyLevel(w, w.level + 1);
    return true;
  },

  chooseEvolution(id, optionId) {
    const b = this.byId(id);
    const tier = b && this.pendingEvolution(b);
    if (!tier) return false;
    const opt = BUILDINGS[b.type].evolutions[tier].find((o) => o.id === optionId);
    if (!opt) return false;
    b.evo = { ...b.evo, [tier]: optionId };
    this.stats.evolutions++;
    this.unlockStory('first_evolution');
    const c = this.center(b);
    this.emit('evolved', { id: b.id, x: c.x, y: c.y, name: opt.name });
    this.auraDirty = true;
    this.recomputeEnergy();
    this.emit('save');
    return true;
  },

  // ---------- снос ----------

  // Возврат за снос: половина цены постройки и всех её улучшений (у разрушенной — четверть).
  demolishRefund(b) {
    const cfg = BUILDINGS[b.type];
    const total = { ...(cfg.cost || {}) };
    for (let lvl = 1; lvl < b.level; lvl++) {
      for (const [k, v] of Object.entries(this.upgradeCost({ type: b.type, level: lvl }))) total[k] = (total[k] || 0) + v;
    }
    const k = (b.destroyed ? 0.5 : 1) * WORLD.demolishRefund;
    const out = {};
    for (const [r, v] of Object.entries(total)) {
      if (r === 'gems') continue;
      const n = Math.floor(v * k);
      if (n > 0) out[r] = n;
    }
    return out;
  },

  canDemolish(b) {
    if (!b || b.type === 'heart') return { ok: false, reason: 'Сердце снести нельзя' };
    if (this.phase === 'wave') return { ok: false, reason: 'Сносить можно только между волнами' };
    return { ok: true };
  },

  demolish(id) {
    const b = this.byId(id);
    const check = this.canDemolish(b);
    if (!check.ok) {
      this.emit('toast', { text: check.reason, bad: true });
      return false;
    }
    const refund = this.demolishRefund(b);
    const cfg = BUILDINGS[b.type];
    for (let y = b.ty; y < b.ty + b.size; y++) {
      for (let x = b.tx; x < b.tx + b.size; x++) {
        const i = this.idx(x, y);
        if (this.grid[i] === b.id) this.grid[i] = 0;
      }
    }
    b.destroyed = true;
    b.removed = true;
    this.buildings = this.buildings.filter((o) => o !== b);
    this.bMap.delete(b.id);
    // жители постройки уходят вместе с ней
    for (const list of [this.allies, this.workers]) {
      for (const u of list) if (u.home === b.id && !u.dead) { u.dead = true; this.emit('poof', { x: u.x, y: u.y }); }
    }
    this.repairers = this.repairers.filter((r) => r.home !== b.id);
    for (const r of this.repairers) if (r.task === b.id) r.task = 0;
    this.flowDirty = true;
    this.auraDirty = true;
    if (cfg.wall) this.wallsDirty = true;
    const c = { x: b.tx + b.size / 2, y: b.ty + b.size / 2 };
    let i = 0;
    for (const [r, v] of Object.entries(refund)) {
      const got = this.addRes(r, v);
      if (got > 0) this.emit('gain', { x: c.x, y: c.y - 0.6 - i++ * 0.45, res: r, amount: Math.round(got) });
    }
    this.stats.demolished = (this.stats.demolished || 0) + 1;
    if (b.type === 'trainingHall') this.refreshHeroStats();
    this.recomputeEnergy();
    this.emit('demolished', { id: b.id, x: c.x, y: c.y, size: b.size, building: b.type });
    this.emit('save');
    return true;
  },

  toggleEnabled(id) {
    const b = this.byId(id);
    if (!b) return;
    b.enabled = !b.enabled;
    this.recomputeEnergy();
    this.emit('save');
  },

  changePriority(id, delta) {
    const b = this.byId(id);
    if (!b) return;
    b.priority = Math.max(0, Math.min(5, b.priority + delta));
    this.recomputeEnergy();
    this.emit('save');
  },

  setWorkerFilter(id, filter) {
    const b = this.byId(id);
    if (!b) return;
    b.filter = filter;
    for (const w of this.workers) if (w.home === id) { w.task = 0; w.state = 'seek'; }
    this.emit('save');
  },

  // ---------- ауры сторожевых башен ----------

  recomputeAuras() {
    const watchers = this.buildings.filter((b) => BUILDINGS[b.type].aura && !b.destroyed && b.enabled && b.powered !== false);
    for (const b of this.buildings) {
      if (!BUILDINGS[b.type].attack) continue;
      const c = this.center(b);
      let dmg = 0; let rng = 0;
      for (const w of watchers) {
        const a = BUILDINGS[w.type].aura;
        const wc = this.center(w);
        if (Math.hypot(wc.x - c.x, wc.y - c.y) <= a.radius + 0.1 * (w.level - 1)) {
          dmg = Math.max(dmg, a.damage * (1 + 0.05 * (w.level - 1)));
          rng = Math.max(rng, a.range * (1 + 0.03 * (w.level - 1)));
        }
      }
      b.aura = { damage: dmg, range: rng };
    }
    this.auraDirty = false;
  },

  // ---------- заборы: общая прочность ----------

  // Секции забора/ворот одного уровня, касающиеся сторонами, — одна группа с общей прочностью.
  rebuildWallGroups() {
    this.wallGroups = new Map();
    const walls = this.buildings.filter((b) => BUILDINGS[b.type].wall);
    for (const w of walls) w.wallGroup = 0;
    let gid = 1;
    for (const w of walls) {
      if (w.wallGroup) continue;
      const group = { id: gid, members: [], level: w.level, destroyed: w.destroyed };
      const stack = [w];
      w.wallGroup = gid;
      while (stack.length) {
        const cur = stack.pop();
        group.members.push(cur.id);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.buildingAt(cur.tx + dx, cur.ty + dy);
          if (!n || n.wallGroup || !BUILDINGS[n.type].wall) continue;
          if (n.level !== w.level || n.destroyed !== w.destroyed) continue;
          n.wallGroup = gid;
          stack.push(n);
        }
      }
      // выравниваем прочность: общая доля на всех
      const ms = group.members.map((id) => this.byId(id));
      const hp = ms.reduce((s, m) => s + m.hp, 0);
      const max = ms.reduce((s, m) => s + m.maxHp, 0);
      for (const m of ms) m.hp = m.maxHp * (hp / max);
      this.wallGroups.set(gid, group);
      gid++;
    }
    this.wallsDirty = false;
  },

  wallGroupHp(b) {
    const ms = this.wallSegment(b);
    return { hp: ms.reduce((s, m) => s + m.hp, 0), maxHp: ms.reduce((s, m) => s + m.maxHp, 0), count: ms.length };
  },

  // ---------- урон и ремонт ----------

  damageBuilding(b, amount) {
    if (b.destroyed) return;
    b.hitTime = this.time;
    const c = this.center(b);
    if (BUILDINGS[b.type].wall) {
      const ms = this.wallSegment(b);
      const g = this.wallGroupHp(b);
      const ratio = Math.max(0, (g.hp - amount) / g.maxHp);
      for (const m of ms) { m.hp = m.maxHp * ratio; m.hitTime = this.time; }
      this.emit('buildingHit', { x: c.x, y: c.y, id: b.id });
      if (ratio <= 0) {
        for (const m of ms) {
          m.hp = 0;
          m.destroyed = true;
          const mc = this.center(m);
          this.emit('collapse', { x: mc.x, y: mc.y, size: 1, building: m.type });
        }
        this.flowDirty = true;
        this.wallsDirty = true;
      }
      return;
    }
    b.hp -= amount;
    this.emit('buildingHit', { x: c.x, y: c.y, id: b.id });
    if (b.hp <= 0) {
      b.hp = 0;
      if (b.type === 'heart') return; // поражение проверит волна
      b.destroyed = true;
      this.flowDirty = true;
      this.auraDirty = true;
      this.recomputeEnergy();
      this.emit('collapse', { x: c.x, y: c.y, size: b.size, building: b.type });
    }
  },

  // Ремонт на amount единиц (для забора — на всю секцию).
  repairBuilding(b, amount) {
    if (BUILDINGS[b.type].wall) {
      const ms = this.wallSegment(b);
      const g = this.wallGroupHp(b);
      let ratio = Math.min(1, (g.hp + amount) / g.maxHp);
      if (g.maxHp - g.hp - amount < 0.5) ratio = 1;
      for (const m of ms) m.hp = m.maxHp * ratio;
      if (ratio >= 1) {
        let revived = false;
        for (const m of ms) if (m.destroyed) { m.destroyed = false; revived = true; }
        if (revived) { this.flowDirty = true; this.wallsDirty = true; }
        return true;
      }
      return false;
    }
    b.hp = Math.min(b.maxHp, b.hp + amount);
    if (b.maxHp - b.hp < 0.5) b.hp = b.maxHp;
    if (b.hp >= b.maxHp) {
      if (b.destroyed) {
        b.destroyed = false;
        this.flowDirty = true;
        this.auraDirty = true;
        this.recomputeEnergy();
      }
      return true;
    }
    return false;
  },

  missingHp(b) {
    if (BUILDINGS[b.type].wall) {
      const g = this.wallGroupHp(b);
      return g.maxHp - g.hp;
    }
    return b.maxHp - b.hp;
  },

  manualRepairCost(b) {
    return { wood: Math.max(1, Math.ceil(this.missingHp(b) * WORLD.repairWoodPerHp * WORLD.manualRepairMultiplier)) };
  },

  repairNow(id, useGems = false) {
    const b = this.byId(id);
    if (!b || this.missingHp(b) < 0.5) return false;
    if (this.phase !== 'build') {
      this.emit('toast', { text: 'Чинить вручную можно только между волнами', bad: true });
      return false;
    }
    if (!this.spend(this.manualRepairCost(b), useGems)) return false;
    this.repairBuilding(b, Infinity);
    const c = this.center(b);
    this.emit('repaired', { x: c.x, y: c.y, id: b.id });
    this.emit('save');
    return true;
  },

  repairEstimate() {
    let missing = 0;
    const seen = new Set();
    for (const b of this.buildings) {
      if (BUILDINGS[b.type].wall) {
        if (seen.has(b.wallGroup)) continue;
        seen.add(b.wallGroup);
      }
      missing += this.missingHp(b);
    }
    return { hp: Math.round(missing), wood: Math.ceil(missing * WORLD.repairWoodPerHp) };
  },

  // ---------- статус ----------

  squadSize(b) {
    const s = BUILDINGS[b.type].spawns;
    return s.count + Math.floor((b.level - 1) / s.every) + mod(evoMods(b), 'units');
  },

  workerCount(b) {
    const w = BUILDINGS[b.type].workers;
    return w.count + Math.floor((b.level - 1) / w.every) + mod(evoMods(b), 'workers');
  },

  repairerCount(b) {
    const r = BUILDINGS[b.type].repair;
    return r.workers + Math.floor((b.level - 1) / r.every);
  },

  statusOf(b) {
    const cfg = BUILDINGS[b.type];
    if (b.destroyed) return { code: 'destroyed', text: 'Разрушено — ремонтники восстановят после волны', bad: true };
    if (this.pendingEvolution(b)) return { code: 'evolve', text: 'Готово к эволюции — выбери путь', bad: false, evolve: true };
    if (!b.enabled) return { code: 'disabled', text: 'Отключено вручную', bad: true };
    if (cfg.energyUse && !b.powered) {
      return { code: 'no_power', text: `Нет энергии: нужно ${cfg.energyUse}, в сети не хватает ${this.energy.deficit}`, bad: true };
    }
    if (cfg.recipes) {
      const r = this.recipeOf(b);
      if (r.minLevel && b.level < r.minLevel) return { code: 'locked', text: `Рецепт откроется на ${r.minLevel} уровне`, bad: true };
      if (!this.canAfford(r.input)) {
        return { code: 'no_input', text: 'Нет сырья: нужно ' + Object.entries(r.input).map(([k, v]) => `${v} ${resName(k).toLowerCase()}`).join(', '), bad: true };
      }
      const low = Object.entries(r.input).find(([k, v]) => this.res[k] - v < b.reserve);
      if (low) return { code: 'reserve', text: `Ждёт: ${resName(low[0]).toLowerCase()} не ниже резерва ${b.reserve}` };
      const full = Object.keys(r.output).some((k) => this.res[k] >= this.capOf(k));
      if (full) return { code: 'full', text: 'Склад полон — построй или улучши склад', bad: true };
      return { code: 'working', text: 'Работает' };
    }
    if (cfg.spawns) {
      const have = this.allies.filter((a) => a.home === b.id).length;
      const max = this.squadSize(b);
      const unit = UNITS[cfg.spawns.unit].name.toLowerCase();
      if (have < max && this.res.food < cfg.spawns.foodCost) return { code: 'no_food', text: `Нет еды на нового бойца (${cfg.spawns.foodCost})`, bad: true };
      if (have < max) return { code: 'working', text: `Отряд ${have}/${max}, следующий (${unit}) через ${Math.ceil(b.spawnTimer)} с` };
      return { code: 'working', text: `Отряд ${have}/${max} на посту` };
    }
    if (cfg.workers) {
      const have = this.workers.filter((w) => w.home === b.id).length;
      const max = this.workerCount(b);
      if (have < max && this.res.food < cfg.workers.foodCost) return { code: 'no_food', text: `Нет еды на нового рабочего (${cfg.workers.foodCost})`, bad: true };
      if (this.phase === 'wave') return { code: 'working', text: `Рабочие ${have}/${max} укрылись до конца волны` };
      return { code: 'working', text: `Рабочие ${have}/${max} добывают ресурсы` };
    }
    if (cfg.repair) {
      if (this.repairBlocked) return { code: 'no_input', text: 'Ремонт стоит: нет древесины', bad: true };
      if (this.phase === 'wave') return { code: 'working', text: 'Ремонтники укрылись до конца волны' };
      return { code: 'working', text: 'Готов к ремонту' };
    }
    if (b.hp < b.maxHp) return { code: 'damaged', text: 'Повреждено, но работает' };
    return { code: 'working', text: 'Работает' };
  },

  displayName(b) { return buildingName(b); },
};
