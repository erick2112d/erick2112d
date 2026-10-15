// Хранитель: характеристики, снаряжение, инвентарь, изучение предметов, атаки.
import { UNITS, WORLD, ITEMS, WEAPON_TYPES, BASE_DAMAGE, TIER_POWER, BUILDINGS, SHRINES } from '../data/index.js';

const angleDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

export const heroMixin = {
  makeHero() {
    return {
      id: 0, kind: 'hero', x: 0, y: 0, vx: 0, vy: 0, r: UNITS.hero.radius, hp: UNITS.hero.hp, maxHp: UNITS.hero.hp,
      cd: 0, facing: 1, aimX: 1, aimY: 0, dead: false, respawn: 0, hotIndex: 0,
      input: { x: 0, y: 0 }, moveTarget: null, attackAt: null, attackHeld: false,
      attackTime: -9, hitTime: -9, moving: false, lastHurt: -9,
    };
  },

  // ---------- характеристики ----------

  trainingLevel() {
    let lvl = 0;
    for (const b of this.buildings) if (b.type === 'trainingHall' && !b.destroyed) lvl = Math.max(lvl, b.level);
    return lvl;
  },

  refreshHeroStats() {
    const t = this.trainingLevel();
    const tr = BUILDINGS.trainingHall.training;
    const s = { maxHp: UNITS.hero.hp + tr.hp * t, armor: 0, damage: tr.damage * t, attackSpeed: 0, crit: 0,
      speed: tr.speed * t, regen: WORLD.heroRegenPerSecond + tr.regen * t, goldFind: 0 };
    for (const slot of ['armor', 'amulet', 'ring']) {
      const it = ITEMS[this.inventory.equipped[slot]];
      if (!it) continue;
      for (const [k, v] of Object.entries(it.stats || {})) {
        if (k === 'hp') s.maxHp += v; else s[k] = (s[k] || 0) + v;
      }
    }
    const buff = this.activeBuff();
    if (buff) for (const [k, v] of Object.entries(buff.stats)) s[k] = (s[k] || 0) + v;
    this.heroStats = s;
    const h = this.hero;
    const ratio = h.maxHp ? h.hp / h.maxHp : 1;
    h.maxHp = Math.round(s.maxHp);
    h.hp = Math.min(h.maxHp, Math.max(h.hp, h.maxHp * ratio));
  },

  activeBuff() {
    const b = this.activities.buff;
    if (!b || b.until <= this.time) return null;
    return SHRINES.buffs.find((x) => x.id === b.id) || null;
  },

  weaponItem() { return ITEMS[this.inventory.equipped.weapon] || ITEMS.swordWood; },

  weaponStats(itemId = this.inventory.equipped.weapon) {
    const it = ITEMS[itemId] || ITEMS.swordWood;
    const t = WEAPON_TYPES[it.wtype];
    const s = this.heroStats || { damage: 0, attackSpeed: 0, crit: 0 };
    return {
      ...t,
      item: it,
      damage: BASE_DAMAGE[it.wtype] * TIER_POWER[it.tier] * (1 + s.damage),
      cooldown: t.cooldown / (1 + s.attackSpeed),
      crit: (t.crit || 0) + s.crit,
    };
  },

  // ---------- инвентарь ----------

  owns(itemId) { return this.inventory.items.includes(itemId); },

  equip(itemId) {
    const it = ITEMS[itemId];
    if (!it || !this.owns(itemId)) return false;
    this.inventory.equipped[it.slot] = itemId;
    if (it.slot === 'weapon') {
      const hb = this.inventory.hotbar;
      if (!hb.includes(itemId)) hb[this.hero.hotIndex] = itemId;
      this.hero.hotIndex = hb.indexOf(itemId);
      this.emit('weapon', { weapon: itemId });
    }
    this.refreshHeroStats();
    this.emit('equip', { item: itemId });
    this.emit('save');
    return true;
  },

  unequip(slot) {
    if (slot === 'weapon') return false;
    this.inventory.equipped[slot] = null;
    this.refreshHeroStats();
    this.emit('save');
    return true;
  },

  setHotbar(index, itemId) {
    const it = ITEMS[itemId];
    if (!it || it.slot !== 'weapon' || !this.owns(itemId)) return false;
    const hb = this.inventory.hotbar;
    const prev = hb.indexOf(itemId);
    if (prev >= 0) hb[prev] = null;
    hb[index] = itemId;
    if (this.hero.hotIndex === index) this.equip(itemId);
    this.emit('save');
    return true;
  },

  useHotbar(index) {
    const id = this.inventory.hotbar[index];
    if (!id) return false;
    this.hero.hotIndex = index;
    return this.equip(id);
  },

  // ---------- изучение предметов ----------

  craftLevel(buildingType) {
    let lvl = 0;
    for (const b of this.buildings) if (b.type === buildingType && !b.destroyed) lvl = Math.max(lvl, b.level);
    return lvl;
  },

  canCraft(itemId) {
    const it = ITEMS[itemId];
    if (!it || !it.cost || !it.building) return { ok: false, reason: 'Не изучается' };
    if (this.owns(itemId)) return { ok: false, reason: 'Уже изучено', owned: true };
    const lvl = this.craftLevel(it.building);
    if (!lvl) return { ok: false, reason: `Нужно здание: ${BUILDINGS[it.building].name}` };
    if (lvl < it.level) return { ok: false, reason: `Нужен ${it.level} уровень здания`, level: true };
    if (!this.canAfford(it.cost)) return { ok: false, reason: 'Не хватает: ' + this.missing(it.cost).join(', '), noMoney: true };
    return { ok: true };
  },

  craft(itemId, useGems = false) {
    const it = ITEMS[itemId];
    const check = this.canCraft(itemId);
    if (!check.ok && !(check.noMoney && useGems)) {
      this.emit('toast', { text: check.reason, bad: true });
      return false;
    }
    if (!this.spend(it.cost, useGems)) return false;
    this.inventory.items.push(itemId);
    this.stats.crafted++;
    if (it.tier >= 7) this.stats.legendary++;
    // новое оружие сразу в свободный быстрый слот
    if (it.slot === 'weapon') {
      const hb = this.inventory.hotbar;
      const free = hb.indexOf(null);
      if (free >= 0) hb[free] = itemId;
    }
    this.unlockStory('first_craft');
    this.emit('crafted', { item: itemId });
    this.emit('save');
    return true;
  },

  // ---------- поведение ----------

  toggleAuto() {
    this.settings.auto = !this.settings.auto;
    this.emit('toast', { text: this.settings.auto ? 'Автоатака: ближайшая цель' : 'Ручной бой: целься и атакуй' });
  },

  updateHero(dt) {
    const h = this.hero;
    const s = this.heroStats;
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
    const speed = UNITS.hero.speed * (1 + s.speed);
    const len = Math.hypot(h.input.x, h.input.y);
    if (len > 0.1) h.moveTarget = null;
    if (h.moveTarget) {
      const t = h.moveTarget;
      const inside = this.inBounds(Math.floor(t.x), Math.floor(t.y));
      const solid = inside && this.isSolidCell(this.idx(Math.floor(t.x), Math.floor(t.y)));
      const stop = solid ? 0.5 + h.r + 0.2 : 0.15;
      this.navigate(h, t.x, t.y, speed, stop, dt);
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
      h.vx = ix * speed;
      h.vy = iy * speed;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.moving = len > 0.1;
      if (Math.abs(ix) > 0.1) h.facing = ix > 0 ? 1 : -1;
      this.resolveSolids(h);
    }
    // восстановление: полное между волнами, слабое в бою
    const calm = this.time - h.lastHurt > 4;
    h.hp = Math.min(h.maxHp, h.hp + s.regen * (this.phase === 'build' ? 1 : calm ? 0.5 : 0.15) * dt);

    h.cd -= dt;
    if (h.cd > 0) return;
    const wpn = this.weaponStats();
    let target = null;
    if (h.attackAt) {
      target = { x: h.attackAt.x, y: h.attackAt.y, manual: true };
      if (!h.attackHeld) h.attackAt = null;
    } else if (this.settings.auto) {
      const e = this.nearestEnemy(h.x, h.y, wpn.range + 0.3);
      if (e) target = { x: e.x, y: e.y, enemy: e };
      else {
        const rift = this.activities.rifts.find((r) => Math.hypot(r.x - h.x, r.y - h.y) - r.r <= Math.max(wpn.range, 1.6) + 0.3);
        if (rift) target = { x: rift.x, y: rift.y, rift };
        else {
          const n = this.nearestNode(h.x, h.y, 2.2);
          if (n) target = { x: n.x, y: n.y, node: n };
        }
      }
    }
    if (target) this.heroAttack(target, wpn);
  },

  nearestNode(x, y, range) {
    let best = null;
    let bd = range;
    const r = Math.ceil(range) + 1;
    for (let ty = Math.floor(y) - r; ty <= Math.floor(y) + r; ty++) {
      for (let tx = Math.floor(x) - r; tx <= Math.floor(x) + r; tx++) {
        const n = this.nodeAt(tx, ty);
        if (!n || n.hp <= 0) continue;
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best;
  },

  rollCrit(chance) { return Math.random() < chance; },

  heroAttack(target, wpn) {
    const h = this.hero;
    let dx = target.x - h.x;
    let dy = target.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    h.aimX = dx; h.aimY = dy;
    if (Math.abs(dx) > 0.05) h.facing = dx > 0 ? 1 : -1;
    h.cd = wpn.cooldown;
    h.attackTime = this.time;
    const aim = Math.atan2(dy, dx);
    const melee = ['slash', 'smash', 'stab', 'reap', 'thrust'].includes(wpn.kind);

    if (melee) {
      const victims = [];
      const inReach = (o) => {
        const ox = o.x - h.x; const oy = o.y - h.y;
        const dist = Math.hypot(ox, oy);
        if (wpn.kind === 'thrust') {
          const along = ox * dx + oy * dy;
          const across = Math.abs(-ox * dy + oy * dx);
          return along > -0.3 && along <= wpn.range + o.r && across <= wpn.width / 2 + o.r;
        }
        if (dist > wpn.range + o.r) return false;
        return wpn.arc >= Math.PI * 2 - 0.01 || dist < 0.5 || angleDiff(Math.atan2(oy, ox), aim) <= wpn.arc / 2;
      };
      for (const e of this.enemies) if (!e.dead && inReach(e)) victims.push(e);
      const hits = wpn.hits || 1;
      let dealt = 0;
      for (let k = 0; k < hits; k++) {
        for (const e of victims) {
          if (e.dead) continue;
          const crit = this.rollCrit(wpn.crit);
          dealt += this.damageEnemy(e, wpn.damage * (crit ? 2 : 1), { kx: dx, ky: dy, crit, stun: wpn.stun });
        }
      }
      for (const r of this.activities.rifts) if (inReach(r)) this.damageRift(r, wpn.damage * hits);
      if (wpn.lifesteal && dealt > 0) h.hp = Math.min(h.maxHp, h.hp + dealt * wpn.lifesteal);
      if (!victims.length || target.node) {
        const n = target.node || this.nearestNode(h.x + dx * 0.6, h.y + dy * 0.6, 1.5);
        if (n && Math.hypot(n.x - h.x, n.y - h.y) <= wpn.range + 0.7) this.hitNode(n, wpn.nodeDamage);
      }
      this.emit('swing', { x: h.x, y: h.y, angle: aim, range: wpn.range, kind: wpn.kind, arc: wpn.arc, tier: wpn.item.tier });
      return;
    }

    if (wpn.kind === 'lightning') {
      this.castLightning(h.x, h.y - 0.3, target, wpn);
      return;
    }

    // снаряд вылетает из оружия, которое парит сбоку от героя
    const ox = h.x + h.facing * 0.4;
    const oy = h.y - 0.2;
    let tx = target.x - ox;
    let ty = target.y - oy;
    const td = Math.hypot(tx, ty) || 1;
    tx /= td; ty /= td;
    const crit = this.rollCrit(wpn.crit);
    this.projectiles.push({
      id: this.nextId++, faction: 'player', kind: wpn.kind, x: ox, y: oy,
      vx: tx * wpn.speed, vy: ty * wpn.speed, speed: wpn.speed,
      damage: wpn.damage * (crit ? 2 : 1), crit, aoe: wpn.aoe || 0, slow: wpn.slow || 0, slowTime: 2,
      pierce: wpn.pierce || 0, hitIds: [], life: (wpn.range + 1) / wpn.speed,
      nodeTarget: target.node ? target.node.id : 0, hitsNodes: !!target.manual, nodeDamage: wpn.nodeDamage,
      tier: wpn.item.tier, born: this.time,
    });
    this.emit('shoot', { x: ox, y: oy, kind: wpn.kind });
  },

  castLightning(x, y, target, wpn) {
    const pts = [[x, y]];
    const hit = new Set();
    let cur = target.enemy || this.nearestEnemy(target.x, target.y, 1.5) || this.nearestEnemy(x, y, wpn.range);
    let from = { x, y };
    let dmg = wpn.damage;
    if (!cur && target.rift) {
      this.damageRift(target.rift, dmg);
      pts.push([target.rift.x, target.rift.y]);
    } else if (!cur && target.node) {
      this.hitNode(target.node, wpn.nodeDamage);
      pts.push([target.node.x, target.node.y]);
    }
    for (let i = 0; cur && i <= (wpn.chain || 0); i++) {
      hit.add(cur.id);
      pts.push([cur.x, cur.y - 0.3]);
      this.damageEnemy(cur, dmg, { magic: true, kx: (cur.x - from.x) * 0.2, ky: (cur.y - from.y) * 0.2 });
      from = cur;
      dmg *= 0.8;
      let next = null;
      let bd = 2.8;
      for (const e of this.enemies) {
        if (e.dead || hit.has(e.id)) continue;
        const dd = Math.hypot(e.x - from.x, e.y - from.y);
        if (dd < bd) { bd = dd; next = e; }
      }
      cur = next;
    }
    if (pts.length > 1) this.bolts.push({ pts, t: this.time, color: '#9fe8ff' });
    this.emit('shoot', { x, y, kind: 'lightning' });
  },
};
