// Союзники: воины из казарм, рабочие, ремонтники.
import { BUILDINGS, UNITS, NODES, WORLD } from '../data/index.js';
import { evoMods, mod } from './stats.js';

// Какие узлы берёт рабочий при выбранном фильтре лагеря.
export const WORKER_FILTERS = {
  all: { name: 'Всё подряд', kinds: null },
  wood: { name: 'Лес', kinds: ['tree'] },
  food: { name: 'Ягоды', kinds: ['bush'] },
  stone: { name: 'Камень', kinds: ['rock'] },
  metal: { name: 'Руда и уголь', kinds: ['ironVein', 'coalSeam', 'silver', 'mithril', 'meteor'] },
  crystal: { name: 'Кристаллы', kinds: ['crystal'] },
};

export const unitsMixin = {
  // ---------- казармы ----------

  updateSpawners(dt) {
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (b.destroyed) continue;
      if (cfg.spawns) this.spawnSoldiers(b, cfg, dt);
      if (cfg.workers) this.spawnWorkers(b, cfg, dt);
    }
  },

  spawnSoldiers(b, cfg, dt) {
    const s = cfg.spawns;
    const mine = this.allies.filter((a) => a.home === b.id);
    if (mine.length >= this.squadSize(b)) { b.spawnTimer = s.respawn; return; }
    b.spawnTimer -= dt;
    if (b.spawnTimer > 0) return;
    if ((this.res.food || 0) < s.foodCost) { b.spawnTimer = 1; return; }
    this.res.food -= s.foodCost;
    b.spawnTimer = s.respawn;
    const u = UNITS[s.unit];
    const m = evoMods(b);
    const mult = 1 + s.statsPerLevel * (b.level - 1);
    const c = this.center(b);
    const slots = mine.map((a) => a.slot);
    let slot = 0;
    while (slots.includes(slot)) slot++;
    const door = this.approachPoint(b, c.x, c.y + b.size);
    const ally = {
      id: this.nextId++, kind: 'ally', type: s.unit, home: b.id, slot, x: door.x, y: door.y, r: u.radius,
      hp: u.hp * mult * mod(m, 'unitHp'), maxHp: u.hp * mult * mod(m, 'unitHp'),
      damage: u.damage * mult * mod(m, 'unitDmg'), range: u.range + (m.unitRange || 0),
      cd: 0, target: null, retarget: 0, vx: 0, vy: 0, facing: 1, hitTime: -9, attackTime: -9, born: this.time,
      tier: Math.min(7, 1 + Math.floor(b.level / 5)), evo: b.evo,
    };
    this.allies.push(ally);
    this.emit('spawnAlly', { x: ally.x, y: ally.y });
  },

  guardPoint(a) {
    const b = this.byId(a.home);
    if (!b) return { x: a.x, y: a.y };
    const c = this.center(b);
    const heart = this.heartCenter();
    let dx = c.x - heart.x;
    let dy = c.y - heart.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const back = UNITS[a.type].ranged ? -0.6 : 1.2;
    const spread = (a.slot - (this.squadSize(b) - 1) / 2) * 0.85;
    let x = c.x + dx * (b.size / 2 + 1 + back) - dy * spread;
    let y = c.y + dy * (b.size / 2 + 1 + back) + dx * spread;
    if (!this.inTerritory(x, y, 0.6)) { x = c.x - dy * spread; y = c.y + b.size / 2 + 0.8; }
    return { x, y };
  },

  updateAllies(dt) {
    for (const a of this.allies) {
      if (a.dead) continue;
      const u = UNITS[a.type];
      a.cd -= dt;
      a.retarget -= dt;
      const g = this.guardPoint(a);
      if (a.retarget <= 0) {
        a.retarget = 0.3;
        if (a.target && (a.target.dead || Math.hypot(a.target.x - g.x, a.target.y - g.y) > u.leash)) a.target = null;
        if (!a.target) a.target = this.nearestEnemy(g.x, g.y, u.aggro);
      }
      let tx = g.x;
      let ty = g.y;
      let stop = 0.15;
      if (a.target) {
        tx = a.target.x; ty = a.target.y;
        stop = (u.ranged ? a.range : u.range) + a.target.r;
        const d = Math.hypot(tx - a.x, ty - a.y);
        if (d <= stop + 0.05 && a.cd <= 0) {
          a.cd = u.cooldown;
          a.attackTime = this.time;
          a.facing = tx > a.x ? 1 : -1;
          if (u.ranged) {
            this.projectiles.push({
              id: this.nextId++, faction: 'player', kind: a.type === 'mage' ? 'orb' : 'arrow', x: a.x, y: a.y - 0.3,
              vx: 0, vy: 0, speed: u.projectileSpeed, damage: a.damage, aoe: u.splash || 0, magic: a.type === 'mage',
              hitIds: [], pierce: 0, life: 2, targetId: a.target.id, homing: true, tier: a.tier, born: this.time,
            });
          } else {
            const k = 1 / (d || 1);
            this.damageEnemy(a.target, a.damage, { kx: (tx - a.x) * k * 0.5, ky: (ty - a.y) * k * 0.5 });
            this.emit('allyHit', { x: a.target.x, y: a.target.y });
          }
          continue;
        }
      }
      this.navigate(a, tx, ty, u.speed, stop, dt);
      if (this.phase === 'build') a.hp = Math.min(a.maxHp, a.hp + 4 * dt);
    }
  },

  // ---------- рабочие ----------

  spawnWorkers(b, cfg, dt) {
    const w = cfg.workers;
    const mine = this.workers.filter((x) => x.home === b.id);
    if (mine.length >= this.workerCount(b)) { b.spawnTimer = w.respawn; return; }
    b.spawnTimer -= dt;
    if (b.spawnTimer > 0) return;
    if ((this.res.food || 0) < w.foodCost) { b.spawnTimer = 1; return; }
    this.res.food -= w.foodCost;
    b.spawnTimer = w.respawn;
    const c = this.center(b);
    const door = this.approachPoint(b, c.x, c.y + b.size);
    this.workers.push({
      id: this.nextId++, kind: 'worker', home: b.id, x: door.x, y: door.y, r: UNITS.worker.radius, hp: UNITS.worker.hp, maxHp: UNITS.worker.hp,
      state: 'seek', task: 0, carry: 0, carryRes: null, cd: 0, vx: 0, vy: 0, facing: 1, workTime: -9, hitTime: -9, born: this.time,
      tool: 'axe', hidden: false,
    });
    this.emit('spawnAlly', { x: door.x, y: door.y });
  },

  claimedNodes() {
    const s = new Set();
    for (const w of this.workers) if (w.task) s.add(w.task);
    return s;
  },

  findWorkNode(w, camp) {
    const filter = WORKER_FILTERS[camp.filter] || WORKER_FILTERS.all;
    const claimed = this.claimedNodes();
    let best = null;
    let bd = Infinity;
    for (const n of this.nodes) {
      if (n.hp <= 0 || claimed.has(n.id)) continue;
      if (filter.kinds && !filter.kinds.includes(n.kind)) continue;
      if (!this.inTerritory(n.x, n.y, 0.6)) continue;
      // рабочие не лезут за склад: если ресурс некуда класть — пропускаем
      if ((this.res[NODES[n.kind].res] || 0) >= this.capOf(NODES[n.kind].res)) continue;
      const d = Math.hypot(n.x - w.x, n.y - w.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  },

  updateWorkers(dt) {
    let count = 0;
    for (const w of this.workers) {
      if (w.dead) continue;
      count++;
      const camp = this.byId(w.home);
      if (!camp || camp.destroyed) { w.dead = true; continue; }
      const cfg = BUILDINGS.workerCamp.workers;
      const m = evoMods(camp);
      const speed = cfg.speed * mod(m, 'speed') * (1 + 0.02 * (camp.level - 1));
      const door = this.approachPoint(camp, w.x, w.y);
      // во время волны прячутся в лагере
      if (this.phase === 'wave') {
        if (w.hidden) continue;
        this.navigate(w, door.x, door.y, speed * 1.3, 0.3, dt);
        if (Math.hypot(w.x - door.x, w.y - door.y) < 0.6) { w.hidden = true; w.task = 0; w.state = 'seek'; }
        continue;
      }
      if (w.hidden) { w.hidden = false; w.x = door.x; w.y = door.y; }
      w.cd -= dt;
      const capacity = cfg.carry * mod(m, 'carry') + Math.floor(camp.level / 5);
      if (w.state === 'seek') {
        if (w.carry > 0) { w.state = 'return'; continue; }
        const n = this.findWorkNode(w, camp);
        if (!n) {
          // ждём у лагеря
          this.navigate(w, door.x, door.y, speed, 0.6, dt);
          continue;
        }
        w.task = n.id;
        w.tool = NODES[n.kind].tool;
        w.state = 'walk';
      }
      if (w.state === 'walk') {
        const n = this.nodeById(w.task);
        if (!n || n.hp <= 0) { w.task = 0; w.state = w.carry > 0 ? 'return' : 'seek'; continue; }
        const reach = n.r + w.r + 0.25;
        if (Math.hypot(n.x - w.x, n.y - w.y) <= reach + 0.05) { w.state = 'gather'; w.vx = 0; w.vy = 0; w.moving = false; }
        else {
          this.navigate(w, n.x, n.y, speed, reach, dt);
          w.walkCheck = (w.walkCheck ?? 0) + dt;
          if (w.walkCheck > 1.2) {
            if (w.walkFrom && Math.hypot(w.x - w.walkFrom.x, w.y - w.walkFrom.y) < 0.1) { w.task = 0; w.state = 'seek'; }
            w.walkFrom = { x: w.x, y: w.y };
            w.walkCheck = 0;
          }
        }
        continue;
      }
      if (w.state === 'gather') {
        const n = this.nodeById(w.task);
        if (!n || n.hp <= 0) { w.task = 0; w.state = w.carry > 0 ? 'return' : 'seek'; continue; }
        w.facing = n.x > w.x ? 1 : -1;
        if (w.cd > 0) continue;
        w.cd = 1.1;
        w.workTime = this.time;
        const gain = this.hitNode(n, mod(m, 'gather'), { byWorker: true });
        w.carry += gain;
        w.carryRes = NODES[n.kind].res;
        if (w.carry >= capacity || n.hp <= 0) { w.state = 'return'; w.task = n.hp > 0 ? 0 : 0; }
        continue;
      }
      if (w.state === 'return') {
        this.navigate(w, door.x, door.y, speed, 0.3, dt);
        if (Math.hypot(w.x - door.x, w.y - door.y) < 0.7) {
          const added = this.addRes(w.carryRes, w.carry);
          this.stats.gathered += added;
          const c = this.center(camp);
          if (added > 0) this.emit('gain', { x: c.x, y: c.y - 1.4, res: w.carryRes, amount: added });
          w.carry = 0;
          w.state = 'seek';
        }
      }
    }
    this.workersNow = count;
  },

  // ---------- ремонт ----------

  updateRepairers(dt) {
    if (this.phase !== 'build') {
      if (this.repairers.length) {
        for (const r of this.repairers) this.emit('poof', { x: r.x, y: r.y });
        this.repairers = [];
      }
      return;
    }
    const damaged = this.buildings.filter((b) => this.missingHp(b) > 0.5);
    let anyBlocked = false;
    for (const house of this.buildings) {
      const cfg = BUILDINGS[house.type];
      if (!cfg.repair || house.destroyed || !house.enabled) continue;
      const rc = cfg.repair;
      const mult = 1 + rc.perLevel * (house.level - 1);
      const mine = this.repairers.filter((r) => r.home === house.id);
      if (damaged.length && mine.length < this.repairerCount(house)) {
        house.spawnTimer -= dt;
        if (house.spawnTimer <= 0) {
          house.spawnTimer = 0.6;
          const door = this.approachPoint(house, this.center(house).x, house.ty + house.size + 1);
          this.repairers.push({
            id: this.nextId++, kind: 'repairer', home: house.id, x: door.x, y: door.y,
            r: UNITS.repairer.radius, hp: 40, maxHp: 40, task: 0, vx: 0, vy: 0, facing: 1, workTime: -9, hitTime: -9, born: this.time,
          });
          this.emit('spawnAlly', { x: door.x, y: door.y });
        }
      }
      for (const r of mine) {
        let b = r.task ? this.byId(r.task) : null;
        if (!b || this.missingHp(b) <= 0.5) {
          r.task = 0;
          const taken = new Set(this.repairers.map((o) => o.task));
          const free = damaged.filter((d) => this.missingHp(d) > 0.5 && !taken.has(d.id));
          const pool = free.length ? free : damaged.filter((d) => this.missingHp(d) > 0.5);
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
        if (this.distToRect(r.x, r.y, b) > 0.8) {
          const p = this.approachPoint(b, r.x, r.y);
          this.navigate(r, p.x, p.y, rc.speed * mult, 0.1, dt);
          continue;
        }
        r.vx = 0; r.vy = 0; r.moving = false;
        r.facing = this.center(b).x > r.x ? 1 : -1;
        const amount = Math.min(rc.hpPerSecond * mult * dt, this.missingHp(b));
        const wood = amount * WORLD.repairWoodPerHp;
        if ((this.res.wood || 0) < wood) { anyBlocked = true; continue; }
        this.res.wood -= wood;
        r.workTime = this.time;
        if (this.repairBuilding(b, amount)) {
          const c = this.center(b);
          this.emit('repaired', { x: c.x, y: c.y, id: b.id });
        }
      }
    }
    if (anyBlocked && !this.repairBlocked) this.emit('toast', { text: 'Ремонт остановлен: не хватает древесины', bad: true });
    this.repairBlocked = anyBlocked;
  },
};
