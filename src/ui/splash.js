// Экран загрузки: картинка рисуется кодом в стиле игры — Сердце Светоча в кругу света, Хранитель с мечом,
// твари во мгле по краям; сверху название, снизу полоса загрузки и советы.
import { ART } from '../render/art/buildings.js';
import { PALETTES, LOOKS, drawHead, drawBody } from '../render/art/characters.js';
import { drawItem } from '../render/art/weapons.js';
import { ITEMS } from '../data/index.js';

const TIPS = [
  'Улучшай Сердце — свет раздвигает мглу и открывает новые земли',
  'Соседние секции забора одного уровня делят общую прочность',
  'Рабочие сами рубят деревья и добывают камень и руду',
  'В Кузне можно изучить меч, булаву, кинжалы, косу и алебарду',
  'Башни работают от энергии — следи за генераторами',
  'На 10, 20 и 30 уровне некоторые постройки эволюционируют',
];

export class Splash {
  constructor(el) {
    this.el = el;
    el.className = 'splash';
    el.innerHTML = `<canvas class="splash-art"></canvas>
      <div class="splash-ui">
        <div class="splash-title"><span>Последний Светоч</span></div>
        <div class="splash-sub">Последний огонь в мире, поглощённом мглой</div>
        <div class="splash-bottom"><div class="splash-bar"><div></div></div><div class="splash-tip"></div></div>
      </div>`;
    this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.bar = el.querySelector('.splash-bar div');
    this.tip = el.querySelector('.splash-tip');
    this.target = 0;
    this.shown = 0;
    this.t0 = performance.now();
    this.tipIndex = Math.floor(Math.random() * TIPS.length);
    this.tip.textContent = TIPS[this.tipIndex];
    this.wisps = Array.from({ length: 22 }, (_, i) => ({ x: Math.random(), y: 0.55 + Math.random() * 0.45, r: 0.08 + Math.random() * 0.14, s: (Math.random() - 0.5) * 0.02, i }));
    this.sparks = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05, a: Math.random() }));
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.drawStatic();
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  progress(p) { this.target = Math.max(this.target, Math.min(1, p)); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.dpr = dpr;
    this.static = null;
  }

  // Неподвижная часть сцены рисуется один раз в отдельный слой.
  drawStatic() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    ctx.scale(this.dpr, this.dpr);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const { w, h } = this;
    // на низких экранах (телефон боком) сцена мельче и выше, чтобы не залезать под полосу загрузки
    const u = Math.min(w * 0.11, h < 520 ? h * 0.125 : h * 0.16);
    const gx = w / 2;
    const gy = Math.min(h * 0.8, h - 80 - u * 0.6);
    // ночное небо
    let g = ctx.createRadialGradient(gx, gy - u * 2, u, gx, gy - u * 2, Math.max(w, h) * 0.8);
    g.addColorStop(0, '#3b2f6a');
    g.addColorStop(0.45, '#1c1536');
    g.addColorStop(1, '#07050e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * w;
      const y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * h * 0.6;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 5) * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // лучи света от кристалла
    ctx.save();
    ctx.translate(gx, gy - u * 3.3);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.fillStyle = 'rgba(255,220,140,0.035)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-u * 0.5, -Math.max(w, h));
      ctx.lineTo(u * 0.5, -Math.max(w, h));
      ctx.fill();
    }
    ctx.restore();
    // освещённая поляна
    g = ctx.createRadialGradient(gx, gy, u * 0.3, gx, gy, u * 4.6);
    g.addColorStop(0, 'rgba(116,168,88,0.95)');
    g.addColorStop(0.55, 'rgba(56,98,56,0.8)');
    g.addColorStop(1, 'rgba(20,30,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gx, gy, u * 4.8, u * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Сердце
    ctx.save();
    ctx.translate(gx, gy + u * 0.35);
    ctx.scale(u * 0.95, u * 0.95);
    const info = { size: 3, level: 50, path: null, tier: 0, working: true, powered: true, hpRatio: 1 };
    try { ART.heart.static(ctx, info); ART.heart.anim?.(ctx, info, 0.6, {}); } catch { /* без сердца — просто фон */ }
    ctx.restore();
    // твари во мгле по краям
    const monster = (x, y, k, flip, look) => {
      const L = LOOKS[look] || LOOKS.skeleton;
      const p = PALETTES[L.pal];
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k * flip, k);
      ctx.globalAlpha = 0.85;
      try {
        drawBody(ctx, L, p, 0);
        ctx.translate(0, L.headY ?? -0.86);
        drawHead(ctx, L, p, 0, {});
      } catch { /* нет такого облика */ }
      ctx.restore();
    };
    monster(w * 0.12, gy + u * 0.2, u * 0.95, 1, 'skeleton');
    monster(w * 0.05, gy + u * 0.55, u * 0.8, 1, 'brute');
    monster(w * 0.88, gy + u * 0.2, u * 0.95, -1, 'skeleton');
    monster(w * 0.95, gy + u * 0.6, u * 0.8, -1, 'skelArcher');
    // Хранитель
    ctx.save();
    ctx.translate(gx + u * 2.3, gy + u * 0.55);
    ctx.scale(u * 1.05, u * 1.05);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.36, 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const hp = PALETTES.hero;
    drawBody(ctx, LOOKS.hero, hp, 0, 2);
    ctx.save();
    ctx.translate(0, -0.86);
    drawHead(ctx, LOOKS.hero, hp, 0, {});
    ctx.restore();
    ctx.translate(0.52, -0.6);
    ctx.rotate(0.3);
    drawItem(ctx, ITEMS.swordSilver || ITEMS.swordWood, { s: 0.85, glow: 0.6 });
    ctx.restore();
    // мгла по краям и снизу
    g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(14,8,26,0.85)');
    g.addColorStop(0.22, 'rgba(14,8,26,0)');
    g.addColorStop(0.78, 'rgba(14,8,26,0)');
    g.addColorStop(1, 'rgba(14,8,26,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    g = ctx.createLinearGradient(0, h * 0.82, 0, h);
    g.addColorStop(0, 'rgba(10,6,20,0)');
    g.addColorStop(1, 'rgba(10,6,20,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    this.static = c;
    this.u = u;
    this.gx = gx;
    this.gy = gy;
  }

  tick(now) {
    if (!this.el.isConnected) return;
    const t = (now - this.t0) / 1000;
    if (!this.static) this.drawStatic();
    const ctx = this.ctx;
    const { w, h, u, gx, gy } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.static, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // пульсирующее сияние кристалла
    const pulse = 0.75 + Math.sin(t * 2.4) * 0.25;
    const cy = gy - u * 3.1;
    let g = ctx.createRadialGradient(gx, cy, 0, gx, cy, u * 2.6);
    g.addColorStop(0, `rgba(190,250,255,${0.5 * pulse})`);
    g.addColorStop(0.4, `rgba(110,220,255,${0.16 * pulse})`);
    g.addColorStop(1, 'rgba(110,220,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(gx - u * 3, cy - u * 3, u * 6, u * 6);
    // искры поднимаются от Сердца
    for (const s of this.sparks) {
      const y = ((s.y - t * s.v) % 1 + 1) % 1;
      const x = gx + (s.x - 0.5) * u * 6 + Math.sin(t * 2 + s.a * 6) * u * 0.2;
      const yy = gy - u * 0.5 - (1 - y) * h * 0.7;
      ctx.fillStyle = `rgba(255,${200 + Math.round(s.a * 50)},140,${0.25 + 0.5 * y})`;
      ctx.beginPath();
      ctx.arc(x, yy, 1 + s.a * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // клубы мглы у земли
    for (const wp of this.wisps) {
      const x = ((wp.x + t * wp.s) % 1 + 1) % 1 * w;
      const y = wp.y * h;
      const r = wp.r * Math.max(w, h) * 0.6;
      g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, wp.i % 3 ? 'rgba(70,30,110,0.28)' : 'rgba(10,4,20,0.4)');
      g.addColorStop(1, 'rgba(40,20,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // полоса загрузки — плавно догоняет реальный прогресс
    this.shown += (this.target - this.shown) * 0.18;
    this.bar.style.width = `${Math.round(this.shown * 1000) / 10}%`;
    const tipNow = Math.floor(t / 3.2);
    if (tipNow !== this.tipShown) { this.tipShown = tipNow; this.tip.textContent = TIPS[(this.tipIndex + tipNow) % TIPS.length]; }
    this.raf = requestAnimationFrame(this.tick);
  }

  // Дорисовать полосу до конца и плавно убрать экран.
  async finish() {
    this.progress(1);
    const start = performance.now();
    while (this.shown < 0.985 && performance.now() - start < 600) await new Promise((ok) => setTimeout(ok, 30));
    this.el.classList.add('out');
    await new Promise((ok) => setTimeout(ok, 450));
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.el.remove();
  }
}
