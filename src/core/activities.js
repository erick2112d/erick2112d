// Активности на карте: сундуки, святилища, разломы мглы, записки, торговец.
import { CHESTS, SHRINES, RIFTS, MERCHANT, NOTES, ENEMIES } from '../data/index.js';
import { createRng } from './rng.js';

export const activitiesMixin = {
  updateActivities(dt) {
    const a = this.activities;
    const h = this.hero;
    // окончание благословения
    if (a.buff && a.buff.until <= this.time) {
      a.buff = null;
      this.refreshHeroStats();
      this.emit('toast', { text: 'Благословение святилища угасло' });
    }
    if (this.phase === 'build') {
      a.chestTimer -= dt;
      if (a.chestTimer <= 0) {
        a.chestTimer = CHESTS.spawnEvery;
        if (a.chests.length < CHESTS.max) this.spawnChest();
      }
      if (this.progress.highestCleared >= 2) {
        a.riftTimer -= dt;
        if (a.riftTimer <= 0) {
          a.riftTimer = RIFTS.spawnEvery;
          if (a.rifts.length < RIFTS.max) this.spawnRift();
        }
      }
    }
    if (h.dead) return;
    // подбор касанием
    for (const c of a.chests) {
      if (Math.hypot(c.x - h.x, c.y - h.y) < 1.1) { this.openChest(c); break; }
    }
    for (const n of a.notes) {
      if (this.inTerritory(n.x, n.y) && Math.hypot(n.x - h.x, n.y - h.y) < 1.1) { this.takeNote(n); break; }
    }
    for (const s of a.shrines) {
      if (s.readyAt <= this.time && this.inTerritory(s.x, s.y) && Math.hypot(s.x - h.x, s.y - h.y) < 1.1) { this.useShrine(s); break; }
    }
  },

  // ---------- сундуки ----------

  randomSpot(minFrac = 0.35) {
    const c = this.heartCenter();
    const R = this.radius() - 1.2;
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = R * (minFrac + Math.random() * (1 - minFrac));
      const tx = Math.floor(c.x + Math.cos(ang) * r);
      const ty = Math.floor(c.y + Math.sin(ang) * r);
      if (!this.inBounds(tx, ty)) continue;
      const i2 = this.idx(tx, ty);
      if (this.grid[i2] || this.nodeGrid[i2]) continue;
      if (this.distFromHeart(tx + 0.5, ty + 0.5) < 4) continue;
      return { x: tx + 0.5, y: ty + 0.5 };
    }
    return null;
  },

  spawnChest() {
    const p = this.randomSpot(0.4);
    if (!p) return null;
    const c = { id: this.nextId++, x: p.x, y: p.y };
    this.activities.chests.push(c);
    this.emit('chestSpawn', { x: p.x, y: p.y });
    return c;
  },

  openChest(c) {
    this.activities.chests = this.activities.chests.filter((x) => x !== c);
    const zone = Math.max(1, this.zoneAt(c.x, c.y).id);
    const L = CHESTS.loot;
    const gold = Math.round(L.gold[0] * Math.pow(zone, L.gold[1]) * (0.8 + Math.random() * 0.4) * (1 + (this.heroStats.goldFind || 0)));
    this.addRes('gold', gold);
    const got = [['gold', gold]];
    const pool = L.materials[Math.min(zone, 5)];
    const picks = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < picks; i++) {
      const mat = pool[Math.floor(Math.random() * pool.length)];
      const amount = Math.round((8 + zone * 4) * (0.7 + Math.random() * 0.6));
      const added = this.addRes(mat, amount);
      if (added > 0) got.push([mat, Math.round(added)]);
    }
    if (Math.random() < L.gemChance) {
      const g = 1 + Math.floor(Math.random() * 3);
      this.addRes('gems', g);
      got.push(['gems', g]);
    }
    this.stats.chests++;
    this.emit('chestOpen', { x: c.x, y: c.y, loot: got });
    got.forEach(([res, amount], i) => this.emit('gain', { x: c.x, y: c.y - 0.8 - i * 0.45, res, amount }));
    this.emit('save');
  },

  // ---------- святилища ----------

  useShrine(s) {
    const buff = SHRINES.buffs[Math.floor(Math.random() * SHRINES.buffs.length)];
    s.readyAt = this.time + SHRINES.cooldown;
    this.activities.buff = { id: buff.id, until: this.time + SHRINES.duration };
    this.refreshHeroStats();
    if (buff.stats.regen) this.hero.hp = this.hero.maxHp;
    this.emit('shrine', { x: s.x, y: s.y, name: buff.name });
    this.emit('toast', { text: `${buff.name}: ${buff.desc.toLowerCase()} на ${SHRINES.duration} с` });
  },

  // ---------- записки ----------

  takeNote(n) {
    this.activities.notes = this.activities.notes.filter((x) => x !== n);
    this.activities.notesTaken.push(n.id);
    this.stats.notes++;
    this.unlockStory(n.id);
    this.emit('note', { x: n.x, y: n.y });
    this.emit('save');
  },

  // ---------- разломы ----------

  spawnRift(saved = null) {
    let p = saved;
    if (!p) {
      p = this.randomSpot(0.55);
      if (!p) return null;
    }
    const zone = saved?.zone ?? this.zoneAt(p.x, p.y).id;
    const maxHp = saved?.maxHp ?? Math.round(RIFTS.hp * Math.pow(RIFTS.hpPerZone, zone - 1) * (1 + 0.08 * this.progress.highestCleared));
    const rift = { id: this.nextId++, x: p.x, y: p.y, r: 0.7, hp: saved?.hp ?? maxHp, maxHp, zone, hitTime: -9, born: this.time };
    this.activities.rifts.push(rift);
    const top = Math.max(1, this.progress.highestCleared);
    const types = RIFTS.guardTypes.filter((t) => ENEMIES[t].fromWave <= top + 2);
    const count = RIFTS.guards + Math.min(4, zone - 1);
    const hpMul = 1 + 0.12 * (top - 1);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const t = types[Math.floor(Math.random() * types.length)];
      this.createEnemy(t, p.x + Math.cos(ang) * 1.4, p.y + Math.sin(ang) * 1.4, { guard: { x: p.x, y: p.y }, hpMul, dmgMul: 1 + 0.07 * (top - 1), speedMul: 1 });
    }
    if (!saved) this.emit('riftOpen', { x: p.x, y: p.y });
    return rift;
  },

  damageRift(r, amount) {
    if (r.hp <= 0) return;
    r.hp -= amount;
    r.hitTime = this.time;
    this.emit('damage', { x: r.x, y: r.y - 1, amount: Math.round(amount) });
    if (r.hp > 0) return;
    this.activities.rifts = this.activities.rifts.filter((x) => x !== r);
    const L = RIFTS.loot;
    const essence = Math.round(L.essence[0] * Math.pow(r.zone, L.essence[1]));
    const gold = Math.round(L.gold[0] * Math.pow(r.zone, L.gold[1]));
    this.addRes('essence', essence);
    this.addRes('gold', gold);
    this.stats.rifts++;
    // стражи без разлома рассеиваются
    for (const e of this.enemies) {
      if (e.guard && Math.hypot(e.guard.x - r.x, e.guard.y - r.y) < 0.1) { e.dead = true; this.emit('poof', { x: e.x, y: e.y, big: true }); }
    }
    this.emit('riftClosed', { x: r.x, y: r.y });
    this.emit('gain', { x: r.x, y: r.y - 0.8, res: 'essence', amount: essence });
    this.emit('gain', { x: r.x, y: r.y - 1.3, res: 'gold', amount: gold });
    this.emit('save');
  },

  // ---------- торговец ----------

  summonMerchant(wave) {
    const rng = createRng(wave * 31 + 7);
    const zone = this.openZone();
    const pool = MERCHANT.pool.filter((o) => (o.zone || 1) <= zone);
    const offers = [];
    while (offers.length < MERCHANT.offers && pool.length) {
      const i = Math.floor(rng.next() * pool.length);
      offers.push({ ...pool.splice(i, 1)[0], sold: false });
    }
    const c = this.heartCenter();
    const p = this.randomSpot(0.3) || { x: c.x + 4, y: c.y + 3 };
    this.activities.merchant = { x: p.x, y: p.y, offers };
    this.emit('merchant', { x: p.x, y: p.y });
    this.emit('toast', { text: 'Пришёл бродячий торговец! Найди его повозку на карте' });
  },

  buyFromMerchant(i) {
    const m = this.activities.merchant;
    const o = m?.offers[i];
    if (!o || o.sold) return false;
    if (!this.spend({ gold: o.price })) return false;
    for (const [k, v] of Object.entries(o.give)) this.addRes(k, v);
    o.sold = true;
    this.emit('toast', { text: 'Сделка заключена' });
    this.emit('save');
    return true;
  },

  noteById(id) { return NOTES.find((n) => n.id === id); },
};
