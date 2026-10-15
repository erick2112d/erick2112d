// Карта: свет Сердца, мгла, природные ресурсы, столкновения и поиск пути.
import { WORLD, NODES, ZONES, NODE_RESPAWN_SECONDS, BUILDINGS, SHRINES, NOTES, heartRadius } from '../data/index.js';
import { createRng } from './rng.js';
import { buildFlowField, nextCell, findPath } from './flowfield.js';

export const worldMixin = {
  // ---------- свет и мгла ----------

  radius() { return heartRadius(this.heartLevel); },

  inTerritory(x, y, margin = 0) {
    const c = this.heartCenter();
    return (x - c.x) ** 2 + (y - c.y) ** 2 <= (this.radius() - margin) ** 2;
  },

  distFromHeart(x, y) {
    const c = this.heartCenter();
    return Math.hypot(x - c.x, y - c.y);
  },

  zoneAt(x, y) {
    const d = this.distFromHeart(x, y);
    return ZONES.find((z) => d >= z.rMin && d < z.rMax) || ZONES[ZONES.length - 1];
  },

  // Самая дальняя зона, куда уже дотянулся свет.
  openZone() {
    const r = this.radius();
    let z = 1;
    for (const zone of ZONES) if (r > zone.rMin + 0.5) z = zone.id;
    return z;
  },

  // Герой и союзники не заходят во мглу.
  clampToTerritory(u) {
    const c = this.heartCenter();
    const R = this.radius() - u.r - 0.1;
    const dx = u.x - c.x;
    const dy = u.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      u.x = c.x + (dx / d) * R;
      u.y = c.y + (dy / d) * R;
      return true;
    }
    return false;
  },

  // ---------- генерация ----------

  generateMap() {
    const rng = createRng(20251015);
    const c = { x: WORLD.heart.tx + 1.5, y: WORLD.heart.ty + 1.5 };
    this.activities.shrines = [];
    this.activities.notes = [];
    const at = (zone, k, n) => {
      const a = (k / n) * Math.PI * 2 + rng.range(-0.4, 0.4) + zone.id * 1.3;
      const r = rng.range(zone.rMin + 2.5, Math.min(zone.rMax, 57) - 2);
      return { x: Math.floor(c.x + Math.cos(a) * r) + 0.5, y: Math.floor(c.y + Math.sin(a) * r) + 0.5 };
    };
    for (const zone of ZONES) {
      if (zone.id === 1) continue;
      for (let k = 0; k < SHRINES.perZone; k++) {
        const p = at(zone, k, SHRINES.perZone);
        this.activities.shrines.push({ id: this.nextId++, x: p.x, y: p.y, zone: zone.id, readyAt: 0 });
      }
    }
    // в стартовой зоне одно святилище поближе
    this.activities.shrines.push({ id: this.nextId++, x: c.x - 5.5, y: c.y + 4.5, zone: 1, readyAt: 0 });
    const perZone = {};
    for (const n of NOTES) {
      const zone = ZONES.find((z) => z.id === n.zone);
      perZone[n.zone] = (perZone[n.zone] || 0) + 1;
      const p = zone.id === 1 ? { x: c.x + (perZone[1] === 1 ? 5.5 : -3.5), y: c.y + (perZone[1] === 1 ? -4.5 : -6) } : at(zone, perZone[n.zone] + 0.5, 2);
      this.activities.notes.push({ id: n.id, x: p.x, y: p.y, zone: n.zone });
    }
  },

  // ---------- узлы ресурсов ----------

  addNode(kind, tx, ty, hp) {
    const cfg = NODES[kind];
    const n = { id: this.nextId++, kind, tx, ty, x: tx + 0.5, y: ty + 0.5, r: cfg.collider, hp: hp ?? cfg.hp, maxHp: cfg.hp, hitTime: -9, born: this.time };
    this.nodes.push(n);
    this.nMap.set(n.id, n);
    this.nodeGrid[this.idx(tx, ty)] = n.id;
    this.flowDirty = true;
    return n;
  },

  removeNode(n) {
    this.nodeGrid[this.idx(n.tx, n.ty)] = 0;
    this.nMap.delete(n.id);
    this.nodes = this.nodes.filter((x) => x !== n);
    this.flowDirty = true;
  },

  removeNodeAt(tx, ty) {
    const id = this.nodeGrid[this.idx(tx, ty)];
    if (id) this.removeNode(this.nMap.get(id));
  },

  nodeAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    const id = this.nodeGrid[this.idx(tx, ty)];
    return id ? this.nMap.get(id) : null;
  },

  // Доля кольца зоны, уже освещённая Сердцем.
  zoneRevealed(zone) {
    const R = this.radius();
    if (R <= zone.rMin) return 0;
    const outer = Math.min(R, zone.rMax);
    return (outer * outer - zone.rMin * zone.rMin) / (zone.rMax * zone.rMax - zone.rMin * zone.rMin);
  },

  canPlaceNode(tx, ty) {
    if (!this.inBounds(tx, ty)) return false;
    if (!this.inTerritory(tx + 0.5, ty + 0.5, 0.8)) return false;
    if (this.distFromHeart(tx + 0.5, ty + 0.5) < 3.4) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx; const y = ty + dy;
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        if (this.nodeGrid[i]) return false;
        if (dx === 0 && dy === 0 && this.grid[i]) return false;
      }
    }
    // не вплотную к постройкам — остаются проходы
    if (this.grid[this.idx(tx, ty)]) return false;
    const h = this.hero;
    if (Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 1) return false;
    return !this.activities.chests.some((c) => Math.hypot(c.x - tx - 0.5, c.y - ty - 0.5) < 1.2);
  },

  spawnNodeInZone(zone, rand = Math.random) {
    const c = this.heartCenter();
    const weights = Object.entries(zone.nodes);
    const total = weights.reduce((s, [, v]) => s + v, 0);
    let roll = rand() * total;
    let kind = weights[0][0];
    for (const [k, v] of weights) { roll -= v; if (roll <= 0) { kind = k; break; } }
    const rMax = Math.min(zone.rMax, this.radius() - 0.8);
    for (let tries = 0; tries < 40; tries++) {
      const a = rand() * Math.PI * 2;
      const r = zone.rMin + rand() * (rMax - zone.rMin);
      const tx = Math.floor(c.x + Math.cos(a) * r);
      const ty = Math.floor(c.y + Math.sin(a) * r);
      if (this.canPlaceNode(tx, ty)) return this.addNode(kind, tx, ty);
    }
    return null;
  },

  zoneNodeCount(zone) {
    let n = 0;
    for (const node of this.nodes) {
      const d = this.distFromHeart(node.x, node.y);
      if (d >= zone.rMin && d < zone.rMax) n++;
    }
    return n;
  },

  zoneCap(zone) {
    const total = Object.values(zone.nodes).reduce((s, v) => s + v, 0);
    return Math.round(total * this.zoneRevealed(zone));
  },

  // Мгновенно заполняет открытые зоны (новая игра, рост Сердца).
  fillNodes(seeded) {
    const rr = createRng(4242 + this.heartLevel);
    const rand = seeded ? () => rr.next() : Math.random;
    for (const zone of ZONES) {
      const cap = this.zoneCap(zone);
      let have = this.zoneNodeCount(zone);
      let guard = 0;
      while (have < cap && guard++ < cap * 3) {
        if (this.spawnNodeInZone(zone, rand)) have++;
      }
    }
  },

  updateNodes(dt) {
    for (const zone of ZONES) {
      const cap = this.zoneCap(zone);
      if (!cap) continue;
      this.zoneTimers[zone.id] = (this.zoneTimers[zone.id] ?? NODE_RESPAWN_SECONDS) - dt;
      if (this.zoneTimers[zone.id] > 0) continue;
      this.zoneTimers[zone.id] = NODE_RESPAWN_SECONDS;
      if (this.zoneNodeCount(zone) < cap) {
        const n = this.spawnNodeInZone(zone);
        if (n) this.emit('nodeGrow', { x: n.x, y: n.y });
      }
    }
  },

  // Удар по узлу (герой или рабочий). Возвращает добытое количество.
  hitNode(n, dmg, { byWorker = false } = {}) {
    if (!n || n.hp <= 0) return 0;
    const cfg = NODES[n.kind];
    const real = Math.min(dmg, n.hp);
    n.hp -= real;
    n.hitTime = this.time;
    let gain = cfg.perHit * real;
    if (n.hp <= 0) {
      gain += cfg.onBreak;
      this.emit('nodeBreak', { x: n.x, y: n.y, kind: n.kind });
      this.removeNode(n);
    }
    this.emit('nodeHit', { x: n.x, y: n.y, kind: n.kind });
    if (!byWorker) {
      const added = this.addRes(cfg.res, gain);
      this.stats.gathered += added;
      this.emit('gain', { x: n.x, y: n.y - 0.7, res: cfg.res, amount: gain });
    }
    return gain;
  },

  // ---------- клетки и столкновения ----------

  buildingAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    const id = this.grid[this.idx(tx, ty)];
    return id ? this.bMap.get(id) : null;
  },

  // who: 'friend' | 'enemy'
  isSolidCell(i, who = 'friend') {
    const bid = this.grid[i];
    if (bid) {
      const b = this.bMap.get(bid);
      if (b && !b.destroyed) {
        const cfg = BUILDINGS[b.type];
        if (cfg.trap) return false;
        if (cfg.gate && who === 'friend') return false;
        return true;
      }
    }
    const nid = this.nodeGrid[i];
    if (nid) {
      const n = this.nMap.get(nid);
      if (n && n.hp > 0) return true;
    }
    return false;
  },

  distToRect(x, y, b, inset = 0) {
    const x0 = b.tx + inset; const x1 = b.tx + b.size - inset;
    const y0 = b.ty + inset; const y1 = b.ty + b.size - inset;
    const dx = Math.max(x0 - x, 0, x - x1);
    const dy = Math.max(y0 - y, 0, y - y1);
    return Math.hypot(dx, dy);
  },

  // Контур, о который спотыкаются герой и союзники: меньше клетки здания и смещён к его «подошве»,
  // чтобы между соседними постройками и позади них можно было пройти.
  colliderBox(b) {
    const cfg = BUILDINGS[b.type];
    if (cfg.wall) return { x0: b.tx, y0: b.ty, x1: b.tx + 1, y1: b.ty + 1 };
    const c = cfg.collider || (b.size >= 3 ? [0.4, 0.75, 0.3] : b.size === 2 ? [0.3, 0.6, 0.15] : [0.22, 0.38, 0.1]);
    return { x0: b.tx + c[0], y0: b.ty + c[1], x1: b.tx + b.size - c[0], y1: b.ty + b.size - c[2] };
  },

  // Точка (x, y) занята для союзников с запасом pad?
  friendBlocked(x, y, pad = 0) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const R = pad > 0 ? 1 : 0;
    for (let yy = cy - R; yy <= cy + R; yy++) {
      for (let xx = cx - R; xx <= cx + R; xx++) {
        if (!this.inBounds(xx, yy)) { if (xx === cx && yy === cy) return true; continue; }
        const i = this.idx(xx, yy);
        const bid = this.grid[i];
        if (bid) {
          const b = this.bMap.get(bid);
          if (b && !b.destroyed && this.isSolidCell(i, 'friend')) {
            const q = this.colliderBox(b);
            if (x > q.x0 - pad && x < q.x1 + pad && y > q.y0 - pad && y < q.y1 + pad) return true;
          }
        }
        const nid = this.nodeGrid[i];
        if (nid) {
          const n = this.nMap.get(nid);
          if (n && n.hp > 0 && Math.hypot(x - n.x, y - n.y) < n.r + pad) return true;
        }
      }
    }
    return false;
  },

  // Выталкивает круглое тело из построек (по их реальному контуру) и стволов деревьев.
  resolveSolids(u, who = u.kind === 'enemy' ? 'enemy' : 'friend') {
    const r = u.r;
    u.x = Math.max(r, Math.min(this.W - r, u.x));
    u.y = Math.max(r, Math.min(this.H - r, u.y));
    if (u.flying) return;
    const x0 = Math.floor(u.x - r - 0.5);
    const x1 = Math.floor(u.x + r + 0.5);
    const y0 = Math.floor(u.y - r - 0.5);
    const y1 = Math.floor(u.y + r + 0.5);
    const seen = new Set();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.inBounds(cx, cy)) continue;
        const i = this.idx(cx, cy);
        const bid = this.grid[i];
        if (bid && !seen.has(bid)) {
          seen.add(bid);
          const b = this.bMap.get(bid);
          if (b && !b.destroyed && this.isSolidCell(i, who)) this.pushOutOfRect(u, b, who);
        }
        const nid = this.nodeGrid[i];
        if (nid) {
          const n = this.nMap.get(nid);
          if (n && n.hp > 0) this.pushOutOfCircle(u, n.x, n.y, n.r);
        }
      }
    }
    if (who === 'friend') this.clampToTerritory(u);
  },

  pushOutOfRect(u, b, who = 'enemy') {
    let x0; let x1; let y0; let y1;
    let rr = u.r;
    if (who === 'friend') {
      ({ x0, y0, x1, y1 } = this.colliderBox(b));
      rr = u.r * 0.8;
    } else {
      const inset = BUILDINGS[b.type].inset ?? 0.12;
      x0 = b.tx + inset; x1 = b.tx + b.size - inset;
      y0 = b.ty + inset; y1 = b.ty + b.size - inset;
    }
    const px = Math.max(x0, Math.min(u.x, x1));
    const py = Math.max(y0, Math.min(u.y, y1));
    let dx = u.x - px;
    let dy = u.y - py;
    const d = Math.hypot(dx, dy);
    if (d >= rr) return;
    if (d < 1e-6) {
      const m = Math.min(u.x - x0, x1 - u.x, u.y - y0, y1 - u.y);
      if (m === u.x - x0) u.x = x0 - rr; else if (m === x1 - u.x) u.x = x1 + rr;
      else if (m === u.y - y0) u.y = y0 - rr; else u.y = y1 + rr;
      return;
    }
    dx /= d; dy /= d;
    u.x = px + dx * rr;
    u.y = py + dy * rr;
  },

  pushOutOfCircle(u, x, y, r) {
    const dx = u.x - x;
    const dy = u.y - y;
    const d = Math.hypot(dx, dy);
    const min = u.r + r;
    if (d >= min) return;
    if (d < 1e-6) { u.y += min; return; }
    u.x = x + (dx / d) * min;
    u.y = y + (dy / d) * min;
  },

  // ---------- поле пути врагов ----------

  rebuildFlow() {
    const heart = this.heart();
    const goals = [];
    for (let y = heart.ty; y < heart.ty + heart.size; y++) {
      for (let x = heart.tx; x < heart.tx + heart.size; x++) goals.push(this.idx(x, y));
    }
    const solid = (i) => this.isSolidCell(i, 'enemy');
    this.flow = buildFlowField(this.W, this.H, goals, (i) => {
      const nid = this.nodeGrid[i];
      if (nid) {
        const n = this.nMap.get(nid);
        if (n && n.hp > 0) return Infinity;
      }
      const bid = this.grid[i];
      if (bid) {
        const b = this.bMap.get(bid);
        if (b && !b.destroyed && !BUILDINGS[b.type].trap) return 1 + WORLD.flowWallPenalty;
      }
      return 1;
    }, solid);
    this.flowDirty = false;
  },

  nextFlowCell(i) {
    return nextCell(this.flow, this.W, this.H, i, (k) => this.isSolidCell(k, 'enemy'));
  },

  // ---------- движение ----------

  clearLine(x0, y0, x1, y1, r, who = 'friend') {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (who === 'friend') {
      const steps = Math.ceil(d / 0.2);
      for (let k = 1; k <= steps; k++) {
        if (this.friendBlocked(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, r * 0.8)) return false;
      }
      return true;
    }
    const steps = Math.ceil(d / 0.3);
    for (let k = 1; k <= steps; k++) {
      const x = x0 + ((x1 - x0) * k) / steps;
      const y = y0 + ((y1 - y0) * k) / steps;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        const cx = Math.floor(x + ox * 0.9);
        const cy = Math.floor(y + oy * 0.9);
        if (!this.inBounds(cx, cy) || this.isSolidCell(this.idx(cx, cy), who)) return false;
      }
    }
    return true;
  },

  // Движение с обходом препятствий. false — цель недостижима.
  // Союзники ищут путь по сетке из полуклеток, поэтому протискиваются между соседними постройками.
  navigate(u, tx, ty, speed, stop, dt) {
    const who = u.kind === 'enemy' ? 'enemy' : 'friend';
    const d = Math.hypot(tx - u.x, ty - u.y);
    if (d <= stop || u.flying || this.clearLine(u.x, u.y, tx, ty, u.r, who)) {
      u.path = null;
      this.moveToward(u, tx, ty, speed, stop, dt);
      return true;
    }
    const S = who === 'friend' ? 2 : 1;
    const GW = this.W * S;
    const sub = (x, y) => Math.floor(x * S) + Math.floor(y * S) * GW;
    const goal = sub(tx, ty);
    if (!u.path || u.pathGoal !== goal || this.time - u.pathTime > 1) {
      const start = sub(u.x, u.y);
      const solid = S === 1
        ? (i) => this.isSolidCell(i, who)
        : (i) => this.friendBlocked(((i % GW) + 0.5) / S, (Math.floor(i / GW) + 0.5) / S, 0.1);
      u.path = findPath(GW, this.H * S, start, goal, solid, S === 1 ? 4000 : 9000);
      u.pathGoal = goal;
      u.pathTime = this.time;
    }
    if (!u.path) {
      this.moveToward(u, tx, ty, speed, stop, dt);
      return false;
    }
    const cellX = (i) => ((i % GW) + 0.5) / S;
    const cellY = (i) => (Math.floor(i / GW) + 0.5) / S;
    while (u.path.length > 1 && (Math.hypot(cellX(u.path[0]) - u.x, cellY(u.path[0]) - u.y) < 0.35 / S
      || this.clearLine(u.x, u.y, cellX(u.path[1]), cellY(u.path[1]), u.r, who))) u.path.shift();
    if (u.path.length <= 1) {
      this.moveToward(u, tx, ty, speed, stop, dt);
      return true;
    }
    this.moveToward(u, cellX(u.path[0]), cellY(u.path[0]), speed, 0, dt);
    return true;
  },

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
        if (!this.inTerritory(tx + 0.5, ty + 0.5, 0.3)) continue;
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d < bd) { bd = d; best = { x: tx + 0.5, y: ty + 0.5 }; }
      }
    }
    return best || this.center(b);
  },

  moveToward(u, tx, ty, speed, stop, dt) {
    const slow = u.slowUntil > this.time ? 1 - u.slowFactor : 1;
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d > stop) {
      const sp = speed * slow;
      const s = Math.min(sp * dt, d - stop);
      u.vx = (dx / d) * sp;
      u.vy = (dy / d) * sp;
      u.x += (dx / d) * s;
      u.y += (dy / d) * s;
      if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
      u.moving = true;
    } else {
      u.vx = 0; u.vy = 0;
      u.moving = false;
    }
    this.resolveSolids(u);
  },

  separateUnits() {
    const list = [];
    if (!this.hero.dead) list.push(this.hero);
    for (const a of this.allies) if (!a.dead) list.push(a);
    for (const w of this.workers) if (!w.dead && !w.hidden) list.push(w);
    for (const e of this.enemies) if (!e.dead) list.push(e);
    for (const r of this.repairers) list.push(r);
    const buckets = new Map();
    for (const u of list) {
      const k = Math.floor(u.x) + Math.floor(u.y) * 1000;
      let cell = buckets.get(k);
      if (!cell) { cell = []; buckets.set(k, cell); }
      cell.push(u);
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
            if (!!o.flying !== !!u.flying) continue;
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
  },
};
