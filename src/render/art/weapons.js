// Оружие и инструменты. Рукоять в начале координат, клинок вверх (−y). Цвет и сияние зависят от тира.
import { OUTLINE, ink, ellipse, poly, glow as glowSoft } from './common.js';

export const METAL = [null, '#a87a4a', '#b9c0cc', '#d6dce6', '#eef4ff', '#8ff5e6', '#ffb0f0', '#ffe9a0'];
export const METAL_SHADE = [null, '#7a5530', '#8a92a2', '#a2aab8', '#b8c4dc', '#4fc8b8', '#d070c8', '#e0b040'];
export const GEM = [null, '#7a4524', '#c94a3a', '#3fd66a', '#3f8fff', '#b05aff', '#ff7a3c', '#fff6c0'];
export const GLOW = [null, null, null, null, 'rgba(160,200,255,0.35)', 'rgba(110,255,230,0.45)', 'rgba(255,120,240,0.5)', 'rgba(255,220,120,0.6)'];

const GLOW_RGB = [null, null, null, null, '160,200,255', '110,255,230', '255,120,240', '255,220,120'];
function glow(ctx, x, y, r, tier) {
  if (GLOW_RGB[tier]) glowSoft(ctx, x, y, r, GLOW_RGB[tier], 0.55);
}

function gem(ctx, x, y, r, tier) {
  poly(ctx, [[x, y - r], [x + r * 0.8, y], [x, y + r], [x - r * 0.8, y]]);
  ink(ctx, GEM[tier] || '#3f8fff', 0.018);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  poly(ctx, [[x, y - r * 0.7], [x + r * 0.3, y - r * 0.1], [x - r * 0.1, y - r * 0.1]]);
  ctx.fill();
}

export function sword(ctx, tier = 1, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  const len = 0.5 + tier * 0.025;
  const w = tier >= 6 ? 0.065 : 0.05;
  glow(ctx, 0, -len * 0.6, len * 0.75, tier);
  if (tier === 1) {
    // деревянный меч
    poly(ctx, [[-w, -0.06], [-w, -len], [0, -len - 0.08], [w, -len], [w, -0.06]]);
    ink(ctx, METAL[1], 0.035);
    ctx.strokeStyle = METAL_SHADE[1];
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(-0.01, -0.1); ctx.lineTo(-0.02, -len + 0.05);
    ctx.moveTo(0.02, -0.2); ctx.lineTo(0.025, -len * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-0.12, -0.09, 0.24, 0.05);
    ink(ctx, '#6b3d1f', 0.025);
  } else {
    const flame = tier >= 6;
    ctx.beginPath();
    ctx.moveTo(-w, -0.06);
    if (flame) { ctx.lineTo(-w - 0.02, -len * 0.5); ctx.lineTo(-w + 0.01, -len * 0.65); ctx.lineTo(-w - 0.015, -len * 0.82); }
    ctx.lineTo(-w, -len);
    ctx.lineTo(0, -len - 0.12);
    ctx.lineTo(w, -len);
    if (flame) { ctx.lineTo(w + 0.015, -len * 0.82); ctx.lineTo(w - 0.01, -len * 0.65); ctx.lineTo(w + 0.02, -len * 0.5); }
    ctx.lineTo(w, -0.06);
    ctx.closePath();
    ink(ctx, METAL[tier], 0.035);
    poly(ctx, [[0, -0.08], [0, -len - 0.09], [w, -len], [w * 0.85, -0.08]]);
    ctx.fillStyle = METAL_SHADE[tier];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -0.12); ctx.lineTo(-w * 0.5, -len + 0.02);
    ctx.stroke();
    if (tier >= 4) {
      // руны
      ctx.fillStyle = tier >= 5 ? '#ffffff' : '#7fb0ff';
      for (let i = 0; i < 3; i++) ctx.fillRect(-0.008, -0.16 - i * 0.1, 0.016, 0.04);
    }
    // гарда
    ctx.beginPath();
    ctx.moveTo(-0.17 - tier * 0.01, -0.09);
    ctx.quadraticCurveTo(0, -0.02, 0.17 + tier * 0.01, -0.09);
    ctx.lineTo(0.15, -0.03);
    ctx.quadraticCurveTo(0, 0.02, -0.15, -0.03);
    ctx.closePath();
    ink(ctx, tier >= 4 ? '#f2c14e' : '#8a7a6a', 0.03);
    if (tier >= 7) {
      for (const sx of [-1, 1]) { poly(ctx, [[sx * 0.15, -0.08], [sx * 0.26, -0.18], [sx * 0.2, -0.05]]); ink(ctx, '#f2c14e', 0.02); }
    }
    gem(ctx, 0, -0.055, 0.04, tier);
  }
  ctx.beginPath();
  ctx.rect(-0.03, -0.02, 0.06, 0.15);
  ink(ctx, '#6b3d1f', 0.03);
  ctx.strokeStyle = '#a8653a';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  for (let y = 0; y < 0.12; y += 0.035) { ctx.moveTo(-0.03, y); ctx.lineTo(0.03, y + 0.02); }
  ctx.stroke();
  ellipse(ctx, 0, 0.16, 0.045, 0.045);
  ink(ctx, tier >= 3 ? '#f2c14e' : '#8a7a6a', 0.03);
  if (tier >= 2) { ellipse(ctx, 0, 0.16, 0.02, 0.02); ctx.fillStyle = GEM[tier]; ctx.fill(); }
  ctx.restore();
}

export function mace(ctx, tier = 2, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  glow(ctx, 0, -0.45, 0.35, tier);
  ctx.beginPath();
  ctx.rect(-0.028, -0.32, 0.056, 0.48);
  ink(ctx, tier <= 2 ? '#6b3d1f' : '#4a3a3a', 0.03);
  ctx.beginPath();
  ctx.rect(-0.04, 0.0, 0.08, 0.13);
  ink(ctx, '#8a5a32', 0.025);
  if (tier <= 2) {
    // окованная дубина
    ctx.beginPath();
    ctx.moveTo(-0.07, -0.3);
    ctx.quadraticCurveTo(-0.12, -0.55, -0.02, -0.62);
    ctx.quadraticCurveTo(0.12, -0.6, 0.09, -0.3);
    ctx.closePath();
    ink(ctx, '#8a5a32', 0.035);
    ctx.fillStyle = '#c9ced8';
    for (const [x, y] of [[-0.07, -0.45], [0.07, -0.42], [0.0, -0.55], [-0.02, -0.36]]) { poly(ctx, [[x - 0.025, y], [x, y - 0.05], [x + 0.025, y]]); ctx.fill(); ctx.lineWidth = 0.012; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
  } else if (tier >= 5) {
    // боевой молот
    ctx.beginPath();
    ctx.rect(-0.2, -0.56, 0.4, 0.2);
    ink(ctx, METAL[tier], 0.035);
    ctx.fillStyle = METAL_SHADE[tier];
    ctx.fillRect(0.02, -0.54, 0.16, 0.16);
    ctx.beginPath();
    ctx.rect(-0.24, -0.53, 0.06, 0.14);
    ink(ctx, '#f2c14e', 0.02);
    ctx.beginPath();
    ctx.rect(0.18, -0.53, 0.06, 0.14);
    ink(ctx, '#f2c14e', 0.02);
    gem(ctx, 0, -0.46, 0.045, tier);
  } else {
    // булава / моргенштерн
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 ? 0.11 : tier >= 4 ? 0.19 : 0.15;
      ctx.lineTo(Math.cos(a) * r, -0.43 + Math.sin(a) * r);
    }
    ctx.closePath();
    ink(ctx, METAL[tier], 0.03);
    ellipse(ctx, 0, -0.43, 0.09, 0.09);
    ink(ctx, METAL_SHADE[tier], 0.02);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ellipse(ctx, -0.03, -0.46, 0.03, 0.02);
    ctx.fill();
  }
  ctx.restore();
}

export function dagger(ctx, tier = 2, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  glow(ctx, 0, -0.22, 0.22, tier);
  ctx.beginPath();
  ctx.moveTo(-0.04, -0.05);
  ctx.quadraticCurveTo(-0.06, -0.2, 0, -0.38);
  ctx.quadraticCurveTo(0.05, -0.2, 0.04, -0.05);
  ctx.closePath();
  ink(ctx, METAL[tier], 0.03);
  poly(ctx, [[0, -0.07], [0, -0.36], [0.04, -0.07]]);
  ctx.fillStyle = METAL_SHADE[tier];
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-0.1, -0.07, 0.2, 0.04);
  ink(ctx, tier >= 4 ? '#f2c14e' : '#7a6a5a', 0.02);
  ctx.beginPath();
  ctx.rect(-0.025, -0.03, 0.05, 0.11);
  ink(ctx, '#3a2a1a', 0.025);
  ellipse(ctx, 0, 0.1, 0.03, 0.03);
  ink(ctx, GEM[tier], 0.02);
  ctx.restore();
}

export function scythe(ctx, tier = 2, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  glow(ctx, 0.15, -0.6, 0.4, tier);
  ctx.beginPath();
  ctx.moveTo(0, 0.2);
  ctx.quadraticCurveTo(0.04, -0.3, -0.02, -0.72);
  ctx.lineWidth = 0.075;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.04;
  ctx.strokeStyle = tier >= 5 ? '#3a2a4a' : '#6b3d1f';
  ctx.stroke();
  // лезвие
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.7);
  ctx.quadraticCurveTo(0.35, -0.82, 0.52, -0.5 - tier * 0.01);
  ctx.quadraticCurveTo(0.3, -0.64, 0.0, -0.6);
  ctx.closePath();
  ink(ctx, METAL[tier], 0.035);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0.05, -0.73);
  ctx.quadraticCurveTo(0.3, -0.78, 0.46, -0.54);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-0.05, -0.04, 0.1, 0.05);
  ink(ctx, '#f2c14e', 0.02);
  if (tier >= 4) gem(ctx, -0.01, -0.66, 0.035, tier);
  ctx.restore();
}

export function halberd(ctx, tier = 2, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  glow(ctx, 0, -0.75, 0.35, tier);
  ctx.beginPath();
  ctx.rect(-0.025, -0.78, 0.05, 1.0);
  ink(ctx, '#6b3d1f', 0.03);
  for (const y of [-0.1, 0.1]) { ctx.beginPath(); ctx.rect(-0.035, y, 0.07, 0.03); ink(ctx, '#f2c14e', 0.015); }
  // наконечник
  poly(ctx, [[-0.04, -0.78], [0, -1.0], [0.04, -0.78]]);
  ink(ctx, METAL[tier], 0.03);
  if (tier >= 3) {
    // топорище
    ctx.beginPath();
    ctx.moveTo(0.02, -0.76);
    ctx.quadraticCurveTo(0.3, -0.8, 0.28, -0.56);
    ctx.quadraticCurveTo(0.16, -0.62, 0.02, -0.58);
    ctx.closePath();
    ink(ctx, METAL[tier], 0.03);
    poly(ctx, [[-0.02, -0.72], [-0.14, -0.66], [-0.02, -0.62]]);
    ink(ctx, METAL_SHADE[tier], 0.025);
  } else {
    // рогатина
    ctx.beginPath();
    ctx.rect(-0.1, -0.78, 0.2, 0.03);
    ink(ctx, '#8a7a6a', 0.02);
  }
  if (tier >= 4) gem(ctx, 0, -0.7, 0.03, tier);
  ctx.restore();
}

export function bow(ctx, tier = 1, pull = 0, s = 1) {
  // цель — по +x: дуга выгнута вперёд, тетива ближе к стрелку и при натяжении уходит назад
  ctx.save();
  ctx.scale(s, s);
  glow(ctx, 0.1, 0, 0.4, tier);
  const sx = -0.04 - pull * 0.18; // где тетива
  ctx.beginPath();
  ctx.moveTo(-0.04, -0.36);
  ctx.lineTo(sx, 0);
  ctx.lineTo(-0.04, 0.36);
  ctx.strokeStyle = tier >= 5 ? '#bff6ff' : '#e8c766';
  ctx.lineWidth = 0.014;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.05, -0.38);
  ctx.bezierCurveTo(0.14, -0.3, 0.1, -0.08, 0.13, 0);
  ctx.bezierCurveTo(0.1, 0.08, 0.14, 0.3, -0.05, 0.38);
  ctx.lineWidth = 0.1;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.055;
  ctx.strokeStyle = tier >= 4 ? METAL[tier] : tier >= 2 ? '#7a4524' : '#a07848';
  ctx.stroke();
  for (const sy of [-1, 1]) {
    poly(ctx, [[-0.06, sy * 0.4], [0.0, sy * 0.3], [0.05, sy * 0.33]]);
    ink(ctx, tier >= 2 ? '#f2c14e' : '#8a6a4a', 0.022);
  }
  if (tier >= 2) gem(ctx, 0.13, 0, 0.05, tier);
  if (pull > 0.05) {
    ctx.save();
    ctx.translate(sx, 0);
    arrow(ctx, 0.75, tier);
    ctx.restore();
  }
  ctx.restore();
}

export function crossbow(ctx, tier = 3, pull = 0, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  glow(ctx, 0.1, 0, 0.35, tier);
  // ложа
  ctx.beginPath();
  ctx.rect(-0.25, -0.04, 0.55, 0.08);
  ink(ctx, '#6b3d1f', 0.03);
  ctx.beginPath();
  ctx.rect(-0.3, -0.05, 0.12, 0.12);
  ink(ctx, '#5a3218', 0.025);
  // дуга
  ctx.beginPath();
  ctx.moveTo(0.26, -0.3);
  ctx.quadraticCurveTo(0.14, 0, 0.26, 0.3);
  ctx.lineWidth = 0.09;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = METAL[tier];
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.26, -0.3);
  ctx.lineTo(0.12 - (1 - pull) * 0.1, 0);
  ctx.lineTo(0.26, 0.3);
  ctx.strokeStyle = '#e8c766';
  ctx.lineWidth = 0.014;
  ctx.stroke();
  if (pull < 0.5) { ctx.save(); ctx.translate(-0.1, 0); bolt(ctx, 0.7, tier); ctx.restore(); }
  gem(ctx, 0.0, 0, 0.035, tier);
  ctx.restore();
}

export function staff(ctx, kind = 'fireStaff', tier = 2, glowK = 0, t = 0, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  const color = kind === 'frostStaff' ? '#9fe8ff' : kind === 'lightningStaff' ? '#fff27a' : '#ffb347';
  const halo = kind === 'frostStaff' ? '120,220,255' : kind === 'lightningStaff' ? '255,240,120' : '255,140,40';
  ctx.beginPath();
  ctx.moveTo(-0.025, 0.3);
  ctx.lineTo(-0.03, -0.42);
  ctx.lineTo(0.03, -0.42);
  ctx.lineTo(0.025, 0.3);
  ctx.closePath();
  ink(ctx, tier >= 5 ? '#3a2a4a' : '#7a4524', 0.03);
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  for (let y = -0.3; y < 0.2; y += 0.12) { ctx.moveTo(-0.03, y); ctx.lineTo(0.03, y + 0.05); }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.09, -0.4);
  ctx.quadraticCurveTo(-0.14 - tier * 0.01, -0.56, -0.04, -0.68);
  ctx.moveTo(0.09, -0.4);
  ctx.quadraticCurveTo(0.14 + tier * 0.01, -0.56, 0.04, -0.68);
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = tier >= 4 ? METAL[tier] : '#f2c14e';
  ctx.stroke();
  const r = 0.08 + tier * 0.005 + glowK * 0.03 + Math.sin(t * 6) * 0.006;
  glowSoft(ctx, 0, -0.54, r * 2.6, halo, 0.55 + glowK * 0.3);
  if (kind === 'frostStaff') {
    poly(ctx, [[0, -0.54 - r * 1.3], [r * 0.8, -0.54], [0, -0.54 + r * 1.1], [-r * 0.8, -0.54]]);
    ink(ctx, color, 0.025);
  } else if (kind === 'lightningStaff') {
    ellipse(ctx, 0, -0.54, r, r);
    ink(ctx, color, 0.025);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(-0.02, -0.6); ctx.lineTo(0.02, -0.55); ctx.lineTo(-0.01, -0.52); ctx.lineTo(0.03, -0.47);
    ctx.stroke();
  } else {
    ellipse(ctx, 0, -0.54, r, r);
    ink(ctx, color, 0.025);
  }
  ctx.fillStyle = '#fffbe8';
  ellipse(ctx, -0.02, -0.56, r * 0.4, r * 0.4);
  ctx.fill();
  ctx.restore();
}

export function arrow(ctx, s = 1, tier = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, -0.016, 0.5, 0.032);
  ink(ctx, '#7a4524', 0.02);
  for (const sy of [-1, 1]) {
    poly(ctx, [[0.02, 0], [-0.02, sy * 0.07], [0.1, sy * 0.06], [0.14, 0]]);
    ink(ctx, tier >= 5 ? '#c07aff' : '#2f9df2', 0.018);
  }
  ctx.beginPath();
  ctx.rect(0.13, -0.022, 0.03, 0.044);
  ink(ctx, '#f2c14e', 0.012);
  poly(ctx, [[0.48, -0.05], [0.6, 0], [0.48, 0.05]]);
  ink(ctx, METAL[Math.max(2, tier)], 0.02);
  ctx.restore();
}

export function bolt(ctx, s = 1, tier = 3) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, -0.022, 0.42, 0.044);
  ink(ctx, '#5a3218', 0.02);
  poly(ctx, [[0.4, -0.06], [0.56, 0], [0.4, 0.06]]);
  ink(ctx, METAL[Math.max(2, tier)], 0.02);
  for (const sy of [-1, 1]) { poly(ctx, [[0.0, 0], [0.0, sy * 0.06], [0.08, 0]]); ink(ctx, '#c9ced8', 0.015); }
  ctx.restore();
}

export function hammer(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.022, -0.2, 0.044, 0.38);
  ink(ctx, '#8a5a32', 0.025);
  ctx.beginPath();
  ctx.rect(-0.12, -0.3, 0.24, 0.12);
  ink(ctx, '#9aa5b8', 0.03);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(-0.1, -0.28, 0.08, 0.03);
  ctx.restore();
}

export function axe(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.022, -0.3, 0.044, 0.5);
  ink(ctx, '#8a5a32', 0.025);
  ctx.beginPath();
  ctx.moveTo(0.02, -0.3);
  ctx.quadraticCurveTo(0.2, -0.34, 0.2, -0.16);
  ctx.quadraticCurveTo(0.12, -0.2, 0.02, -0.18);
  ctx.closePath();
  ink(ctx, '#c9ced8', 0.025);
  ctx.restore();
}

export function pickaxe(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.022, -0.3, 0.044, 0.5);
  ink(ctx, '#8a5a32', 0.025);
  ctx.beginPath();
  ctx.moveTo(-0.24, -0.22);
  ctx.quadraticCurveTo(0, -0.38, 0.24, -0.22);
  ctx.quadraticCurveTo(0, -0.32, -0.24, -0.22);
  ctx.lineWidth = 0.08;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = '#9aa5b8';
  ctx.stroke();
  ctx.restore();
}

export function shield(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-0.22, -0.3);
  ctx.lineTo(0.22, -0.3);
  ctx.lineTo(0.22, 0.05);
  ctx.quadraticCurveTo(0.2, 0.25, 0, 0.36);
  ctx.quadraticCurveTo(-0.2, 0.25, -0.22, 0.05);
  ctx.closePath();
  ink(ctx, '#646b78', 0.04);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#4b515c';
  ctx.fillRect(0, -0.4, 0.3, 0.8);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-0.22, -0.3);
  ctx.lineTo(0.22, -0.3);
  ctx.lineTo(0.22, 0.05);
  ctx.quadraticCurveTo(0.2, 0.25, 0, 0.36);
  ctx.quadraticCurveTo(-0.2, 0.25, -0.22, 0.05);
  ctx.closePath();
  ctx.strokeStyle = '#b08a3a';
  ctx.lineWidth = 0.04;
  ctx.stroke();
  // череп-эмблема
  ellipse(ctx, 0, -0.04, 0.08, 0.07);
  ink(ctx, '#e8dcc0', 0.02);
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, -0.03, -0.05, 0.02, 0.02);
  ctx.fill();
  ellipse(ctx, 0.03, -0.05, 0.02, 0.02);
  ctx.fill();
  ctx.restore();
}

export function greatsword(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  poly(ctx, [[-0.07, -0.08], [-0.07, -0.78], [0, -0.92], [0.07, -0.78], [0.07, -0.08]]);
  ink(ctx, '#3a3a48', 0.035);
  ctx.strokeStyle = '#b02a2a';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(0, -0.12); ctx.lineTo(0, -0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-0.2, -0.11, 0.4, 0.06);
  ink(ctx, '#2a2a34', 0.025);
  ctx.beginPath();
  ctx.rect(-0.03, -0.05, 0.06, 0.2);
  ink(ctx, '#3a2a1a', 0.025);
  ctx.restore();
}

export function skullStaff(ctx, color = '#5aff8a', s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.025, -0.45, 0.05, 0.75);
  ink(ctx, '#3a2a1a', 0.025);
  ellipse(ctx, 0, -0.55, 0.11, 0.1);
  ink(ctx, '#e8e0c8', 0.03);
  ctx.fillStyle = color;
  ellipse(ctx, -0.04, -0.56, 0.025, 0.025);
  ctx.fill();
  ellipse(ctx, 0.04, -0.56, 0.025, 0.025);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color.replace('#', '#') + '';
  ctx.globalAlpha *= 0.25;
  ellipse(ctx, 0, -0.55, 0.2, 0.2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function boneBow(ctx, pull = 0) {
  ctx.beginPath();
  ctx.moveTo(0.04, -0.3);
  ctx.lineTo(0.04 - pull * 0.12, 0);
  ctx.lineTo(0.04, 0.3);
  ctx.strokeStyle = '#c9b48a';
  ctx.lineWidth = 0.012;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.05, -0.32);
  ctx.quadraticCurveTo(-0.18, 0, 0.05, 0.32);
  ctx.lineWidth = 0.085;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = '#efe3c8';
  ctx.stroke();
}

// Рисует предмет по описанию из data/items.js (для иконок и в руках героя).
export function drawItem(ctx, item, opts = {}) {
  const tier = item.tier || 1;
  switch (item.wtype) {
    case 'sword': return sword(ctx, tier, opts.s);
    case 'mace': return mace(ctx, tier, opts.s);
    case 'daggers': return dagger(ctx, tier, opts.s);
    case 'scythe': return scythe(ctx, tier, opts.s);
    case 'halberd': return halberd(ctx, tier, opts.s);
    case 'bow': return bow(ctx, tier, opts.pull || 0, opts.s);
    case 'crossbow': return crossbow(ctx, tier, opts.pull || 0, opts.s);
    case 'fireStaff':
    case 'frostStaff':
    case 'lightningStaff': return staff(ctx, item.wtype, tier, opts.glow || 0, opts.t || 0, opts.s);
    default: return null;
  }
}
