// Отрисовка мира: камера, земля по зонам, постройки, персонажи, снаряды, мгла, подсказки.
import { BUILDINGS, ENEMIES, MATERIALS, CURRENCIES, WORLD, ZONES, ITEMS, WEAPON_TYPES, NODES } from '../data/index.js';
import { SIDE_VECTORS } from '../core/waves.js';
import { evoPath, towerStats } from '../core/stats.js';
import { OUTLINE, ink, ellipse, sprite, drawSprite, setSpriteResolution, hash } from './art/common.js';
import { PALETTES, LOOKS, flashPalette, drawHead, drawBody, hoodHead } from './art/characters.js';
import * as W from './art/weapons.js';
import * as N from './art/nature.js';
import { ART, wallArt, rubble, setHoodHead } from './art/buildings.js';
import { Fx } from './fx.js';

const easeOutBack = (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const resColor = (k) => (CURRENCIES[k] || MATERIALS[k])?.color || '#fff';
const SWING_COLORS = { slash: 'rgba(160,220,255,0.9)', smash: 'rgba(255,220,140,0.9)', stab: 'rgba(220,240,255,0.9)', reap: 'rgba(200,140,255,0.9)', thrust: 'rgba(160,220,255,0.9)' };

setHoodHead((ctx) => hoodHead(ctx, PALETTES.ranger, {}));

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
    this.wisps = Array.from({ length: 34 }, (_, i) => ({
      a: Math.random() * Math.PI * 2, d: Math.random(), r: 2 + Math.random() * 5,
      speed: 0.02 + Math.random() * 0.05, a2: 0.18 + Math.random() * 0.25, i,
    }));
    this.eyes = Array.from({ length: 10 }, () => this.newEyes());
    this.ghost = null;
    this.wallDrag = null;
    this.selected = null;
    this.resize();
  }

  setGame(game) {
    this.game = game;
    this.cam = { x: game.hero.x, y: game.hero.y };
    this.fx = new Fx();
    this.selected = null;
  }

  resize() {
    const dpr = this.lowQ ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = clamp(Math.min(w, h) / 12.5, 30, 64);
    this.fogCanvas.width = Math.ceil(w / 4);
    this.fogCanvas.height = Math.ceil(h / 4);
    setSpriteResolution(this.scale * dpr);
  }

  toScreen = (x, y) => [(x - this.cam.x) * this.scale + this.w / 2, (y - this.cam.y) * this.scale + this.h / 2];
  toWorld(sx, sy) { return { x: (sx - this.w / 2) / this.scale + this.cam.x, y: (sy - this.h / 2) / this.scale + this.cam.y }; }

  // ---------- события → эффекты ----------

  consume(events, audio) {
    const fx = this.fx;
    const halfW = this.w / 2 / this.scale;
    for (const e of events) {
      // стерео и громкость по положению на экране: далёкое — тише и в сторону
      let snd = null;
      if (audio) {
        let pan = 0;
        let near = 1;
        if (typeof e.x === 'number') {
          const dx = (e.x - this.cam.x) / halfW;
          const dy = (e.y - this.cam.y) / (halfW * 0.7);
          pan = clamp(dx * 0.75, -0.85, 0.85);
          near = clamp(1.35 - Math.hypot(dx, dy) * 0.45, 0.25, 1);
        }
        snd = { play: (name, v = 1) => audio.play(name, v * near, pan) };
      }
      switch (e.type) {
        case 'damage':
          if (e.friendly && e.hero) snd?.play('hurt', 0.7);
          fx.text(e.x + (Math.random() - 0.5) * 0.4, e.y, String(e.amount), e.friendly ? '#ff6b6b' : e.crit ? '#ffd34d' : e.armor ? '#cfd6e2' : '#fff6d5', { size: e.crit ? 1.15 : 0.8 });
          break;
        case 'gain':
          fx.text(e.x, e.y, `+${Math.round(e.amount * 10) / 10 >= 10 ? Math.round(e.amount) : Math.round(e.amount * 10) / 10}`, resColor(e.res), { dot: resColor(e.res), size: 0.85, life: 1.1 });
          break;
        case 'nodeHit': {
          const tree = e.kind === 'tree' || e.kind === 'bush';
          fx.burst(e.x, e.y, tree
            ? { count: 6, color: ['#c98a4b', '#4c8a46', '#346a3c'], shape: 'rect', size: 0.07, speed: 3, up: 3, outline: true }
            : { count: 6, color: e.kind === 'crystal' ? ['#7ff3ff', '#ffffff'] : ['#a9b0bd', '#7d8696'], shape: 'rect', size: 0.07, speed: 3, up: 3, outline: true });
          snd?.play(tree ? 'chop' : 'rock', 0.8);
          break;
        }
        case 'nodeBreak':
          fx.burst(e.x, e.y, { count: 14, color: ['#4c8a46', '#346a3c', '#a9b0bd'], size: 0.12, speed: 4, up: 4, outline: true });
          fx.addShake(0.06);
          break;
        case 'nodeGrow':
          fx.burst(e.x, e.y, { count: 6, color: ['#9be36e', '#ffffff'], speed: 1, up: 3, size: 0.05, glow: true, life: 0.6, grav: 3 });
          break;
        case 'swing':
          fx.trail(e.x, e.y, e.angle, e.range, SWING_COLORS[e.kind] || SWING_COLORS.slash, e.arc, e.kind);
          if (e.tier >= 5) fx.burst(e.x + Math.cos(e.angle) * 0.8, e.y + Math.sin(e.angle) * 0.6, { count: 6, color: [W.METAL[e.tier], '#ffffff'], speed: 2, up: 2, size: 0.05, glow: true, life: 0.35 });
          snd?.play('swing');
          break;
        case 'shoot':
          if (e.kind === 'fireball') snd?.play('fire');
          else if (e.kind === 'lightning') snd?.play('zap');
          else if (e.kind === 'ice') snd?.play('ice');
          else if (e.kind === 'ballista') snd?.play('thud');
          else if (e.kind === 'enemy') snd?.play('bow', 0.4);
          else snd?.play('bow', 0.7);
          break;
        case 'explode': {
          const ice = e.kind === 'ice' || e.kind === 'frost';
          const orb = e.kind === 'orb';
          const col = ice ? ['#bff3ff', '#7fd6f0', '#ffffff'] : orb ? ['#d0a0ff', '#8a3fd0', '#ffffff'] : ['#ffb347', '#ff7a2a', '#fff3c4'];
          fx.ring(e.x, e.y, e.r * 2.2, col[0], { fill: ice ? 'rgba(150,230,255,0.3)' : orb ? 'rgba(180,120,255,0.3)' : 'rgba(255,140,40,0.35)', life: 0.35, width: 0.2 });
          fx.burst(e.x, e.y, { count: 16, color: col, speed: 4, up: 3, size: 0.11, glow: true, life: 0.5 });
          fx.addShake(0.08);
          snd?.play(ice ? 'ice' : 'boom', 0.7);
          break;
        }
        case 'flame':
          fx.ring(e.x, e.y, e.r * 2, '#ff9a3c', { fill: 'rgba(255,120,30,0.18)', life: 0.3 });
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            fx.burst(e.x + Math.cos(a) * e.r * 0.6, e.y + Math.sin(a) * e.r * 0.4, { count: 2, color: ['#ff7a2a', '#ffd34d'], speed: 1, up: 3, size: 0.12, glow: true, life: 0.5, grav: -2 });
          }
          snd?.play('fire', 0.5);
          break;
        case 'blast':
          fx.ring(e.x, e.y, e.r * 2.2, '#c8ff3a', { fill: 'rgba(160,220,60,0.35)', life: 0.5, width: 0.25 });
          fx.burst(e.x, e.y, { count: 26, color: ['#c8ff3a', '#7a9a4a', '#e8ff9a'], speed: 5, up: 4, size: 0.14, life: 0.7 });
          fx.addShake(0.3);
          snd?.play('boom');
          break;
        case 'heal':
          fx.burst(e.x, e.y - 0.4, { count: 4, color: ['#ff7aff', '#ffffff'], speed: 0.5, up: 3, size: 0.06, glow: true, life: 0.6, grav: 1 });
          break;
        case 'summon':
          fx.ring(e.x, e.y, 2.5, '#5aff8a', { life: 0.5 });
          snd?.play('summon');
          break;
        case 'burn':
          fx.burst(e.x, e.y - 0.4, { count: 2, color: ['#ff7a2a', '#ffd34d'], speed: 0.5, up: 2, size: 0.08, glow: true, life: 0.4, grav: -2 });
          break;
        case 'spikes':
          fx.burst(e.x, e.y, { count: 5, color: ['#c9ced8', '#ff6b6b'], speed: 2, up: 3, size: 0.05, life: 0.3 });
          snd?.play('hit', 0.6);
          break;
        case 'arrowHit':
        case 'allyHit':
          fx.burst(e.x, e.y, { count: 5, color: ['#fff6d5', '#ffd34d'], speed: 3, up: 2, size: 0.05, glow: true, life: 0.3 });
          snd?.play('hit', 0.6);
          break;
        case 'enemyHit':
          fx.burst(e.x, e.y - 0.3, { count: 4, color: '#ff6b6b', speed: 2, up: 2, size: 0.05, life: 0.3 });
          if (e.boss) { fx.addShake(0.25); fx.ring(e.x, e.y, 2.4, '#ff3cf0', { life: 0.4 }); }
          break;
        case 'buildingHit':
          fx.burst(e.x, e.y, { count: 3, color: ['#8a92a0', '#c98a4b'], shape: 'rect', speed: 2, up: 3, size: 0.06, outline: true });
          snd?.play('thud', 0.4);
          break;
        case 'demolished':
          fx.burst(e.x, e.y, { count: 14 + e.size * 6, color: ['#8a92a0', '#a0683a', '#c9a06a'], shape: 'rect', speed: 4, up: 4, size: 0.1, outline: true, life: 0.8 });
          fx.burst(e.x, e.y, { count: 10, color: ['rgba(200,190,170,0.6)'], speed: 1.5, up: 1.5, size: 0.35, life: 1.1, grav: -0.5 });
          fx.addShake(0.12);
          snd?.play('demolish');
          break;
        case 'found':
          snd?.play('gem', 0.8);
          break;
        case 'collapse':
          fx.burst(e.x, e.y, { count: 18 + e.size * 6, color: ['#5a5f70', '#7a5a3a', '#8a92a0'], shape: 'rect', speed: 5, up: 5, size: 0.12, outline: true, life: 0.9 });
          fx.ring(e.x, e.y, e.size * 1.5, 'rgba(200,200,200,0.6)', { life: 0.5 });
          fx.addShake(0.25);
          snd?.play('collapse', e.size > 1 ? 1 : 0.5);
          break;
        case 'death':
          this.deathFx(e);
          snd?.play(e.boss ? 'bossDie' : 'bones', 0.8);
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
          snd?.play(BUILDINGS[e.building]?.wall ? 'thud' : 'build', BUILDINGS[e.building]?.wall ? 0.5 : 1);
          break;
        case 'upgraded':
          fx.burst(e.x, e.y - 0.5, { count: 20, color: ['#f2c14e', '#fff3c4'], speed: 3, up: 5, size: 0.07, glow: true, life: 0.8, grav: 4 });
          fx.ring(e.x, e.y, 2.6, '#f2c14e', { life: 0.5 });
          fx.text(e.x, e.y - 1.5, `Уровень ${e.level}`, '#f2c14e', { size: 1.05, life: 1.2 });
          snd?.play('upgrade');
          break;
        case 'evolved':
          fx.ring(e.x, e.y, 4, '#ff7aff', { life: 0.8, width: 0.25 });
          fx.burst(e.x, e.y - 1, { count: 40, color: ['#ff7aff', '#7ff3ff', '#ffd34d'], speed: 4, up: 7, size: 0.08, glow: true, life: 1.2, grav: 3 });
          fx.text(e.x, e.y - 2.2, e.name, '#ff9af0', { size: 1.2, life: 2 });
          fx.addShake(0.2);
          snd?.play('evolve');
          break;
        case 'repaired':
          fx.burst(e.x, e.y - 0.4, { count: 10, color: ['#7dff9a', '#ffffff'], speed: 2, up: 4, size: 0.06, glow: true, life: 0.7, grav: 3 });
          break;
        case 'heroDown':
          fx.burst(e.x, e.y, { count: 18, color: ['#1f6fd1', '#f2c14e', '#ffffff'], speed: 4, up: 4, size: 0.1, life: 0.8 });
          fx.addShake(0.3);
          snd?.play('heroDown');
          break;
        case 'allyDown':
          fx.burst(e.x, e.y, { count: 10, color: ['#2f80d8', '#9aa5b8'], speed: 3, up: 3, size: 0.08, life: 0.6 });
          break;
        case 'respawn':
          fx.ring(e.x, e.y, 2.5, '#7ff3ff', { life: 0.6, width: 0.2 });
          fx.burst(e.x, e.y, { count: 20, color: ['#7ff3ff', '#ffffff'], speed: 2, up: 6, size: 0.06, glow: true, life: 0.9, grav: 2 });
          snd?.play('respawn');
          break;
        case 'heartUp':
          this.lightWave = { t: 0, x: e.x, y: e.y, r: e.radius };
          fx.burst(e.x, e.y - 2.5, { count: 50, color: ['#ffd34d', '#fff3c4', '#7ff3ff'], speed: 6, up: 9, size: 0.1, glow: true, life: 1.4, grav: 3 });
          fx.text(e.x, e.y - 3.6, `Сердце: уровень ${e.level}`, '#ffe08a', { size: 1.3, life: 2 });
          fx.addShake(0.35);
          snd?.play('beacon');
          break;
        case 'chestSpawn':
          fx.burst(e.x, e.y, { count: 10, color: ['#ffd34d', '#ffffff'], speed: 1, up: 4, size: 0.05, glow: true, life: 0.8, grav: 2 });
          break;
        case 'chestOpen':
          fx.burst(e.x, e.y - 0.3, { count: 26, color: ['#ffd34d', '#fff3c4', '#ff9af0'], speed: 4, up: 6, size: 0.08, glow: true, life: 1, grav: 5 });
          fx.ring(e.x, e.y, 2, '#ffd34d', { life: 0.5 });
          snd?.play('chest');
          break;
        case 'shrine':
          fx.ring(e.x, e.y, 3, '#7ff3ff', { life: 0.7, width: 0.25 });
          fx.burst(e.x, e.y - 1.2, { count: 30, color: ['#7ff3ff', '#ffffff'], speed: 3, up: 6, size: 0.07, glow: true, life: 1, grav: 3 });
          snd?.play('respawn');
          break;
        case 'note':
          fx.burst(e.x, e.y - 0.6, { count: 14, color: ['#fff3c4', '#ffffff'], speed: 2, up: 4, size: 0.05, glow: true, life: 0.8, grav: 2 });
          snd?.play('page');
          break;
        case 'riftOpen':
          fx.ring(e.x, e.y, 3, '#b07aff', { life: 0.8, width: 0.3 });
          snd?.play('summon');
          break;
        case 'riftClosed':
          fx.ring(e.x, e.y, 4, '#ffffff', { life: 0.6, width: 0.3 });
          fx.burst(e.x, e.y - 0.5, { count: 34, color: ['#b07aff', '#ffffff', '#5a1a8a'], speed: 5, up: 5, size: 0.1, glow: true, life: 1 });
          fx.addShake(0.3);
          snd?.play('boom');
          break;
        case 'merchant':
          fx.burst(e.x, e.y - 0.8, { count: 18, color: ['#ffd34d', '#ffffff'], speed: 2, up: 5, size: 0.06, glow: true, life: 1, grav: 3 });
          break;
        case 'waveStart': snd?.play('horn'); break;
        case 'victory': snd?.play('victory'); break;
        case 'defeat': fx.addShake(0.5); snd?.play('defeat'); break;
        case 'crafted': snd?.play('upgrade'); break;
        case 'achievement': snd?.play('victory', 0.6); break;
        default:
      }
    }
  }

  deathFx(e) {
    const look = LOOKS[ENEMIES[e.enemy]?.look] || LOOKS.skeleton;
    const pal = PALETTES[look.pal];
    const s = look.scale;
    this.fx.piece(e.x, e.y, 0.9 * s, (ctx) => {
      ctx.scale(s, s);
      drawHead(ctx, look, pal, this.time);
    }, { vz: 5 + Math.random() * 2, life: 1.0 });
    this.fx.burst(e.x, e.y, { count: e.boss ? 40 : 10, color: [pal.bone || pal.stone || pal.fur || '#efe3c8', pal.boneShade || '#cbb994', pal.cape || pal.robe || '#4b3366'], shape: 'bone', size: 0.06 * s, speed: 4, up: 4, outline: true, life: 0.9 });
    this.fx.burst(e.x, e.y, { count: 8, color: ['#6a4a8a', '#3a2a50'], speed: 1, up: 1, size: 0.25 * s, life: 0.8, grav: -2 });
    if (e.boss) this.fx.addShake(0.6);
  }

  // ---------- кадр ----------

  frame(dt, ui) {
    this.time += dt;
    // если кадры долго медленные — снижаем плотность пикселей (слабые телефоны)
    this.ft = (this.ft ?? 0.016) * 0.97 + dt * 0.03;
    if (!this.lowQ && this.time > 5 && this.ft > 0.034 && (window.devicePixelRatio || 1) > 1) {
      this.lowQ = true;
      this.resize();
    }
    const g = this.game;
    this.fx.update(dt);
    if (this.lightWave) { this.lightWave.t += dt; if (this.lightWave.t > 1.6) this.lightWave = null; }
    for (const w of this.wisps) w.a += w.speed * dt;
    for (const e of this.eyes) { e.t += dt; if (e.t > e.life) Object.assign(e, this.newEyes()); }

    const k = 1 - Math.pow(0.002, dt);
    this.cam.x += (g.hero.x - this.cam.x) * k;
    this.cam.y += (g.hero.y - 0.4 - this.cam.y) * k;
    const halfW = this.w / 2 / this.scale;
    const halfH = this.h / 2 / this.scale;
    this.cam.x = clamp(this.cam.x, halfW - 2, WORLD.width - halfW + 2);
    this.cam.y = clamp(this.cam.y, halfH - 2, WORLD.height - halfH + 2);

    const ctx = this.ctx;
    const shake = this.fx.shake;
    const sx = (Math.random() - 0.5) * shake * 0.6;
    const sy = (Math.random() - 0.5) * shake * 0.6;
    const s = this.scale;
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#0b0a14';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(d * s, 0, 0, d * s, d * (this.w / 2 - (this.cam.x + sx) * s), d * (this.h / 2 - (this.cam.y + sy) * s));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    this.drawGround(ctx);
    this.drawTerritoryLight(ctx, ui);
    this.drawWorldObjects(ctx, ui);
    this.drawBolts(ctx);
    this.fx.drawWorld(ctx);
    this.drawFog(ctx);
    this.drawFogEdge(ctx);
    this.drawWaveArrows(ctx);
    this.drawOverlays(ctx, ui);

    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.fx.drawTexts(ctx, this.toScreen, s);
    this.drawObjectivePointer(ctx, ui);
    this.drawOffscreenEnemies(ctx);
  }

  makeGround() {
    const px = 20;
    const c = document.createElement('canvas');
    c.width = WORLD.width * px;
    c.height = WORLD.height * px;
    const g = c.getContext('2d');
    const cx = (WORLD.heart.tx + 1.5) * px;
    const cy = (WORLD.heart.ty + 1.5) * px;
    // зоны — концентрические кольца с мягкими переходами
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 60 * px);
    for (const z of ZONES) {
      grad.addColorStop(Math.min(1, z.rMin / 60), z.ground);
      grad.addColorStop(Math.min(1, (z.rMax - 1.5) / 60), z.ground);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const zoneOf = (x, y) => {
      const r = Math.hypot(x - cx, y - cy) / px;
      return ZONES.find((z) => r >= z.rMin && r < z.rMax)?.id || 5;
    };
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * c.width; const y = rnd() * c.height;
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.beginPath();
      g.arc(x, y, 6 + rnd() * 30, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 16000; i++) {
      const x = rnd() * c.width; const y = rnd() * c.height;
      const z = zoneOf(x, y);
      if (z === 1 || z === 4) {
        g.strokeStyle = z === 1 ? 'rgba(110,150,90,0.55)' : 'rgba(90,170,160,0.45)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 2 + rnd() * 4, y - 3 - rnd() * 4);
        g.stroke();
      } else if (z === 2) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(160,100,60,0.35)' : 'rgba(80,70,60,0.4)';
        g.fillRect(x, y, 2 + rnd() * 2, 2 + rnd() * 2);
      } else if (z === 3) {
        g.fillStyle = rnd() < 0.85 ? 'rgba(170,180,210,0.25)' : 'rgba(220,235,255,0.7)';
        g.beginPath();
        g.arc(x, y, 1 + rnd() * 1.5, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = rnd() < 0.9 ? 'rgba(90,60,90,0.4)' : 'rgba(255,120,220,0.6)';
        g.fillRect(x, y, 1.5, 1.5);
      }
    }
    // цветы и камешки
    for (let i = 0; i < 900; i++) {
      const x = rnd() * c.width; const y = rnd() * c.height;
      const z = zoneOf(x, y);
      g.fillStyle = z === 1 ? ['#e8d36a', '#c9a0e8', '#f0f0f0'][Math.floor(rnd() * 3)] : z === 3 ? '#dfe8ff' : z === 5 ? '#ff7ad2' : '#7d8696';
      g.beginPath();
      g.arc(x, y, 1.6 + rnd() * 1.3, 0, Math.PI * 2);
      g.fill();
    }
    // светящиеся трещины в кратере
    g.strokeStyle = 'rgba(255,120,220,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      let x = rnd() * c.width; let y = rnd() * c.height;
      if (zoneOf(x, y) !== 5) continue;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    // мощёная площадь у Сердца
    g.fillStyle = '#4a4538';
    g.beginPath();
    g.arc(cx, cy, 3.4 * px, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(20,16,12,0.5)';
    g.lineWidth = 1.5;
    for (let r = 1.2; r < 3.4; r += 0.6) { g.beginPath(); g.arc(cx, cy, r * px, 0, Math.PI * 2); g.stroke(); }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 1.2 * px, cy + Math.sin(a) * 1.2 * px);
      g.lineTo(cx + Math.cos(a) * 3.4 * px, cy + Math.sin(a) * 3.4 * px);
      g.stroke();
    }
    // дорожки к сторонам света
    g.strokeStyle = 'rgba(90,80,60,0.55)';
    g.lineWidth = 0.9 * px;
    g.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(cx + dx * 3.3 * px, cy + dy * 3.3 * px); g.lineTo(cx + dx * 9 * px, cy + dy * 9 * px); }
    g.stroke();
    return c;
  }

  view() {
    const halfW = this.w / 2 / this.scale + 2;
    const halfH = this.h / 2 / this.scale + 3;
    return { x0: this.cam.x - halfW, x1: this.cam.x + halfW, y0: this.cam.y - halfH, y1: this.cam.y + halfH + 3 };
  }

  drawGround(ctx) {
    const v = this.view();
    const px = 20;
    const x0 = clamp(Math.floor(v.x0), 0, WORLD.width);
    const y0 = clamp(Math.floor(v.y0), 0, WORLD.height);
    const x1 = clamp(Math.ceil(v.x1), 0, WORLD.width);
    const y1 = clamp(Math.ceil(v.y1), 0, WORLD.height);
    if (x1 > x0 && y1 > y0) ctx.drawImage(this.ground, x0 * px, y0 * px, (x1 - x0) * px, (y1 - y0) * px, x0, y0, x1 - x0, y1 - y0);
  }

  drawTerritoryLight(ctx, ui) {
    const g = this.game;
    const c = g.heartCenter();
    const R = g.radius();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.min(R, 14));
    gr.addColorStop(0, 'rgba(255,200,110,0.12)');
    gr.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.min(R, 14), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // волна света при улучшении Сердца
    if (this.lightWave) {
      const k = this.lightWave.t / 1.6;
      ctx.save();
      ctx.strokeStyle = `rgba(255,230,150,${1 - k})`;
      ctx.lineWidth = 0.6 * (1 - k) + 0.1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, this.lightWave.r * easeOutBack(Math.min(1, k * 1.3)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (ui.buildType) {
      const hx = this.ghost ? this.ghost.tx : Math.floor(g.hero.x);
      const hy = this.ghost ? this.ghost.ty : Math.floor(g.hero.y);
      for (let y = hy - 7; y <= hy + 8; y++) {
        for (let x = hx - 9; x <= hx + 10; x++) {
          if (!g.inBounds(x, y) || !g.inTerritory(x + 0.5, y + 0.5, 0.4)) continue;
          const i = g.idx(x, y);
          const busy = g.grid[i] || g.nodeGrid[i];
          ctx.fillStyle = busy ? 'rgba(255,90,90,0.08)' : 'rgba(140,255,170,0.07)';
          ctx.fillRect(x + 0.05, y + 0.05, 0.9, 0.9);
        }
      }
    }
  }

  drawWorldObjects(ctx, ui) {
    const g = this.game;
    const v = this.view();
    const items = [];
    const visible = (x, y) => x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1;
    for (const n of g.nodes) if (visible(n.x, n.y)) items.push({ y: n.y + 0.3, draw: () => this.drawNode(ctx, n) });
    for (const b of g.buildings) {
      const c = g.center(b);
      if (visible(c.x, c.y)) items.push({ y: b.ty + b.size, draw: () => this.drawBuilding(ctx, b) });
    }
    const a = g.activities;
    for (const c of a.chests) if (visible(c.x, c.y)) items.push({ y: c.y + 0.3, draw: () => this.at(ctx, c.x, c.y + 0.3, () => { this.shadow(ctx, 0.35); N.chest(ctx, this.time); }) });
    for (const s of a.shrines) {
      if (visible(s.x, s.y) && g.inTerritory(s.x, s.y, -1.5)) items.push({ y: s.y + 0.3, draw: () => this.at(ctx, s.x, s.y + 0.3, () => { this.shadow(ctx, 0.5); N.shrine(ctx, s.readyAt <= g.time, this.time); }) });
    }
    for (const n of a.notes) {
      if (visible(n.x, n.y) && g.inTerritory(n.x, n.y, -1)) items.push({ y: n.y + 0.3, draw: () => this.at(ctx, n.x, n.y + 0.3, () => { this.shadow(ctx, 0.25); N.note(ctx, this.time); }) });
    }
    for (const r of a.rifts) if (visible(r.x, r.y)) items.push({ y: r.y + 0.3, draw: () => this.drawRift(ctx, r) });
    if (a.merchant && visible(a.merchant.x, a.merchant.y)) {
      const m = a.merchant;
      items.push({ y: m.y + 0.3, draw: () => this.at(ctx, m.x, m.y + 0.3, () => { this.shadow(ctx, 0.9); N.wagon(ctx, this.time); }) });
    }
    if (!g.hero.dead) items.push({ y: g.hero.y, draw: () => this.drawUnit(ctx, g.hero, 'hero') });
    for (const u of g.allies) if (visible(u.x, u.y)) items.push({ y: u.y, draw: () => this.drawUnit(ctx, u, u.type) });
    for (const u of g.workers) if (!u.hidden && visible(u.x, u.y)) items.push({ y: u.y, draw: () => this.drawUnit(ctx, u, 'worker') });
    for (const u of g.repairers) if (visible(u.x, u.y)) items.push({ y: u.y, draw: () => this.drawUnit(ctx, u, 'repairer') });
    for (const e of g.enemies) if (visible(e.x, e.y)) items.push({ y: e.y + (e.flying ? 1.5 : 0), draw: () => this.drawUnit(ctx, e, ENEMIES[e.type].look) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();
    // герой за зданием просвечивает, чтобы не теряться
    const h = g.hero;
    if (!h.dead && g.buildings.some((b) => !b.destroyed && !BUILDINGS[b.type].wall && h.y < b.ty + b.size - 0.05 && h.y > b.ty - 1.6
      && h.x > b.tx - 0.15 && h.x < b.tx + b.size + 0.15)) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      this.drawUnit(ctx, h, 'hero');
      ctx.restore();
    }
    for (const p of g.projectiles) this.drawProjectile(ctx, p);
    if (ui.buildType) this.drawGhost(ctx, ui);
  }

  at(ctx, x, y, fn) {
    ctx.save();
    ctx.translate(x, y);
    fn();
    ctx.restore();
  }

  shadow(ctx, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawNode(ctx, n) {
    const g = this.game;
    const hitAge = g.time - n.hitTime;
    const shake = hitAge < 0.25 ? Math.sin(hitAge * 60) * 0.06 * (1 - hitAge / 0.25) : 0;
    const grow = clamp((g.time - n.born) / 0.5, 0, 1);
    const zone = g.zoneAt(n.x, n.y).id;
    ctx.save();
    ctx.translate(n.x + shake, n.y + 0.35);
    this.shadow(ctx, n.kind === 'tree' ? 0.4 : 0.36);
    if (grow < 1) { const k = easeOutBack(grow) || 0.01; ctx.scale(k, k); }
    if (n.kind === 'tree') {
      const variant = (n.tx * 7 + n.ty * 13) % 5;
      const sp = sprite(`tree|${zone}|${variant}`, [-0.7, -1.4, 0.7, 0.2], (c) => N.tree(c, zone, 0, variant));
      const sway = Math.sin(this.time * 1.3 + n.tx * 0.7 + n.ty) * 0.03;
      ctx.rotate(sway);
      drawSprite(ctx, sp);
    } else if (n.kind === 'bush') {
      N.bush(ctx, n.hp, n.maxHp);
    } else if (['crystal', 'mithril', 'meteor'].includes(n.kind)) {
      N.rock(ctx, n.kind, n.hp, n.maxHp, this.time);
    } else {
      const k = Math.round((n.hp / n.maxHp) * 4);
      const sp = sprite(`rock|${n.kind}|${k}`, [-0.6, -0.7, 0.6, 0.2], (c) => N.rock(c, n.kind, k, 4, 0));
      drawSprite(ctx, sp);
    }
    ctx.restore();
  }

  drawRift(ctx, r) {
    const g = this.game;
    const hitAge = g.time - r.hitTime;
    ctx.save();
    ctx.translate(r.x + (hitAge < 0.2 ? Math.sin(hitAge * 70) * 0.05 : 0), r.y + 0.3);
    N.rift(ctx, this.time, r.hp / r.maxHp);
    ctx.restore();
    // полоска прочности
    const w = 1.2;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(r.x - w / 2 - 0.03, r.y - 1.6, w + 0.06, 0.15);
    ctx.fillStyle = '#b07aff';
    ctx.fillRect(r.x - w / 2, r.y - 1.57, w * (r.hp / r.maxHp), 0.09);
  }

  buildingInfo(b) {
    const g = this.game;
    return {
      size: b.size, level: b.level, path: evoPath(b), tier: Object.keys(b.evo || {}).length,
      working: b.status === 'working' && g.time - b.workTime < 0.5, powered: b.powered && b.enabled, hpRatio: b.hp / b.maxHp,
    };
  }

  drawBuilding(ctx, b) {
    const g = this.game;
    const cfg = BUILDINGS[b.type];
    const c = g.center(b);
    const age = g.time - b.builtTime;
    const hitAge = g.time - b.hitTime;
    ctx.save();
    ctx.translate(c.x, b.ty + b.size);
    const pop = age < 0.5 ? easeOutBack(clamp(age / 0.5, 0, 1)) : 1;
    const wob = hitAge < 0.2 ? Math.sin(hitAge * 70) * 0.05 * (1 - hitAge / 0.2) : 0;
    ctx.translate(wob, 0);
    if (pop !== 1) ctx.scale(pop, pop);
    if (cfg.wall) {
      const mask = this.wallMask(b);
      const path = evoPath(b);
      const sp = sprite(`wall2|${b.level}|${mask}|${cfg.gate ? 1 : 0}|${b.destroyed ? 1 : 0}`, [-0.6, -1.9, 0.6, 0.15], (cx) => wallArt(cx, b.level, mask, !!cfg.gate, b.destroyed, path));
      drawSprite(ctx, sp);
    } else if (b.destroyed) {
      rubble(ctx, b.size, this.time);
    } else {
      const art = ART[b.type];
      if (art) {
        const info = this.buildingInfo(b);
        const levelBucket = b.type === 'heart' ? Math.min(100, b.level >= 100 ? 100 : b.level >= 50 ? 50 : b.level >= 25 ? 25 : b.level >= 10 ? 10 : 1) : Math.floor(b.level / 5);
        const key = `${b.type}|${levelBucket}|${info.path}|${info.tier}`;
        drawSprite(ctx, sprite(key, art.bounds, (cx) => art.static(cx, info)));
        if (art.anim) {
          const extra = { attackAge: g.time - b.workTime, trapAge: g.time - b.workTime };
          if (b.type === 'ballista') {
            const st = towerStats(b);
            const e = g.nearestEnemy(c.x, c.y, st.range);
            b.aim = e ? Math.atan2(e.y - c.y, e.x - c.x) : (b.aim ?? -Math.PI / 2);
            extra.aim = b.aim;
          }
          art.anim(ctx, info, this.time, extra);
        }
      }
      if (hitAge < 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,120,120,0.22)';
        ctx.fillRect(-b.size / 2, -2.5, b.size, 2.5);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
    if (this.selected === b.id) this.drawSelection(ctx, b);
  }

  wallMask(b) {
    const g = this.game;
    let m = 0;
    const is = (x, y) => { const o = g.buildingAt(x, y); return o && BUILDINGS[o.type].wall; };
    if (is(b.tx, b.ty - 1)) m |= 1;
    if (is(b.tx + 1, b.ty)) m |= 2;
    if (is(b.tx, b.ty + 1)) m |= 4;
    if (is(b.tx - 1, b.ty)) m |= 8;
    return m;
  }

  drawSelection(ctx, b) {
    const g = this.game;
    const cfg = BUILDINGS[b.type];
    const t = this.time;
    ctx.save();
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 0.07;
    ctx.setLineDash([0.25, 0.15]);
    ctx.lineDashOffset = -t;
    if (cfg.wall) {
      for (const m of g.wallSegment(b)) ctx.strokeRect(m.tx + 0.05, m.ty + 0.05, 0.9, 0.9);
    } else ctx.strokeRect(b.tx + 0.05, b.ty + 0.05, b.size - 0.1, b.size - 0.1);
    ctx.restore();
    const c = g.center(b);
    const st = towerStats(b);
    let r = st ? st.range : cfg.aura ? cfg.aura.radius : 0;
    if (r) {
      ctx.strokeStyle = 'rgba(255,224,138,0.55)';
      ctx.fillStyle = 'rgba(255,224,138,0.06)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ---------- персонажи ----------

  drawUnit(ctx, u, lookId) {
    const g = this.game;
    const look = LOOKS[lookId] || LOOKS.skeleton;
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
    let alpha = look.alpha || 1;
    if (bornAge < 0.45) { const k = bornAge / 0.45; s *= easeOutBack(k); alpha *= Math.min(1, k * 2); }
    const flash = hitAge < 0.12;
    const p = flash ? flashPalette(pal) : pal;
    const armorTier = u === g.hero ? ITEMS[g.inventory.equipped.armor]?.tier || 0 : 0;
    const float = look.float ? look.float + Math.sin(t * 3) * 0.08 : 0;

    ctx.save();
    ctx.translate(u.x, u.y + 0.2);
    ctx.save();
    ctx.scale(s, s);
    ctx.globalAlpha = 0.9;
    this.shadow(ctx, 0.32 * (1 - hop * 0.3) * (look.float ? 0.8 : 1));
    ctx.restore();
    ctx.globalAlpha = alpha;
    if (u.slowUntil > g.time) {
      ctx.fillStyle = 'rgba(150,230,255,0.35)';
      ellipse(ctx, 0, 0, 0.45 * s, 0.18 * s);
      ctx.fill();
    }
    let lunge = 0;
    if (attackAge < 0.22) lunge = Math.sin((attackAge / 0.22) * Math.PI);
    const pop = hitAge < 0.15 ? 1 + 0.15 * (1 - hitAge / 0.15) : 1;
    const breathe = moving ? 0 : Math.sin(t * 3) * 0.025;
    const squashY = (moving ? 1 - (1 - hop) * 0.1 : 1 + breathe) * (1 - lunge * 0.08);
    const squashX = (moving ? 1 + (1 - hop) * 0.08 : 1 - breathe) * (1 + lunge * 0.1);
    const tilt = (moving ? clamp((u.vx || 0) * 0.05, -0.2, 0.2) + Math.sin(t * hopSpeed) * 0.05 : 0) + facing * lunge * 0.25;

    ctx.translate(facing * lunge * 0.14 * s, -hop * 0.13 * s - float * s);
    ctx.rotate(tilt);
    ctx.scale(s * pop, s * pop);
    ctx.scale(squashX, squashY);

    // тело
    ctx.save();
    ctx.scale(facing, 1);
    const live = look.body === 'wisp' || look.body === 'drake';
    if (live) drawBody(ctx, look, p, t);
    else drawSprite(ctx, sprite(`b|${lookId}|${flash ? 1 : 0}|${armorTier}`, [-0.85, -1.05, 0.85, 0.15], (c) => drawBody(c, look, p, 0, armorTier)));
    if (lookId === 'worker' && u.carry > 0) {
      // ноша за спиной
      ctx.beginPath();
      ctx.ellipse(-0.25, -0.45, 0.13, 0.15, -0.3, 0, Math.PI * 2);
      ink(ctx, u.carryRes === 'wood' ? '#c98a4b' : u.carryRes === 'food' ? '#d93a6a' : '#a9b0bd', 0.025);
    }
    if (u === g.hero && g.inventory.equipped.amulet) {
      ellipse(ctx, 0.0, -0.4, 0.035, 0.045);
      ink(ctx, W.GEM[ITEMS[g.inventory.equipped.amulet].tier], 0.015);
    }
    ctx.restore();

    // голова — парит над телом и отстаёт по фазе
    const headBob = moving ? Math.sin(t * hopSpeed - 0.9) * 0.05 : Math.sin(t * 3 - 0.6) * 0.02;
    ctx.save();
    ctx.translate(0, (look.headY ?? -0.86) + headBob - lunge * 0.04);
    ctx.rotate(Math.sin(t * hopSpeed * 0.5) * (moving ? 0.07 : 0.02) + facing * lunge * 0.15);
    ctx.scale(facing, 1);
    const blink = (t % 3.7) < 0.12;
    const shout = attackAge < 0.2;
    if (look.head === 'maw') drawHead(ctx, look, p, t);
    else {
      const key = `h|${lookId}|${flash ? 1 : 0}|${blink ? 1 : 0}|${shout ? 1 : 0}`;
      drawSprite(ctx, sprite(key, [-0.65, -0.85, 0.7, 0.45], (c) => drawHead(c, look, p, 0, { blink, shout })));
    }
    ctx.restore();
    ctx.restore();

    this.drawUnitWeapon(ctx, u, look, s, attackAge, facing, t, hop, float);

    // статусы
    if (u.stunUntil > g.time) {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * 2.1;
        ctx.fillStyle = '#ffd34d';
        ellipse(ctx, u.x + Math.cos(a) * 0.3 * s, u.y - 1.25 * s + Math.sin(a) * 0.08, 0.05, 0.05);
        ctx.fill();
      }
    }
    if (u.burnUntil > g.time && Math.random() < 0.3) this.fx.burst(u.x, u.y, { count: 1, color: ['#ff7a2a', '#ffd34d'], speed: 0.5, up: 2, size: 0.07, glow: true, life: 0.4, grav: -2, z: 0.5 });

    const showBar = u.hp < u.maxHp && !(u === g.hero && g.phase === 'build' && u.hp > u.maxHp * 0.95);
    if (showBar) {
      const w = 0.8 * Math.max(1, s * 0.8);
      const y = u.y - 1.35 * s - float * s;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(u.x - w / 2 - 0.03, y - 0.03, w + 0.06, 0.15);
      ctx.fillStyle = u.kind === 'enemy' ? (ENEMIES[u.type]?.boss ? '#ff3cf0' : '#ff5a5a') : '#6ee36e';
      ctx.fillRect(u.x - w / 2, y, w * clamp(u.hp / u.maxHp, 0, 1), 0.09);
    }
  }

  drawUnitWeapon(ctx, u, look, s, attackAge, facing, t, hop, float) {
    const g = this.game;
    const cx = u.x;
    const cy = u.y + 0.2 - 0.35 * s - hop * 0.13 * s - float * s;
    const fl = Math.sin(t * 3.2) * 0.05;
    let item = null;
    let weapon = look.weapon;
    if (u === g.hero) { item = g.weaponItem(); weapon = item.wtype; }
    if (u.kind === 'ally') item = { tier: u.tier || 2, wtype: look.weapon === 'staff' ? 'fireStaff' : look.weapon };
    if (lookIsWorker(u)) weapon = u.tool === 'pickaxe' ? 'pickaxe' : 'axe';
    if (!weapon) return;
    const aimAng = u === g.hero ? Math.atan2(g.hero.aimY, g.hero.aimX) : facing > 0 ? 0 : Math.PI;
    const tier = item?.tier || 2;
    ctx.save();
    const melee = { sword: 1, mace: 1, daggers: 1, scythe: 1, halberd: 1 }[weapon];
    if (melee) {
      const kind = WEAPON_TYPES[weapon].kind;
      const dur = kind === 'smash' ? 0.32 : kind === 'stab' ? 0.16 : kind === 'thrust' ? 0.22 : kind === 'reap' ? 0.34 : 0.24;
      const sz = s * (u === g.hero ? 1 : 0.8);
      const draw = (c) => {
        if (weapon === 'sword') W.sword(c, tier, sz);
        else if (weapon === 'mace') W.mace(c, tier, sz);
        else if (weapon === 'daggers') W.dagger(c, tier, sz);
        else if (weapon === 'scythe') W.scythe(c, tier, sz);
        else W.halberd(c, tier, sz * 0.9);
      };
      if (attackAge < dur) {
        const k = attackAge / dur;
        const e = 1 - Math.pow(1 - k, 3);
        if (kind === 'thrust') {
          const reach = 0.3 + Math.sin(k * Math.PI) * 0.9;
          ctx.translate(cx + Math.cos(aimAng) * reach * s, cy + Math.sin(aimAng) * reach * 0.8 * s);
          ctx.rotate(aimAng + Math.PI / 2);
          draw(ctx);
        } else if (kind === 'stab') {
          for (const side of [-1, 1]) {
            ctx.save();
            const reach = 0.35 + Math.sin(((k + (side > 0 ? 0.3 : 0)) % 1) * Math.PI) * 0.45;
            ctx.translate(cx + Math.cos(aimAng + side * 0.35) * reach * s, cy + Math.sin(aimAng + side * 0.35) * reach * s);
            ctx.rotate(aimAng + Math.PI / 2);
            draw(ctx);
            ctx.restore();
          }
        } else {
          const span = kind === 'smash' ? 2.2 : kind === 'reap' ? 5.6 : 3.4;
          const ang = aimAng - (span / 2) * facing + span * e * facing;
          const rr = kind === 'reap' ? 0.65 : 0.55;
          ctx.translate(cx + Math.cos(ang) * rr * s, cy + Math.sin(ang) * rr * 0.75 * s);
          ctx.rotate(ang + Math.PI / 2);
          draw(ctx);
        }
      } else if (weapon === 'daggers') {
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(cx + side * 0.42 * s, cy - 0.1 * s + fl * (side > 0 ? 1 : -1));
          ctx.rotate(side * 0.4);
          draw(ctx);
          ctx.restore();
        }
      } else {
        ctx.translate(cx + facing * 0.5 * s, cy - 0.15 * s + fl);
        ctx.rotate(facing * (weapon === 'scythe' || weapon === 'halberd' ? 0.15 : 0.35) + Math.sin(t * 2) * 0.05);
        draw(ctx);
      }
    } else if (weapon === 'bow' || weapon === 'crossbow') {
      const pull = attackAge < 0.15 ? 1 - attackAge / 0.15 : 0;
      const ang = attackAge < 0.6 ? aimAng : facing > 0 ? 0 : Math.PI;
      ctx.translate(cx + Math.cos(ang) * 0.5 * s, cy + Math.sin(ang) * 0.3 * s + fl);
      ctx.rotate(ang);
      if (weapon === 'bow') W.bow(ctx, tier, pull, s);
      else W.crossbow(ctx, tier, attackAge < 0.5 ? attackAge / 0.5 : 1, s);
    } else if (weapon.endsWith('Staff') || weapon === 'staff') {
      const k = attackAge < 0.3 ? Math.sin((attackAge / 0.3) * Math.PI) : 0;
      ctx.translate(cx + facing * 0.5 * s, cy + fl);
      ctx.rotate(facing * 0.15 + k * (aimAng + Math.PI / 2 - facing * 0.15) * 0.5);
      W.staff(ctx, weapon === 'staff' ? 'fireStaff' : weapon, tier, k, t, s);
    } else if (weapon === 'hammer' || weapon === 'axe' || weapon === 'pickaxe') {
      const working = g.time - (u.workTime ?? -9) < 0.35;
      ctx.translate(cx + facing * 0.4 * s, cy + fl);
      ctx.rotate(facing * (working ? 0.4 + Math.sin(t * 16) * 0.8 : 0.3));
      if (weapon === 'hammer') W.hammer(ctx, s);
      else if (weapon === 'axe') W.axe(ctx, s * 1.1);
      else W.pickaxe(ctx, s * 1.1);
    } else if (weapon === 'mace' || weapon === 'greatsword') {
      const k = attackAge < 0.3 ? Math.sin((attackAge / 0.3) * Math.PI) : 0;
      ctx.translate(cx + facing * 0.5 * s, cy + fl);
      ctx.rotate(facing * (0.3 + k * 1.4));
      if (weapon === 'mace') W.mace(ctx, 3, s * 0.9); else W.greatsword(ctx, s * 0.8);
    } else if (weapon === 'boneBow') {
      const pull = attackAge < 0.25 ? 1 - attackAge / 0.25 : 0;
      ctx.translate(cx + facing * 0.45 * s, cy + fl);
      if (facing < 0) ctx.rotate(Math.PI);
      ctx.scale(s, s);
      W.boneBow(ctx, pull);
    } else if (weapon === 'shield') {
      ctx.translate(cx + facing * 0.42 * s, cy + 0.05 * s);
      W.shield(ctx, s * 0.85);
    } else if (weapon === 'skullStaff') {
      const k = attackAge < 0.3 ? Math.sin((attackAge / 0.3) * Math.PI) : 0;
      ctx.translate(cx + facing * 0.48 * s, cy + fl);
      ctx.rotate(facing * (0.15 + k * 0.4));
      W.skullStaff(ctx, PALETTES[look.pal].eye, s * 0.9);
    }
    ctx.restore();
  }

  drawProjectile(ctx, p) {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y - 0.25);
    const glowBall = (r, color, core) => {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = color.replace('A', String(0.25 - i * 0.05));
        ctx.beginPath();
        ctx.arc(-Math.cos(ang) * i * 0.15, -Math.sin(ang) * i * 0.15, r - i * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
      ctx.lineWidth = 0.035;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ellipse(ctx, -0.03, -0.03, r * 0.2, r * 0.2);
      ctx.fill();
    };
    switch (p.kind) {
      case 'fireball':
        glowBall(0.3, 'rgba(255,140,40,A)', '#ffb347');
        if (Math.random() < 0.5) this.fx.burst(p.x, p.y, { count: 1, color: ['#ffb347', '#ff7a2a'], speed: 0.5, up: 1, size: 0.07, glow: true, life: 0.3, z: 0.25, grav: -1 });
        break;
      case 'ice':
      case 'frost':
        ctx.rotate(ang);
        glowBall(0.24, 'rgba(150,230,255,A)', '#bff3ff');
        break;
      case 'orb':
        glowBall(0.24, 'rgba(190,120,255,A)', '#d0a0ff');
        break;
      case 'hex':
        glowBall(0.2, 'rgba(255,90,255,A)', '#ff7aff');
        break;
      case 'darkfire':
        glowBall(0.28, 'rgba(255,60,200,A)', '#ff7ad2');
        break;
      case 'boneArrow':
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.rect(-0.25, -0.02, 0.45, 0.04);
        ink(ctx, '#efe3c8', 0.02);
        ctx.beginPath();
        ctx.moveTo(0.2, -0.05); ctx.lineTo(0.3, 0); ctx.lineTo(0.2, 0.05);
        ctx.closePath();
        ink(ctx, '#ff5f7a', 0.02);
        break;
      case 'bolt':
        ctx.rotate(ang);
        ctx.translate(-0.3, 0);
        W.bolt(ctx, 1.1, p.tier || 3);
        break;
      default:
        ctx.rotate(ang);
        ctx.translate(-0.3, 0);
        W.arrow(ctx, 0.9, p.tier || 1);
    }
    ctx.restore();
  }

  drawBolts(ctx) {
    for (const b of this.game.bolts) {
      const k = (this.game.time - b.t) / 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, a] of [[0.22, 0.25], [0.08, 0.9]]) {
        ctx.strokeStyle = w > 0.1 ? `rgba(120,200,255,${a * (1 - k)})` : `rgba(240,250,255,${a * (1 - k)})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        b.pts.forEach(([x, y], i) => {
          if (i === 0) { ctx.moveTo(x, y); return; }
          const [px, py] = b.pts[i - 1];
          for (let s = 1; s <= 4; s++) {
            const tt = s / 4;
            const jx = s < 4 ? (Math.random() - 0.5) * 0.3 : 0;
            const jy = s < 4 ? (Math.random() - 0.5) * 0.3 : 0;
            ctx.lineTo(px + (x - px) * tt + jx, py + (y - py) * tt + jy);
          }
        });
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawGhost(ctx, ui) {
    const gh = this.ghost;
    if (!gh) return;
    const g = this.game;
    const cfg = BUILDINGS[gh.type];
    const cells = this.wallDrag ? g.wallLineCells(this.wallDrag.x0, this.wallDrag.y0, gh.tx, gh.ty) : [[gh.tx, gh.ty]];
    ctx.save();
    for (const [tx, ty] of cells) {
      const ok = cells.length > 1 ? g.canPlace(gh.type, tx, ty).ok : gh.ok;
      ctx.globalAlpha = 0.6 + Math.sin(this.time * 6) * 0.1;
      ctx.fillStyle = ok ? 'rgba(120,255,150,0.25)' : 'rgba(255,90,90,0.3)';
      ctx.strokeStyle = ok ? '#8cffaa' : '#ff6b6b';
      ctx.lineWidth = 0.06;
      ctx.fillRect(tx, ty, cfg.size, cfg.size);
      ctx.strokeRect(tx, ty, cfg.size, cfg.size);
      ctx.save();
      ctx.translate(tx + cfg.size / 2, ty + cfg.size);
      ctx.globalAlpha = 0.55;
      if (cfg.wall) wallArt(ctx, 1, 0, !!cfg.gate, false);
      else if (ART[gh.type]) drawSprite(ctx, sprite(`${gh.type}|0|null|0`, ART[gh.type].bounds, (c) => ART[gh.type].static(c, { size: cfg.size, level: 1, path: null, tier: 0 })));
      ctx.restore();
    }
    ctx.restore();
    if (cfg.attack || cfg.aura) {
      const r = cfg.attack ? cfg.attack.range : cfg.aura.radius;
      ctx.strokeStyle = 'rgba(140,255,170,0.45)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(gh.tx + cfg.size / 2, gh.ty + cfg.size / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- мгла ----------

  newEyes() {
    return { a: Math.random() * Math.PI * 2, d: 1.5 + Math.random() * 6, t: -Math.random() * 6, life: 2.5 + Math.random() * 3, color: Math.random() < 0.6 ? '#ff3a5a' : '#c03cff' };
  }

  drawFog(ctx) {
    const g = this.game;
    const f = this.fogCtx;
    const fw = this.fogCanvas.width;
    const fh = this.fogCanvas.height;
    const k = fw / this.w;
    const s = this.scale * k;
    const ox = fw / 2 - this.cam.x * s;
    const oy = fh / 2 - this.cam.y * s;
    const c = g.heartCenter();
    const R = g.radius();
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, fw, fh);
    f.fillStyle = 'rgba(12,8,22,0.95)';
    f.fillRect(0, 0, fw, fh);
    // клубящиеся щупальца мглы вокруг света
    for (const w of this.wisps) {
      const ang = w.a + w.i;
      const dist = R + 1 + w.d * 9;
      const x = (c.x + Math.cos(ang) * dist) * s + ox;
      const y = (c.y + Math.sin(ang) * dist) * s + oy;
      const r = w.r * s;
      if (x + r < 0 || y + r < 0 || x - r > fw || y - r > fh) continue;
      const gr = f.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, w.i % 3 ? `rgba(70,30,110,${w.a2})` : `rgba(0,0,0,${w.a2 + 0.2})`);
      gr.addColorStop(1, 'rgba(40,20,70,0)');
      f.fillStyle = gr;
      f.beginPath();
      f.arc(x, y, r, 0, Math.PI * 2);
      f.fill();
    }
    f.globalCompositeOperation = 'destination-out';
    const holes = [{ x: c.x, y: c.y, r: R, soft: 1.6 }];
    for (const h of holes) {
      const x = h.x * s + ox;
      const y = h.y * s + oy;
      const r0 = Math.max(0, (h.r - h.soft) * s);
      const r1 = (h.r + h.soft * 0.3) * s;
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

  // Граница: светящийся рунный барьер, глаза и искры во мгле.
  drawFogEdge(ctx) {
    const g = this.game;
    const c = g.heartCenter();
    const R = g.radius();
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150,90,255,${0.35 + Math.sin(t * 2) * 0.1})`;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R + 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([0.12, 0.5]);
    ctx.lineDashOffset = -t * 0.8;
    ctx.strokeStyle = 'rgba(255,220,140,0.55)';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R - 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // искры, поднимающиеся из мглы
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + hash(i) * 0.3;
      const ph = (t * (0.15 + hash(i * 3) * 0.2) + hash(i * 7)) % 1;
      const r = R + 0.4 + ph * 2.5;
      ctx.fillStyle = `rgba(${i % 3 ? '180,110,255' : '255,120,170'},${0.6 * (1 - ph)})`;
      ellipse(ctx, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r - ph * 0.8, 0.05, 0.05);
      ctx.fill();
    }
    ctx.restore();
    // пары глаз во мгле
    for (const e of this.eyes) {
      if (e.t < 0) continue;
      const k = e.t / e.life;
      const open = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : (Math.sin(e.t * 2.5) > 0.97 ? 0.1 : 1);
      const r = R + e.d;
      const x = c.x + Math.cos(e.a) * r;
      const y = c.y + Math.sin(e.a) * r;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const dx of [-0.13, 0.13]) {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 0.25;
        ellipse(ctx, x + dx, y, 0.14, 0.12 * open);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ellipse(ctx, x + dx, y, 0.06, 0.035 * open + 0.003);
        ctx.fill();
      }
      ctx.restore();
    }
    // редкие фиолетовые молнии во мгле
    if (Math.sin(t * 0.7) > 0.985) {
      const a = t * 3.1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(190,120,255,0.8)';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      let x = c.x + Math.cos(a) * (R + 6);
      let y = c.y + Math.sin(a) * (R + 6);
      ctx.moveTo(x, y);
      for (let i = 0; i < 6; i++) { x += (Math.random() - 0.5) * 1.5; y += 0.7; ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawWaveArrows(ctx) {
    const g = this.game;
    let sides = null;
    if (g.phase === 'build') sides = g.wavePreview().sides;
    else if (g.wave && g.wave.idx < g.wave.plan.spawns.length) sides = g.wave.plan.sides;
    if (!sides) return;
    const c = g.heartCenter();
    const R = g.radius();
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    for (const side of sides) {
      const [vx, vy] = SIDE_VECTORS[side];
      const x = c.x + vx * (R - 0.9);
      const y = c.y + vy * (R - 0.9);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(-vy, -vx));
      ctx.translate(pulse * 0.25, 0);
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      ctx.beginPath();
      ctx.moveTo(0.6, 0); ctx.lineTo(-0.2, -0.55); ctx.lineTo(-0.2, -0.22); ctx.lineTo(-0.8, -0.22);
      ctx.lineTo(-0.8, 0.22); ctx.lineTo(-0.2, 0.22); ctx.lineTo(-0.2, 0.55);
      ctx.closePath();
      ctx.fillStyle = '#ff4a4a';
      ctx.fill();
      ctx.lineWidth = 0.07;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawOverlays(ctx) {
    const g = this.game;
    const t = this.time;
    const seenGroups = new Set();
    for (const b of g.buildings) {
      const cfg = BUILDINGS[b.type];
      const st = g.statusOf(b);
      const c = g.center(b);
      const tall = { archerTower: 2.6, mageTower: 3.0, frostTower: 2.6, watchTower: 3.1, heart: 3.6, generator: 2.4, arcanum: 3.2, smelter: 2.4, forge: 2.4 }[b.type] || 1.8;
      const top = b.ty + b.size - tall;
      if (cfg.wall) {
        // прочность всего забора — одной полосой над серединой секции
        if (seenGroups.has(b.wallGroup)) continue;
        seenGroups.add(b.wallGroup);
        const grp = g.wallGroupHp(b);
        if (grp.hp < grp.maxHp && !b.destroyed) {
          const ms = g.wallSegment(b);
          const mx = ms.reduce((s2, m) => s2 + m.tx + 0.5, 0) / ms.length;
          const my = Math.min(...ms.map((m) => m.ty)) - 0.6;
          const w = Math.min(2.5, 0.6 + ms.length * 0.15);
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(mx - w / 2 - 0.03, my - 0.03, w + 0.06, 0.14);
          ctx.fillStyle = grp.hp / grp.maxHp > 0.5 ? '#9be36e' : '#ff9a3c';
          ctx.fillRect(mx - w / 2, my, w * (grp.hp / grp.maxHp), 0.08);
        }
        continue;
      }
      if (b.hp < b.maxHp && !b.destroyed && b.type !== 'heart') {
        const w = Math.min(1.6, b.size * 0.8);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(c.x - w / 2 - 0.03, top + 0.42, w + 0.06, 0.14);
        ctx.fillStyle = b.hp / b.maxHp > 0.5 ? '#9be36e' : '#ff9a3c';
        ctx.fillRect(c.x - w / 2, top + 0.45, w * (b.hp / b.maxHp), 0.08);
      }
      if (!st.bad && !st.evolve) continue;
      const bob = Math.sin(t * 4 + b.id) * 0.06;
      ctx.save();
      ctx.translate(c.x, top + bob);
      ctx.beginPath();
      ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
      ctx.fillStyle = st.evolve ? '#ff7aff' : st.code === 'no_power' ? '#ffcf3a' : st.code === 'destroyed' ? '#ff6b6b' : '#ff9a3c';
      ctx.fill();
      ctx.lineWidth = 0.05;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      if (st.evolve) {
        ctx.moveTo(0, -0.16); ctx.lineTo(0.05, -0.05); ctx.lineTo(0.16, 0); ctx.lineTo(0.05, 0.05); ctx.lineTo(0, 0.16); ctx.lineTo(-0.05, 0.05); ctx.lineTo(-0.16, 0); ctx.lineTo(-0.05, -0.05);
        ctx.closePath();
        ctx.fill();
      } else if (st.code === 'no_power') {
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

  drawObjectivePointer(ctx, ui) {
    const obj = ui.objective;
    if (!obj || !obj.target) return;
    const [sx, sy] = this.toScreen(obj.target.x, obj.target.y);
    const m = 60;
    const on = sx > m && sy > m && sx < this.w - m && sy < this.h - m;
    const t = this.time;
    ctx.save();
    if (on) {
      ctx.translate(sx, sy - this.scale * 1.7 + Math.sin(t * 5) * 6);
      ctx.beginPath();
      ctx.moveTo(0, 12); ctx.lineTo(-10, -4); ctx.lineTo(10, -4);
    } else {
      const cx = this.w / 2;
      const cy = this.h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      ctx.translate(clamp(cx + Math.cos(ang) * 1000, m, this.w - m), clamp(cy + Math.sin(ang) * 1000, m + 40, this.h - m - 60));
      ctx.rotate(ang);
      ctx.translate(Math.sin(t * 5) * 5, 0);
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }

  drawOffscreenEnemies(ctx) {
    const g = this.game;
    if (g.phase !== 'wave') return;
    const m = 24;
    for (const e of g.enemies) {
      if (e.guard) continue;
      const [sx, sy] = this.toScreen(e.x, e.y);
      if (sx > 0 && sy > 0 && sx < this.w && sy < this.h) continue;
      if (!g.inTerritory(e.x, e.y)) continue;
      const ang = Math.atan2(sy - this.h / 2, sx - this.w / 2);
      ctx.save();
      ctx.translate(clamp(sx, m, this.w - m), clamp(sy, m + 50, this.h - m - 70));
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fillStyle = ENEMIES[e.type].boss ? '#ff3cf0' : '#ff4a4a';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function lookIsWorker(u) { return u.kind === 'worker'; }
