// Иконки интерфейса. Нарисованы теми же функциями, что и игра, и закэшированы как картинки.
import { OUTLINE, ink, ellipse, poly } from '../render/art/common.js';
import { PALETTES, LOOKS, drawHead } from '../render/art/characters.js';
import { ART, wallArt } from '../render/art/buildings.js';
import { drawItem, GEM, METAL } from '../render/art/weapons.js';
import { BUILDINGS, ITEMS, ENEMIES } from '../data/index.js';

const cache = new Map();

function render(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  const dpr = 2;
  c.width = w * dpr;
  c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  try { draw(ctx); } catch (e) { console.warn('icon', key, e); }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

const RES_DRAW = {
  wood(ctx) {
    ctx.rotate(-0.4);
    ctx.beginPath(); ctx.rect(-0.38, -0.16, 0.7, 0.32); ink(ctx, '#9a6234', 0.08);
    ellipse(ctx, 0.32, 0, 0.1, 0.16); ink(ctx, '#e0b07a', 0.08);
  },
  planks(ctx) { for (const y of [-0.22, 0.02]) { ctx.beginPath(); ctx.rect(-0.4, y, 0.8, 0.2); ink(ctx, '#e6c27a', 0.08); } },
  stone(ctx) { poly(ctx, [[-0.38, 0.25], [-0.3, -0.15], [0, -0.35], [0.35, -0.1], [0.38, 0.25]]); ink(ctx, '#a9b0bd', 0.08); },
  bricks(ctx) {
    for (const [x, y] of [[-0.38, 0.02], [0.02, 0.02], [-0.18, -0.22]]) { ctx.beginPath(); ctx.rect(x, y, 0.36, 0.2); ink(ctx, '#9aa3b5', 0.07); }
  },
  bones(ctx) {
    ctx.rotate(0.6);
    ctx.beginPath(); ctx.rect(-0.3, -0.06, 0.6, 0.12); ink(ctx, '#efe3c8', 0.07);
    for (const x of [-0.32, 0.32]) for (const y of [-0.08, 0.08]) { ellipse(ctx, x, y, 0.09, 0.09); ink(ctx, '#efe3c8', 0.07); }
  },
  ore(ctx) { poly(ctx, [[-0.38, 0.25], [-0.3, -0.15], [0, -0.35], [0.35, -0.1], [0.38, 0.25]]); ink(ctx, '#6a6070', 0.08); for (const [x, y] of [[-0.12, -0.05], [0.12, 0.08], [0.05, -0.2]]) { ellipse(ctx, x, y, 0.07, 0.06); ink(ctx, '#c0703a', 0.04); } },
  coal(ctx) { for (const [x, y, r] of [[-0.15, 0.05, 0.22], [0.15, 0.1, 0.18], [0.02, -0.15, 0.16]]) { ellipse(ctx, x, y, r, r * 0.85); ink(ctx, '#3a3a44', 0.07); } },
  iron(ctx) { poly(ctx, [[-0.4, 0.2], [-0.25, -0.15], [0.25, -0.15], [0.4, 0.2]]); ink(ctx, '#c9ced8', 0.08); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-0.2, -0.1, 0.25, 0.06); },
  parts(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 0.28 : 0.38; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ink(ctx, '#d9a64a', 0.07);
    ellipse(ctx, 0, 0, 0.12, 0.12); ink(ctx, '#8a6a2a', 0.05);
  },
  crystal(ctx) { poly(ctx, [[0, -0.42], [0.2, -0.1], [0.12, 0.38], [-0.12, 0.38], [-0.2, -0.1]]); ink(ctx, '#7ff3ff', 0.08); },
  silver(ctx) { poly(ctx, [[-0.4, 0.2], [-0.25, -0.15], [0.25, -0.15], [0.4, 0.2]]); ink(ctx, '#eef4ff', 0.08); ctx.strokeStyle = '#9fb0d0'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.2, 0.05); ctx.lineTo(0.2, 0.05); ctx.stroke(); },
  essence(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -0.42); ctx.quadraticCurveTo(0.35, 0, 0.2, 0.25); ctx.quadraticCurveTo(0, 0.42, -0.2, 0.25); ctx.quadraticCurveTo(-0.35, 0, 0, -0.42);
    ink(ctx, '#b07aff', 0.08);
    ellipse(ctx, -0.06, 0.08, 0.06, 0.06); ctx.fillStyle = '#fff'; ctx.fill();
  },
  mithrilOre(ctx) { poly(ctx, [[-0.38, 0.25], [-0.3, -0.15], [0, -0.35], [0.35, -0.1], [0.38, 0.25]]); ink(ctx, '#2a3a44', 0.08); for (const [x, y] of [[-0.1, 0], [0.12, -0.12]]) { poly(ctx, [[x, y - 0.12], [x + 0.06, y], [x, y + 0.1], [x - 0.06, y]]); ink(ctx, '#9ff5e8', 0.04); } },
  mithril(ctx) { poly(ctx, [[-0.4, 0.2], [-0.25, -0.15], [0.25, -0.15], [0.4, 0.2]]); ink(ctx, '#9ff5e8', 0.08); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-0.2, -0.1, 0.25, 0.06); },
  starmetal(ctx) {
    poly(ctx, [[0, -0.42], [0.1, -0.12], [0.4, -0.1], [0.16, 0.1], [0.25, 0.4], [0, 0.22], [-0.25, 0.4], [-0.16, 0.1], [-0.4, -0.1], [-0.1, -0.12]]);
    ink(ctx, '#ffb0f0', 0.07);
  },
  gold(ctx) { ellipse(ctx, 0, 0, 0.36, 0.36); ink(ctx, '#ffd34d', 0.08); ellipse(ctx, 0, 0, 0.2, 0.2); ctx.strokeStyle = '#c9902a'; ctx.lineWidth = 0.06; ctx.stroke(); },
  gems(ctx) {
    poly(ctx, [[-0.32, -0.12], [-0.16, -0.32], [0.16, -0.32], [0.32, -0.12], [0, 0.38]]);
    ink(ctx, '#ff5fd2', 0.07);
    poly(ctx, [[-0.32, -0.12], [0.32, -0.12], [0, 0.38]]);
    ctx.fillStyle = '#d03aa8'; ctx.fill();
    poly(ctx, [[-0.16, -0.3], [-0.05, -0.14], [-0.22, -0.13]]); ctx.fillStyle = '#ffffff'; ctx.fill();
  },
  food(ctx) {
    ellipse(ctx, -0.05, 0.05, 0.3, 0.28); ink(ctx, '#e04a3a', 0.08);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(ctx, -0.15, -0.05, 0.08, 0.06); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.05, -0.38); ctx.stroke();
    ellipse(ctx, 0.15, -0.3, 0.12, 0.06, -0.4); ink(ctx, '#6ac04a', 0.05);
  },
  energy(ctx) {
    poly(ctx, [[0.08, -0.42], [-0.25, 0.06], [-0.02, 0.06], [-0.1, 0.42], [0.25, -0.08], [0.02, -0.08]]);
    ink(ctx, '#ffcf3a', 0.07);
  },
};

export function resIcon(res) {
  return render('res-' + res, 26, 26, (ctx) => {
    ctx.translate(13, 13);
    ctx.scale(22, 22);
    (RES_DRAW[res] || RES_DRAW.stone)(ctx);
  });
}

export function buildingIcon(type) {
  return render('b-' + type, 72, 72, (ctx) => {
    const cfg = BUILDINGS[type];
    if (cfg.wall) {
      ctx.translate(36, 58);
      ctx.scale(40, 40);
      wallArt(ctx, 1, 10, !!cfg.gate, false);
      return;
    }
    const art = ART[type];
    if (!art) return;
    const [x0, y0, x1, y1] = art.bounds;
    const k = Math.min(64 / (x1 - x0), 64 / (y1 - y0));
    ctx.translate(36, 68 - y1 * k);
    ctx.scale(k, k);
    art.static(ctx, { size: cfg.size, level: type === 'heart' ? 10 : 1, path: null, tier: 0 });
    if (art.anim) art.anim(ctx, { size: cfg.size, level: 10, path: null, tier: 0, working: true, powered: true, hpRatio: 1 }, 0.4, {});
  });
}

export function itemIcon(itemId) {
  const it = ITEMS[itemId];
  return render('i-' + itemId, 56, 56, (ctx) => {
    ctx.translate(28, 28);
    if (it.slot === 'weapon') {
      ctx.scale(58, 58);
      if (it.wtype === 'bow' || it.wtype === 'crossbow') { ctx.rotate(-0.7); drawItem(ctx, it, { s: it.wtype === 'crossbow' ? 1.2 : 1.1 }); return; }
      ctx.rotate(0.75);
      const off = { sword: 0.2, mace: 0.2, daggers: 0.12, scythe: 0.32, halberd: 0.45 }[it.wtype] ?? 0.2;
      ctx.translate(0, off);
      if (it.wtype === 'daggers') { ctx.save(); ctx.translate(-0.12, 0); drawItem(ctx, it, { s: 1.1 }); ctx.restore(); ctx.translate(0.12, 0); ctx.rotate(-0.3); }
      drawItem(ctx, it, { s: it.wtype === 'halberd' ? 0.75 : it.wtype === 'scythe' ? 0.85 : 1, glow: 0.4 });
      return;
    }
    ctx.scale(40, 40);
    const tier = it.tier;
    if (it.slot === 'armor') {
      ctx.beginPath();
      ctx.moveTo(-0.32, -0.28); ctx.lineTo(-0.12, -0.38); ctx.quadraticCurveTo(0, -0.28, 0.12, -0.38); ctx.lineTo(0.32, -0.28);
      ctx.lineTo(0.28, 0.32); ctx.quadraticCurveTo(0, 0.42, -0.28, 0.32); ctx.closePath();
      ink(ctx, tier <= 2 ? '#8a5a32' : METAL[tier], 0.06);
      if (tier >= 3) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, -0.28); ctx.lineTo(0, 0.38); ctx.stroke(); }
      for (const sx of [-1, 1]) { ellipse(ctx, sx * 0.3, -0.3, 0.12, 0.08, sx * 0.4); ink(ctx, tier <= 2 ? '#6b3d1f' : METAL[tier], 0.04); }
      ellipse(ctx, 0, 0, 0.06, 0.06); ink(ctx, GEM[tier], 0.03);
    } else if (it.slot === 'amulet') {
      ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(0, -0.15, 0.3, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
      poly(ctx, [[0, 0.02], [0.18, 0.2], [0, 0.42], [-0.18, 0.2]]);
      ink(ctx, GEM[tier], 0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; poly(ctx, [[-0.06, 0.12], [0.02, 0.06], [-0.02, 0.2]]); ctx.fill();
    } else if (it.slot === 'ring') {
      ctx.beginPath(); ctx.ellipse(0, 0.08, 0.28, 0.24, 0, 0, Math.PI * 2);
      ctx.lineWidth = 0.16; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.lineWidth = 0.09; ctx.strokeStyle = tier >= 4 ? METAL[tier] : '#f2c14e'; ctx.stroke();
      poly(ctx, [[0, -0.36], [0.14, -0.18], [0, -0.06], [-0.14, -0.18]]);
      ink(ctx, GEM[tier], 0.05);
    }
  });
}

export function portrait(lookId) {
  return render('p-' + lookId, 48, 48, (ctx) => {
    const look = LOOKS[lookId] || LOOKS.skeleton;
    ctx.translate(22, 27);
    const k = look.head === 'maw' || look.head === 'golem' ? 44 : look.head === 'drake' ? 40 : 52;
    ctx.scale(k, k);
    drawHead(ctx, look, PALETTES[look.pal], 0, {});
  });
}

export function enemyPortrait(type) { return portrait(ENEMIES[type].look); }

const UI_DRAW = {
  bag(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.32, -0.1); ctx.quadraticCurveTo(-0.4, 0.38, 0, 0.38); ctx.quadraticCurveTo(0.4, 0.38, 0.32, -0.1); ctx.closePath();
    ink(ctx, '#a0683a', 0.07);
    ctx.beginPath(); ctx.rect(-0.3, -0.2, 0.6, 0.14); ink(ctx, '#8a5a32', 0.06);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(0, -0.22, 0.14, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.rect(-0.07, -0.08, 0.14, 0.12); ink(ctx, '#f2c14e', 0.04);
  },
  trophy(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.26, -0.34); ctx.lineTo(0.26, -0.34); ctx.quadraticCurveTo(0.26, 0.05, 0, 0.1); ctx.quadraticCurveTo(-0.26, 0.05, -0.26, -0.34);
    ink(ctx, '#ffd34d', 0.07);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.07;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 0.28, -0.2, 0.1, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI * 1.5, sx < 0); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(-0.05, 0.08, 0.1, 0.14); ink(ctx, '#ffd34d', 0.05);
    ctx.beginPath(); ctx.rect(-0.2, 0.22, 0.4, 0.12); ink(ctx, '#8a5a32', 0.05);
  },
  scroll(ctx) {
    ctx.beginPath(); ctx.rect(-0.28, -0.3, 0.56, 0.6); ink(ctx, '#f6ead6', 0.07);
    for (const y of [-0.3, 0.3]) { ellipse(ctx, 0, y, 0.34, 0.07); ink(ctx, '#e0c9a0', 0.05); }
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 0.04; ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(-0.18, -0.12 + i * 0.12); ctx.lineTo(0.18, -0.12 + i * 0.12); }
    ctx.stroke();
  },
  hammer(ctx) {
    ctx.rotate(-0.6);
    ctx.beginPath(); ctx.rect(-0.05, -0.15, 0.1, 0.55); ink(ctx, '#8a5a32', 0.07);
    ctx.beginPath(); ctx.rect(-0.3, -0.38, 0.6, 0.24); ink(ctx, '#9aa5b8', 0.07);
  },
  menu(ctx) { ctx.strokeStyle = '#f6ecd8'; ctx.lineWidth = 0.1; ctx.beginPath(); for (const y of [-0.22, 0, 0.22]) { ctx.moveTo(-0.28, y); ctx.lineTo(0.28, y); } ctx.stroke(); },
  soundOn(ctx) {
    poly(ctx, [[-0.35, -0.12], [-0.15, -0.12], [0.08, -0.32], [0.08, 0.32], [-0.15, 0.12], [-0.35, 0.12]]); ink(ctx, '#f6ecd8', 0.06);
    ctx.strokeStyle = '#f6ecd8'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(0.1, 0, 0.18, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(0.1, 0, 0.32, -0.9, 0.9); ctx.stroke();
  },
  soundOff(ctx) {
    poly(ctx, [[-0.35, -0.12], [-0.15, -0.12], [0.08, -0.32], [0.08, 0.32], [-0.15, 0.12], [-0.35, 0.12]]); ink(ctx, '#8a8098', 0.06);
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0.18, -0.15); ctx.lineTo(0.38, 0.15); ctx.moveTo(0.38, -0.15); ctx.lineTo(0.18, 0.15); ctx.stroke();
  },
  shop(ctx) { RES_DRAW.gems(ctx); },
  swords(ctx) {
    for (const r of [-0.7, 0.7]) {
      ctx.save(); ctx.rotate(r);
      poly(ctx, [[-0.05, 0.1], [-0.05, -0.38], [0, -0.45], [0.05, -0.38], [0.05, 0.1]]); ink(ctx, '#d6dce6', 0.05);
      ctx.beginPath(); ctx.rect(-0.14, 0.08, 0.28, 0.06); ink(ctx, '#f2c14e', 0.04);
      ctx.restore();
    }
  },
};

export function uiIcon(name) {
  return render('ui-' + name, 36, 36, (ctx) => {
    ctx.translate(18, 18);
    ctx.scale(30, 30);
    (UI_DRAW[name] || UI_DRAW.menu)(ctx);
  });
}
