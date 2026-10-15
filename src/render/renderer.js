// Отрисовка мира: камера, земля, постройки, персонажи, снаряды, туман, подсказки.
import { BUILDINGS, ENEMIES, RESOURCES, WORLD } from '../config.js';
import { SIDE_VECTORS, SIDE_NAMES } from '../core/waves.js';
import * as art from './art.js';
import { Fx } from './fx.js';

const { PALETTES, OUTLINE } = art;
const easeOutBack = (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Как выглядит каждый вид персонажа.
const LOOKS = {
  hero: { head: 'hood', body: 'tunic', pal: 'hero', scale: 1 },
  swordsman: { head: 'hood', body: 'tunic', pal: 'swordsman', scale: 0.82, weapon: 'sword' },
  repairer: { head: 'hood', body: 'tunic', pal: 'repairer', scale: 0.7, weapon: 'hammer' },
  skeleton: { head: 'skull', body: 'armor', pal: 'skeleton', scale: 0.95 },
  runner: { head: 'skull', body: 'armor', pal: 'runner', scale: 0.82, hopSpeed: 18 },
  brute: { head: 'skull', body: 'armor', pal: 'brute', scale: 1.3, helmet: true, heavy: true, weapon: 'mace' },
  archer: { head: 'skull', body: 'armor', pal: 'archer', scale: 0.92, weapon: 'boneBow' },
  boss: { head: 'skull', body: 'armor', pal: 'boss', scale: 2.3, crown: true, heavy: true, weapon: 'mace' },
};

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.fx = new Fx();
    this.cam = { x: game.hero.x, y: game.hero.y };
    this.scale = 48;
    this.time = 0;
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.ground = this.makeGround();
    this.wisps = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random() * WORLD.width, y: Math.random() * WORLD.height,
      r: 3 + Math.random() * 5, vx: 0.3 + Math.random() * 0.5, vy: (Math.random() - 0.5) * 0.2, a: 0.15 + Math.random() * 0.2, i,
    }));
    this.ghost = null;        // { type, tx, ty, ok }
    this.selected = null;     // id постройки
    this.resize();
  }

  setGame(game) {
    this.game = game;
    this.cam = { x: game.hero.x, y: game.hero.y };
    this.fx = new Fx();
    this.selected = null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // на телефоне видно ~13 клеток по короткой стороне, на ПК — больше
    this.scale = clamp(Math.min(w, h) / 13, 30, 60);
    this.fogCanvas.width = Math.ceil(w / 4);
    this.fogCanvas.height = Math.ceil(h / 4);
  }

  toScreen = (x, y) => [(x - this.cam.x) * this.scale + this.w / 2, (y - this.cam.y) * this.scale + this.h / 2];
  toWorld(sx, sy) { return { x: (sx - this.w / 2) / this.scale + this.cam.x, y: (sy - this.h / 2) / this.scale + this.cam.y }; }

  // ---------- события симуляции → эффекты ----------

  consume(events, audio) {
    const fx = this.fx;
    for (const e of events) {
      switch (e.type) {
        case 'damage':
          fx.text(e.x + (Math.random() - 0.5) * 0.4, e.y, String(e.amount), e.friendly ? '#ff6b6b' : e.armor ? '#cfd6e2' : '#fff6d5', { size: 0.8 });
          break;
        case 'gain':
          fx.text(e.x, e.y, `+${Math.round(e.amount)}`, RESOURCES[e.res].color, { dot: RESOURCES[e.res].color, size: 0.85, life: 1.1 });
          break;
        case 'nodeHit':
          fx.burst(e.x, e.y, e.kind === 'tree'
            ? { count: 6, color: ['#c98a4b', '#4c8a46', '#346a3c'], shape: 'rect', size: 0.07, speed: 3, up: 3, outline: true }
            : { count: 6, color: ['#a9b0bd', '#7d8696'], shape: 'rect', size: 0.07, speed: 3, up: 3, outline: true });
          audio?.play(e.kind === 'tree' ? 'chop' : 'rock');
          break;
        case 'nodeBreak':
          fx.burst(e.x, e.y, { count: 14, color: e.kind === 'tree' ? ['#4c8a46', '#346a3c', '#24452f'] : ['#a9b0bd', '#7d8696'], size: 0.12, speed: 4, up: 4, outline: true });
          fx.addShake(0.08);
          break;
        case 'slash':
          fx.trail(e.x, e.y, e.angle, e.range, 'rgba(160,220,255,0.9)');
          audio?.play('swing');
          break;
        case 'shoot':
          if (e.kind === 'fireball') audio?.play('fire');
          else if (e.kind === 'tower' || e.kind === 'arrow') audio?.play('bow');
          else if (e.kind === 'enemy') audio?.play('bow', 0.5);
          break;
        case 'explode':
          fx.ring(e.x, e.y, e.r * 2.2, '#ffb347', { fill: 'rgba(255,140,40,0.35)', life: 0.35, width: 0.2 });
          fx.burst(e.x, e.y, { count: 16, color: ['#ffb347', '#ff7a2a', '#fff3c4'], speed: 4, up: 3, size: 0.12, glow: true, life: 0.5 });
          fx.addShake(0.12);
          audio?.play('boom');
          break;
        case 'arrowHit':
        case 'allyHit':
          fx.burst(e.x, e.y, { count: 5, color: ['#fff6d5', '#ffd34d'], speed: 3, up: 2, size: 0.05, glow: true, life: 0.3 });
          audio?.play('hit');
          break;
        case 'enemyHit':
          fx.burst(e.x, e.y - 0.3, { count: 4, color: '#ff6b6b', speed: 2, up: 2, size: 0.05, life: 0.3 });
          if (e.boss) { fx.addShake(0.25); fx.ring(e.x, e.y, 2.4, '#ff3cf0', { life: 0.4 }); }
          break;
        case 'buildingHit':
          fx.burst(e.x, e.y, { count: 3, color: ['#8a92a0', '#c98a4b'], shape: 'rect', speed: 2, up: 3, size: 0.06, outline: true });
          audio?.play('thud', 0.5);
          break;
        case 'collapse':
          fx.burst(e.x, e.y, { count: 22, color: ['#5a5f70', '#7a5a3a', '#8a92a0'], shape: 'rect', speed: 5, up: 5, size: 0.12, outline: true, life: 0.9 });
          fx.ring(e.x, e.y, e.size * 1.5, 'rgba(200,200,200,0.6)', { life: 0.5 });
          fx.addShake(0.3);
          audio?.play('collapse');
          break;
        case 'death':
          this.deathFx(e);
          audio?.play(e.boss ? 'bossDie' : 'bones');
          break;
        case 'spawn':
          fx.burst(e.x, e.y, { count: 10, color: ['#6a4a8a', '#3a2a50', '#8a6aaa'], speed: 1.5, up: 2, size: 0.18, life: 0.8, grav: -1 });
          break;
        case 'spawnAlly':
          fx.ring(e.x, e.y, 1.2, '#7ff3ff', { life: 0.4 });
          break;
        case 'poof':
          fx.burst(e.x, e.y, { count: e.big ? 10 : 6, color: ['#6a4a8a', '#3a2a50'], speed: 1.5, up: 2, size: 0.2, life: 0.7, grav: -1 });
          break;
        case 'built':
          fx.burst(e.x, e.y, { count: 14, color: ['#e6c27a', '#c98a4b', '#ffffff'], shape: 'rect', speed: 4, up: 4, size: 0.08, outline: true });
          fx.ring(e.x, e.y, 2.2, '#f2c14e', { life: 0.45 });
          audio?.play('build');
          break;
        case 'upgraded':
          fx.burst(e.x, e.y - 0.5, { count: 20, color: ['#f2c14e', '#fff3c4'], speed: 3, up: 5, size: 0.07, glow: true, life: 0.8, grav: 4 });
          fx.ring(e.x, e.y, 2.6, '#f2c14e', { life: 0.5 });
          fx.text(e.x, e.y - 1.5, `Уровень ${e.level}`, '#f2c14e', { size: 1.1, life: 1.3 });
          audio?.play('upgrade');
          break;
        case 'repaired':
          fx.burst(e.x, e.y - 0.4, { count: 10, color: ['#7dff9a', '#ffffff'], speed: 2, up: 4, size: 0.06, glow: true, life: 0.7, grav: 3 });
          break;
        case 'heroDown':
          fx.burst(e.x, e.y, { count: 18, color: ['#1f6fd1', '#f2c14e', '#ffffff'], speed: 4, up: 4, size: 0.1, life: 0.8 });
          fx.addShake(0.3);
          audio?.play('heroDown');
          break;
        case 'allyDown':
          fx.burst(e.x, e.y, { count: 10, color: ['#2f80d8', '#9aa5b8'], speed: 3, up: 3, size: 0.08, life: 0.6 });
          break;
        case 'respawn':
          fx.ring(e.x, e.y, 2.5, '#7ff3ff', { life: 0.6, width: 0.2 });
          fx.burst(e.x, e.y, { count: 20, color: ['#7ff3ff', '#ffffff'], speed: 2, up: 6, size: 0.06, glow: true, life: 0.9, grav: 2 });
          audio?.play('respawn');
          break;
        case 'beaconLit':
          fx.ring(e.x, e.y, 16, 'rgba(255,220,130,0.9)', { life: 1.4, width: 0.4 });
          fx.burst(e.x, e.y - 2.5, { count: 40, color: ['#ffd34d', '#fff3c4', '#ffb347'], speed: 5, up: 8, size: 0.1, glow: true, life: 1.4, grav: 3 });
          fx.addShake(0.4);
          audio?.play('beacon');
          break;
        case 'waveStart':
          audio?.play('horn');
          break;
        case 'victory':
          audio?.play('victory');
          break;
        case 'defeat':
          fx.addShake(0.5);
          audio?.play('defeat');
          break;
        default:
      }
    }
  }

  deathFx(e) {
    const look = LOOKS[ENEMIES[e.type].look];
    const pal = PALETTES[look.pal];
    const s = look.scale;
    // голова отлетает и кувыркается
    this.fx.piece(e.x, e.y, 0.9 * s, (ctx) => {
      ctx.scale(s, s);
      art.drawSkullHead(ctx, pal, this.time, { helmet: look.helmet, crown: look.crown });
    }, { vz: 5 + Math.random() * 2, life: 1.0 });
    this.fx.burst(e.x, e.y, { count: e.boss ? 40 : 10, color: [pal.bone, pal.boneShade, pal.cape], shape: 'bone', size: 0.06 * s, speed: 4, up: 4, outline: true, life: 0.9 });
    this.fx.burst(e.x, e.y, { count: 8, color: ['#6a4a8a', '#3a2a50'], speed: 1, up: 1, size: 0.25 * s, life: 0.8, grav: -2 });
    if (e.boss) this.fx.addShake(0.6);
  }

  // ---------- кадр ----------

  frame(dt, ui) {
    this.time += dt;
    const g = this.game;
    this.fx.update(dt);
    for (const w of this.wisps) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      if (w.x - w.r > WORLD.width) w.x = -w.r;
    }
    // камера мягко следует за героем
    const k = 1 - Math.pow(0.002, dt);
    this.cam.x += (g.hero.x - this.cam.x) * k;
    this.cam.y += (g.hero.y - 0.4 - this.cam.y) * k;
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    this.cam.x = clamp(this.cam.x, halfW, WORLD.width - halfW);
    this.cam.y = clamp(this.cam.y, halfH, WORLD.height - halfH);

    const ctx = this.ctx;
    const shake = this.fx.shake;
    const sx = (Math.random() - 0.5) * shake * 0.6;
    const sy = (Math.random() - 0.5) * shake * 0.6;
    const s = this.scale;
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#0d0f17';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(d * s, 0, 0, d * s, d * (this.w / 2 - (this.cam.x + sx) * s), d * (this.h / 2 - (this.cam.y + sy) * s));
    ctx.lineJoin = 'round';

    this.drawGround(ctx);
    this.drawTerritory(ctx, ui);
    this.drawWorldObjects(ctx, ui);
    this.fx.drawWorld(ctx);
    this.drawFog(ctx);
    this.drawWaveArrows(ctx);
    this.drawOverlays(ctx, ui);

    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.fx.drawTexts(ctx, this.toScreen, s);
    this.drawObjectivePointer(ctx, ui);
    this.drawOffscreenEnemies(ctx);
  }

  makeGround() {
    const px = 24;
    const c = document.createElement('canvas');
    c.width = WORLD.width * px;
    c.height = WORLD.height * px;
    const g = c.getContext('2d');
    g.fillStyle = '#26352a';
    g.fillRect(0, 0, c.width, c.height);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(60,90,55,0.35)' : 'rgba(20,30,22,0.35)';
      g.beginPath();
      g.arc(rnd() * c.width, rnd() * c.height, 8 + rnd() * 40, 0, Math.PI * 2);
      g.fill();
    }
    // травинки
    g.strokeStyle = 'rgba(110,150,90,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i < 4500; i++) {
      const x = rnd() * c.width;
      const y = rnd() * c.height;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 2 + rnd() * 4, y - 4 - rnd() * 4);
      g.stroke();
    }
    // цветы и камешки
    for (let i = 0; i < 380; i++) {
      const x = rnd() * c.width;
      const y = rnd() * c.height;
      g.fillStyle = ['#e8d36a', '#c9a0e8', '#f0f0f0', '#7d8696'][Math.floor(rnd() * 4)];
      g.beginPath();
      g.arc(x, y, 2 + rnd() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
    // мощёная площадь у Сердца
    const h = WORLD.heart;
    const cx = (h.tx + 1.5) * px;
    const cy = (h.ty + 1.5) * px;
    g.fillStyle = '#4a4538';
    g.beginPath();
    g.arc(cx, cy, 3.3 * px, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(20,16,12,0.5)';
    g.lineWidth = 2;
    for (let r = 1.2; r < 3.3; r += 0.7) {
      g.beginPath();
      g.arc(cx, cy, r * px, 0, Math.PI * 2);
      g.stroke();
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 1.2 * px, cy + Math.sin(a) * 1.2 * px);
      g.lineTo(cx + Math.cos(a) * 3.3 * px, cy + Math.sin(a) * 3.3 * px);
      g.stroke();
    }
    return c;
  }

  view() {
    const halfW = this.w / 2 / this.scale + 2;
    const halfH = this.h / 2 / this.scale + 3;
    return { x0: this.cam.x - halfW, x1: this.cam.x + halfW, y0: this.cam.y - halfH, y1: this.cam.y + halfH + 2 };
  }

  drawGround(ctx) {
    const v = this.view();
    const px = 24;
    const x0 = clamp(Math.floor(v.x0), 0, WORLD.width);
    const y0 = clamp(Math.floor(v.y0), 0, WORLD.height);
    const x1 = clamp(Math.ceil(v.x1), 0, WORLD.width);
    const y1 = clamp(Math.ceil(v.y1), 0, WORLD.height);
    if (x1 > x0 && y1 > y0) ctx.drawImage(this.ground, x0 * px, y0 * px, (x1 - x0) * px, (y1 - y0) * px, x0, y0, x1 - x0, y1 - y0);
  }

  drawTerritory(ctx, ui) {
    const g = this.game;
    const circles = g.territory();
    // тёплый свет
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of circles) {
      const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      gr.addColorStop(0, 'rgba(255,200,110,0.10)');
      gr.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // граница
    ctx.save();
    ctx.setLineDash([0.3, 0.25]);
    ctx.lineDashOffset = -this.time * 0.4;
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = 'rgba(255,215,130,0.45)';
    for (const c of circles) {
      ctx.beginPath();
      // дуги, не попавшие внутрь других кругов
      const steps = 120;
      let drawing = false;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = c.x + Math.cos(a) * c.r;
        const y = c.y + Math.sin(a) * c.r;
        const inside = circles.some((o) => o !== c && (x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r - 0.01);
        if (inside) { drawing = false; continue; }
        if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // сетка при строительстве
    if (ui.buildType) {
      const hx = this.ghost ? this.ghost.tx : Math.floor(g.hero.x);
      const hy = this.ghost ? this.ghost.ty : Math.floor(g.hero.y);
      ctx.lineWidth = 0.02;
      for (let y = hy - 7; y <= hy + 7; y++) {
        for (let x = hx - 9; x <= hx + 9; x++) {
          if (!g.inBounds(x, y) || !g.inTerritory(x + 0.5, y + 0.5)) continue;
          const i = g.idx(x, y);
          const busy = g.grid[i] || g.nodeGrid[i];
          ctx.fillStyle = busy ? 'rgba(255,90,90,0.08)' : 'rgba(140,255,170,0.07)';
          ctx.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
        }
      }
    }
  }

  drawWorldObjects(ctx, ui) {
    const g = this.game;
    const v = this.view();
    const items = [];
    const visible = (x, y) => x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1;

    for (const n of g.nodes) {
      if (!visible(n.x, n.y)) continue;
      items.push({ y: n.y + 0.3, draw: () => this.drawNode(ctx, n) });
    }
    for (const bc of g.beacons) {
      if (bc.state === 'lit') continue;
      const x = bc.cfg.tx + 1;
      const y = bc.cfg.ty + 2;
      if (visible(x, y)) items.push({ y, draw: () => this.drawBeaconRuin(ctx, bc) });
    }
    for (const b of g.buildings) {
      const c = g.center(b);
      if (!visible(c.x, c.y)) continue;
      items.push({ y: b.ty + b.size, draw: () => this.drawBuilding(ctx, b, ui) });
    }
    if (!g.hero.dead) items.push({ y: g.hero.y, draw: () => this.drawUnit(ctx, g.hero, 'hero') });
    for (const a of g.allies) if (visible(a.x, a.y)) items.push({ y: a.y, draw: () => this.drawUnit(ctx, a, a.type) });
    for (const r of g.repairers) if (visible(r.x, r.y)) items.push({ y: r.y, draw: () => this.drawUnit(ctx, r, 'repairer') });
    for (const e of g.enemies) if (visible(e.x, e.y)) items.push({ y: e.y, draw: () => this.drawUnit(ctx, e, ENEMIES[e.type].look) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    for (const p of g.projectiles) this.drawProjectile(ctx, p);
    if (this.ghost && ui.buildType) this.drawGhost(ctx);
  }

  drawNode(ctx, n) {
    const t = this.time;
    const hitAge = this.game.time - n.hitTime;
    const shake = hitAge < 0.25 ? Math.sin(hitAge * 60) * 0.06 * (1 - hitAge / 0.25) : 0;
    ctx.save();
    ctx.translate(n.x, n.y + 0.35);
    this.shadow(ctx, 0.36);
    if (n.kind === 'tree') {
      if (n.hp > 0) {
        const grow = n.grownTime ? clamp((this.game.time - n.grownTime) / 0.6, 0, 1) : 1;
        ctx.scale(easeOutBack(grow) || 0.01, easeOutBack(grow) || 0.01);
        const sway = Math.sin(t * 1.3 + n.tx * 0.7 + n.ty) * 0.04 + shake;
        art.drawTree(ctx, t, sway, shake, (n.tx + n.ty) % 2);
      } else art.drawStump(ctx);
    } else if (n.hp > 0) art.drawRock(ctx, n.hp, n.maxHp, shake);
    else {
      ctx.fillStyle = 'rgba(120,125,140,0.6)';
      ctx.beginPath();
      ctx.ellipse(0, -0.05, 0.25, 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  shadow(ctx, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBeaconRuin(ctx, bc) {
    ctx.save();
    ctx.translate(bc.cfg.tx + 1, bc.cfg.ty + 2);
    this.shadow(ctx, 1);
    art.drawBeacon(ctx, this.time, false);
    if (bc.state === 'ready') {
      const p = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.fillStyle = `rgba(255,215,120,${0.25 + p * 0.35})`;
      ctx.beginPath();
      ctx.arc(0, -2.8, 0.5 + p * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBuilding(ctx, b, ui) {
    const g = this.game;
    const t = this.time;
    const cfg = BUILDINGS[b.type];
    const c = g.center(b);
    const age = g.time - b.builtTime;
    const hitAge = g.time - b.hitTime;
    ctx.save();
    ctx.translate(c.x, b.ty + b.size);
    // постройка «выпрыгивает» из земли
    const pop = age < 0.5 ? easeOutBack(clamp(age / 0.5, 0, 1)) : 1;
    const wob = hitAge < 0.2 ? Math.sin(hitAge * 70) * 0.05 * (1 - hitAge / 0.2) : 0;
    ctx.translate(wob, 0);
    ctx.scale(pop * (b.size >= 2 ? b.size / 2 : 1), pop * (b.size >= 2 ? b.size / 2 : 1));
    if (b.type !== 'heart') this.shadow(ctx, 0.95);
    if (b.destroyed) {
      art.drawRubble(ctx, b.size, t);
    } else {
      const working = b.status === 'working';
      switch (b.type) {
        case 'heart': ctx.scale(2 / 3, 2 / 3); ctx.translate(0, 0.9); art.drawHeart(ctx, t, b.hp / b.maxHp); break;
        case 'generator': art.drawGenerator(ctx, t, true); break;
        case 'sawmill': art.drawSawmill(ctx, t, working); break;
        case 'quarry': art.drawQuarry(ctx, t, working); break;
        case 'archerTower': ctx.scale(1.1, 1.1); art.drawArcherTower(ctx, t, b.powered && b.enabled, g.time - b.workTime); break;
        case 'barracks': art.drawBarracks(ctx, t); break;
        case 'repairHouse': art.drawRepairHouse(ctx, t, g.repairers.some((r) => r.home === b.id && g.time - r.workTime < 0.3)); break;
        case 'wall': art.drawWall(ctx, b.level); break;
        case 'beacon': art.drawBeacon(ctx, t, true); break;
        default:
          ctx.fillStyle = '#888';
          ctx.fillRect(-0.8, -1, 1.6, 0.9);
      }
      // вспышка попадания
      if (hitAge < 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,120,120,0.25)';
        ctx.fillRect(-1, -2.5, 2, 2.5);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
    // выделение
    if (this.selected === b.id) {
      ctx.save();
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 0.07;
      ctx.setLineDash([0.25, 0.15]);
      ctx.lineDashOffset = -t;
      ctx.strokeRect(b.tx + 0.05, b.ty + 0.05, b.size - 0.1, b.size - 0.1);
      ctx.restore();
      if (cfg.attack) {
        const r = cfg.attack.range + cfg.attack.rangePerLevel * (b.level - 1);
        ctx.strokeStyle = 'rgba(255,224,138,0.5)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawUnit(ctx, u, lookId) {
    const g = this.game;
    const look = LOOKS[lookId];
    const pal = PALETTES[look.pal];
    const t = this.time + (u.seed || u.id * 0.37);
    const hitAge = g.time - (u.hitTime ?? -9);
    const attackAge = g.time - (u.attackTime ?? -9);
    const bornAge = g.time - (u.born ?? -9);
    const moving = Math.hypot(u.vx || 0, u.vy || 0) > 0.2;
    const hopSpeed = look.hopSpeed || 13;
    const hop = moving ? Math.abs(Math.sin(t * hopSpeed)) : 0;
    const facing = u.facing || 1;
    let s = look.scale;

    // появление
    let alpha = 1;
    if (bornAge < 0.45) {
      const k = bornAge / 0.45;
      s *= easeOutBack(k);
      alpha = Math.min(1, k * 2);
    }
    const flash = hitAge < 0.12;
    const p = flash ? art.flashPalette(pal) : pal;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(u.x, u.y + 0.2);
    ctx.save();
    ctx.scale(s, s);
    this.shadow(ctx, 0.32 * (1 - hop * 0.3));
    ctx.restore();

    // выпад при атаке
    let lunge = 0;
    if (attackAge < 0.22) lunge = Math.sin((attackAge / 0.22) * Math.PI);
    const pop = hitAge < 0.15 ? 1 + 0.15 * (1 - hitAge / 0.15) : 1;
    const breathe = moving ? 0 : Math.sin(t * 3) * 0.025;
    const squashY = (moving ? 1 - (1 - hop) * 0.1 : 1 + breathe) * (1 - lunge * 0.08);
    const squashX = (moving ? 1 + (1 - hop) * 0.08 : 1 - breathe) * (1 + lunge * 0.1);
    const tilt = (moving ? clamp((u.vx || 0) * 0.05, -0.2, 0.2) + Math.sin(t * hopSpeed) * 0.05 : 0) + facing * lunge * 0.25;

    ctx.translate(facing * lunge * 0.14 * s, -hop * 0.13 * s);
    ctx.rotate(tilt);
    ctx.scale(s * pop, s * pop);
    ctx.scale(squashX, squashY);

    // тело
    ctx.save();
    ctx.scale(facing, 1);
    const bodyH = 0.56;
    if (look.body === 'tunic') art.drawTunicBody(ctx, p);
    else art.drawArmorBody(ctx, p, 0.6, 0.56, look.heavy);
    ctx.restore();

    // голова парит над телом и отстаёт по фазе
    const headBob = moving ? Math.sin(t * hopSpeed - 0.9) * 0.05 : Math.sin(t * 3 - 0.6) * 0.02;
    ctx.save();
    ctx.translate(0, -bodyH - 0.3 + headBob - lunge * 0.04);
    ctx.rotate(Math.sin(t * hopSpeed * 0.5) * (moving ? 0.07 : 0.02) + facing * lunge * 0.15);
    ctx.scale(facing, 1);
    if (look.head === 'hood') {
      const blink = (t % 3.7) < 0.12;
      art.drawHoodHead(ctx, p, t, { blink, shout: attackAge < 0.2 });
    } else {
      art.drawSkullHead(ctx, p, t, { helmet: look.helmet, crown: look.crown });
    }
    ctx.restore();
    ctx.restore();

    // оружие — в мировой ориентации
    this.drawUnitWeapon(ctx, u, look, s, attackAge, facing, t, hop);

    // полоска здоровья
    const showBar = u.hp < u.maxHp && !(lookId === 'hero' && g.phase === 'build' && u.hp > u.maxHp * 0.95);
    if (showBar) {
      const w = 0.8 * Math.max(1, s * 0.8);
      const y = u.y - 1.35 * s;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(u.x - w / 2 - 0.03, y - 0.03, w + 0.06, 0.15);
      ctx.fillStyle = u.kind === 'enemy' ? '#ff5a5a' : '#6ee36e';
      ctx.fillRect(u.x - w / 2, y, w * clamp(u.hp / u.maxHp, 0, 1), 0.09);
    }
  }

  drawUnitWeapon(ctx, u, look, s, attackAge, facing, t, hop) {
    const g = this.game;
    let weapon = look.weapon;
    if (u === g.hero) weapon = g.hero.weapon;
    if (!weapon) return;
    const cx = u.x;
    const cy = u.y + 0.2 - 0.35 * s - hop * 0.13 * s;
    const aimAng = u === g.hero ? Math.atan2(g.hero.aimY, g.hero.aimX) : facing > 0 ? 0 : Math.PI;
    const float = Math.sin(t * 3.2) * 0.05;
    ctx.save();
    if (weapon === 'sword') {
      const dur = 0.24;
      if (attackAge < dur) {
        const k = attackAge / dur;
        const e = 1 - Math.pow(1 - k, 3);
        const ang = aimAng - 1.9 * facing + 3.4 * e * facing;
        ctx.translate(cx + Math.cos(ang) * 0.55 * s, cy + Math.sin(ang) * 0.4 * s);
        ctx.rotate(ang + Math.PI / 2);
      } else {
        ctx.translate(cx + facing * 0.5 * s, cy - 0.15 * s + float);
        ctx.rotate(facing * 0.35 + Math.sin(t * 2) * 0.05);
      }
      art.drawSword(ctx, s * (u === g.hero ? 1 : 0.8));
    } else if (weapon === 'bow') {
      const pull = attackAge < 0.15 ? 1 - attackAge / 0.15 : 0;
      const ang = attackAge < 0.6 ? aimAng : facing > 0 ? 0 : Math.PI;
      ctx.translate(cx + Math.cos(ang) * 0.48 * s, cy + Math.sin(ang) * 0.3 * s + float);
      ctx.rotate(ang);
      art.drawBow(ctx, pull, s);
    } else if (weapon === 'staff') {
      const k = attackAge < 0.3 ? Math.sin((attackAge / 0.3) * Math.PI) : 0;
      ctx.translate(cx + facing * 0.5 * s, cy + float);
      ctx.rotate(facing * 0.15 + k * (aimAng + Math.PI / 2 - facing * 0.15) * 0.5);
      art.drawStaff(ctx, k, t, s);
    } else if (weapon === 'hammer') {
      const working = g.time - (u.workTime ?? -9) < 0.3;
      ctx.translate(cx + facing * 0.4 * s, cy + float);
      ctx.rotate(facing * (working ? 0.4 + Math.sin(t * 16) * 0.7 : 0.3));
      art.drawHammer(ctx, s);
    } else if (weapon === 'mace') {
      const k = attackAge < 0.3 ? Math.sin((attackAge / 0.3) * Math.PI) : 0;
      ctx.translate(cx + facing * 0.5 * s, cy + float);
      ctx.rotate(facing * (0.3 + k * 1.4));
      art.drawMace(ctx, s * 0.9);
    } else if (weapon === 'boneBow') {
      const pull = attackAge < 0.25 ? 1 - attackAge / 0.25 : 0;
      ctx.translate(cx + facing * 0.45 * s, cy + float);
      if (facing < 0) ctx.rotate(Math.PI);
      ctx.scale(s, s);
      art.drawBoneBow(ctx, pull);
    }
    ctx.restore();
  }

  drawProjectile(ctx, p) {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y - 0.25);
    if (p.kind === 'fireball') {
      const t = this.time;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(255,${120 + i * 30},40,${0.25 - i * 0.04})`;
        ctx.beginPath();
        ctx.arc(-Math.cos(ang) * i * 0.15, -Math.sin(ang) * i * 0.15, 0.28 - i * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(0, 0, 0.16 + Math.sin(t * 30) * 0.015, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb347';
      ctx.fill();
      ctx.lineWidth = 0.04;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-0.03, -0.03, 0.07, 0, Math.PI * 2);
      ctx.fillStyle = '#fff3c4';
      ctx.fill();
      if (Math.random() < 0.5) this.fx.burst(p.x, p.y, { count: 1, color: ['#ffb347', '#ff7a2a'], speed: 0.5, up: 1, size: 0.07, glow: true, life: 0.3, z: 0.25, grav: -1 });
    } else if (p.kind === 'boneArrow') {
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.rect(-0.25, -0.02, 0.45, 0.04);
      ctx.fillStyle = '#efe3c8';
      ctx.fill();
      ctx.lineWidth = 0.02;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.2, -0.05); ctx.lineTo(0.3, 0); ctx.lineTo(0.2, 0.05);
      ctx.closePath();
      ctx.fillStyle = '#ff5f7a';
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.rotate(ang);
      ctx.translate(-0.3, 0);
      art.drawArrow(ctx, 0.9);
    }
    ctx.restore();
  }

  drawGhost(ctx) {
    const gh = this.ghost;
    const cfg = BUILDINGS[gh.type];
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(this.time * 6) * 0.1;
    ctx.fillStyle = gh.ok ? 'rgba(120,255,150,0.25)' : 'rgba(255,90,90,0.3)';
    ctx.strokeStyle = gh.ok ? '#8cffaa' : '#ff6b6b';
    ctx.lineWidth = 0.06;
    ctx.fillRect(gh.tx, gh.ty, cfg.size, cfg.size);
    ctx.strokeRect(gh.tx, gh.ty, cfg.size, cfg.size);
    ctx.translate(gh.tx + cfg.size / 2, gh.ty + cfg.size);
    ctx.globalAlpha = 0.55;
    if (cfg.size >= 2) ctx.scale(cfg.size / 2, cfg.size / 2);
    const fake = { type: gh.type };
    switch (fake.type) {
      case 'generator': art.drawGenerator(ctx, this.time, true); break;
      case 'sawmill': art.drawSawmill(ctx, this.time, true); break;
      case 'quarry': art.drawQuarry(ctx, this.time, true); break;
      case 'archerTower': ctx.scale(1.1, 1.1); art.drawArcherTower(ctx, this.time, true, 9); break;
      case 'barracks': art.drawBarracks(ctx, this.time); break;
      case 'repairHouse': art.drawRepairHouse(ctx, this.time, false); break;
      case 'wall': art.drawWall(ctx, 1); break;
      default:
    }
    ctx.restore();
    if (cfg.attack) {
      ctx.strokeStyle = 'rgba(140,255,170,0.45)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(gh.tx + 0.5, gh.ty + 0.5, cfg.attack.range, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Туман: тёмная пелена с плывущими клубами, дыры там, где свет.
  drawFog(ctx) {
    const g = this.game;
    const f = this.fogCtx;
    const fw = this.fogCanvas.width;
    const fh = this.fogCanvas.height;
    const k = fw / this.w;
    const s = this.scale * k;
    const ox = fw / 2 - this.cam.x * s;
    const oy = fh / 2 - this.cam.y * s;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, fw, fh);
    f.fillStyle = 'rgba(14,12,26,0.93)';
    f.fillRect(0, 0, fw, fh);
    for (const w of this.wisps) {
      const x = w.x * s + ox;
      const y = w.y * s + oy;
      const r = w.r * s;
      if (x + r < 0 || y + r < 0 || x - r > fw || y - r > fh) continue;
      const gr = f.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(80,70,120,${w.a})`);
      gr.addColorStop(1, 'rgba(80,70,120,0)');
      f.fillStyle = gr;
      f.beginPath();
      f.arc(x, y, r, 0, Math.PI * 2);
      f.fill();
    }
    f.globalCompositeOperation = 'destination-out';
    const holes = g.territory().map((c) => ({ ...c, soft: 1.8 }));
    if (!g.hero.dead) holes.push({ x: g.hero.x, y: g.hero.y, r: 3.2, soft: 1.5 });
    for (const bc of g.beacons) {
      if (bc.state === 'ready') holes.push({ x: bc.cfg.tx + 1, y: bc.cfg.ty + 0.5, r: 2.2 + Math.sin(this.time * 2) * 0.2, soft: 1.5 });
    }
    for (const h of holes) {
      const x = h.x * s + ox;
      const y = h.y * s + oy;
      const r0 = Math.max(0, (h.r - h.soft) * s);
      const r1 = (h.r + h.soft * 0.6) * s;
      const gr = f.createRadialGradient(x, y, r0, x, y, r1);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = gr;
      f.beginPath();
      f.arc(x, y, r1, 0, Math.PI * 2);
      f.fill();
    }
    const d = this.dpr;
    ctx.save();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, fw, fh, 0, 0, this.w, this.h);
    ctx.restore();
  }

  // Красные стрелки на границе света — откуда придёт волна.
  drawWaveArrows(ctx) {
    const g = this.game;
    let sides = null;
    if (g.phase === 'build') sides = g.wavePreview().sides;
    else if (g.wave && g.wave.idx < g.wave.plan.spawns.length) sides = g.wave.plan.sides;
    if (!sides) return;
    const c = g.heartCenter();
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    for (const side of sides) {
      const [vx, vy] = SIDE_VECTORS[side];
      let ext = 0;
      for (const t of g.territory()) ext = Math.max(ext, (t.x - c.x) * vx + (t.y - c.y) * vy + t.r);
      const x = c.x + vx * (ext - 0.6);
      const y = c.y + vy * (ext - 0.6);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(-vy, -vx));
      ctx.translate(pulse * 0.25, 0);
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      ctx.beginPath();
      ctx.moveTo(0.6, 0);
      ctx.lineTo(-0.2, -0.55);
      ctx.lineTo(-0.2, -0.22);
      ctx.lineTo(-0.8, -0.22);
      ctx.lineTo(-0.8, 0.22);
      ctx.lineTo(-0.2, 0.22);
      ctx.lineTo(-0.2, 0.55);
      ctx.closePath();
      ctx.fillStyle = '#ff4a4a';
      ctx.fill();
      ctx.lineWidth = 0.07;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
      this.arrowLabels = this.arrowLabels || [];
    }
  }

  drawOverlays(ctx) {
    const g = this.game;
    const t = this.time;
    // значки проблем над постройками
    for (const b of g.buildings) {
      const st = g.statusOf(b);
      const c = g.center(b);
      const top = b.ty - (b.type === 'archerTower' ? 2.3 : b.type === 'heart' ? 2.6 : 1.4);
      if (b.hp < b.maxHp && !b.destroyed && b.type !== 'heart') {
        const w = Math.min(1.6, b.size * 0.8);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(c.x - w / 2 - 0.03, top + 0.42, w + 0.06, 0.14);
        ctx.fillStyle = b.hp / b.maxHp > 0.5 ? '#9be36e' : '#ff9a3c';
        ctx.fillRect(c.x - w / 2, top + 0.45, w * (b.hp / b.maxHp), 0.08);
      }
      if (!st.bad) continue;
      const bob = Math.sin(t * 4 + b.id) * 0.06;
      ctx.save();
      ctx.translate(c.x, top + bob);
      ctx.beginPath();
      ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
      ctx.fillStyle = st.code === 'no_power' ? '#ffcf3a' : st.code === 'destroyed' ? '#ff6b6b' : '#ff9a3c';
      ctx.fill();
      ctx.lineWidth = 0.05;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      if (st.code === 'no_power') {
        ctx.moveTo(0.04, -0.17); ctx.lineTo(-0.1, 0.03); ctx.lineTo(0, 0.03); ctx.lineTo(-0.04, 0.17); ctx.lineTo(0.1, -0.03); ctx.lineTo(0, -0.03);
        ctx.closePath();
        ctx.fill();
      } else if (st.code === 'disabled') {
        ctx.fillRect(-0.09, -0.12, 0.06, 0.24);
        ctx.fillRect(0.03, -0.12, 0.06, 0.24);
      } else {
        ctx.fillRect(-0.03, -0.15, 0.06, 0.18);
        ctx.fillRect(-0.03, 0.07, 0.06, 0.06);
      }
      ctx.restore();
    }
  }

  // Стрелка-подсказка к цели обучения, если цель за краем экрана.
  drawObjectivePointer(ctx, ui) {
    const obj = ui.objective;
    if (!obj || !obj.target) return;
    const [sx, sy] = this.toScreen(obj.target.x, obj.target.y);
    const m = 60;
    const on = sx > m && sy > m && sx < this.w - m && sy < this.h - m;
    const t = this.time;
    if (on) {
      const y = sy - this.scale * 1.6 + Math.sin(t * 5) * 6;
      ctx.save();
      ctx.translate(sx, y);
      ctx.beginPath();
      ctx.moveTo(0, 12); ctx.lineTo(-10, -4); ctx.lineTo(10, -4);
      ctx.closePath();
      ctx.fillStyle = '#ffe08a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const cx = this.w / 2;
    const cy = this.h / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const px = clamp(cx + Math.cos(ang) * 1000, m, this.w - m);
    const py = clamp(cy + Math.sin(ang) * 1000, m + 40, this.h - m - 60);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.translate(Math.sin(t * 5) * 5, 0);
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }

  // Красные метки у края экрана для врагов за его пределами (но уже на свету).
  drawOffscreenEnemies(ctx) {
    const g = this.game;
    if (g.phase !== 'wave') return;
    const m = 24;
    for (const e of g.enemies) {
      const [sx, sy] = this.toScreen(e.x, e.y);
      if (sx > 0 && sy > 0 && sx < this.w && sy < this.h) continue;
      if (!g.inTerritory(e.x, e.y)) continue;
      const cx = this.w / 2;
      const cy = this.h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const px = clamp(sx, m, this.w - m);
      const py = clamp(sy, m + 50, this.h - m - 70);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fillStyle = '#ff4a4a';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
    }
  }

  sideLabel(side) { return SIDE_NAMES[side]; }
}
