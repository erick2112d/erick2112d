// Враги, башни, ловушки, снаряды, урон.
import { ENEMIES, BUILDINGS, WORLD } from '../data/index.js';
import { generateWave, SIDE_VECTORS } from './waves.js';
import { towerStats, evoMods } from './stats.js';

export const combatMixin = {
  // ---------- поиск целей ----------

  nearestEnemy(x, y, range, filter = null) {
    let best = null;
    let bd = range;
    for (const e of this.enemies) {
      if (e.dead || (filter && !filter(e))) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  nearestEnemies(x, y, range, n) {
    const list = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d <= range) list.push([d, e]);
    }
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map((p) => p[1]);
  },

  // ---------- волна ----------

  wavePreview(n = this.progress.nextWave) { return generateWave(n); },

  spawnPoint(side, offset) {
    const [vx, vy] = SIDE_VECTORS[side];
    const c = this.heartCenter();
    const d = this.radius() + 5;
    let x = c.x + vx * d + -vy * offset;
    let y = c.y + vy * d + vx * offset;
    x = Math.max(1.5, Math.min(this.W - 1.5, x));
    y = Math.max(1.5, Math.min(this.H - 1.5, y));
    for (let k = 0; k < 10 && this.isSolidCell(this.idx(Math.floor(x), Math.floor(y)), 'enemy'); k++) { x -= vx; y -= vy; }
    return { x, y };
  },

  createEnemy(type, x, y, opts = {}) {
    const cfg = ENEMIES[type];
    const plan = this.wave?.plan || this.wavePreview(Math.max(1, this.progress.highestCleared));
    const hpMul = (opts.hpMul ?? plan.hpMult) * (opts.boss ? plan.bossHp || 1 : 1);
    const hp = Math.round(cfg.hp * hpMul);
    const e = {
      id: this.nextId++, type, kind: 'enemy', x, y, r: cfg.radius, hp, maxHp: hp,
      damage: cfg.damage * (opts.dmgMul ?? plan.damageMult), speed: cfg.speed * (opts.speedMul ?? plan.speedMult), cd: 0.5,
      retarget: 0, target: null, vx: 0, vy: 0, kx: 0, ky: 0, hitTime: -9, attackTime: -9, born: this.time,
      seed: Math.random() * 10, flying: !!cfg.flying, facing: 1,
      slowUntil: 0, slowFactor: 0, burnUntil: 0, burnDps: 0, stunUntil: 0,
      summonTimer: cfg.summon ? cfg.summon.every : 0, healTimer: cfg.heal ? cfg.heal.every : 0,
      minion: !!opts.minion, guard: opts.guard || null, boss: !!cfg.boss,
    };
    this.enemies.push(e);
    this.emit('spawn', { x: e.x, y: e.y, enemy: type });
    return e;
  },

  spawnEnemy(type, side, offset, boss) {
    const p = this.spawnPoint(side, offset);
    return this.createEnemy(type, p.x, p.y, { boss });
  },

  // ---------- урон ----------

  // Возвращает нанесённый урон.
  damageEnemy(e, amount, o = {}) {
    if (e.dead) return 0;
    const cfg = ENEMIES[e.type];
    const armor = o.armorPierce || o.magic ? 0 : cfg.armor;
    const dmg = Math.max(amount * 0.15, amount - armor);
    e.hp -= dmg;
    e.hitTime = this.time;
    if (!cfg.boss && (o.kx || o.ky)) { e.kx += (o.kx || 0) * 4; e.ky += (o.ky || 0) * 4; }
    if (o.stun && Math.random() < o.stun && !cfg.boss) e.stunUntil = this.time + 0.8;
    if (o.slow) { e.slowUntil = this.time + (o.slowTime || 2); e.slowFactor = Math.max(e.slowUntil > this.time ? e.slowFactor : 0, o.slow); }
    if (o.burn) { e.burnUntil = this.time + 3; e.burnDps = Math.max(e.burnDps, o.burn); }
    this.emit('damage', { x: e.x, y: e.y - e.r - 0.4, amount: Math.round(dmg), armor: armor > 0 && amount - armor < amount * 0.5, crit: o.crit });
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  },

  killEnemy(e) {
    if (e.dead) return;
    const cfg = ENEMIES[e.type];
    e.dead = true;
    if (!e.minion) {
      const gold = Math.round(cfg.gold * (1 + (this.heroStats?.goldFind || 0)));
      this.addRes('gold', gold);
      if (this.wave) this.wave.loot.gold += gold;
      this.emit('gain', { x: e.x, y: e.y - 0.6, res: 'gold', amount: gold });
      let dy = 1.1;
      for (const [res, [amount, chance]] of Object.entries(cfg.drops || {})) {
        if (Math.random() >= chance) continue;
        const got = this.addRes(res, amount);
        if (got > 0) {
          if (this.wave) this.wave.loot[res] = (this.wave.loot[res] || 0) + got;
          this.emit('gain', { x: e.x, y: e.y - dy, res, amount: got });
          dy += 0.45;
        }
      }
      if (cfg.gems) {
        this.addRes('gems', cfg.gems);
        this.emit('gain', { x: e.x, y: e.y - dy, res: 'gems', amount: cfg.gems });
      }
      this.stats.kills++;
      if (cfg.boss) { this.stats.bosses++; this.unlockStory('first_boss'); }
      if (this.wave && !e.guard) this.wave.killed++;
    }
    if (cfg.explode) this.explodeAt(e.x, e.y, cfg.explode.radius, cfg.explode.damage * (e.damage / cfg.damage));
    this.emit('death', { x: e.x, y: e.y, enemy: e.type, boss: !!cfg.boss });
  },

  explodeAt(x, y, radius, damage) {
    for (const b of this.buildings) {
      if (!b.destroyed && b.type !== 'heart' && this.distToRect(x, y, b) <= radius) this.damageBuilding(b, damage);
    }
    for (const u of [this.hero, ...this.allies]) {
      if (!u.dead && Math.hypot(u.x - x, u.y - y) <= radius + u.r) this.damageUnit(u, damage * 0.5);
    }
    this.emit('blast', { x, y, r: radius });
  },

  damageUnit(u, amount) {
    if (u.dead) return;
    let dmg = amount;
    if (u === this.hero) {
      const a = this.heroStats.armor;
      dmg = amount * (1 - a / (a + 15));
      u.lastHurt = this.time;
    }
    u.hp -= dmg;
    u.hitTime = this.time;
    this.emit('damage', { x: u.x, y: u.y - 0.9, amount: Math.round(dmg), friendly: true });
    if (u.hp <= 0) {
      u.hp = 0;
      u.dead = true;
      if (u === this.hero) {
        u.respawn = WORLD.heroRespawnSeconds;
        this.emit('heroDown', { x: u.x, y: u.y });
      } else this.emit('allyDown', { x: u.x, y: u.y });
    }
  },

  // ---------- враги ----------

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cfg = ENEMIES[e.type];
      e.cd -= dt;
      e.retarget -= dt;
      if (e.burnUntil > this.time) {
        e.hp -= e.burnDps * dt;
        e.burnTick = (e.burnTick || 0) + dt;
        if (e.burnTick > 0.5) { e.burnTick = 0; this.emit('burn', { x: e.x, y: e.y }); }
        if (e.hp <= 0) { this.killEnemy(e); continue; }
      }
      // отбрасывание
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      if (e.stunUntil > this.time) { e.vx = 0; e.vy = 0; continue; }
      if (cfg.summon) {
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = cfg.summon.every;
          for (let i = 0; i < cfg.summon.count; i++) {
            const a = Math.random() * Math.PI * 2;
            this.createEnemy(cfg.summon.type, e.x + Math.cos(a) * 1.2, e.y + Math.sin(a) * 1.2, { minion: true, guard: e.guard });
          }
          this.emit('summon', { x: e.x, y: e.y });
        }
      }
      if (cfg.heal) {
        e.healTimer -= dt;
        if (e.healTimer <= 0) {
          e.healTimer = cfg.heal.every;
          for (const o of this.enemies) {
            if (o === e || o.dead || o.hp >= o.maxHp) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) <= cfg.heal.radius) {
              o.hp = Math.min(o.maxHp, o.hp + cfg.heal.amount * (e.damage / cfg.damage));
              this.emit('heal', { x: o.x, y: o.y });
            }
          }
        }
      }
      if (e.retarget <= 0) {
        e.retarget = 0.25;
        e.target = this.chooseEnemyTarget(e, cfg);
      }
      const t = e.target;
      if (t && t.unit && t.unit.dead) e.target = null;
      if (t && t.building && t.building.destroyed) e.target = null;

      if (e.target && e.target.unit) {
        const u = e.target.unit;
        const d = Math.hypot(u.x - e.x, u.y - e.y);
        const reach = cfg.range + u.r + e.r;
        if (d <= reach) this.enemyAttack(e, cfg, { unit: u });
        else if (!this.navigate(e, u.x, u.y, e.speed, reach * 0.9, dt)) {
          e.target = null;
          e.ignoreUnitsUntil = this.time + 2;
        }
        continue;
      }
      if (e.target && e.target.building) {
        const b = e.target.building;
        if (this.distToRect(e.x, e.y, b, BUILDINGS[b.type].inset ?? 0) <= cfg.range + e.r) {
          this.enemyAttack(e, cfg, { building: b });
          continue;
        }
        if (cfg.siege || e.flying) {
          this.navigate(e, this.center(b).x, this.center(b).y, e.speed, cfg.range + e.r, dt);
          continue;
        }
      }
      if (e.guard) {
        this.moveToward(e, e.guard.x, e.guard.y, e.speed * 0.6, 1.2, dt);
        continue;
      }
      if (e.flying) {
        const c = this.heartCenter();
        if (this.distToRect(e.x, e.y, this.heart()) <= cfg.range + e.r) this.enemyAttack(e, cfg, { building: this.heart() });
        else this.moveToward(e, c.x, c.y, e.speed, 0, dt);
        continue;
      }
      this.followFlow(e, cfg, dt);
    }
  },

  chooseEnemyTarget(e, cfg) {
    if (cfg.siege) {
      // осадный — только постройки
      let best = null;
      let bd = 6;
      for (const b of this.buildings) {
        if (b.destroyed || BUILDINGS[b.type].trap) continue;
        const d = this.distToRect(e.x, e.y, b);
        if (d < bd) { bd = d; best = b; }
      }
      return best ? { building: best } : null;
    }
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
    if (e.guard) return null;
    // ближайшая постройка (кроме заборов и ловушек) в радиусе атаки
    const reach = cfg.range + e.r + 0.3;
    const r = Math.ceil(reach) + 1;
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    let bb = null;
    let bbd = reach;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const b = this.buildingAt(x, y);
        if (!b || b.destroyed || BUILDINGS[b.type].wall || BUILDINGS[b.type].trap) continue;
        const d = this.distToRect(e.x, e.y, b);
        if (d < bbd) { bbd = d; bb = b; }
      }
    }
    return bb ? { building: bb } : null;
  },

  followFlow(e, cfg, dt) {
    const heart = this.heart();
    if (this.distToRect(e.x, e.y, heart, BUILDINGS.heart.inset) <= cfg.range + e.r) {
      this.enemyAttack(e, cfg, { building: heart });
      return;
    }
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    const c = this.heartCenter();
    if (!this.inBounds(cx, cy) || !this.flow) { this.moveToward(e, c.x, c.y, e.speed, 0, dt); return; }
    const i = this.idx(cx, cy);
    const n = this.nextFlowCell(i);
    if (n < 0 || this.flow[i] === Infinity) { this.moveToward(e, c.x, c.y, e.speed, 0, dt); return; }
    const nb = this.grid[n] ? this.byId(this.grid[n]) : null;
    if (nb && !nb.destroyed && !BUILDINGS[nb.type].trap) {
      // путь перекрыт постройкой — ломаем её
      e.target = { building: nb };
      if (this.distToRect(e.x, e.y, nb, BUILDINGS[nb.type].inset ?? 0) <= cfg.range + e.r) {
        this.enemyAttack(e, cfg, { building: nb });
        return;
      }
    }
    this.moveToward(e, (n % this.W) + 0.5, Math.floor(n / this.W) + 0.5, e.speed, 0, dt);
  },

  enemyAttack(e, cfg, target) {
    e.vx = 0; e.vy = 0; e.moving = false;
    const tc = target.unit || this.center(target.building);
    if (Math.abs(tc.x - e.x) > 0.05) e.facing = tc.x > e.x ? 1 : -1;
    if (e.cd > 0) return;
    e.cd = cfg.cooldown;
    e.attackTime = this.time;
    if (cfg.ranged) {
      this.projectiles.push({
        id: this.nextId++, faction: 'enemy', kind: cfg.boss || e.type === 'drake' ? 'darkfire' : e.type === 'archer' ? 'boneArrow' : 'hex',
        x: e.x, y: e.y - 0.3, vx: 0, vy: 0, speed: cfg.projectileSpeed, damage: e.damage, life: 3, homing: true,
        targetUnit: target.unit || null, targetBuilding: target.building || null, tx: tc.x, ty: tc.y, born: this.time,
      });
      this.emit('shoot', { x: e.x, y: e.y, kind: 'enemy' });
      return;
    }
    let dmg = e.damage;
    if (target.building && cfg.siege && BUILDINGS[target.building.type].wall) dmg *= 2;
    if (target.unit) this.damageUnit(target.unit, dmg);
    else this.damageBuilding(target.building, dmg);
    this.emit('enemyHit', { x: e.x, y: e.y, boss: !!cfg.boss });
  },

  // ---------- оборона ----------

  updateTowers(dt) {
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (cfg.energyOut && !b.destroyed) this.updateZap(b, dt);
      if (!cfg.attack) continue;
      b.status = this.statusOf(b).code;
      b.cd -= dt;
      if (b.status !== 'working' && b.status !== 'damaged' && b.status !== 'evolve') continue;
      if (b.cd > 0) continue;
      const st = towerStats(b);
      const c = this.center(b);
      const top = { x: c.x, y: c.y - 1.1 };
      if (st.projectile === 'flame') {
        const targets = this.enemies.filter((e) => !e.dead && Math.hypot(e.x - c.x, e.y - c.y) - e.r <= st.range);
        if (!targets.length) continue;
        b.cd = st.cooldown;
        b.workTime = this.time;
        for (const e of targets) this.damageEnemy(e, st.damage, { magic: true, burn: st.burn });
        this.emit('flame', { x: c.x, y: c.y, r: st.range });
        continue;
      }
      const targets = this.nearestEnemies(c.x, c.y, st.range, st.multishot);
      if (!targets.length) continue;
      b.cd = st.cooldown;
      b.workTime = this.time;
      if (st.chain) {
        this.castLightning(top.x, top.y - 0.4, { enemy: targets[0], x: targets[0].x, y: targets[0].y }, { damage: st.damage, chain: st.chain, range: st.range });
        continue;
      }
      for (const e of targets) {
        const crit = st.crit && Math.random() < st.crit;
        const dmg = st.damage * (crit ? 2.5 : 1);
        const straight = st.projectile === 'bolt';
        let vx = 0; let vy = 0;
        if (straight) {
          const dx = e.x - top.x; const dy = e.y - top.y; const d = Math.hypot(dx, dy) || 1;
          vx = (dx / d) * st.speed; vy = (dy / d) * st.speed;
        }
        this.projectiles.push({
          id: this.nextId++, faction: 'player', kind: st.projectile, x: top.x, y: top.y, vx, vy, speed: st.speed,
          damage: dmg, crit, aoe: st.splash, slow: st.slow, slowTime: st.slowTime, pierce: st.pierce, hitIds: [],
          armorPierce: st.armorPierce, magic: st.magic, life: straight ? (st.range + 2) / st.speed : 2.5,
          targetId: e.id, homing: !straight, tier: Math.min(7, 1 + Math.floor(b.level / 5)), born: this.time,
        });
      }
      this.emit('shoot', { x: top.x, y: top.y, kind: st.projectile === 'bolt' ? 'ballista' : 'tower' });
    }
  },

  // Эволюция генератора «Громовой столп» бьёт молниями.
  updateZap(b, dt) {
    const m = evoMods(b);
    if (!m.zap) return;
    b.zapCd = (b.zapCd ?? 1.5) - dt;
    if (b.zapCd > 0) return;
    const c = this.center(b);
    const e = this.nearestEnemy(c.x, c.y, 4.5);
    if (!e) return;
    b.zapCd = 1.5;
    b.workTime = this.time;
    this.castLightning(c.x, c.y - 1.8, { enemy: e, x: e.x, y: e.y }, { damage: m.zap * (1 + 0.1 * (b.level - 1)), chain: m.chain || 0, range: 4.5 });
  },

  updateTraps(dt) {
    for (const b of this.buildings) {
      const trap = BUILDINGS[b.type].trap;
      if (!trap || b.destroyed) continue;
      b.cd -= dt;
      if (b.cd > 0) continue;
      const on = this.enemies.filter((e) => !e.dead && !e.flying && e.x >= b.tx && e.x < b.tx + 1 && e.y >= b.ty && e.y < b.ty + 1);
      if (!on.length) continue;
      b.cd = trap.cooldown;
      b.workTime = this.time;
      for (const e of on) this.damageEnemy(e, trap.damage * (1 + 0.15 * (b.level - 1)), { armorPierce: true });
      this.emit('spikes', { x: b.tx + 0.5, y: b.ty + 0.5 });
    }
  },

  // ---------- снаряды ----------

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.homing) {
        let tx = p.tx; let ty = p.ty;
        if (p.faction === 'player') {
          const t = this.enemies.find((e) => e.id === p.targetId && !e.dead);
          if (t) { tx = t.x; ty = t.y; p.tx = tx; p.ty = ty; }
        } else if (p.targetUnit && !p.targetUnit.dead) {
          tx = p.targetUnit.x; ty = p.targetUnit.y;
        }
        if (tx !== undefined) {
          const dx = tx - p.x; const dy = ty - p.y; const d = Math.hypot(dx, dy) || 1;
          p.vx = (dx / d) * p.speed; p.vy = (dy / d) * p.speed;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.faction === 'player') {
        for (const e of this.enemies) {
          if (e.dead || p.hitIds?.includes(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= e.r + 0.22) {
            this.projectileHit(p, e);
            if (p.dead) break;
          }
        }
        if (!p.dead) {
          for (const r of this.activities.rifts) {
            if (Math.hypot(r.x - p.x, r.y - p.y) <= r.r + 0.2) { this.damageRift(r, p.damage); this.projectileHit(p, null); break; }
          }
        }
        if (!p.dead && (p.nodeTarget || p.hitsNodes)) {
          const n = this.nodeAt(Math.floor(p.x), Math.floor(p.y));
          if (n && n.hp > 0 && (p.hitsNodes || n.id === p.nodeTarget) && Math.hypot(n.x - p.x, n.y - p.y) < 0.6) {
            this.hitNode(n, p.nodeDamage || 1);
            this.projectileHit(p, null);
          }
        }
        if (p.homing && !p.dead && p.tx !== undefined && Math.hypot(p.tx - p.x, p.ty - p.y) < 0.25) {
          if (p.aoe) this.projectileHit(p, null); else p.dead = true;
        }
      } else {
        const u = p.targetUnit;
        if (u && !u.dead && Math.hypot(u.x - p.x, u.y - p.y) <= u.r + 0.2) {
          this.damageUnit(u, p.damage);
          p.dead = true;
        } else if (p.targetBuilding && this.distToRect(p.x, p.y, p.targetBuilding) < 0.2) {
          this.damageBuilding(p.targetBuilding, p.damage);
          p.dead = true;
        } else if (Math.hypot(p.tx - p.x, p.ty - p.y) < 0.2) p.dead = true;
      }
      if (p.life <= 0 && !p.dead) {
        if (p.aoe) this.projectileHit(p, null);
        p.dead = true;
      }
    }
  },

  projectileHit(p, e) {
    const opts = { armorPierce: p.armorPierce, magic: p.magic || p.kind === 'fireball' || p.kind === 'ice', crit: p.crit };
    if (p.aoe) {
      p.dead = true;
      for (const o of this.enemies) {
        if (o.dead) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d <= p.aoe + o.r) {
          const k = 1 / (d || 1);
          this.damageEnemy(o, p.damage, { ...opts, kx: (o.x - p.x) * k * 0.6, ky: (o.y - p.y) * k * 0.6, slow: p.slow, slowTime: p.slowTime });
        }
      }
      this.emit('explode', { x: p.x, y: p.y, r: p.aoe, kind: p.kind });
      return;
    }
    if (!e) { p.dead = true; return; }
    const sp = Math.hypot(p.vx, p.vy) || 1;
    this.damageEnemy(e, p.damage, { ...opts, kx: (p.vx / sp) * 0.6, ky: (p.vy / sp) * 0.6 });
    this.emit('arrowHit', { x: p.x, y: p.y, crit: p.crit });
    if (p.pierce > 0) {
      p.pierce--;
      p.hitIds.push(e.id);
    } else p.dead = true;
  },
};
