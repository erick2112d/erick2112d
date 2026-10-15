// Клавиатура, мышь и касания → команды игры.
import { BUILDINGS } from './config.js';

export class Input {
  constructor(canvas, hud, renderer, getGame) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = renderer;
    this.getGame = getGame;
    this.keys = new Set();
    this.joy = null;         // { id, x0, y0, x, y }
    this.mouse = null;       // экранные координаты
    this.pointerDown = null;
    this.moveTarget = null;
    this.stick = document.getElementById('stick');
    this.joyEl = document.getElementById('joystick');

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.hud.action('cancelBuild', {}); });
  }

  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.code;
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (!down) {
      if (k === 'Space') this.getGame().hero.attackHeld = false;
      return;
    }
    const g = this.getGame();
    if (k === 'Escape') {
      if (this.hud.modal) this.hud.closeModal();
      else if (this.hud.buildType) this.hud.action('cancelBuild', {});
      else if (this.hud.card) this.hud.closeCard();
      else this.hud.openMenu();
    }
    if (this.hud.blocking) return;
    if (k === 'Digit1') this.hud.action('weapon', { weapon: 'staff' });
    if (k === 'Digit2') this.hud.action('weapon', { weapon: 'sword' });
    if (k === 'Digit3') this.hud.action('weapon', { weapon: 'bow' });
    if (k === 'KeyQ') this.hud.action('auto', {});
    if (k === 'Space') {
      e.preventDefault();
      this.attackToward(this.mouse ? this.renderer.toWorld(this.mouse.x, this.mouse.y) : null);
      g.hero.attackHeld = true;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  }

  attackToward(p) {
    const h = this.getGame().hero;
    if (!p) p = { x: h.x + h.facing, y: h.y };
    h.attackAt = { x: p.x, y: p.y };
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onDown(e) {
    if (this.hud.blocking) return;
    const p = this.local(e);
    const g = this.getGame();
    const isTouch = e.pointerType === 'touch';
    // джойстик: касание в левой нижней части экрана
    if (isTouch && !this.hud.buildType && p.x < this.renderer.w * 0.4 && p.y > this.renderer.h * 0.45 && !this.joy) {
      this.joy = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y };
      this.joyEl.style.left = `${p.x}px`;
      this.joyEl.style.top = `${p.y}px`;
      this.joyEl.classList.remove('hidden');
      this.stick.style.transform = 'translate(-50%, -50%)';
      this.moveTarget = null;
      return;
    }
    this.mouse = p;
    this.pointerDown = { id: e.pointerId, x: p.x, y: p.y, t: performance.now() };
    const w = this.renderer.toWorld(p.x, p.y);
    if (this.hud.buildType) {
      this.updateGhost(p);
      return;
    }
    if (!g.settings.auto && !this.hitSomething(w)) {
      this.attackToward(w);
      g.hero.attackHeld = true;
    }
  }

  onMove(e) {
    const p = this.local(e);
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy.x = p.x;
      this.joy.y = p.y;
      const dx = p.x - this.joy.x0;
      const dy = p.y - this.joy.y0;
      const d = Math.hypot(dx, dy);
      const max = 46;
      const k = d > max ? max / d : 1;
      this.stick.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      return;
    }
    if (e.pointerType === 'mouse' || this.pointerDown) this.mouse = p;
    if (this.hud.buildType) this.updateGhost(p);
    const g = this.getGame();
    if (this.pointerDown && g.hero.attackHeld && !g.settings.auto) {
      const w = this.renderer.toWorld(p.x, p.y);
      g.hero.attackAt = { x: w.x, y: w.y };
    }
  }

  onUp(e) {
    const g = this.getGame();
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy = null;
      this.joyEl.classList.add('hidden');
      return;
    }
    const down = this.pointerDown;
    this.pointerDown = null;
    g.hero.attackHeld = false;
    if (!down || down.id !== e.pointerId || this.hud.blocking) return;
    const p = this.local(e);
    const moved = Math.hypot(p.x - down.x, p.y - down.y);
    if (moved > 18) return;
    const w = this.renderer.toWorld(p.x, p.y);
    if (this.hud.buildType) {
      this.updateGhost(p);
      const gh = this.renderer.ghost;
      const type = this.hud.buildType;
      if (gh && g.build(type, gh.tx, gh.ty)) {
        if (type !== 'wall' || !g.canAfford(BUILDINGS.wall.cost)) this.hud.action('cancelBuild', {});
      }
      return;
    }
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    // постройка (включая высокие — по клику чуть выше основания)
    const b = g.buildingAt(tx, ty) || g.buildingAt(tx, ty + 1);
    if (b) { this.hud.selectBuilding(b.id); return; }
    const bc = g.beacons.find((x) => x.state !== 'lit' && w.x >= x.cfg.tx - 0.3 && w.x <= x.cfg.tx + 2.3 && w.y >= x.cfg.ty - 2.5 && w.y <= x.cfg.ty + 2.2);
    if (bc && (bc.state === 'ready' || g.inTerritory(w.x, w.y + 3))) { this.hud.selectBeacon(bc.id); return; }
    if (this.hud.card) { this.hud.closeCard(); return; }
    // в авто-режиме касание земли ведёт героя к точке
    if (g.settings.auto) this.moveTarget = { x: w.x, y: w.y };
  }

  hitSomething(w) {
    const g = this.getGame();
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    return !!(g.buildingAt(tx, ty) || g.buildingAt(tx, ty + 1));
  }

  updateGhost(p) {
    const g = this.getGame();
    const type = this.hud.buildType;
    const size = BUILDINGS[type].size;
    const w = this.renderer.toWorld(p.x, p.y);
    const tx = Math.round(w.x - size / 2);
    const ty = Math.round(w.y - size / 2);
    const check = g.canPlace(type, tx, ty);
    this.renderer.ghost = { type, tx, ty, ok: check.ok, reason: check.reason };
  }

  // Вектор движения героя за этот кадр.
  movement() {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.joy) {
      const dx = this.joy.x - this.joy.x0;
      const dy = this.joy.y - this.joy.y0;
      const d = Math.hypot(dx, dy);
      if (d > 8) { x = dx / Math.max(d, 46); y = dy / Math.max(d, 46); }
    }
    if (x || y) { this.moveTarget = null; return { x, y }; }
    const g = this.getGame();
    if (this.moveTarget) {
      const dx = this.moveTarget.x - g.hero.x;
      const dy = this.moveTarget.y - g.hero.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.25) { this.moveTarget = null; return { x: 0, y: 0 }; }
      return { x: dx / d, y: dy / d };
    }
    return { x: 0, y: 0 };
  }
}
