// Частицы, всплывающие надписи, тряска камеры. Чисто визуальные — на игру не влияют.
import { OUTLINE } from './art/common.js';

export class Fx {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.trails = [];
    this.shake = 0;
  }

  addShake(v) { this.shake = Math.min(0.6, this.shake + v); }

  burst(x, y, opts) {
    const n = opts.count || 8;
    for (let i = 0; i < n; i++) {
      const a = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? 1.2) : Math.random() * Math.PI * 2;
      const sp = (opts.speed || 3) * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, z: opts.z ?? 0.3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: (opts.up ?? 3) * (0.5 + Math.random()),
        life: 0, max: (opts.life || 0.6) * (0.7 + Math.random() * 0.6),
        size: (opts.size || 0.08) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(opts.color) ? opts.color[i % opts.color.length] : opts.color,
        grav: opts.grav ?? 12, shape: opts.shape || 'circle', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        outline: opts.outline ?? false, glow: opts.glow ?? false, fade: opts.fade ?? true,
      });
    }
  }

  // Летящая часть персонажа (голова при гибели).
  piece(x, y, z, draw, opts = {}) {
    this.particles.push({
      x, y, z, vx: opts.vx ?? (Math.random() - 0.5) * 3, vy: opts.vy ?? (Math.random() - 0.5) * 1.2, vz: opts.vz ?? 5,
      life: 0, max: opts.life ?? 0.9, size: 1, grav: 16, shape: 'piece', draw, rot: 0, vr: opts.vr ?? (Math.random() - 0.5) * 16,
      bounce: true, fade: true, scale: opts.scale ?? 1,
    });
  }

  text(x, y, str, color, opts = {}) {
    this.texts.push({ x, y, str, color, life: 0, max: opts.life || 0.9, size: opts.size || 1, vy: opts.vy ?? -1.6, dot: opts.dot });
  }

  ring(x, y, r, color, opts = {}) {
    this.rings.push({ x, y, r, color, life: 0, max: opts.life || 0.4, width: opts.width || 0.12, fill: opts.fill });
  }

  trail(x, y, angle, range, color, arc = 2.6, kind = 'slash') {
    this.trails.push({ x, y, angle, range, color, arc: Math.min(arc || 2.6, Math.PI * 2), kind, life: 0, max: kind === 'smash' ? 0.3 : 0.22 });
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.2);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.grav * dt;
      p.z += p.vz * dt;
      p.rot += p.vr * dt;
      if (p.z < 0) {
        p.z = 0;
        if (p.bounce && Math.abs(p.vz) > 1.5) { p.vz = -p.vz * 0.4; p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.5; }
        else { p.vz = 0; p.vx *= 0.85; p.vy *= 0.85; p.vr *= 0.8; }
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const t of this.texts) { t.life += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.15, dt); }
    this.texts = this.texts.filter((t) => t.life < t.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    for (const t of this.trails) t.life += dt;
    this.trails = this.trails.filter((t) => t.life < t.max);
  }

  // Рисование в мировых координатах (ctx уже в клетках).
  drawWorld(ctx) {
    for (const t of this.trails) {
      const k = t.life / t.max;
      ctx.save();
      ctx.translate(t.x, t.y - 0.35);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = t.color;
      ctx.lineCap = 'round';
      if (t.kind === 'thrust') {
        ctx.lineWidth = 0.28 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(Math.cos(t.angle) * 0.4, Math.sin(t.angle) * 0.4);
        ctx.lineTo(Math.cos(t.angle) * t.range, Math.sin(t.angle) * t.range);
        ctx.stroke();
      } else {
        const arc = t.arc >= Math.PI * 2 - 0.01 ? Math.PI * 1.9 : t.arc;
        const a0 = t.angle - arc / 2 + k * 0.4;
        ctx.lineWidth = (t.kind === 'smash' ? 0.34 : 0.22) * (1 - k);
        ctx.beginPath();
        ctx.arc(0, 0, t.range * (0.75 + k * 0.25), a0, a0 + arc);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.08 * (1 - k);
        ctx.stroke();
        if (t.kind === 'smash' && k < 0.5) {
          ctx.globalAlpha = (1 - k * 2) * 0.6;
          ctx.beginPath();
          ctx.ellipse(Math.cos(t.angle) * t.range * 0.7, Math.sin(t.angle) * t.range * 0.7 + 0.35, 0.6 * (0.5 + k), 0.25 * (0.5 + k), 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,220,140,0.9)';
          ctx.lineWidth = 0.08;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const r of this.rings) {
      const k = r.life / r.max;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * (0.4 + k * 0.6), r.r * (0.4 + k * 0.6) * 0.55, 0, 0, Math.PI * 2);
      if (r.fill) { ctx.fillStyle = r.fill; ctx.fill(); }
      ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.strokeStyle = r.color;
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      const k = p.life / p.max;
      ctx.save();
      ctx.globalAlpha = p.fade ? Math.min(1, (1 - k) * 2) : 1;
      ctx.translate(p.x, p.y - p.z);
      ctx.rotate(p.rot);
      if (p.shape === 'piece') {
        ctx.scale(p.scale, p.scale);
        p.draw(ctx);
      } else {
        if (p.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.shape === 'rect') ctx.rect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        else if (p.shape === 'bone') ctx.rect(-p.size * 1.6, -p.size * 0.4, p.size * 3.2, p.size * 0.8);
        else ctx.arc(0, 0, p.size * (p.glow ? 1 - k * 0.5 : 1), 0, Math.PI * 2);
        ctx.fill();
        if (p.outline) {
          ctx.lineWidth = 0.025;
          ctx.strokeStyle = OUTLINE;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Надписи — в экранных координатах, чтобы шрифт был чётким.
  // Каждая надпись растеризуется один раз в картинку (шрифт, обводка, кружок ресурса),
  // а «выпрыгивание» — это масштаб картинки: так не нужно перестраивать шрифт каждый кадр.
  drawTexts(ctx, toScreen, scale, dpr = 1) {
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
      const [sx, sy] = toScreen(t.x, t.y);
      const base = Math.round(Math.max(12, scale * 0.38) * t.size * 1.2);
      const img = this.textSprite(t.str, t.color, t.dot, base, dpr);
      const m = pop / 1.2;
      const w = img.cssW * m;
      const h = img.cssH * m;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.drawImage(img, sx - img.ax * m, sy - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  textSprite(str, color, dot, size, dpr) {
    const key = `${str}|${color}|${dot || ''}|${size}|${dpr}`;
    const cache = this.textCache || (this.textCache = new Map());
    let c = cache.get(key);
    if (c) return c;
    const font = `800 ${size}px "Trebuchet MS", system-ui, sans-serif`;
    const meas = (this.measureCtx || (this.measureCtx = document.createElement('canvas').getContext('2d')));
    meas.font = font;
    const tw = meas.measureText(str).width;
    const lw = Math.max(3, size * 0.22);
    const dotR = dot ? size * 0.32 : 0;
    const pad = lw + 2;
    const left = dot ? dotR * 2 + size * 0.05 + pad : pad;
    const cssW = Math.ceil(left + tw + pad);
    const cssH = Math.ceil(size * 1.3 + pad);
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(cssW * dpr));
    c.height = Math.max(1, Math.ceil(cssH * dpr));
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.font = font;
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.strokeStyle = OUTLINE;
    const cy = cssH / 2;
    if (dot) {
      x.beginPath();
      x.arc(pad + dotR, cy, dotR, 0, Math.PI * 2);
      x.fillStyle = dot;
      x.fill();
      x.lineWidth = Math.max(2, size * 0.12);
      x.stroke();
    }
    x.lineWidth = lw;
    x.strokeText(str, left, cy);
    x.fillStyle = color;
    x.fillText(str, left, cy);
    c.cssW = cssW;
    c.cssH = cssH;
    // точка привязки: середина текста (как раньше — текст по центру, кружок слева от него)
    c.ax = dot ? left + tw / 2 - size * 0.35 : left + tw / 2;
    cache.set(key, c);
    if (cache.size > 240) cache.delete(cache.keys().next().value);
    return c;
  }
}
