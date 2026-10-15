// Клавиатура, мышь и касания → команды игры.
import { BUILDINGS } from './data/index.js';

export class Input {
  constructor(canvas, hud, renderer, getGame) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = renderer;
    this.getGame = getGame;
    this.keys = new Set();
    this.joy = null;
    this.mouse = null;
    this.pointerDown = null;
    this.stick = document.getElementById('stick');
    this.joyEl = document.getElementById('joystick');

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.hud.cancelBuild(); });
  }

  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.code;
    if (down) this.keys.add(k); else this.keys.delete(k);
    const g = this.getGame();
    if (!down) {
      if (k === 'Space') g.hero.attackHeld = false;
      return;
    }
    if (k === 'Escape') {
      if (this.hud.modal) this.hud.closeModal();
      else if (this.hud.window) this.hud.closeWindow();
      else if (this.hud.buildType) this.hud.cancelBuild();
      else if (this.hud.card) this.hud.closeCard();
      else this.hud.openMenu();
      return;
    }
    if (k === 'KeyI' && !this.hud.modal) { if (this.hud.window?.kind === 'inventory') this.hud.closeWindow(); else this.hud.openInventory(); return; }
    if (k === 'KeyB' && !this.hud.modal) { if (this.hud.window?.kind === 'build') this.hud.closeWindow(); else this.hud.openBuildMenu(); return; }
    if (this.hud.blocking) return;
    if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') { g.useHotbar(Number(k.slice(-1)) - 1); this.hud.renderHotbar(); }
    if (k === 'KeyQ') { g.toggleAuto(); this.hud.renderHotbar(); }
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

  cellAt(p) {
    const type = this.hud.buildType;
    const size = BUILDINGS[type].size;
    const w = this.renderer.toWorld(p.x, p.y);
    return { tx: Math.round(w.x - size / 2), ty: Math.round(w.y - size / 2) };
  }

  onDown(e) {
    if (this.hud.blocking) return;
    const p = this.local(e);
    const g = this.getGame();
    const isTouch = e.pointerType === 'touch';
    if (isTouch && !this.hud.buildType && p.x < this.renderer.w * 0.4 && p.y > this.renderer.h * 0.5 && !this.joy) {
      this.joy = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y };
      // интерфейс на больших экранах увеличен через zoom — делим координаты обратно
      this.zoom = parseFloat(getComputedStyle(this.joyEl.parentElement).zoom) || 1;
      this.joyEl.style.left = `${p.x / this.zoom}px`;
      this.joyEl.style.top = `${p.y / this.zoom}px`;
      this.joyEl.classList.remove('hidden');
      this.stick.style.transform = 'translate(-50%, -50%)';
      g.hero.moveTarget = null;
      return;
    }
    this.mouse = p;
    this.pointerDown = { id: e.pointerId, x: p.x, y: p.y, t: performance.now() };
    if (this.hud.buildType) {
      this.updateGhost(p);
      if (BUILDINGS[this.hud.buildType].wall) {
        const c = this.cellAt(p);
        this.renderer.wallDrag = { x0: c.tx, y0: c.ty };
      }
      return;
    }
    const w = this.renderer.toWorld(p.x, p.y);
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
      const k = (d > 46 ? 46 / d : 1) / (this.zoom || 1);
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
    if (!down || down.id !== e.pointerId || this.hud.blocking) { this.renderer.wallDrag = null; return; }
    const p = this.local(e);
    const type = this.hud.buildType;
    if (type) {
      this.updateGhost(p);
      const gh = this.renderer.ghost;
      const drag = this.renderer.wallDrag;
      this.renderer.wallDrag = null;
      if (!gh) return;
      if (drag && (drag.x0 !== gh.tx || drag.y0 !== gh.ty)) {
        g.buildLine(type, drag.x0, drag.y0, gh.tx, gh.ty);
        return;
      }
      const b = g.build(type, gh.tx, gh.ty, { useGems: this.hud.buildGems });
      if (b && (!BUILDINGS[type].wall || this.hud.buildGems)) this.hud.cancelBuild();
      return;
    }
    if (Math.hypot(p.x - down.x, p.y - down.y) > 18) return;
    const w = this.renderer.toWorld(p.x, p.y);
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    // сундуки, записки и святилища важнее зданий за ними
    const a = g.activities;
    const pick = [...a.chests, ...a.notes, ...a.shrines].find((o) => Math.hypot(o.x - w.x, o.y - 0.3 - w.y) < 0.75 && g.inTerritory(o.x, o.y));
    if (pick) {
      if (this.hud.card) this.hud.closeCard();
      g.hero.moveTarget = { x: pick.x, y: pick.y };
      this.renderer.fx.ring(pick.x, pick.y, 0.8, 'rgba(255,224,138,0.9)', { life: 0.35 });
      return;
    }
    // постройка; дерево/камень; высокая постройка — по клику чуть выше основания
    const node = g.nodeAt(tx, ty);
    const b = g.buildingAt(tx, ty) || (!node && (g.buildingAt(tx, ty + 1) || g.buildingAt(tx, ty + 2)));
    if (b) { this.hud.selectBuilding(b.id); return; }
    const m = g.activities.merchant;
    if (m && Math.abs(w.x - m.x) < 1 && w.y > m.y - 2 && w.y < m.y + 0.6) {
      if (Math.hypot(g.hero.x - m.x, g.hero.y - m.y) < 4) this.hud.openMerchant();
      else g.hero.moveTarget = { x: m.x, y: m.y + 0.9 };
      return;
    }
    if (this.hud.card) this.hud.closeCard();
    if (g.settings.auto) {
      g.hero.moveTarget = { x: w.x, y: w.y };
      this.renderer.fx.ring(w.x, w.y, 0.8, 'rgba(255,224,138,0.9)', { life: 0.35 });
    }
  }

  hitSomething(w) {
    const g = this.getGame();
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    return !!(g.buildingAt(tx, ty) || (!g.nodeAt(tx, ty) && g.buildingAt(tx, ty + 1)));
  }

  updateGhost(p) {
    const g = this.getGame();
    const type = this.hud.buildType;
    const { tx, ty } = this.cellAt(p);
    const check = g.canPlace(type, tx, ty);
    this.renderer.ghost = { type, tx, ty, ok: check.ok || (check.noMoney && this.hud.buildGems), reason: check.reason };
  }

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
    return { x, y };
  }
}
