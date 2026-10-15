// Общие кисти и кэш спрайтов. Стиль: толстый тёмный контур, плоская заливка, тень и блик.
export const OUTLINE = '#1b1320';
export const LW = 0.045;

export function ink(ctx, fill, lw = LW) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Псевдослучайное число от целого — для стабильных «случайных» деталей.
export const hash = (n) => {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255; let g = (n >> 8) & 255; let b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// Кладка из камней внутри прямоугольника (вызывать внутри clip или поверх грани).
export function stoneCourses(ctx, x, y, w, h, rows, base, seed = 1) {
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let cx = x - (r % 2 ? rh * 0.7 : 0);
    let i = 0;
    while (cx < x + w) {
      const bw = rh * (1.3 + hash(seed + r * 13 + i) * 0.9);
      const tone = hash(seed * 7 + r * 31 + i * 3) * 0.16 - 0.08;
      ctx.fillStyle = shade(base, tone);
      const bx = Math.max(x, cx);
      const bw2 = Math.min(cx + bw, x + w) - bx;
      if (bw2 > 0.02) {
        rrect(ctx, bx + 0.012, y + r * rh + 0.012, bw2 - 0.024, rh - 0.024, 0.03);
        ctx.fill();
        ctx.lineWidth = 0.016;
        ctx.strokeStyle = 'rgba(27,19,32,0.55)';
        ctx.stroke();
      }
      cx += bw;
      i++;
    }
  }
}

// Доски (вертикальные или горизонтальные) с волокнами.
export function planksFill(ctx, x, y, w, h, n, base, vertical = true, seed = 1) {
  for (let i = 0; i < n; i++) {
    const tone = hash(seed + i * 5.3) * 0.14 - 0.07;
    ctx.fillStyle = shade(base, tone);
    if (vertical) ctx.fillRect(x + (w / n) * i, y, w / n, h);
    else ctx.fillRect(x, y + (h / n) * i, w, h / n);
  }
  ctx.strokeStyle = 'rgba(27,19,32,0.45)';
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    if (vertical) { ctx.moveTo(x + (w / n) * i, y); ctx.lineTo(x + (w / n) * i, y + h); } else { ctx.moveTo(x, y + (h / n) * i); ctx.lineTo(x + w, y + (h / n) * i); }
  }
  ctx.stroke();
  // сучки
  ctx.fillStyle = 'rgba(27,19,32,0.25)';
  for (let i = 0; i < n; i++) {
    if (hash(seed * 3 + i) > 0.6) {
      const px = vertical ? x + (w / n) * (i + 0.5) : x + w * hash(seed + i * 9);
      const py = vertical ? y + h * hash(seed + i * 11) : y + (h / n) * (i + 0.5);
      ellipse(ctx, px, py, 0.025, 0.018);
      ctx.fill();
    }
  }
}

// Черепичная крыша-трапеция: нижняя кромка y, верх на y-h, ширина низа w, верха wt.
export function tiledRoof(ctx, cx, y, w, wt, h, base, rows = 4, seed = 1) {
  poly(ctx, [[cx - w / 2, y], [cx - wt / 2, y - h], [cx + wt / 2, y - h], [cx + w / 2, y]]);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let r = 0; r < rows; r++) {
    const yy = y - (h / rows) * (r + 1);
    const ww = w - ((w - wt) * (r + 0.5)) / rows;
    const tw = 0.17;
    for (let x = cx - ww / 2 - (r % 2) * tw * 0.5; x < cx + ww / 2; x += tw) {
      ctx.beginPath();
      ctx.arc(x + tw / 2, yy + h / rows, tw / 2, 0, Math.PI);
      ctx.fillStyle = shade(base, hash(seed + r * 17 + x * 31) * 0.2 - 0.12);
      ctx.fill();
      ctx.lineWidth = 0.014;
      ctx.strokeStyle = 'rgba(27,19,32,0.5)';
      ctx.stroke();
    }
  }
  // тень справа
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  poly(ctx, [[cx + w * 0.1, y], [cx + wt * 0.1, y - h], [cx + wt / 2, y - h], [cx + w / 2, y]]);
  ctx.fill();
  ctx.restore();
  poly(ctx, [[cx - w / 2, y], [cx - wt / 2, y - h], [cx + wt / 2, y - h], [cx + w / 2, y]]);
  ink(ctx, null);
  // конёк
  ctx.beginPath();
  ctx.rect(cx - wt / 2 - 0.04, y - h - 0.06, wt + 0.08, 0.09);
  ink(ctx, shade(base, -0.3), 0.03);
}

// Окно со светом изнутри.
export function window_(ctx, x, y, w, h, lit = true, arched = true) {
  ctx.beginPath();
  if (arched) {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w / 2);
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  } else ctx.rect(x, y, w, h);
  ink(ctx, lit ? '#ffcf6a' : '#2a2433', 0.03);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + (arched ? 0.02 : 0));
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.55);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.stroke();
  if (lit) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + w * 0.1, y + h * 0.6, w * 0.3, h * 0.3);
  }
}

export function door(ctx, x, y, w, h, color = '#4a2c18') {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ink(ctx, color, 0.035);
  ctx.save();
  ctx.clip();
  planksFill(ctx, x, y, w, h, 3, color, true, 3);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ink(ctx, null, 0.035);
  ctx.fillStyle = '#f2c14e';
  ellipse(ctx, x + w * 0.75, y + h * 0.6, 0.025, 0.025);
  ctx.fill();
}

// Фундамент-плита по реальному контуру постройки (видно, где она занимает место).
export function foundation(ctx, w, h, color = '#3c3a46') {
  // полупрозрачная плита по реальному контуру: видно, где постройка занимает место
  ctx.save();
  ctx.globalAlpha *= 0.5;
  rrect(ctx, -w / 2 + 0.04, -h + 0.04, w - 0.08, h - 0.08, 0.1);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  rrect(ctx, -w / 2 + 0.04, -h + 0.04, w - 0.08, h - 0.08, 0.1);
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = 'rgba(27,19,32,0.55)';
  ctx.stroke();
}

export function banner(ctx, x, y, w, h, color, emblem = '#f2c14e', wave = 0) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2 + wave, y + h);
  ctx.lineTo(x + wave, y + h * 0.82);
  ctx.lineTo(x - w / 2 + wave, y + h);
  ctx.closePath();
  ink(ctx, color, 0.03);
  ctx.fillStyle = emblem;
  ellipse(ctx, x + wave * 0.5, y + h * 0.42, w * 0.18, w * 0.18);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x - w / 2 - 0.04, y - 0.03, w + 0.08, 0.05);
  ink(ctx, '#7a4524', 0.02);
}

export function torch(ctx, x, y, t, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.03, 0, 0.06, 0.22);
  ink(ctx, '#5a3218', 0.02);
  const f = Math.sin(t * 13 + x * 5) * 0.03;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,170,60,0.25)';
  ellipse(ctx, 0, -0.06, 0.22, 0.22);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(-0.07, 0.02);
  ctx.quadraticCurveTo(-0.08, -0.12, f, -0.22);
  ctx.quadraticCurveTo(0.08, -0.12, 0.07, 0.02);
  ctx.closePath();
  ink(ctx, '#ff9a3c', 0.02);
  ctx.beginPath();
  ctx.moveTo(-0.03, 0.01);
  ctx.quadraticCurveTo(-0.03, -0.07, f * 0.6, -0.13);
  ctx.quadraticCurveTo(0.03, -0.07, 0.03, 0.01);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
  ctx.restore();
}

export function smoke(ctx, x, y, t, n = 3, color = 'rgba(120,115,130,') {
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.45 + i / n) % 1;
    ctx.fillStyle = `${color}${0.35 * (1 - ph)})`;
    ellipse(ctx, x + Math.sin(t * 1.3 + i * 2) * 0.12 * ph, y - ph * 1.1, 0.08 + ph * 0.2, 0.08 + ph * 0.2);
    ctx.fill();
  }
}

// ---------- кэш спрайтов ----------

const cache = new Map();
let cacheRes = 80;

export function setSpriteResolution(px) {
  const r = px <= 70 ? 64 : px <= 110 ? 96 : 128;
  if (r !== cacheRes) { cacheRes = r; cache.clear(); }
}

// Рисует fn один раз в отдельный холст и затем просто копирует его.
// bounds — [x0, y0, x1, y1] в единицах рисунка.
export function sprite(key, bounds, fn) {
  let s = cache.get(key);
  if (!s) {
    const [x0, y0, x1, y1] = bounds;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0) * cacheRes));
    c.height = Math.max(1, Math.ceil((y1 - y0) * cacheRes));
    const g = c.getContext('2d');
    g.scale(cacheRes, cacheRes);
    g.translate(-x0, -y0);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    fn(g);
    s = { canvas: c, x0, y0, w: x1 - x0, h: y1 - y0 };
    cache.set(key, s);
  }
  return s;
}

export function drawSprite(ctx, s) {
  ctx.drawImage(s.canvas, s.x0, s.y0, s.w, s.h);
}

export function cacheSize() { return cache.size; }
