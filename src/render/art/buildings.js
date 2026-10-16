// Постройки. Начало координат — середина нижней кромки участка, x — в клетках, вверх — минус y.
// static(ctx, info) рисуется один раз в кэш; anim(ctx, info, t) — каждый кадр поверх.
// info: { size, level, path ('a'|'b'|null), tier (число эволюций), working, powered, hpRatio }
import {
  OUTLINE, ink, ellipse, poly, rrect, shade, hash, stoneCourses, planksFill, tiledRoof, window_, door,
  foundation, banner, torch, smoke, glow,
} from './common.js';
import { sword, axe, pickaxe, hammer, bow, shield, staff } from './weapons.js';

const EVO = { a: '#3f8fff', b: '#d93a3a' };
const accent = (info, fallback) => (info.path ? EVO[info.path] : fallback);

// ---------- общие части ----------

function wallBox(ctx, x, y, w, h, kind, color, seed = 1) {
  ctx.beginPath();
  ctx.rect(x, y - h, w, h);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (kind === 'stone') stoneCourses(ctx, x, y - h, w, h, Math.max(2, Math.round(h / 0.17)), color, seed);
  else if (kind === 'wood') planksFill(ctx, x, y - h, w, h, Math.max(3, Math.round(w / 0.16)), color, true, seed);
  else if (kind === 'timber') {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - h, w, h);
    ctx.strokeStyle = '#5a3a24';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.5); ctx.lineTo(x + w, y - h * 0.5);
    ctx.moveTo(x + w * 0.33, y - h); ctx.lineTo(x + w * 0.33, y);
    ctx.moveTo(x + w * 0.66, y - h); ctx.lineTo(x + w * 0.66, y);
    ctx.moveTo(x, y - h); ctx.lineTo(x + w * 0.33, y - h * 0.5);
    ctx.moveTo(x + w, y - h); ctx.lineTo(x + w * 0.66, y - h * 0.5);
    ctx.stroke();
  }
  // тень снизу и справа
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + w * 0.78, y - h, w * 0.22, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x, y - 0.06, w, 0.06);
  ctx.restore();
  ctx.beginPath();
  ctx.rect(x, y - h, w, h);
  ink(ctx, null);
}

function crate(ctx, x, y, s = 0.22, color = '#a0683a') {
  ctx.beginPath();
  ctx.rect(x - s / 2, y - s, s, s);
  ink(ctx, color, 0.025);
  ctx.strokeStyle = shade(color, -0.35);
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y - s); ctx.lineTo(x + s / 2, y);
  ctx.moveTo(x - s / 2 + 0.02, y - s / 2); ctx.lineTo(x + s / 2 - 0.02, y - s / 2);
  ctx.stroke();
}

function barrel(ctx, x, y, s = 0.2) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y);
  ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.6, x - s * 0.45, y - s * 1.2);
  ctx.lineTo(x + s * 0.45, y - s * 1.2);
  ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.6, x + s * 0.45, y);
  ctx.closePath();
  ink(ctx, '#8a5a32', 0.025);
  ctx.strokeStyle = '#4a4a55';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.52, y - s * 0.3); ctx.lineTo(x + s * 0.52, y - s * 0.3);
  ctx.moveTo(x - s * 0.52, y - s * 0.9); ctx.lineTo(x + s * 0.52, y - s * 0.9);
  ctx.stroke();
  ellipse(ctx, x, y - s * 1.2, s * 0.45, s * 0.12);
  ink(ctx, '#a0683a', 0.02);
}

function sack(ctx, x, y, s = 0.18, color = '#d8c49a') {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y);
  ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.9, x - s * 0.2, y - s * 1.1);
  ctx.lineTo(x - s * 0.1, y - s * 1.35);
  ctx.lineTo(x + s * 0.15, y - s * 1.35);
  ctx.lineTo(x + s * 0.2, y - s * 1.1);
  ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.9, x + s * 0.6, y);
  ctx.closePath();
  ink(ctx, color, 0.025);
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.2, y - s * 1.1); ctx.lineTo(x + s * 0.2, y - s * 1.1);
  ctx.stroke();
}

function logPile(ctx, x, y, n = 3, r = 0.08) {
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n - row; i++) {
      const cx = x + (i - (n - row - 1) / 2) * r * 2.05;
      const cy = y - r - row * r * 1.75;
      ellipse(ctx, cx, cy, r, r);
      ink(ctx, '#c98a4b', 0.025);
      ellipse(ctx, cx, cy, r * 0.55, r * 0.55);
      ctx.strokeStyle = '#8a5a32';
      ctx.lineWidth = 0.012;
      ctx.stroke();
    }
  }
}

function plankStack(ctx, x, y, w = 0.4, n = 4) {
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.rect(x - w / 2 + (i % 2) * 0.03, y - 0.05 * (i + 1), w, 0.05);
    ink(ctx, i % 2 ? '#e6c27a' : '#d8b26a', 0.02);
  }
}

function brickStack(ctx, x, y, w = 0.36, rows = 3, color = '#9aa3b5') {
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 3 - (r % 2); i++) {
      ctx.beginPath();
      ctx.rect(x - w / 2 + (r % 2) * (w / 6) + i * (w / 3), y - 0.08 * (r + 1), w / 3 - 0.01, 0.075);
      ink(ctx, shade(color, hash(r * 7 + i) * 0.15 - 0.07), 0.018);
    }
  }
}

function chimney(ctx, x, y, w = 0.16, h = 0.4) {
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h, w, h);
  ink(ctx, '#6a5a58', 0.03);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h, w, h);
  ctx.clip();
  stoneCourses(ctx, x - w / 2, y - h, w, h, 4, '#6a5a58', 9);
  ctx.restore();
  ctx.beginPath();
  ctx.rect(x - w / 2 - 0.03, y - h - 0.05, w + 0.06, 0.06);
  ink(ctx, '#4a3e3c', 0.025);
}

// Знамя эволюции и звёздочки уровня.
function evoMarks(ctx, info, x, y) {
  if (!info.path) return;
  banner(ctx, x, y, 0.16, 0.3, EVO[info.path], '#f2c14e');
  for (let i = 0; i < info.tier; i++) {
    const sx = x - 0.1 + i * 0.1;
    const sy = y + 0.36;
    poly(ctx, [[sx, sy - 0.04], [sx + 0.012, sy - 0.012], [sx + 0.04, sy], [sx + 0.012, sy + 0.012], [sx, sy + 0.04], [sx - 0.012, sy + 0.012], [sx - 0.04, sy], [sx - 0.012, sy - 0.012]]);
    ink(ctx, '#ffd34d', 0.012);
  }
}

function gearShape(ctx, x, y, r, teeth = 10, color = '#c9ced8', rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.78 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ink(ctx, color, 0.025);
  ellipse(ctx, 0, 0, r * 0.32, r * 0.32);
  ink(ctx, shade(color, -0.3), 0.02);
  ctx.restore();
}

function glowSpot(ctx, x, y, r, rgb, a = 0.5) { glow(ctx, x, y, r, rgb, a); }

// ---------- постройки ----------

export const ART = {};

ART.heart = {
  bounds: [-1.7, -4.4, 1.7, 0.2],
  static(ctx, info) {
    const lv = info.level;
    // широкая плита-основание на весь участок
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.lineTo(Math.cos(a) * 1.55, -1.5 + Math.sin(a) * 1.45);
    }
    ctx.closePath();
    ink(ctx, '#4a4a5a');
    ctx.save();
    ctx.clip();
    stoneCourses(ctx, -1.6, -3, 3.2, 3, 12, '#4a4a5a', 77);
    ctx.restore();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.lineTo(Math.cos(a) * 1.55, -1.5 + Math.sin(a) * 1.45);
    }
    ctx.closePath();
    ink(ctx, null);
    const oct = (r, y, fill) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.lineTo(Math.cos(a) * r, y + Math.sin(a) * r * 0.55);
      }
      ctx.closePath();
      ink(ctx, fill);
    };
    oct(1.42, -1.25, '#3a3f52');
    // стенка нижнего яруса
    ctx.beginPath();
    ctx.rect(-1.3, -1.3, 2.6, 0.35);
    ink(ctx, '#4b5268');
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1.3, -1.3, 2.6, 0.35);
    ctx.clip();
    stoneCourses(ctx, -1.3, -1.3, 2.6, 0.35, 2, '#4b5268', 3);
    ctx.restore();
    oct(1.3, -1.45, '#6a7390');
    // ступени спереди
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.rect(-0.4 + i * 0.05, -0.95 - i * 0.1, 0.8 - i * 0.1, 0.1);
      ink(ctx, shade('#7d8696', i * 0.06), 0.025);
    }
    oct(0.95, -1.65, '#8892b0');
    ctx.save();
    ctx.translate(0, -1.65);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = lv >= 10 ? '#f2c14e' : '#b0b8d0';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // колонны с жаровнями
    for (const [x, y] of [[-1.05, -1.4], [1.05, -1.4], [-0.75, -2.0], [0.75, -2.0]]) {
      const back = y < -1.6;
      ctx.beginPath();
      ctx.rect(x - 0.1, y - 0.75, 0.2, 0.75);
      ink(ctx, back ? '#6a7390' : '#8892b0');
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 0.02, y - 0.75, 0.08, 0.75);
      ctx.beginPath();
      ctx.rect(x - 0.14, y - 0.82, 0.28, 0.08);
      ink(ctx, lv >= 10 ? '#f2c14e' : '#a9b0bd', 0.025);
      ctx.beginPath();
      ctx.moveTo(x - 0.14, y - 0.82);
      ctx.quadraticCurveTo(x, y - 0.7, x + 0.14, y - 0.82);
      ctx.lineTo(x + 0.11, y - 0.92);
      ctx.lineTo(x - 0.11, y - 0.92);
      ctx.closePath();
      ink(ctx, '#4a4a58', 0.025);
    }
    // постамент
    ctx.beginPath();
    ctx.moveTo(-0.35, -1.65);
    ctx.lineTo(-0.22, -2.1);
    ctx.lineTo(0.22, -2.1);
    ctx.lineTo(0.35, -1.65);
    ctx.closePath();
    ink(ctx, '#59607a');
    ctx.beginPath();
    ctx.rect(-0.3, -2.18, 0.6, 0.1);
    ink(ctx, lv >= 10 ? '#f2c14e' : '#a9b0bd', 0.03);
    // руны на постаменте
    ctx.strokeStyle = '#7ff3ff';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.1, -1.75); ctx.lineTo(-0.05, -1.95); ctx.lineTo(0.0, -1.8); ctx.lineTo(0.05, -1.95); ctx.lineTo(0.1, -1.75);
    ctx.stroke();
    if (lv >= 25) {
      // крылья света
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.3, -2.3);
        ctx.quadraticCurveTo(sx * 1.2, -3.2, sx * 1.4, -2.4);
        ctx.quadraticCurveTo(sx * 1.0, -2.6, sx * 0.9, -2.2);
        ctx.quadraticCurveTo(sx * 0.7, -2.4, sx * 0.3, -2.2);
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ink(ctx, '#fff3c4', 0.03);
        ctx.globalAlpha = 1;
      }
    }
  },
  anim(ctx, info, t) {
    const lv = info.level;
    // огонь в жаровнях
    for (const [x, y] of [[-1.05, -1.4], [1.05, -1.4], [-0.75, -2.0], [0.75, -2.0]]) {
      const f = Math.sin(t * 12 + x * 3) * 0.03;
      glowSpot(ctx, x, y - 1.0, 0.35, '255,170,60', 0.35);
      ctx.beginPath();
      ctx.moveTo(x - 0.1, y - 0.92);
      ctx.quadraticCurveTo(x - 0.1, y - 1.12, x + f, y - 1.25);
      ctx.quadraticCurveTo(x + 0.1, y - 1.12, x + 0.1, y - 0.92);
      ctx.closePath();
      ink(ctx, '#ff9a3c', 0.02);
      ctx.fillStyle = '#fff3c4';
      ellipse(ctx, x, y - 1.0, 0.035, 0.05);
      ctx.fill();
    }
    // вращающиеся руны
    ctx.save();
    ctx.translate(0, -1.65);
    ctx.scale(1, 0.55);
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = `rgba(127,243,255,${0.5 + 0.3 * Math.sin(t * 2)})`;
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.16, 0.12]);
    ctx.beginPath();
    ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // кристалл
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const cy = -3.0 + Math.sin(t * 1.6) * 0.1;
    const s = 1 + Math.min(0.5, lv * 0.005);
    glowSpot(ctx, 0, cy, 1.7 * s, '255,236,160', 0.45 * info.hpRatio + 0.15);
    ctx.save();
    ctx.translate(0, cy);
    ctx.scale(s * (1 + pulse * 0.04), s * (1 - pulse * 0.03));
    poly(ctx, [[0, -0.75], [0.38, -0.15], [0.22, 0.55], [-0.22, 0.55], [-0.38, -0.15]]);
    ink(ctx, '#7ff3ff', 0.06);
    poly(ctx, [[0, -0.75], [0.38, -0.15], [0.22, 0.55], [0.02, 0.55], [0.06, -0.1]]);
    ctx.fillStyle = '#3fc6e8';
    ctx.fill();
    poly(ctx, [[-0.16, -0.25], [-0.06, -0.5], [-0.02, -0.2]]);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    // осколки на орбите (растут с уровнем)
    const shards = Math.min(8, 1 + Math.floor(lv / 10));
    for (let i = 0; i < shards; i++) {
      const a = t * 0.8 + (i / shards) * Math.PI * 2;
      const x = Math.cos(a) * 1.0;
      const y = cy + Math.sin(a) * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      poly(ctx, [[0, -0.12], [0.06, 0], [0, 0.12], [-0.06, 0]]);
      ink(ctx, lv >= 50 ? '#ffe08a' : '#bffaff', 0.02);
      ctx.restore();
    }
    if (lv >= 100) {
      ctx.save();
      ctx.translate(0, cy - 1.0);
      ctx.scale(1, 0.35);
      ctx.strokeStyle = 'rgba(255,224,138,0.9)';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },
};

ART.workerCamp = {
  bounds: [-1.2, -2.2, 1.2, 0.2],
  static(ctx) {
    foundation(ctx, 2, 2, '#4a3e30');
    // большая палатка
    ctx.beginPath();
    ctx.moveTo(-0.85, -0.55);
    ctx.lineTo(-0.2, -1.65);
    ctx.lineTo(0.45, -0.55);
    ctx.closePath();
    ink(ctx, '#c9a06a');
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#b08a52';
    ctx.fillRect(-0.2, -1.7, 0.7, 1.2);
    ctx.strokeStyle = 'rgba(27,19,32,0.3)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) { ctx.moveTo(-0.2, -1.65); ctx.lineTo(-0.2 + i * 0.22, -0.55); }
    ctx.stroke();
    ctx.restore();
    poly(ctx, [[-0.35, -0.55], [-0.2, -1.0], [-0.05, -0.55]]);
    ink(ctx, '#3a2414', 0.03);
    ctx.beginPath();
    ctx.moveTo(-0.2, -1.65); ctx.lineTo(-0.2, -1.85);
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    banner(ctx, -0.12, -1.85, 0.14, 0.16, '#3f8fff', '#ffd34d');
    // стойка с инструментами
    ctx.beginPath();
    ctx.rect(0.5, -1.05, 0.06, 0.6);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.rect(0.86, -1.05, 0.06, 0.6);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.rect(0.48, -1.1, 0.46, 0.06);
    ink(ctx, '#8a5a32', 0.02);
    ctx.save(); ctx.translate(0.62, -0.62); ctx.rotate(0.15); axe(ctx, 1.2); ctx.restore();
    ctx.save(); ctx.translate(0.8, -0.62); ctx.rotate(-0.1); pickaxe(ctx, 1.1); ctx.restore();
    logPile(ctx, 0.6, -0.25, 3, 0.07);
    sack(ctx, -0.65, -0.2, 0.16);
    crate(ctx, -0.35, -0.2, 0.2);
    // кострище
    ellipse(ctx, 0.05, -0.35, 0.16, 0.07);
    ink(ctx, '#4a4a55', 0.02);
  },
  anim(ctx, info, t) {
    const f = Math.sin(t * 13) * 0.02;
    glowSpot(ctx, 0.05, -0.45, 0.3, '255,170,60', 0.4);
    ctx.beginPath();
    ctx.moveTo(-0.06, -0.36);
    ctx.quadraticCurveTo(-0.07, -0.5, 0.05 + f, -0.6);
    ctx.quadraticCurveTo(0.16, -0.5, 0.15, -0.36);
    ctx.closePath();
    ink(ctx, '#ff9a3c', 0.02);
    smoke(ctx, 0.05, -0.65, t, 2);
  },
};

ART.farm = {
  bounds: [-1.2, -2.6, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#4a3a24');
    // поле
    ctx.beginPath();
    ctx.rect(-0.92, -0.92, 1.0, 0.8);
    ink(ctx, '#6a4a2a', 0.03);
    // забор
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(-0.95, -0.15); ctx.lineTo(0.1, -0.15);
    ctx.moveTo(-0.95, -0.2); ctx.lineTo(-0.95, -0.95);
    ctx.stroke();
    ctx.strokeStyle = '#a0683a';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    for (let x = -0.95; x <= 0.1; x += 0.21) { ctx.beginPath(); ctx.rect(x - 0.02, -0.25, 0.04, 0.14); ink(ctx, '#a0683a', 0.015); }
    // амбар
    wallBox(ctx, 0.15, -0.2, 0.75, 0.75, 'wood', '#b04a3a', 21);
    ctx.strokeStyle = '#f6ead6';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.rect(0.33, -0.7, 0.38, 0.48);
    ctx.moveTo(0.33, -0.7); ctx.lineTo(0.71, -0.22);
    ctx.moveTo(0.71, -0.7); ctx.lineTo(0.33, -0.22);
    ctx.stroke();
    tiledRoof(ctx, 0.52, -0.95, 0.95, 0.35, 0.55, '#7a5a3a', 3, 5);
    window_(ctx, 0.45, -1.3, 0.14, 0.18, true, true);
    // пасека / мельница по эволюции
    if (info.path === 'b') {
      for (const x of [-0.75, -0.45]) {
        ctx.beginPath();
        ctx.rect(x - 0.1, -1.2, 0.2, 0.22);
        ink(ctx, '#e0b060', 0.02);
        ctx.strokeStyle = '#8a6a2a';
        ctx.lineWidth = 0.015;
        ctx.beginPath();
        ctx.moveTo(x - 0.1, -1.13); ctx.lineTo(x + 0.1, -1.13);
        ctx.moveTo(x - 0.1, -1.06); ctx.lineTo(x + 0.1, -1.06);
        ctx.stroke();
      }
    }
    if (info.path === 'a') {
      ctx.beginPath();
      ctx.moveTo(-0.6, -0.95); ctx.lineTo(-0.5, -1.9); ctx.lineTo(-0.3, -1.9); ctx.lineTo(-0.2, -0.95);
      ctx.closePath();
      ink(ctx, '#d8d0c0');
      tiledRoof(ctx, -0.4, -1.9, 0.36, 0.05, 0.25, '#7a5a3a', 2, 6);
    }
    evoMarks(ctx, info, 0.85, -1.5);
  },
  anim(ctx, info, t) {
    // колосья колышутся
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 6; i++) {
        const x = -0.85 + i * 0.15;
        const y = -0.22 - row * 0.18;
        const sw = Math.sin(t * 2 + i * 0.6 + row) * 0.04;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + sw, y - 0.16);
        ctx.stroke();
        ctx.strokeStyle = '#e6c25a';
        ctx.lineWidth = 0.022;
        ctx.stroke();
        ellipse(ctx, x + sw, y - 0.17, 0.025, 0.05);
        ink(ctx, '#f2d06a', 0.012);
      }
    }
    if (info.path === 'a') {
      ctx.save();
      ctx.translate(-0.4, -1.55);
      ctx.rotate(t * 1.2);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.rect(-0.04, 0, 0.08, 0.5);
        ink(ctx, '#e8dcc0', 0.02);
      }
      ctx.restore();
    }
    if (info.path === 'b') {
      ctx.fillStyle = '#ffd34d';
      for (let i = 0; i < 4; i++) {
        const a = t * 3 + i * 1.6;
        ellipse(ctx, -0.6 + Math.cos(a) * 0.25, -1.35 + Math.sin(a * 1.3) * 0.12, 0.025, 0.02);
        ctx.fill();
      }
    }
  },
};

ART.storehouse = {
  bounds: [-1.2, -2.5, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3e3a36');
    wallBox(ctx, -0.85, -0.25, 1.7, 0.95, 'timber', '#e8dcc0', 31);
    door(ctx, -0.25, -1.05, 0.5, 0.8, '#6b3d1f');
    window_(ctx, -0.7, -0.95, 0.18, 0.22, true, false);
    window_(ctx, 0.52, -0.95, 0.18, 0.22, true, false);
    tiledRoof(ctx, 0, -1.2, 1.95, 0.5, 0.75, '#5a4a6a', 4, 7);
    // лебёдка
    ctx.beginPath();
    ctx.rect(-0.05, -2.05, 0.1, 0.3);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.rect(-0.25, -2.08, 0.5, 0.06);
    ink(ctx, '#8a5a32', 0.02);
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(0.2, -2.02); ctx.lineTo(0.2, -1.5);
    ctx.stroke();
    crate(ctx, 0.19, -1.32, 0.16, '#a0683a');
    barrel(ctx, -0.95, -0.15, 0.2);
    crate(ctx, 0.8, -0.15, 0.24);
    crate(ctx, 0.92, -0.39, 0.18, '#8a5a32');
    sack(ctx, -0.62, -0.12, 0.15);
    evoMarks(ctx, info, 0.75, -1.9);
  },
};

ART.generator = {
  bounds: [-1.2, -3.2, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#34384a');
    // каменное кольцо
    ctx.beginPath();
    ctx.ellipse(0, -0.75, 0.85, 0.45, 0, 0, Math.PI * 2);
    ink(ctx, '#4b5268');
    ctx.beginPath();
    ctx.rect(-0.85, -0.75, 1.7, 0.35);
    ink(ctx, '#3f4458');
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.85, -0.75, 1.7, 0.35);
    ctx.clip();
    stoneCourses(ctx, -0.85, -0.75, 1.7, 0.35, 2, '#3f4458', 11);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, -0.75, 0.85, 0.45, 0, Math.PI, Math.PI * 2);
    ink(ctx, null);
    ctx.beginPath();
    ctx.ellipse(0, -0.78, 0.62, 0.3, 0, 0, Math.PI * 2);
    ink(ctx, '#2a2a38', 0.03);
    // кристаллы-катушки по сторонам
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.rect(sx * 0.62 - 0.07, -1.3, 0.14, 0.55);
      ink(ctx, '#59607a', 0.03);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.rect(sx * 0.62 - 0.09, -1.22 + i * 0.11, 0.18, 0.04);
        ink(ctx, '#c9902a', 0.015);
      }
      poly(ctx, [[sx * 0.62, -1.55], [sx * 0.62 + 0.08, -1.32], [sx * 0.62, -1.26], [sx * 0.62 - 0.08, -1.32]]);
      ink(ctx, accent(info, '#7ff3ff'), 0.025);
    }
    // обелиск
    poly(ctx, [[-0.22, -0.85], [-0.15, -2.25], [0, -2.5], [0.15, -2.25], [0.22, -0.85]]);
    ink(ctx, '#4b5268');
    poly(ctx, [[0, -2.5], [0.15, -2.25], [0.22, -0.85], [0.03, -0.85]]);
    ctx.fillStyle = '#3a3f52';
    ctx.fill();
    ctx.strokeStyle = accent(info, '#5ac8ff');
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const y = -1.1 - i * 0.28; ctx.moveTo(-0.06, y); ctx.lineTo(0.06, y - 0.08); ctx.lineTo(-0.04, y - 0.14); }
    ctx.stroke();
    evoMarks(ctx, info, 0.8, -2.2);
  },
  anim(ctx, info, t) {
    const on = info.powered !== false;
    const col = info.path === 'b' ? '255,240,120' : '90,200,255';
    glowSpot(ctx, 0, -1.8, 0.9, col, on ? 0.35 + Math.sin(t * 6) * 0.1 : 0.05);
    ctx.save();
    ctx.translate(0, -1.75);
    ctx.scale(1, 0.4);
    ctx.rotate(t * 2.5);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgb(${col})`;
    ctx.lineWidth = 0.06;
    ctx.setLineDash([0.3, 0.15]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // искры между катушками
    if (Math.sin(t * 9) > 0.4) {
      ctx.strokeStyle = '#e8fbff';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.62, -1.5);
      for (let i = 1; i < 6; i++) ctx.lineTo(-0.62 + i * 0.25, -1.5 - Math.sin(t * 40 + i * 2) * 0.12 - Math.sin((i / 5) * Math.PI) * 0.4);
      ctx.lineTo(0.62, -1.5);
      ctx.stroke();
    }
    if (info.path === 'b') {
      // грозовое облачко над столпом
      ctx.fillStyle = '#4a4a5a';
      for (const [x, r] of [[-0.18, 0.18], [0.05, 0.22], [0.25, 0.16]]) { ellipse(ctx, x, -2.75 + Math.sin(t + x) * 0.03, r, r * 0.7); ink(ctx, '#4a4a5a', 0.025); }
    }
  },
};

ART.market = {
  bounds: [-1.2, -2.3, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#4a3e30');
    for (const [x, col] of [[-0.48, '#d93a3a'], [0.48, '#3f8fff']]) {
      // прилавок
      ctx.beginPath();
      ctx.rect(x - 0.42, -0.6, 0.84, 0.32);
      ink(ctx, '#8a5a32');
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 0.42, -0.6, 0.84, 0.32);
      ctx.clip();
      planksFill(ctx, x - 0.42, -0.6, 0.84, 0.32, 5, '#8a5a32', true, 17);
      ctx.restore();
      // стойки и полосатый навес
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.rect(x + sx * 0.38 - 0.03, -1.45, 0.06, 0.9); ink(ctx, '#6b3d1f', 0.02); }
      ctx.beginPath();
      ctx.moveTo(x - 0.48, -1.2);
      ctx.lineTo(x - 0.38, -1.55);
      ctx.lineTo(x + 0.38, -1.55);
      ctx.lineTo(x + 0.48, -1.2);
      ctx.closePath();
      ink(ctx, '#f6ead6');
      ctx.save();
      ctx.clip();
      ctx.fillStyle = col;
      for (let i = 0; i < 6; i += 2) ctx.fillRect(x - 0.48 + i * 0.16, -1.6, 0.16, 0.5);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x - 0.48, -1.2);
      ctx.lineTo(x - 0.38, -1.55);
      ctx.lineTo(x + 0.38, -1.55);
      ctx.lineTo(x + 0.48, -1.2);
      ink(ctx, null);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(x - 0.4 + i * 0.16, -1.2, 0.08, 0, Math.PI);
        ink(ctx, i % 2 ? col : '#f6ead6', 0.02);
      }
    }
    // товары
    for (const [x, c] of [[-0.75, '#d93a3a'], [-0.6, '#ffb347'], [-0.45, '#7ac04a'], [-0.3, '#d93a3a']]) { ellipse(ctx, x, -0.66, 0.06, 0.06); ink(ctx, c, 0.015); }
    for (const x of [0.25, 0.5, 0.72]) { ctx.beginPath(); ctx.moveTo(x - 0.07, -0.6); ctx.quadraticCurveTo(x - 0.1, -0.78, x, -0.82); ctx.quadraticCurveTo(x + 0.1, -0.78, x + 0.07, -0.6); ctx.closePath(); ink(ctx, '#c97a4a', 0.02); }
    barrel(ctx, -0.95, -0.12, 0.18);
    sack(ctx, 0.95, -0.12, 0.15);
    // вывеска-монета
    ctx.beginPath();
    ctx.rect(-0.03, -2.0, 0.06, 0.45);
    ink(ctx, '#6b3d1f', 0.02);
    ellipse(ctx, 0, -1.95, 0.17, 0.17);
    ink(ctx, '#ffd34d', 0.03);
    ellipse(ctx, 0, -1.95, 0.09, 0.09);
    ctx.strokeStyle = '#c9902a';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    evoMarks(ctx, info, 0.85, -1.9);
  },
};

ART.repairHouse = {
  bounds: [-1.2, -2.6, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3e3a36');
    wallBox(ctx, -0.8, -0.3, 1.25, 0.85, 'timber', '#d8c8a8', 41);
    door(ctx, -0.2, -1.0, 0.4, 0.7, '#5a3218');
    window_(ctx, -0.65, -0.95, 0.2, 0.24, true, true);
    tiledRoof(ctx, -0.17, -1.15, 1.45, 0.4, 0.65, '#6a4a2a', 3, 8);
    chimney(ctx, 0.28, -1.5, 0.16, 0.45);
    // навес с наковальней
    ctx.beginPath();
    ctx.rect(0.48, -1.05, 0.05, 0.8);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.moveTo(0.42, -1.05); ctx.lineTo(0.98, -0.92); ctx.lineTo(0.98, -0.85); ctx.lineTo(0.42, -0.98);
    ctx.closePath();
    ink(ctx, '#8a5a32', 0.025);
    ctx.beginPath();
    ctx.moveTo(0.62, -0.42); ctx.lineTo(0.92, -0.42); ctx.lineTo(0.86, -0.52); ctx.lineTo(0.66, -0.52);
    ctx.closePath();
    ink(ctx, '#4a4a55', 0.025);
    ctx.beginPath();
    ctx.rect(0.72, -0.42, 0.1, 0.16);
    ink(ctx, '#3a3a44', 0.02);
    // вывеска-шестерня
    gearShape(ctx, -0.55, -1.85, 0.16, 8, '#c9ced8', 0.2);
    logPile(ctx, -0.95, -0.15, 2, 0.065);
    plankStack(ctx, 0.82, -0.12, 0.32, 3);
    evoMarks(ctx, info, 0.8, -2.0);
  },
  anim(ctx, info, t) {
    smoke(ctx, 0.28, -2.0, t, 3);
    if (info.working) {
      ctx.save();
      ctx.translate(0.78, -0.62);
      ctx.rotate(Math.sin(t * 14) * 0.6 - 0.3);
      hammer(ctx, 0.9);
      ctx.restore();
    }
  },
};

ART.sawmill = {
  bounds: [-1.2, -2.4, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#4a3a24');
    wallBox(ctx, -0.85, -0.3, 1.1, 0.75, 'wood', '#8a5a32', 51);
    window_(ctx, -0.6, -0.85, 0.18, 0.22, true, false);
    door(ctx, -0.22, -0.95, 0.32, 0.65, '#4a2c18');
    tiledRoof(ctx, -0.3, -1.05, 1.3, 0.35, 0.6, '#7a2f2a', 3, 12);
    // козлы с бревном
    ctx.beginPath();
    ctx.rect(0.25, -0.55, 0.7, 0.08);
    ink(ctx, '#6b3d1f', 0.02);
    for (const x of [0.3, 0.88]) { ctx.beginPath(); ctx.moveTo(x - 0.06, -0.2); ctx.lineTo(x, -0.5); ctx.lineTo(x + 0.06, -0.2); ink(ctx, null, 0.03); }
    ctx.beginPath();
    ctx.rect(0.2, -0.75, 0.8, 0.18);
    ink(ctx, '#c98a4b', 0.025);
    ellipse(ctx, 1.0, -0.66, 0.04, 0.09);
    ink(ctx, '#e0b07a', 0.02);
    logPile(ctx, -0.65, -0.12, 3, 0.07);
    plankStack(ctx, 0.62, -0.1, 0.4, 4);
    evoMarks(ctx, info, -0.75, -1.8);
  },
  anim(ctx, info, t) {
    gearShape(ctx, 0.6, -0.95, 0.28, 16, '#d0d6e0', info.working ? t * 12 : 0);
    if (info.working && Math.sin(t * 20) > 0) {
      ctx.fillStyle = '#e0b07a';
      for (let i = 0; i < 3; i++) { ellipse(ctx, 0.6 + Math.cos(t * 30 + i) * 0.2, -0.7 + Math.sin(t * 25 + i) * 0.1, 0.02, 0.02); ctx.fill(); }
    }
  },
};

ART.quarry = {
  bounds: [-1.2, -2.6, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3a3a40');
    ctx.beginPath();
    ctx.ellipse(0.05, -0.85, 0.8, 0.5, 0, 0, Math.PI * 2);
    ink(ctx, '#2a2830');
    // уступы карьера
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0.05, -0.85 + i * 0.07, 0.75 - i * 0.18, 0.44 - i * 0.12, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.strokeStyle = '#5a5a66';
      ctx.lineWidth = 0.05;
      ctx.stroke();
    }
    for (const [x, y, r] of [[-0.35, -0.85, 0.14], [0.2, -0.75, 0.17], [0.42, -0.95, 0.11], [-0.05, -1.05, 0.1]]) {
      poly(ctx, [[x - r, y + r * 0.4], [x - r * 0.6, y - r * 0.6], [x + r * 0.5, y - r * 0.7], [x + r, y + r * 0.3]]);
      ink(ctx, '#8a92a0', 0.025);
    }
    // тачка
    ctx.beginPath();
    ctx.moveTo(-0.95, -0.35); ctx.lineTo(-0.55, -0.35); ctx.lineTo(-0.6, -0.15); ctx.lineTo(-0.9, -0.15);
    ctx.closePath();
    ink(ctx, '#8a5a32', 0.025);
    ellipse(ctx, -0.75, -0.1, 0.07, 0.07);
    ink(ctx, '#4a4a55', 0.02);
    brickStack(ctx, 0.75, -0.08, 0.36, 2, '#8a92a0');
    // журавль
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(-0.75, -0.6); ctx.lineTo(-0.75, -2.0); ctx.lineTo(0.25, -1.8);
    ctx.stroke();
    ctx.strokeStyle = '#8a5a32';
    ctx.lineWidth = 0.055;
    ctx.stroke();
    evoMarks(ctx, info, 0.8, -1.7);
  },
  anim(ctx, info, t) {
    const dy = info.working ? Math.sin(t * 2) * 0.3 : 0;
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.22, -1.8); ctx.lineTo(0.22, -1.25 + dy);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(0.1, -1.25 + dy, 0.24, 0.16);
    ink(ctx, '#7d8696', 0.025);
  },
};

ART.stonecutter = {
  bounds: [-1.2, -2.4, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3a3a40');
    // навес на столбах
    for (const x of [-0.85, 0.85]) { ctx.beginPath(); ctx.rect(x - 0.05, -1.35, 0.1, 1.1); ink(ctx, '#6b3d1f', 0.025); }
    tiledRoof(ctx, 0, -1.3, 2.0, 0.9, 0.5, '#5a6070', 3, 14);
    // каменная плита и блоки
    ctx.beginPath();
    ctx.rect(-0.45, -0.62, 0.9, 0.22);
    ink(ctx, '#8a92a0');
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.45, -0.62, 0.9, 0.22);
    ctx.clip();
    stoneCourses(ctx, -0.45, -0.62, 0.9, 0.22, 1, '#8a92a0', 2);
    ctx.restore();
    poly(ctx, [[-0.3, -0.62], [-0.25, -0.92], [0.15, -0.95], [0.25, -0.62]]);
    ink(ctx, '#a9b0bd');
    brickStack(ctx, -0.65, -0.12, 0.42, 3);
    brickStack(ctx, 0.65, -0.12, 0.42, 2);
    // долото и кувалда на стене
    ctx.save(); ctx.translate(0.6, -0.9); ctx.rotate(0.5); hammer(ctx, 1.1); ctx.restore();
    evoMarks(ctx, info, -0.75, -1.9);
  },
  anim(ctx, info, t) {
    if (!info.working) return;
    ctx.save();
    ctx.translate(-0.05, -1.05);
    ctx.rotate(Math.sin(t * 12) * 0.5);
    hammer(ctx, 0.9);
    ctx.restore();
    if (Math.sin(t * 12) > 0.8) {
      ctx.fillStyle = '#d0d6e0';
      for (let i = 0; i < 4; i++) { ellipse(ctx, -0.05 + Math.cos(i * 1.7) * 0.15, -0.95 - Math.sin(i * 2.1) * 0.08, 0.018, 0.018); ctx.fill(); }
    }
  },
};

ART.charcoal = {
  bounds: [-1.2, -2.8, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#2e2a28');
    // земляная печь-курган
    ctx.beginPath();
    ctx.moveTo(-0.75, -0.3);
    ctx.quadraticCurveTo(-0.7, -1.45, 0, -1.5);
    ctx.quadraticCurveTo(0.7, -1.45, 0.75, -0.3);
    ctx.closePath();
    ink(ctx, '#5a4a3a');
    ctx.save();
    ctx.clip();
    stoneCourses(ctx, -0.8, -1.5, 1.6, 1.2, 6, '#5a4a3a', 23);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-0.75, -0.3);
    ctx.quadraticCurveTo(-0.7, -1.45, 0, -1.5);
    ctx.quadraticCurveTo(0.7, -1.45, 0.75, -0.3);
    ink(ctx, null);
    // устье
    ctx.beginPath();
    ctx.moveTo(-0.22, -0.3);
    ctx.lineTo(-0.22, -0.55);
    ctx.arc(0, -0.55, 0.22, Math.PI, 0);
    ctx.lineTo(0.22, -0.3);
    ctx.closePath();
    ink(ctx, '#1a1418');
    logPile(ctx, -0.85, -0.12, 2, 0.07);
    logPile(ctx, 0.82, -0.12, 2, 0.07);
    for (let i = 0; i < 3; i++) { ellipse(ctx, 0.55 + i * 0.1, -0.68, 0.06, 0.05); ink(ctx, '#2a2a30', 0.015); }
    evoMarks(ctx, info, 0.8, -1.9);
  },
  anim(ctx, info, t) {
    glowSpot(ctx, 0, -0.45, 0.4, '255,120,40', info.working ? 0.5 + Math.sin(t * 7) * 0.15 : 0.12);
    smoke(ctx, -0.1, -1.55, t, info.working ? 4 : 1, 'rgba(70,65,75,');
  },
};

ART.mine = {
  bounds: [-1.2, -2.5, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#34303a');
    // скала
    poly(ctx, [[-0.95, -0.3], [-0.85, -1.2], [-0.4, -1.75], [0.25, -1.7], [0.8, -1.25], [0.95, -0.3]]);
    ink(ctx, '#6a6070');
    poly(ctx, [[-0.4, -1.75], [0.25, -1.7], [0.8, -1.25], [0.1, -1.2]]);
    ink(ctx, '#8a8090', 0.03);
    ctx.fillStyle = '#c0703a';
    for (const [x, y] of [[-0.6, -1.0], [0.6, -0.95], [0.4, -1.4]]) { poly(ctx, [[x, y], [x + 0.06, y - 0.05], [x + 0.09, y + 0.03]]); ink(ctx, '#c0703a', 0.015); }
    // вход с крепью
    ctx.beginPath();
    ctx.moveTo(-0.38, -0.3);
    ctx.lineTo(-0.38, -0.85);
    ctx.quadraticCurveTo(0, -1.05, 0.38, -0.85);
    ctx.lineTo(0.38, -0.3);
    ctx.closePath();
    ink(ctx, '#140f14');
    for (const x of [-0.42, 0.34]) { ctx.beginPath(); ctx.rect(x, -0.95, 0.08, 0.65); ink(ctx, '#8a5a32', 0.025); }
    ctx.beginPath();
    ctx.rect(-0.48, -1.02, 0.96, 0.1);
    ink(ctx, '#8a5a32', 0.025);
    // рельсы и вагонетка
    ctx.strokeStyle = '#4a4a55';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(-0.22, -0.3); ctx.lineTo(-0.3, 0);
    ctx.moveTo(0.22, -0.3); ctx.lineTo(0.3, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.28, -0.42); ctx.lineTo(0.28, -0.42); ctx.lineTo(0.22, -0.2); ctx.lineTo(-0.22, -0.2);
    ctx.closePath();
    ink(ctx, '#5a5a66', 0.03);
    for (const [x, c] of [[-0.12, '#c0703a'], [0.02, '#3a3a44'], [0.14, '#c0703a']]) { ellipse(ctx, x, -0.45, 0.07, 0.05); ink(ctx, c, 0.015); }
    for (const x of [-0.16, 0.16]) { ellipse(ctx, x, -0.18, 0.05, 0.05); ink(ctx, '#2a2a30', 0.015); }
    evoMarks(ctx, info, 0.8, -1.7);
  },
  anim(ctx, info, t) {
    torch(ctx, -0.52, -1.05, t, 0.8);
    torch(ctx, 0.52, -1.05, t + 1, 0.8);
    if (info.working) glowSpot(ctx, 0, -0.6, 0.3, '255,200,120', 0.25 + Math.sin(t * 5) * 0.08);
  },
};

ART.smelter = {
  bounds: [-1.2, -3.0, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#34303a');
    // печь-башня
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.3);
    ctx.lineTo(-0.45, -1.7);
    ctx.lineTo(0.45, -1.7);
    ctx.lineTo(0.6, -0.3);
    ctx.closePath();
    ink(ctx, '#6a5a58');
    ctx.save();
    ctx.clip();
    stoneCourses(ctx, -0.65, -1.7, 1.3, 1.4, 7, '#6a5a58', 27);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0.2, -1.8, 0.5, 1.6);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.3); ctx.lineTo(-0.45, -1.7); ctx.lineTo(0.45, -1.7); ctx.lineTo(0.6, -0.3);
    ink(ctx, null);
    ctx.beginPath();
    ctx.rect(-0.52, -1.82, 1.04, 0.14);
    ink(ctx, '#4a3e3c', 0.03);
    chimney(ctx, 0.15, -1.82, 0.22, 0.5);
    // устье печи
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.3);
    ctx.lineTo(-0.25, -0.65);
    ctx.arc(0, -0.65, 0.25, Math.PI, 0);
    ctx.lineTo(0.25, -0.3);
    ctx.closePath();
    ink(ctx, '#1a1010');
    // тигель и слитки
    ctx.beginPath();
    ctx.moveTo(0.62, -0.5); ctx.lineTo(0.98, -0.5); ctx.lineTo(0.92, -0.2); ctx.lineTo(0.68, -0.2);
    ctx.closePath();
    ink(ctx, '#4a4a55', 0.03);
    for (let i = 0; i < 3; i++) { poly(ctx, [[-0.95 + i * 0.12, -0.12], [-0.92 + i * 0.12, -0.2], [-0.84 + i * 0.12, -0.2], [-0.81 + i * 0.12, -0.12]]); ink(ctx, '#c9ced8', 0.015); }
    // мехи
    poly(ctx, [[-0.95, -0.55], [-0.6, -0.65], [-0.6, -0.45]]);
    ink(ctx, '#8a5a32', 0.025);
    evoMarks(ctx, info, 0.85, -1.4);
  },
  anim(ctx, info, t) {
    const w = info.working;
    glowSpot(ctx, 0, -0.5, 0.55, '255,110,30', w ? 0.6 + Math.sin(t * 8) * 0.15 : 0.12);
    ctx.fillStyle = w ? '#ff7a2a' : '#4a2a20';
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.32);
    ctx.lineTo(-0.2, -0.62);
    ctx.arc(0, -0.62, 0.2, Math.PI, 0);
    ctx.lineTo(0.2, -0.32);
    ctx.closePath();
    ctx.fill();
    if (w) {
      ctx.fillStyle = '#fff3c4';
      ellipse(ctx, 0, -0.42, 0.1, 0.06);
      ctx.fill();
      ellipse(ctx, 0.8, -0.48, 0.13, 0.03);
      ctx.fillStyle = '#ff9a3c';
      ctx.fill();
    }
    smoke(ctx, 0.15, -2.4, t, w ? 4 : 1, 'rgba(70,65,75,');
  },
};

ART.workshop = {
  bounds: [-1.2, -2.6, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#34303a');
    wallBox(ctx, -0.85, -0.3, 1.7, 0.9, 'stone', '#6a6a7a', 61);
    door(ctx, -0.25, -1.05, 0.5, 0.75, '#4a2c18');
    window_(ctx, -0.7, -1.0, 0.2, 0.25, true, true);
    window_(ctx, 0.5, -1.0, 0.2, 0.25, true, true);
    tiledRoof(ctx, 0, -1.2, 1.95, 0.6, 0.6, '#3a4a6a', 3, 15);
    chimney(ctx, -0.55, -1.55, 0.16, 0.4);
    crate(ctx, 0.85, -0.15, 0.24, '#8a6a3a');
    crate(ctx, -0.92, -0.15, 0.2, '#8a6a3a');
    evoMarks(ctx, info, 0.75, -2.0);
  },
  anim(ctx, info, t) {
    const r = info.working ? t * 2 : 0;
    gearShape(ctx, 0.25, -1.75, 0.26, 12, '#d9a64a', r);
    gearShape(ctx, 0.62, -1.55, 0.18, 9, '#c9ced8', -r * 1.4);
    smoke(ctx, -0.55, -2.0, t, 2);
  },
};

// Забор: mask — соседи (1 — север, 2 — восток, 4 — юг, 8 — запад).
// open — насколько распахнуты ворота (0 — закрыты, 1 — настежь).
export function wallArt(ctx, level, mask, gate, destroyed, path = null, open = 0) {
  const stone = level >= 5;
  const metal = level >= 15;
  const col = metal ? '#7d8696' : stone ? '#8a8a96' : '#a0683a';
  const top = metal ? '#b0b8c8' : stone ? '#a9b0bd' : '#c98a4b';
  if (destroyed) {
    for (let i = 0; i < 5; i++) {
      const x = -0.3 + i * 0.15;
      ellipse(ctx, x, -0.12 - (i % 2) * 0.08, 0.1, 0.07);
      ink(ctx, i % 2 ? col : shade(col, -0.2), 0.025);
    }
    return;
  }
  const h = 0.62;
  const horiz = (mask & 10) !== 0;
  const vert = !horiz && (mask & 5) !== 0;
  // кол частокола, когда забор уходит вдаль (север–юг): видим его ребром, колья заходят друг за друга
  const vPicket = (y, tone) => {
    const c = shade(col, tone);
    poly(ctx, [[-0.17, y], [-0.17, y - h + 0.06], [-0.02, y - h - 0.12], [0.17, y - h + 0.04], [0.17, y]]);
    ink(ctx, c, 0.03);
    ctx.fillStyle = shade(c, -0.22);
    poly(ctx, [[0.09, y - 0.02], [0.09, y - h + 0.02], [0.15, y - h + 0.05], [0.15, y - 0.02]]);
    ctx.fill();
    ctx.fillStyle = shade(c, 0.25);
    ctx.fillRect(-0.12, y - h + 0.1, 0.04, h - 0.18);
    ctx.fillStyle = shade(c, -0.18);
    ctx.fillRect(-0.15, y - h * 0.55, 0.3, 0.04);
  };
  const vPalisade = (from) => {
    for (let k = from; k <= 0; k++) vPicket(k * 0.34, k % 2 ? -0.08 : 0);
  };
  // каменная стена вдоль оси север–юг: верх уходит к соседу, лицевая грань видна у самой южной секции
  const vStone = () => {
    const w = 0.22;
    const yTop = mask & 1 ? -1 - h : -h - 0.1;
    ctx.beginPath();
    ctx.rect(-w, yTop, w * 2, -h - yTop);
    ink(ctx, top, 0.035);
    ctx.fillStyle = shade(top, -0.2);
    ctx.fillRect(-w + 0.08, yTop + (mask & 1 ? 0 : 0.03), (w - 0.08) * 2, -h - yTop - 0.03);
    for (let y = -h - 0.02; y > yTop + 0.12; y -= 0.34) {
      for (const x of [-w, w - 0.09]) {
        ctx.beginPath();
        ctx.rect(x, y - 0.17, 0.09, 0.17);
        ink(ctx, shade(top, 0.12), 0.022);
        ctx.fillStyle = shade(top, -0.12);
        ctx.fillRect(x + 0.01, y - 0.05, 0.07, 0.04);
      }
    }
    ctx.beginPath();
    ctx.rect(-w, -h, w * 2, h);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.save();
    ctx.clip();
    stoneCourses(ctx, -w, -h, w * 2, h, 4, col, level * 7 + 3);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(w * 0.35, -h, w, h);
    ctx.restore();
    ctx.beginPath();
    ctx.rect(-w, -h, w * 2, h);
    ink(ctx, null);
    if (metal) {
      ctx.strokeStyle = '#c9ced8';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.5); ctx.lineTo(w, -h * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#4a4a55';
      ellipse(ctx, 0, -h * 0.5, 0.035, 0.035);
      ctx.fill();
    }
  };
  if (gate && vert) {
    // ворота вдоль оси север–юг: два столба, створка на петлях у дальнего столба.
    // Закрытая стоит в линии забора (видна ребром), открываясь, поворачивается к востоку лицом к нам.
    const wood = stone ? '#6a6a7a' : '#8a5a32';
    const post = (y) => {
      ctx.beginPath();
      ctx.rect(-0.15, y - h - 0.22, 0.3, h + 0.22);
      ink(ctx, wood, 0.035);
      ctx.fillStyle = shade(wood, -0.25);
      ctx.fillRect(0.05, y - h - 0.2, 0.07, h + 0.18);
      ctx.beginPath();
      ctx.rect(-0.19, y - h - 0.32, 0.38, 0.12);
      ink(ctx, top, 0.03);
    };
    if (mask & 1) vPicket(-0.9, -0.08);
    const hy = -0.72; // петли — у дальнего (северного) столба
    const L = 0.66;
    const H = h * 0.88;
    const a = Math.abs(open) * Math.PI * 0.5;
    const ex = Math.sin(a) * L * (open < 0 ? -1 : 1);
    const ey = hy + Math.cos(a) * L;
    post(hy);
    // проход виден, когда створка отошла
    if (Math.abs(open) > 0.05) {
      ctx.fillStyle = 'rgba(40,26,14,0.28)';
      ctx.fillRect(-0.1, hy, 0.2, -hy);
    }
    const door = '#7a4524';
    if (a < 0.12) {
      // закрыта: ребро створки между столбами — доски, две железные полосы
      ctx.beginPath();
      ctx.rect(-0.1, hy - H, 0.2, -hy + H - 0.02);
      ink(ctx, door, 0.03);
      ctx.fillStyle = shade(door, 0.18);
      ctx.fillRect(-0.06, hy - H + 0.04, 0.05, -hy + H - 0.1);
      ctx.strokeStyle = '#4a4a55';
      ctx.lineWidth = 0.045;
      ctx.beginPath();
      for (const k of [0.25, 0.7]) { const y = hy - H + (-hy + H) * k; ctx.moveTo(-0.1, y); ctx.lineTo(0.1, y); }
      ctx.stroke();
    } else {
      // створка повёрнута: параллелограмм от петель к краю, доски вертикальные
      const A = [0.02, hy];
      const B = [0.02 + ex, ey];
      poly(ctx, [A, [A[0], A[1] - H], [B[0], B[1] - H], B]);
      ink(ctx, a > 1.2 ? shade(door, 0.06) : door, 0.03);
      ctx.strokeStyle = '#4a2a14';
      ctx.lineWidth = 0.02;
      for (const k of [0.25, 0.5, 0.75]) {
        const x = A[0] + (B[0] - A[0]) * k;
        const y = A[1] + (B[1] - A[1]) * k;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - H); ctx.stroke();
      }
      ctx.strokeStyle = '#4a4a55';
      ctx.lineWidth = 0.045;
      for (const k of [0.25, 0.7]) {
        ctx.beginPath(); ctx.moveTo(A[0], A[1] - H * k); ctx.lineTo(B[0], B[1] - H * k); ctx.stroke();
      }
    }
    post(0);
    // фонарь на переднем столбе
    ctx.fillStyle = '#ffd36b';
    ellipse(ctx, 0, -h - 0.42, 0.06, 0.07);
    ink(ctx, '#ffd36b', 0.025);
    return;
  }
  if (vert) {
    if (stone) vStone();
    else {
      vPalisade(mask & 1 ? -2 : 0);
    }
    if (path) {
      ctx.fillStyle = EVO[path];
      ctx.fillRect(-0.05, -h * 0.6, 0.1, 0.06);
    }
    return;
  }
  // перемычки к соседям
  const conn = (dx, w) => {
    ctx.beginPath();
    ctx.rect(dx, -h + 0.08, w, h - 0.12);
    ink(ctx, col, 0.035);
  };
  if (mask & 1) {
    // угол: забор уходит на север
    if (stone) {
      ctx.beginPath();
      ctx.rect(-0.22, -1 - h, 0.44, 1);
      ink(ctx, top, 0.035);
    } else { vPicket(-0.68, -0.08); vPicket(-0.34, 0); }
  }
  if (mask & 8) conn(-0.5, 0.36);
  if (mask & 2) conn(0.14, 0.36);
  if (gate) {
    // ворота: арка и две створки; открываясь, створки уходят внутрь (от нас), и виден проход
    ctx.beginPath();
    ctx.rect(-0.46, -h - 0.1, 0.92, h + 0.08);
    ink(ctx, stone ? '#6a6a7a' : '#8a5a32');
    const arch = () => {
      ctx.beginPath();
      ctx.moveTo(-0.32, -0.02);
      ctx.lineTo(-0.32, -0.42);
      ctx.arc(0, -0.42, 0.32, Math.PI, 0);
      ctx.lineTo(0.32, -0.02);
      ctx.closePath();
    };
    arch();
    open = Math.abs(open);
    ink(ctx, open > 0.02 ? '#2e1f14' : '#5a3218');
    ctx.save();
    arch();
    ctx.clip();
    if (open > 0.02) {
      // за створками — земля по ту сторону забора
      const g = ctx.createLinearGradient(0, -0.75, 0, 0);
      g.addColorStop(0, 'rgba(70,92,52,0.95)');
      g.addColorStop(1, 'rgba(46,62,36,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(-0.32, -0.75, 0.64, 0.75);
    }
    const a = open * Math.PI * 0.45;
    const W2 = 0.32;
    const H2 = 0.76;
    for (const side of [-1, 1]) {
      const hx = side * W2;                       // петли у края проёма
      const ex = hx - side * W2 * Math.cos(a);    // край створки
      const lift = W2 * Math.sin(a) * 0.55;       // уходит вглубь — на экране выше
      const pts = [[hx, -0.02], [ex, -0.02 - lift], [ex, -0.02 - lift - H2], [hx, -0.02 - H2]];
      poly(ctx, pts);
      ink(ctx, '#6b3d1f', 0.025);
      ctx.save();
      poly(ctx, pts);
      ctx.clip();
      ctx.strokeStyle = '#4a2a14';
      ctx.lineWidth = 0.018;
      for (const k of [0.33, 0.66]) {
        const x = hx + (ex - hx) * k;
        const y = -0.02 - lift * k;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - H2); ctx.stroke();
      }
      ctx.strokeStyle = '#4a4a55';
      ctx.lineWidth = 0.04;
      for (const yy of [0.23, 0.53]) {
        ctx.beginPath(); ctx.moveTo(hx, -0.02 - yy); ctx.lineTo(ex, -0.02 - lift - yy); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.rect(sx * 0.46 - 0.08, -h - 0.3, 0.16, h + 0.28); ink(ctx, top, 0.03); }
    return;
  }
  if (stone) {
    ctx.beginPath();
    ctx.rect(-0.3, -h, 0.6, h);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.save();
    ctx.clip();
    stoneCourses(ctx, -0.3, -h, 0.6, h, 4, col, level * 7);
    ctx.restore();
    ctx.beginPath();
    ctx.rect(-0.3, -h, 0.6, h);
    ink(ctx, null);
    ctx.beginPath();
    ctx.rect(-0.34, -h - 0.12, 0.68, 0.14);
    ink(ctx, top, 0.03);
    for (const x of [-0.3, -0.06, 0.18]) { ctx.beginPath(); ctx.rect(x, -h - 0.26, 0.12, 0.14); ink(ctx, top, 0.025); }
    if (metal) {
      ctx.fillStyle = '#4a4a55';
      for (const x of [-0.2, 0.2]) { ellipse(ctx, x, -h * 0.5, 0.035, 0.035); ctx.fill(); }
      ctx.strokeStyle = '#c9ced8';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.3, -h * 0.5); ctx.lineTo(0.3, -h * 0.5);
      ctx.stroke();
    }
  } else {
    // деревянный частокол
    for (let i = 0; i < 3; i++) {
      const x = -0.27 + i * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, -h - 0.05 - (i % 2) * 0.06);
      ctx.lineTo(x + 0.08, -h - 0.17 - (i % 2) * 0.06);
      ctx.lineTo(x + 0.16, -h - 0.05 - (i % 2) * 0.06);
      ctx.lineTo(x + 0.16, 0);
      ctx.closePath();
      ink(ctx, shade(col, (i % 2) * 0.08), 0.035);
    }
    ctx.beginPath();
    ctx.rect(-0.32, -h * 0.72, 0.64, 0.07);
    ink(ctx, shade(col, -0.25), 0.025);
  }
  if (path) {
    ctx.fillStyle = EVO[path];
    ctx.fillRect(-0.06, -h * 0.85, 0.12, 0.06);
  }
}

ART.spikes = {
  bounds: [-0.6, -0.8, 0.6, 0.2],
  static(ctx) {
    rrect(ctx, -0.45, -0.85, 0.9, 0.8, 0.06);
    ink(ctx, '#4a4a55', 0.03);
    ctx.fillStyle = '#2a2a30';
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) { ellipse(ctx, -0.28 + i * 0.28, -0.7 + r * 0.25, 0.06, 0.04); ctx.fill(); }
  },
  anim(ctx, info, t, extra) {
    const up = extra?.trapAge < 0.4 ? 1 - extra.trapAge / 0.4 : 0.25;
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 3; i++) {
        const x = -0.28 + i * 0.28;
        const y = -0.7 + r * 0.25;
        poly(ctx, [[x - 0.05, y], [x, y - 0.08 - up * 0.2], [x + 0.05, y]]);
        ink(ctx, '#c9ced8', 0.02);
      }
    }
  },
};

function towerBase(ctx, info, h, color = '#59607a') {
  foundation(ctx, 1, 1, '#34384a');
  ctx.beginPath();
  ctx.moveTo(-0.42, -0.15);
  ctx.lineTo(-0.36, -h);
  ctx.lineTo(0.36, -h);
  ctx.lineTo(0.42, -0.15);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  stoneCourses(ctx, -0.45, -h, 0.9, h - 0.15, Math.round(h / 0.17), color, info.level + 3);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0.12, -h, 0.35, h);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-0.42, -0.15); ctx.lineTo(-0.36, -h); ctx.lineTo(0.36, -h); ctx.lineTo(0.42, -0.15);
  ink(ctx, null);
  ctx.beginPath();
  ctx.rect(-0.1, -0.5, 0.2, 0.3);
  ink(ctx, '#2a2433', 0.025);
}

ART.archerTower = {
  bounds: [-0.75, -3.4, 0.75, 0.2],
  static(ctx, info) {
    towerBase(ctx, info, 1.45);
    // деревянная площадка с зубцами
    ctx.beginPath();
    ctx.rect(-0.52, -1.68, 1.04, 0.24);
    ink(ctx, '#8a5a32');
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.52, -1.68, 1.04, 0.24);
    ctx.clip();
    planksFill(ctx, -0.52, -1.68, 1.04, 0.24, 7, '#8a5a32', true, info.level);
    ctx.restore();
    for (const x of [-0.5, -0.2, 0.1, 0.38]) { ctx.beginPath(); ctx.rect(x, -1.82, 0.13, 0.15); ink(ctx, '#a0683a', 0.025); }
    // опоры крыши
    for (const x of [-0.45, 0.4]) { ctx.beginPath(); ctx.rect(x, -2.15, 0.05, 0.36); ink(ctx, '#6b3d1f', 0.02); }
    const roof = accent(info, '#2f4fa0');
    ctx.beginPath();
    ctx.moveTo(-0.62, -2.08);
    ctx.lineTo(0, -2.85 - (info.tier || 0) * 0.1);
    ctx.lineTo(0.62, -2.08);
    ctx.closePath();
    ink(ctx, roof);
    poly(ctx, [[0, -2.85 - (info.tier || 0) * 0.1], [0.62, -2.08], [0.1, -2.08]]);
    ctx.fillStyle = shade(roof, -0.25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) { ctx.moveTo(-0.62 + i * 0.12, -2.08); ctx.lineTo(0, -2.85); }
    ctx.stroke();
    if (info.level >= 5) {
      ctx.beginPath();
      ctx.rect(-0.62, -2.13, 1.24, 0.07);
      ink(ctx, '#f2c14e', 0.02);
    }
    // щиты на площадке
    for (const x of [-0.32, 0.32]) { ellipse(ctx, x, -1.56, 0.08, 0.08); ink(ctx, accent(info, '#1f6fd1'), 0.02); ellipse(ctx, x, -1.56, 0.03, 0.03); ctx.fillStyle = '#f2c14e'; ctx.fill(); }
  },
  anim(ctx, info, t, extra) {
    // лучник выглядывает
    const shot = extra?.attackAge < 0.15;
    ctx.save();
    ctx.translate(0, -1.88 + (shot ? -0.05 : 0));
    ctx.scale(0.55, 0.55);
    import_hood(ctx);
    ctx.restore();
    // флаг
    const top = -2.85 - (info.tier || 0) * 0.1;
    const f = Math.sin(t * 5) * 0.05;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(0, top); ctx.lineTo(0, top - 0.32);
    ctx.stroke();
    poly(ctx, [[0, top - 0.32], [0.32, top - 0.25 + f], [0, top - 0.16]]);
    ink(ctx, info.powered !== false ? '#f2c14e' : '#6a6a6a', 0.025);
  },
};

// Голова лучника на башне — мини-версия героя.
let hoodFn = null;
export function setHoodHead(fn) { hoodFn = fn; }
function import_hood(ctx) { if (hoodFn) hoodFn(ctx); }

ART.ballista = {
  bounds: [-0.75, -2.0, 0.75, 0.2],
  static(ctx, info) {
    foundation(ctx, 1, 1, '#34384a');
    ctx.beginPath();
    ctx.rect(-0.42, -0.62, 0.84, 0.45);
    ink(ctx, '#59607a');
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.42, -0.62, 0.84, 0.45);
    ctx.clip();
    stoneCourses(ctx, -0.42, -0.62, 0.84, 0.45, 3, '#59607a', 9);
    ctx.restore();
    ctx.beginPath();
    ctx.rect(-0.48, -0.72, 0.96, 0.12);
    ink(ctx, '#8a5a32', 0.03);
    ctx.beginPath();
    ctx.rect(-0.06, -1.0, 0.12, 0.3);
    ink(ctx, '#6b3d1f', 0.025);
    // стойка болтов
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.rect(0.22 + i * 0.06, -0.95, 0.03, 0.25); ink(ctx, '#5a3218', 0.012); }
  },
  anim(ctx, info, t, extra) {
    const ang = extra?.aim ?? -Math.PI / 2;
    const k = extra?.attackAge < 0.4 ? extra.attackAge / 0.4 : 1;
    ctx.save();
    ctx.translate(0, -1.05);
    ctx.scale(1, 0.75);
    ctx.rotate(ang + Math.PI / 2);
    // ложа
    ctx.beginPath();
    ctx.rect(-0.07, -0.55, 0.14, 0.75);
    ink(ctx, '#8a5a32', 0.03);
    // дуга
    ctx.beginPath();
    ctx.moveTo(-0.5, -0.25);
    ctx.quadraticCurveTo(0, -0.55, 0.5, -0.25);
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = 0.07;
    ctx.strokeStyle = accent(info, '#c9ced8');
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.5, -0.25);
    ctx.lineTo(0, -0.25 + 0.35 * k);
    ctx.lineTo(0.5, -0.25);
    ctx.strokeStyle = '#e8c766';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    if (k > 0.6) {
      ctx.beginPath();
      ctx.rect(-0.03, -0.6 + 0.35 * k, 0.06, 0.5);
      ink(ctx, '#5a3218', 0.02);
      poly(ctx, [[-0.07, -0.6 + 0.35 * k], [0, -0.78 + 0.35 * k], [0.07, -0.6 + 0.35 * k]]);
      ink(ctx, '#c9ced8', 0.02);
    }
    ctx.restore();
  },
};

ART.mageTower = {
  bounds: [-0.75, -3.6, 0.75, 0.2],
  static(ctx, info) {
    towerBase(ctx, info, 1.9, '#4a4060');
    const roof = info.path === 'b' ? '#3f8fff' : info.path === 'a' ? '#8a3fd0' : '#6a3fb0';
    ctx.beginPath();
    ctx.rect(-0.44, -2.02, 0.88, 0.14);
    ink(ctx, '#f2c14e', 0.03);
    ctx.beginPath();
    ctx.moveTo(-0.5, -2.02);
    ctx.quadraticCurveTo(-0.1, -2.4, 0, -3.0);
    ctx.quadraticCurveTo(0.1, -2.4, 0.5, -2.02);
    ctx.closePath();
    ink(ctx, roof);
    ctx.fillStyle = '#f2c14e';
    for (const [x, y] of [[-0.15, -2.2], [0.12, -2.35], [0.0, -2.6]]) { ellipse(ctx, x, y, 0.025, 0.025); ctx.fill(); }
    // руническое окно
    window_(ctx, -0.1, -1.55, 0.2, 0.3, true, true);
  },
  anim(ctx, info, t) {
    const y = -3.25 + Math.sin(t * 2) * 0.08;
    const col = info.path === 'b' ? '255,240,120' : '190,120,255';
    glowSpot(ctx, 0, y, 0.6, col, 0.5);
    ellipse(ctx, 0, y, 0.14, 0.14);
    ink(ctx, `rgb(${col})`, 0.03);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, -0.04, y - 0.04, 0.04, 0.04);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1;
      ctx.fillStyle = `rgb(${col})`;
      ellipse(ctx, Math.cos(a) * 0.3, y + Math.sin(a) * 0.1, 0.03, 0.03);
      ctx.fill();
    }
  },
};

ART.fireTower = {
  bounds: [-0.75, -2.6, 0.75, 0.2],
  static(ctx, info) {
    towerBase(ctx, info, 0.95, '#5a4a48');
    // чаша
    ctx.beginPath();
    ctx.moveTo(-0.52, -1.05);
    ctx.quadraticCurveTo(-0.45, -0.75, 0, -0.75);
    ctx.quadraticCurveTo(0.45, -0.75, 0.52, -1.05);
    ctx.closePath();
    ink(ctx, '#3a3a44');
    ctx.beginPath();
    ctx.ellipse(0, -1.05, 0.52, 0.14, 0, 0, Math.PI * 2);
    ink(ctx, '#2a1a14');
    ctx.strokeStyle = accent(info, '#f2c14e');
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(-0.48, -0.95); ctx.quadraticCurveTo(0, -0.8, 0.48, -0.95);
    ctx.stroke();
  },
  anim(ctx, info, t, extra) {
    const burst = extra?.attackAge < 0.25 ? 1.4 : 1;
    glowSpot(ctx, 0, -1.4, 0.9 * burst, '255,120,30', 0.5);
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(t * 10 + i * 2) * 0.06;
      const s = (0.4 - i * 0.1) * burst;
      ctx.beginPath();
      ctx.moveTo(-s, -1.05);
      ctx.quadraticCurveTo(-s, -1.05 - s * 1.5, f, -1.05 - s * 2.6);
      ctx.quadraticCurveTo(s, -1.05 - s * 1.5, s, -1.05);
      ctx.closePath();
      ink(ctx, ['#ff5a1a', '#ff9a3c', '#fff3c4'][i], i ? 0.02 : 0.03);
    }
  },
};

ART.frostTower = {
  bounds: [-0.75, -3.2, 0.75, 0.2],
  static(ctx, info) {
    towerBase(ctx, info, 0.9, '#5a6a80');
    // ледяной шпиль
    poly(ctx, [[-0.3, -0.9], [-0.12, -2.4], [0, -2.75], [0.12, -2.4], [0.3, -0.9]]);
    ink(ctx, '#bff3ff');
    poly(ctx, [[0, -2.75], [0.12, -2.4], [0.3, -0.9], [0.04, -0.9]]);
    ctx.fillStyle = '#7fd6f0';
    ctx.fill();
    for (const [x, y, h] of [[-0.32, -0.95, 0.5], [0.34, -0.95, 0.42], [-0.18, -0.95, 0.7]]) {
      poly(ctx, [[x - 0.08, y], [x, y - h], [x + 0.08, y]]);
      ink(ctx, '#dffaff', 0.025);
    }
    // снег на основании
    ctx.fillStyle = '#ffffff';
    for (const x of [-0.3, 0, 0.28]) { ellipse(ctx, x, -0.92, 0.12, 0.05); ctx.fill(); }
  },
  anim(ctx, info, t) {
    glowSpot(ctx, 0, -2.0, 0.8, '150,230,255', 0.35 + Math.sin(t * 2) * 0.1);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.3 + i / 5) % 1;
      ellipse(ctx, Math.sin(i * 2.3 + t) * 0.5, -2.6 + ph * 2, 0.025, 0.025);
      ctx.fill();
    }
  },
};

ART.watchTower = {
  bounds: [-0.75, -3.8, 0.75, 0.2],
  static(ctx, info) {
    foundation(ctx, 1, 1, '#34384a');
    // деревянная вышка
    for (const [x0, x1] of [[-0.38, -0.22], [0.38, 0.22]]) {
      ctx.beginPath();
      ctx.moveTo(x0, -0.15); ctx.lineTo(x1, -2.2);
      ctx.lineWidth = 0.1;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.lineWidth = 0.06;
      ctx.strokeStyle = '#8a5a32';
      ctx.stroke();
    }
    ctx.strokeStyle = '#6b3d1f';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y0 = -0.4 - i * 0.6; const y1 = y0 - 0.6;
      const w0 = 0.36 - i * 0.05; const w1 = w0 - 0.05;
      ctx.moveTo(-w0, y0); ctx.lineTo(w1, y1);
      ctx.moveTo(w0, y0); ctx.lineTo(-w1, y1);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-0.42, -2.45, 0.84, 0.28);
    ink(ctx, '#a0683a');
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.42, -2.45, 0.84, 0.28);
    ctx.clip();
    planksFill(ctx, -0.42, -2.45, 0.84, 0.28, 6, '#a0683a', true, 77);
    ctx.restore();
    for (const x of [-0.38, 0.33]) { ctx.beginPath(); ctx.rect(x, -2.85, 0.05, 0.42); ink(ctx, '#6b3d1f', 0.02); }
    ctx.beginPath();
    ctx.moveTo(-0.55, -2.8); ctx.lineTo(0, -3.3); ctx.lineTo(0.55, -2.8);
    ctx.closePath();
    ink(ctx, '#5a3a24');
    // колокол
    ctx.beginPath();
    ctx.moveTo(-0.12, -2.48);
    ctx.quadraticCurveTo(-0.13, -2.75, 0, -2.76);
    ctx.quadraticCurveTo(0.13, -2.75, 0.12, -2.48);
    ctx.closePath();
    ink(ctx, '#f2c14e', 0.025);
    banner(ctx, 0.48, -2.4, 0.16, 0.36, '#1f6fd1', '#f2c14e');
  },
  anim(ctx, info, t) {
    glowSpot(ctx, 0, -2.6, 1.0, '255,220,140', 0.2 + Math.sin(t * 3) * 0.05);
  },
};

function hall(ctx, info, wall, wallColor, roofColor, seed) {
  foundation(ctx, 2, 2, '#34384a');
  wallBox(ctx, -0.85, -0.3, 1.7, 0.9, wall, wallColor, seed);
  tiledRoof(ctx, 0, -1.2, 2.0, 0.7, 0.72, roofColor, 4, seed);
}

ART.barracks = {
  bounds: [-1.2, -2.9, 1.2, 0.2],
  static(ctx, info) {
    hall(ctx, info, 'stone', '#6a7390', accent(info, '#2f4fa0'), 81);
    // ворота
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.3);
    ctx.lineTo(-0.25, -0.8);
    ctx.quadraticCurveTo(0, -1.02, 0.25, -0.8);
    ctx.lineTo(0.25, -0.3);
    ctx.closePath();
    ink(ctx, '#3a2414');
    ctx.save();
    ctx.clip();
    planksFill(ctx, -0.25, -1.05, 0.5, 0.75, 4, '#4a2c18', true, 3);
    ctx.restore();
    for (const sx of [-1, 1]) {
      banner(ctx, sx * 0.55, -1.15, 0.24, 0.55, accent(info, '#1f6fd1'), '#f2c14e', Math.sin(sx) * 0.02);
    }
    // скрещённые мечи на фронтоне
    ctx.save();
    ctx.translate(0, -1.55);
    for (const r of [-0.6, 0.6]) { ctx.save(); ctx.rotate(r); sword(ctx, 3, 0.5); ctx.restore(); }
    ctx.restore();
    // манекен
    ctx.beginPath();
    ctx.rect(0.88, -0.75, 0.05, 0.55);
    ink(ctx, '#6b3d1f', 0.02);
    ellipse(ctx, 0.905, -0.78, 0.12, 0.14);
    ink(ctx, '#c9a06a', 0.025);
    ellipse(ctx, 0.905, -0.98, 0.07, 0.07);
    ink(ctx, '#c9a06a', 0.02);
    evoMarks(ctx, info, -0.92, -1.0);
  },
  anim(ctx, info, t) {
    torch(ctx, -0.35, -0.95, t, 0.7);
    torch(ctx, 0.35, -0.95, t + 2, 0.7);
  },
};

ART.archeryRange = {
  bounds: [-1.2, -2.6, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3e3a30');
    wallBox(ctx, -0.85, -0.3, 1.0, 0.8, 'wood', '#7a5a3a', 91);
    door(ctx, -0.5, -0.95, 0.32, 0.65, '#3a2414');
    tiledRoof(ctx, -0.35, -1.1, 1.2, 0.3, 0.6, accent(info, '#2f7a3e'), 3, 91);
    // мишени
    for (const [x, y] of [[0.55, -0.85], [0.85, -0.45]]) {
      ctx.beginPath();
      ctx.rect(x - 0.03, y, 0.06, 0.35);
      ink(ctx, '#6b3d1f', 0.02);
      ellipse(ctx, x, y, 0.2, 0.2);
      ink(ctx, '#f6ead6', 0.03);
      ellipse(ctx, x, y, 0.13, 0.13);
      ink(ctx, '#d93a3a', 0.02);
      ellipse(ctx, x, y, 0.05, 0.05);
      ctx.fillStyle = '#f6ead6';
      ctx.fill();
      ctx.save();
      ctx.translate(x - 0.05, y - 0.03);
      ctx.rotate(-2.8);
      ctx.beginPath();
      ctx.rect(0, -0.012, 0.25, 0.024);
      ink(ctx, '#7a4524', 0.012);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(-0.2, -0.72);
    ctx.rotate(-0.2);
    bow(ctx, 2, 0, 0.8);
    ctx.restore();
    evoMarks(ctx, info, -0.75, -1.7);
  },
};

ART.sanctum = {
  bounds: [-1.2, -3.2, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#2e2a40');
    wallBox(ctx, -0.8, -0.3, 1.6, 0.85, 'stone', '#5a4a7a', 101);
    // колонны
    for (const x of [-0.6, -0.2, 0.2, 0.6]) {
      ctx.beginPath();
      ctx.rect(x - 0.06, -1.15, 0.12, 0.85);
      ink(ctx, '#d8d0e8', 0.025);
    }
    // купол
    ctx.beginPath();
    ctx.moveTo(-0.85, -1.15);
    ctx.quadraticCurveTo(-0.8, -2.25, 0, -2.3);
    ctx.quadraticCurveTo(0.8, -2.25, 0.85, -1.15);
    ctx.closePath();
    ink(ctx, accent(info, '#6a3fb0'));
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0.2, -2.4, 0.8, 1.3);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (const x of [-0.4, 0, 0.4]) { ctx.moveTo(x * 1.6, -1.15); ctx.quadraticCurveTo(x, -2.0, 0, -2.3); }
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.rect(-0.9, -1.22, 1.8, 0.1);
    ink(ctx, '#f2c14e', 0.03);
    door(ctx, -0.14, -0.85, 0.28, 0.55, '#2a1a4a');
    evoMarks(ctx, info, 0.9, -1.0);
  },
  anim(ctx, info, t) {
    const y = -2.6 + Math.sin(t * 2) * 0.06;
    glowSpot(ctx, 0, y, 0.7, '190,120,255', 0.5);
    poly(ctx, [[0, y - 0.25], [0.12, y], [0, y + 0.18], [-0.12, y]]);
    ink(ctx, '#d0a0ff', 0.03);
  },
};

ART.forge = {
  bounds: [-1.2, -3.0, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#34303a');
    wallBox(ctx, -0.85, -0.3, 1.2, 0.95, 'stone', '#6a5a58', 111);
    tiledRoof(ctx, -0.25, -1.25, 1.4, 0.4, 0.62, '#4a3e3c', 3, 111);
    chimney(ctx, -0.55, -1.55, 0.26, 0.85);
    // горн
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.3);
    ctx.lineTo(-0.6, -0.72);
    ctx.arc(-0.35, -0.72, 0.25, Math.PI, 0);
    ctx.lineTo(-0.1, -0.3);
    ctx.closePath();
    ink(ctx, '#1a1010');
    // навес с наковальней
    ctx.beginPath();
    ctx.rect(0.48, -1.1, 0.05, 0.85);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.rect(0.92, -1.1, 0.05, 0.85);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.moveTo(0.38, -1.1); ctx.lineTo(1.02, -1.1); ctx.lineTo(0.98, -1.2); ctx.lineTo(0.42, -1.2);
    ctx.closePath();
    ink(ctx, '#8a5a32', 0.025);
    ctx.beginPath();
    ctx.moveTo(0.55, -0.45); ctx.lineTo(0.9, -0.45); ctx.lineTo(0.84, -0.56); ctx.lineTo(0.6, -0.56);
    ctx.closePath();
    ink(ctx, '#3a3a44', 0.03);
    ctx.beginPath();
    ctx.rect(0.66, -0.45, 0.12, 0.2);
    ink(ctx, '#2a2a30', 0.02);
    // оружие на стене
    ctx.save(); ctx.translate(0.15, -0.6); ctx.rotate(0.15); sword(ctx, 3, 0.6); ctx.restore();
    ctx.save(); ctx.translate(0.3, -0.62); ctx.rotate(-0.1); sword(ctx, 2, 0.55); ctx.restore();
    // бочка с водой
    barrel(ctx, -0.95, -0.12, 0.2);
    evoMarks(ctx, info, 0.75, -2.0);
  },
  anim(ctx, info, t) {
    glowSpot(ctx, -0.35, -0.55, 0.5, '255,110,30', 0.5 + Math.sin(t * 6) * 0.12);
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath();
    ctx.moveTo(-0.56, -0.32);
    ctx.lineTo(-0.56, -0.7);
    ctx.arc(-0.35, -0.7, 0.21, Math.PI, 0);
    ctx.lineTo(-0.14, -0.32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ellipse(ctx, -0.35, -0.42, 0.1, 0.06);
    ctx.fill();
    smoke(ctx, -0.55, -2.45, t, 3, 'rgba(70,65,75,');
    // искры от молота
    if (Math.sin(t * 6) > 0.7) {
      ctx.fillStyle = '#ffd34d';
      for (let i = 0; i < 4; i++) { ellipse(ctx, 0.72 + Math.cos(i * 1.5 + t * 9) * 0.15, -0.62 - Math.abs(Math.sin(i * 2 + t * 7)) * 0.2, 0.02, 0.02); ctx.fill(); }
    }
  },
};

ART.bowyer = {
  bounds: [-1.2, -2.6, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3e3a30');
    wallBox(ctx, -0.85, -0.3, 1.7, 0.85, 'wood', '#8a5a32', 121);
    tiledRoof(ctx, 0, -1.15, 1.95, 0.55, 0.7, '#2f6a3e', 4, 121);
    door(ctx, -0.18, -0.95, 0.36, 0.65, '#3a2414');
    window_(ctx, -0.65, -0.95, 0.2, 0.24, true, false);
    // луки на стене
    for (const [x, tier] of [[0.38, 2], [0.62, 4]]) {
      ctx.save(); ctx.translate(x, -0.75); ctx.scale(0.55, 0.55); bow(ctx, tier, 0); ctx.restore();
    }
    // колчан у входа
    ctx.beginPath();
    ctx.rect(0.82, -0.6, 0.14, 0.38);
    ink(ctx, '#6b3d1f', 0.025);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.85 + i * 0.04, -0.6); ctx.lineTo(0.85 + i * 0.04, -0.75); ctx.strokeStyle = '#2f9df2'; ctx.lineWidth = 0.03; ctx.stroke(); }
    // мишень на крыше
    ellipse(ctx, 0.0, -1.55, 0.16, 0.16);
    ink(ctx, '#f6ead6', 0.025);
    ellipse(ctx, 0.0, -1.55, 0.09, 0.09);
    ink(ctx, '#d93a3a', 0.02);
    evoMarks(ctx, info, 0.85, -1.6);
  },
};

ART.arcanum = {
  bounds: [-1.2, -3.8, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#2e2a40');
    wallBox(ctx, -0.85, -0.3, 1.0, 0.75, 'stone', '#5a4a7a', 131);
    // высокая башня
    ctx.beginPath();
    ctx.rect(0.15, -2.4, 0.65, 2.1);
    ink(ctx, '#4a3a6a');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0.15, -2.4, 0.65, 2.1);
    ctx.clip();
    stoneCourses(ctx, 0.15, -2.4, 0.65, 2.1, 12, '#4a3a6a', 131);
    ctx.restore();
    window_(ctx, 0.37, -1.5, 0.2, 0.3, true, true);
    window_(ctx, 0.37, -2.1, 0.2, 0.28, true, true);
    ctx.beginPath();
    ctx.moveTo(0.05, -2.4);
    ctx.lineTo(0.48, -3.3);
    ctx.lineTo(0.9, -2.4);
    ctx.closePath();
    ink(ctx, '#6a3fb0');
    ctx.fillStyle = '#f2c14e';
    for (const [x, y] of [[0.4, -2.65], [0.55, -2.85], [0.48, -3.05]]) { ellipse(ctx, x, y, 0.025, 0.025); ctx.fill(); }
    tiledRoof(ctx, -0.35, -1.05, 1.2, 0.4, 0.5, '#6a3fb0', 3, 132);
    door(ctx, -0.5, -0.85, 0.3, 0.55, '#2a1a4a');
    // посох в стойке
    ctx.save(); ctx.translate(-0.95, -0.35); ctx.scale(0.7, 0.7); staff(ctx, 'frostStaff', 3, 0.3, 0); ctx.restore();
    evoMarks(ctx, info, -0.8, -1.4);
  },
  anim(ctx, info, t) {
    // летающие книги
    for (let i = 0; i < 2; i++) {
      const a = t * 1.2 + i * Math.PI;
      const x = 0.48 + Math.cos(a) * 0.6;
      const y = -2.9 + Math.sin(a) * 0.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 2 + i) * 0.2);
      poly(ctx, [[-0.1, 0], [0, -0.04], [0.1, 0], [0.1, 0.1], [0, 0.06], [-0.1, 0.1]]);
      ink(ctx, i ? '#c93a3a' : '#3f8fff', 0.02);
      ctx.restore();
    }
    glowSpot(ctx, 0.48, -3.4, 0.4, '190,120,255', 0.35 + Math.sin(t * 3) * 0.1);
  },
};

ART.armory = {
  bounds: [-1.2, -2.8, 1.2, 0.2],
  static(ctx, info) {
    hall(ctx, info, 'stone', '#6a6a7a', '#4a4a5a', 141);
    door(ctx, -0.2, -1.0, 0.4, 0.7, '#3a2414');
    window_(ctx, -0.65, -1.0, 0.2, 0.25, true, true);
    // щит-эмблема
    ctx.save();
    ctx.translate(0, -1.45);
    ctx.scale(0.7, 0.7);
    shield(ctx);
    ctx.restore();
    // манекен в доспехе
    ctx.beginPath();
    ctx.rect(0.72, -0.65, 0.05, 0.4);
    ink(ctx, '#6b3d1f', 0.02);
    ctx.beginPath();
    ctx.ellipse(0.745, -0.82, 0.16, 0.2, 0, 0, Math.PI * 2);
    ink(ctx, '#c9ced8');
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ellipse(ctx, 0.7, -0.88, 0.05, 0.08);
    ctx.fill();
    ellipse(ctx, 0.745, -1.07, 0.08, 0.08);
    ink(ctx, '#aab2c0', 0.025);
    // кольца и амулет на подставке
    ctx.beginPath();
    ctx.rect(-0.98, -0.42, 0.26, 0.2);
    ink(ctx, '#6b3d1f', 0.02);
    ellipse(ctx, -0.85, -0.47, 0.05, 0.05);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    evoMarks(ctx, info, 0.85, -1.9);
  },
  anim(ctx, info, t) {
    glowSpot(ctx, -0.85, -0.47, 0.15, '255,220,120', 0.3 + Math.sin(t * 3) * 0.15);
  },
};

ART.trainingHall = {
  bounds: [-1.2, -2.8, 1.2, 0.2],
  static(ctx, info) {
    foundation(ctx, 2, 2, '#3e3a30');
    wallBox(ctx, -0.85, -0.3, 1.7, 0.85, 'timber', '#e8dcc0', 151);
    // изогнутая крыша
    ctx.beginPath();
    ctx.moveTo(-1.05, -1.1);
    ctx.quadraticCurveTo(-0.6, -1.25, -0.5, -1.8);
    ctx.lineTo(0.5, -1.8);
    ctx.quadraticCurveTo(0.6, -1.25, 1.05, -1.1);
    ctx.closePath();
    ink(ctx, '#b03a3a');
    ctx.beginPath();
    ctx.rect(-0.55, -1.88, 1.1, 0.1);
    ink(ctx, '#3a2414', 0.025);
    door(ctx, -0.22, -0.95, 0.44, 0.65, '#5a3218');
    // гиря и чучело
    ellipse(ctx, -0.7, -0.22, 0.12, 0.1);
    ink(ctx, '#3a3a44', 0.025);
    ctx.beginPath();
    ctx.rect(0.8, -0.8, 0.05, 0.6);
    ink(ctx, '#6b3d1f', 0.02);
    ellipse(ctx, 0.825, -0.8, 0.13, 0.16);
    ink(ctx, '#c9a06a', 0.025);
    ctx.strokeStyle = '#d93a3a';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(0.825, -0.8, 0.07, 0, Math.PI * 2);
    ctx.stroke();
    banner(ctx, -0.55, -1.15, 0.2, 0.42, '#b03a3a', '#f2c14e');
    banner(ctx, 0.55, -1.15, 0.2, 0.42, '#b03a3a', '#f2c14e');
    evoMarks(ctx, info, 0.0, -2.2);
  },
};

// Руины на месте разрушенной постройки.
export function rubble(ctx, size, t) {
  const w = size * 0.8;
  for (let i = 0; i < 6 + size * 3; i++) {
    const x = (((i * 37) % 17) / 17 - 0.5) * w;
    const y = -0.1 - (((i * 23) % 11) / 11) * 0.35 * size;
    poly(ctx, [[x - 0.1, y + 0.05], [x - 0.05, y - 0.08], [x + 0.08, y - 0.06], [x + 0.11, y + 0.05]]);
    ink(ctx, i % 3 ? '#5a5f70' : '#7a5a3a', 0.03);
  }
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(-w * 0.2 + i * w * 0.35, -0.3 - i * 0.1);
    ctx.rotate(-0.5 + i);
    ctx.beginPath();
    ctx.rect(-0.3, -0.04, 0.6, 0.08);
    ink(ctx, '#8a5a32', 0.025);
    ctx.restore();
  }
  smoke(ctx, 0, -0.4, t, 3);
}
