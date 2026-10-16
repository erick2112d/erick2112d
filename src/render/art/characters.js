// Персонажи: отдельные головы и тела, без рук и ног. Голова рисуется вокруг (0,0), тело — от y=0 вверх.
import { OUTLINE, ink, ellipse, poly } from './common.js';

export const PALETTES = {
  hero: { hood: '#1f6fd1', hoodShade: '#174f9a', trim: '#f2c14e', skin: '#fde6cf', blush: '#f4a68c', hair: '#7a4524', hairLight: '#a8653a', eye: '#4a2a17',
    body: '#1f6fd1', bodyShade: '#174f9a', collar: '#f6ead6', belt: '#6b3d1f', buckle: '#f2c14e', emblem: '#f2c14e' },
  swordsman: { hood: '#9aa5b8', hoodShade: '#6c778b', trim: '#f2c14e', skin: '#fde6cf', blush: '#f4a68c', hair: '#3d2a1e', hairLight: '#5c4130', eye: '#2a1a10',
    body: '#2f80d8', bodyShade: '#235fa0', collar: '#dfe6f0', belt: '#6b3d1f', buckle: '#d9dee8', emblem: '#f6ead6', plume: '#d93a3a' },
  ranger: { hood: '#2f7a3e', hoodShade: '#1f5a2c', trim: '#c9a04a', skin: '#f6d7bb', blush: '#f0a080', hair: '#c27a3a', hairLight: '#e09a5a', eye: '#2a3a12',
    body: '#3a8a4a', bodyShade: '#28683a', collar: '#e8dcc0', belt: '#5a3218', buckle: '#c9a04a', emblem: '#e8dcc0' },
  mage: { hood: '#6a3fb0', hoodShade: '#4d2a86', trim: '#f2c14e', skin: '#f6dcc4', blush: '#f0a080', hair: '#e8e8f0', hairLight: '#ffffff', eye: '#3a2a6a',
    body: '#6a3fb0', bodyShade: '#4d2a86', collar: '#f2c14e', belt: '#2a1a4a', buckle: '#7ff3ff', emblem: '#7ff3ff' },
  worker: { hood: '#b5793f', hoodShade: '#8d5a2b', trim: '#e0b060', skin: '#f6d7bb', blush: '#f0a080', hair: '#7a4524', hairLight: '#a8653a', eye: '#3a2412',
    body: '#5a7aa0', bodyShade: '#425c7c', collar: '#efe2c8', belt: '#5a3218', buckle: '#c9ccd4', emblem: '#8a5a32', apron: '#a0784a' },
  repairer: { hood: '#d0a040', hoodShade: '#a07a2a', trim: '#e0b060', skin: '#f6d7bb', blush: '#f0a080', hair: '#c27a3a', hairLight: '#e09a5a', eye: '#3a2412',
    body: '#b5793f', bodyShade: '#8d5a2b', collar: '#efe2c8', belt: '#5a3218', buckle: '#c9ccd4', emblem: '#5a3218', apron: '#6a4a2a' },

  skeleton: { hood: '#4b3366', hoodShade: '#36244b', trim: '#c99a3e', bone: '#efe3c8', boneShade: '#cbb994', eye: '#3ff0ff',
    armor: '#4a4a5a', armorShade: '#363644', cape: '#4b3366', capeShade: '#36244b', belt: '#6b3d1f', buckle: '#c99a3e' },
  hound: { bone: '#e6d9b8', boneShade: '#bfae86', eye: '#ff6a3c', fur: '#4a3a3a', furShade: '#352828', trim: '#8a6a5a' },
  brute: { hood: '#7d8696', hoodShade: '#5b6372', trim: '#c99a3e', bone: '#e8dcc0', boneShade: '#c2b28c', eye: '#ff9a3c',
    armor: '#5c6270', armorShade: '#434855', cape: '#6b2f3a', capeShade: '#4d1f28', belt: '#5a3218', buckle: '#c99a3e' },
  skelArcher: { hood: '#6b3a2a', hoodShade: '#4d281c', trim: '#c99a3e', bone: '#efe3c8', boneShade: '#cbb994', eye: '#ff5f7a',
    armor: '#4e4540', armorShade: '#3a332f', cape: '#6b3a2a', capeShade: '#4d281c', belt: '#6b3d1f', buckle: '#c99a3e' },
  shieldbearer: { hood: '#8a92a0', hoodShade: '#646b78', trim: '#b08a3a', bone: '#e8dcc0', boneShade: '#c2b28c', eye: '#7fff8a',
    armor: '#646b78', armorShade: '#4b515c', cape: '#3a4a3a', capeShade: '#2a362a', belt: '#5a3218', buckle: '#b08a3a' },
  wraith: { hood: '#3a4a6a', hoodShade: '#26324a', trim: '#7ff3ff', eye: '#9ffcff', robe: '#4a5a8a', robeShade: '#2a3456' },
  necromancer: { hood: '#1f2a1f', hoodShade: '#121a12', trim: '#5aff8a', bone: '#e6e0c8', boneShade: '#bdb592', eye: '#5aff8a',
    robe: '#2a3a2a', robeShade: '#1a261a', belt: '#4a2a14', buckle: '#5aff8a' },
  plague: { bone: '#d8dcb0', boneShade: '#a8ae82', eye: '#d0ff3a', skin: '#7a9a4a', skinShade: '#5a7a34', trim: '#c9b48a', belt: '#4a3a24' },
  bat: { fur: '#3a2a4a', furShade: '#261a32', wing: '#5a3a6a', eye: '#ff3a5a', ear: '#8a5a8a' },
  golem: { stone: '#7d8696', stoneShade: '#5b6372', moss: '#4c8a46', eye: '#ffb03a', rune: '#ffb03a' },
  witch: { hood: '#2a1a3a', hoodShade: '#1a1028', trim: '#c96aff', bone: '#e8e0d0', boneShade: '#c0b8a8', eye: '#ff7aff',
    robe: '#3a2050', robeShade: '#26143a', belt: '#5a2a14', buckle: '#c96aff' },
  deathKnight: { hood: '#2a2a34', hoodShade: '#1a1a22', trim: '#b02a2a', bone: '#e0d8c0', boneShade: '#b8ae94', eye: '#ff3a3a',
    armor: '#2e2e3a', armorShade: '#1e1e28', cape: '#6a1a1a', capeShade: '#4a1010', belt: '#3a2a1a', buckle: '#b02a2a', plume: '#b02a2a' },
  drake: { bone: '#e8dcc0', boneShade: '#bfae86', eye: '#ff7a2a', wing: '#5a3a3a', wingShade: '#3a2424', spike: '#8a7a6a' },
  devourer: { skin: '#5a2a3a', skinShade: '#3a1a26', teeth: '#f6eedc', eye: '#ffd03a', spike: '#c9b48a', gum: '#d04a6a' },
  colossus: { hood: '#2d1a40', hoodShade: '#1d102b', trim: '#f2c14e', bone: '#f3e9d2', boneShade: '#cdbd98', eye: '#ff3cf0',
    armor: '#3a3448', armorShade: '#2a2536', cape: '#5a2d7a', capeShade: '#3f1f57', belt: '#4a2a14', buckle: '#f2c14e' },
  mistQueen: { hood: '#4a3a7a', hoodShade: '#2e2452', trim: '#f2c14e', eye: '#ffffff', robe: '#6a5aa0', robeShade: '#3e3270' },
  lich: { hood: '#3a1a5a', hoodShade: '#26103e', trim: '#f2c14e', bone: '#eee4cc', boneShade: '#c8bb98', eye: '#c03cff',
    robe: '#3a1a5a', robeShade: '#26103e', belt: '#2a1a14', buckle: '#c03cff' },
  boneDragon: { bone: '#f0e6cc', boneShade: '#c8b890', eye: '#ff3cf0', wing: '#3a2a4a', wingShade: '#24182e', spike: '#a89878' },
};

// Вспышка при попадании: всё белое, глаза остаются.
const flashCache = new Map();
export function flashPalette(p) {
  if (!flashCache.has(p)) {
    const f = {};
    for (const k of Object.keys(p)) f[k] = k === 'eye' ? p[k] : '#ffffff';
    flashCache.set(p, f);
  }
  return flashCache.get(p);
}

// ---------------- тела ----------------

function eggPath(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.42, -h, w * 0.53, -h * 0.45, w * 0.5, -h * 0.2);
  ctx.bezierCurveTo(w * 0.48, -h * 0.02, w * 0.25, 0.01, 0, 0.02);
  ctx.bezierCurveTo(-w * 0.25, 0.01, -w * 0.48, -h * 0.02, -w * 0.5, -h * 0.2);
  ctx.bezierCurveTo(-w * 0.53, -h * 0.45, -w * 0.42, -h, 0, -h);
  ctx.closePath();
}

function fleur(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.35, s * 0.28, s * 0.55, 0, 0, Math.PI * 2);
  ctx.ellipse(x - s * 0.45, y - s * 0.05, s * 0.22, s * 0.38, -0.7, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.45, y - s * 0.05, s * 0.22, s * 0.38, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - s * 0.55, y + s * 0.12, s * 1.1, s * 0.16);
  ctx.fillRect(x - s * 0.1, y + s * 0.1, s * 0.2, s * 0.5);
}

const ARMOR_TINT = [null, '#9a8a6a', '#8a5a32', '#aab2c0', '#dfe6f0', '#7ff0e0', '#ff9af0', '#ffe08a'];

// Туника героя и союзников. armorTier добавляет наплечники, нагрудник и кольчугу.
export function tunicBody(ctx, p, armorTier = 0, w = 0.54, h = 0.56) {
  eggPath(ctx, w, h);
  ctx.fillStyle = p.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.bodyShade;
  ctx.beginPath();
  ctx.ellipse(w * 0.42, -h * 0.45, w * 0.22, h * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (armorTier >= 3) {
    // кольчуга
    ctx.fillStyle = armorTier >= 5 ? '#4a6a70' : '#6a707c';
    ctx.fillRect(-w, -h * 0.34, w * 2, h * 0.34);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.012;
    for (let y = -h * 0.32; y < 0; y += 0.035) {
      for (let x = -w * 0.5; x < w * 0.5; x += 0.035) { ctx.beginPath(); ctx.arc(x + ((y * 100) % 2 ? 0.017 : 0), y, 0.012, 0, Math.PI); ctx.stroke(); }
    }
  }
  ctx.fillStyle = p.trim;
  for (const sx of [-1, 1]) ctx.fillRect(sx * w * 0.33 - 0.022, -h, 0.044, h);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.018;
  for (const sx of [-1, 1]) ctx.strokeRect(sx * w * 0.33 - 0.022, -h - 0.1, 0.044, h + 0.2);
  ctx.beginPath();
  ctx.moveTo(-w, -0.05); ctx.lineTo(0, 0.03); ctx.lineTo(w, -0.05);
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = p.trim;
  ctx.stroke();
  ctx.fillStyle = p.belt;
  ctx.fillRect(-w, -h * 0.34, w * 2, 0.075);
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(-w, -h * 0.34, w * 2, 0.075);
  // подсумок
  ctx.beginPath();
  ctx.rect(w * 0.18, -h * 0.34 + 0.06, 0.09, 0.08);
  ink(ctx, p.belt, 0.015);
  ctx.restore();
  ctx.beginPath();
  ctx.rect(-0.055, -h * 0.34 - 0.015, 0.11, 0.105);
  ink(ctx, p.buckle, 0.025);
  ctx.beginPath();
  ctx.rect(-0.025, -h * 0.34 + 0.015, 0.05, 0.045);
  ink(ctx, p.belt, 0.015);
  // воротник со шнуровкой
  ctx.beginPath();
  ctx.moveTo(-0.11, -h + 0.02);
  ctx.quadraticCurveTo(0, -h + 0.08, 0.11, -h + 0.02);
  ctx.lineTo(0.05, -h + 0.17);
  ctx.lineTo(-0.05, -h + 0.17);
  ctx.closePath();
  ink(ctx, p.collar, 0.025);
  ctx.beginPath();
  ctx.moveTo(-0.03, -h + 0.07); ctx.lineTo(0.03, -h + 0.14);
  ctx.moveTo(0.03, -h + 0.07); ctx.lineTo(-0.03, -h + 0.14);
  ctx.strokeStyle = p.belt;
  ctx.lineWidth = 0.018;
  ctx.stroke();
  if (armorTier >= 4) {
    // нагрудник
    poly(ctx, [[-0.16, -h + 0.18], [0.16, -h + 0.18], [0.13, -h * 0.4], [0, -h * 0.34], [-0.13, -h * 0.4]]);
    ink(ctx, ARMOR_TINT[armorTier], 0.025);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    poly(ctx, [[-0.12, -h + 0.21], [-0.03, -h + 0.21], [-0.05, -h * 0.45], [-0.1, -h * 0.47]]);
    ctx.fill();
    fleur(ctx, 0.03, -h * 0.58, 0.06, armorTier >= 7 ? '#fff6d5' : p.emblem);
  } else fleur(ctx, 0, -h * 0.58, 0.075, p.emblem);
  if (armorTier >= 2) {
    // наплечники
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * w * 0.36, -h * 0.84, 0.11, 0.075, sx * 0.4, 0, Math.PI * 2);
      ink(ctx, ARMOR_TINT[armorTier], 0.025);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ellipse(ctx, sx * w * 0.36 - 0.03, -h * 0.87, 0.04, 0.02, sx * 0.4);
      ctx.fill();
    }
  }
  if (armorTier >= 7) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,224,138,0.25)';
    eggPath(ctx, w * 1.15, h * 1.08);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  eggPath(ctx, w, h);
  ink(ctx, null);
}

// Фартук рабочего поверх туники.
export function apronBody(ctx, p) {
  tunicBody(ctx, p, 0, 0.5, 0.5);
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.36);
  ctx.lineTo(0.15, -0.36);
  ctx.lineTo(0.19, -0.02);
  ctx.quadraticCurveTo(0, 0.04, -0.19, -0.02);
  ctx.closePath();
  ink(ctx, p.apron, 0.03);
  ctx.beginPath();
  ctx.rect(-0.07, -0.25, 0.14, 0.09);
  ink(ctx, p.belt, 0.02);
  ctx.strokeStyle = p.apron;
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(-0.13, -0.36); ctx.lineTo(-0.08, -0.5);
  ctx.moveTo(0.13, -0.36); ctx.lineTo(0.08, -0.5);
  ctx.stroke();
}

// Длинная мантия мага, некроманта, ведьмы, лича.
export function robeBody(ctx, p, w = 0.58, h = 0.6) {
  ctx.beginPath();
  ctx.moveTo(-0.16, -h);
  ctx.quadraticCurveTo(-w * 0.5, -h * 0.6, -w * 0.55, 0.01);
  ctx.lineTo(-w * 0.3, -0.03);
  ctx.lineTo(-w * 0.12, 0.03);
  ctx.lineTo(w * 0.1, -0.02);
  ctx.lineTo(w * 0.3, 0.03);
  ctx.lineTo(w * 0.55, 0.01);
  ctx.quadraticCurveTo(w * 0.5, -h * 0.6, 0.16, -h);
  ctx.closePath();
  ink(ctx, p.robe);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.robeShade;
  ctx.fillRect(0.04, -h, w, h + 0.1);
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(0, 0.05);
  ctx.stroke();
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-w, -0.02); ctx.lineTo(w, -0.02);
  ctx.stroke();
  ctx.restore();
  // кушак
  ctx.beginPath();
  ctx.rect(-0.2, -h * 0.5, 0.4, 0.07);
  ink(ctx, p.belt, 0.02);
  ctx.beginPath();
  ctx.moveTo(0.02, -h * 0.47);
  ctx.lineTo(0.08, -h * 0.2);
  ctx.lineTo(0.13, -h * 0.22);
  ctx.closePath();
  ink(ctx, p.belt, 0.02);
  ellipse(ctx, 0, -h * 0.465, 0.04, 0.04);
  ink(ctx, p.buckle, 0.018);
  // рунный воротник
  ctx.beginPath();
  ctx.moveTo(-0.17, -h + 0.02);
  ctx.quadraticCurveTo(0, -h + 0.12, 0.17, -h + 0.02);
  ctx.lineTo(0.15, -h + 0.08);
  ctx.quadraticCurveTo(0, -h + 0.18, -0.15, -h + 0.08);
  ctx.closePath();
  ink(ctx, p.trim, 0.025);
}

// Доспех скелета: панцирь, рваный плащ, рёбра, ремень.
export function armorBody(ctx, p, heavy = false, w = 0.6, h = 0.56) {
  const top = -h;
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, top + 0.12);
  const jag = [[-0.6, -0.02], [-0.42, 0.04], [-0.3, -0.03], [-0.15, 0.05], [0, -0.02], [0.15, 0.05], [0.3, -0.03], [0.42, 0.04], [0.6, -0.02]];
  for (const [x, y] of jag) ctx.lineTo(w * x, y);
  ctx.lineTo(w * 0.55, top + 0.12);
  ctx.closePath();
  ink(ctx, p.capeShade);
  eggPath(ctx, w * 0.86, h * 0.98);
  ctx.fillStyle = p.armor;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.armorShade;
  ctx.fillRect(0.02, -h, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.moveTo(-0.2, -h * 0.75); ctx.lineTo(-0.12, -h * 0.68);
  ctx.moveTo(0.18, -h * 0.25); ctx.lineTo(0.24, -h * 0.18);
  ctx.stroke();
  ctx.strokeStyle = p.bone;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.72);
  ctx.lineTo(0, -h * 0.36);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const y = -h * 0.66 + i * 0.075;
    const len = 0.15 - i * 0.02;
    ctx.beginPath();
    ctx.moveTo(-0.02, y);
    ctx.quadraticCurveTo(-len, y - 0.01, -len - 0.02, y + 0.06);
    ctx.moveTo(0.02, y);
    ctx.quadraticCurveTo(len, y - 0.01, len + 0.02, y + 0.06);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.fillStyle = p.belt;
  ctx.fillRect(-w, -h * 0.3, w * 2, 0.08);
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(-w, -h * 0.3, w * 2, 0.08);
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-w, -0.06); ctx.lineTo(-w * 0.2, -0.02); ctx.lineTo(-w * 0.2, -h * 0.22);
  ctx.stroke();
  ctx.restore();
  eggPath(ctx, w * 0.86, h * 0.98);
  ink(ctx, null);
  ctx.beginPath();
  ctx.rect(-0.05, -h * 0.3 - 0.01, 0.1, 0.1);
  ink(ctx, p.buckle, 0.022);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.06, top + 0.02);
    ctx.quadraticCurveTo(sx * w * 0.6, top - 0.02, sx * w * (heavy ? 0.66 : 0.58), top + 0.16);
    ctx.lineTo(sx * w * 0.6, top + 0.26);
    ctx.lineTo(sx * w * 0.5, top + 0.2);
    ctx.lineTo(sx * w * 0.42, top + 0.27);
    ctx.lineTo(sx * w * 0.3, top + 0.16);
    ctx.lineTo(sx * 0.06, top + 0.14);
    ctx.closePath();
    ink(ctx, p.cape);
    ctx.beginPath();
    ctx.moveTo(sx * 0.1, top + 0.03);
    ctx.quadraticCurveTo(sx * w * 0.5, top - 0.03, sx * w * (heavy ? 0.6 : 0.52), top + 0.12);
    ctx.lineTo(sx * w * 0.36, top + 0.12);
    ctx.quadraticCurveTo(sx * w * 0.3, top + 0.05, sx * 0.1, top + 0.08);
    ctx.closePath();
    ink(ctx, p.trim, 0.03);
    if (heavy) {
      // шипы на наплечниках
      poly(ctx, [[sx * w * 0.42, top + 0.04], [sx * w * 0.5, top - 0.1], [sx * w * 0.52, top + 0.06]]);
      ink(ctx, '#efe3c8', 0.02);
    }
  }
  poly(ctx, [[0, top + 0.03], [0.05, top + 0.1], [0, top + 0.18], [-0.05, top + 0.1]]);
  ink(ctx, p.trim, 0.025);
  poly(ctx, [[0, top + 0.07], [0.022, top + 0.1], [0, top + 0.14], [-0.022, top + 0.1]]);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
}

export function houndBody(ctx, p) {
  // низкое вытянутое тело с хребтом
  ctx.beginPath();
  ctx.ellipse(-0.05, -0.2, 0.36, 0.2, 0, 0, Math.PI * 2);
  ink(ctx, p.fur);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.furShade;
  ctx.fillRect(-0.5, -0.12, 1, 0.3);
  ctx.strokeStyle = p.bone;
  ctx.lineWidth = 0.03;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.2 + i * 0.09, -0.3);
    ctx.quadraticCurveTo(-0.24 + i * 0.09, -0.18, -0.18 + i * 0.09, -0.08);
    ctx.stroke();
  }
  ctx.restore();
  // хребет
  for (let i = 0; i < 5; i++) {
    poly(ctx, [[-0.3 + i * 0.12, -0.36], [-0.25 + i * 0.12, -0.48 + (i % 2) * 0.03], [-0.2 + i * 0.12, -0.36]]);
    ink(ctx, p.bone, 0.02);
  }
  // хвост
  ctx.beginPath();
  ctx.moveTo(-0.38, -0.25);
  ctx.quadraticCurveTo(-0.55, -0.4, -0.5, -0.55);
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = p.fur;
  ctx.stroke();
}

export function wispBody(ctx, p, t = 0) {
  ctx.beginPath();
  ctx.moveTo(-0.26, -0.55);
  ctx.quadraticCurveTo(-0.34, -0.2, -0.18, -0.02);
  ctx.quadraticCurveTo(-0.08, 0.06 + Math.sin(t * 5) * 0.03, 0.02, -0.06);
  ctx.quadraticCurveTo(0.12, 0.08, 0.2, -0.04);
  ctx.quadraticCurveTo(0.34, -0.2, 0.26, -0.55);
  ctx.closePath();
  ink(ctx, p.robe);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.robeShade;
  ctx.fillRect(0.05, -0.6, 0.4, 0.7);
  ctx.strokeStyle = p.trim;
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.4); ctx.quadraticCurveTo(-0.05, -0.25, -0.12, -0.1);
  ctx.moveTo(0.1, -0.45); ctx.quadraticCurveTo(0.18, -0.3, 0.1, -0.15);
  ctx.stroke();
  ctx.restore();
}

export function bloatedBody(ctx, p) {
  ellipse(ctx, 0, -0.32, 0.4, 0.34);
  ink(ctx, p.skin);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.skinShade;
  ellipse(ctx, 0.18, -0.26, 0.3, 0.34);
  ctx.fill();
  // нарывы
  ctx.fillStyle = '#c8e05a';
  for (const [x, y, r] of [[-0.18, -0.42, 0.05], [0.05, -0.18, 0.04], [-0.05, -0.5, 0.03], [0.22, -0.4, 0.035]]) {
    ellipse(ctx, x, y, r, r);
    ctx.fill();
  }
  ctx.restore();
  ellipse(ctx, 0, -0.32, 0.4, 0.34);
  ink(ctx, null);
  // швы
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.12); ctx.quadraticCurveTo(0, -0.08, 0.12, -0.14);
  for (let i = 0; i < 5; i++) { ctx.moveTo(-0.08 + i * 0.05, -0.15); ctx.lineTo(-0.07 + i * 0.05, -0.07); }
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-0.38, -0.32, 0.76, 0.06);
  ink(ctx, p.belt, 0.02);
}

export function stoneBody(ctx, p) {
  const blocks = [[-0.34, -0.62, 0.32, 0.3], [0.0, -0.66, 0.34, 0.32], [-0.38, -0.32, 0.36, 0.32], [0.0, -0.34, 0.38, 0.34]];
  blocks.forEach(([x, y, w, h], i) => {
    ctx.beginPath();
    ctx.moveTo(x + 0.04, y);
    ctx.lineTo(x + w, y + 0.02);
    ctx.lineTo(x + w - 0.02, y + h);
    ctx.lineTo(x, y + h - 0.02);
    ctx.closePath();
    ink(ctx, i % 2 ? p.stoneShade : p.stone);
  });
  ctx.fillStyle = p.moss;
  for (const [x, y] of [[-0.3, -0.62], [0.1, -0.66], [-0.36, -0.32]]) { ellipse(ctx, x + 0.08, y + 0.02, 0.09, 0.035); ctx.fill(); }
  ctx.strokeStyle = p.rune;
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(-0.05, -0.5); ctx.lineTo(0.05, -0.4); ctx.lineTo(-0.05, -0.3); ctx.lineTo(0.05, -0.2);
  ctx.stroke();
}

export function drakeBody(ctx, p, t = 0) {
  const flap = Math.sin(t * 8) * 0.12;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.1, -0.45);
    ctx.lineTo(sx * 0.6, -0.7 - flap);
    ctx.lineTo(sx * 0.68, -0.25 - flap * 0.5);
    ctx.lineTo(sx * 0.5, -0.3);
    ctx.lineTo(sx * 0.42, -0.12);
    ctx.lineTo(sx * 0.3, -0.25);
    ctx.lineTo(sx * 0.15, -0.15);
    ctx.closePath();
    ink(ctx, p.wing);
    ctx.strokeStyle = p.bone;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(sx * 0.1, -0.45);
    ctx.lineTo(sx * 0.6, -0.7 - flap);
    ctx.moveTo(sx * 0.35, -0.55 - flap * 0.5);
    ctx.lineTo(sx * 0.42, -0.12);
    ctx.stroke();
  }
  ellipse(ctx, 0, -0.3, 0.22, 0.28);
  ink(ctx, p.bone);
  ctx.strokeStyle = p.boneShade;
  ctx.lineWidth = 0.03;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.15, -0.42 + i * 0.09);
    ctx.quadraticCurveTo(0, -0.36 + i * 0.09, 0.15, -0.42 + i * 0.09);
    ctx.stroke();
  }
}

export function bulkBody(ctx, p) {
  ellipse(ctx, 0, -0.34, 0.46, 0.36);
  ink(ctx, p.skin);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.skinShade;
  ellipse(ctx, 0.2, -0.28, 0.34, 0.36);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.95 + i * 0.36;
    const x = Math.cos(a) * 0.44;
    const y = -0.34 + Math.sin(a) * 0.34;
    poly(ctx, [[x - 0.05, y + 0.03], [x + Math.cos(a) * 0.14, y + Math.sin(a) * 0.14], [x + 0.05, y + 0.03]]);
    ink(ctx, p.spike, 0.02);
  }
}

// ---------------- головы ----------------

export function hoodHead(ctx, p, opts = {}) {
  const blink = opts.blink;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.28);
  ctx.quadraticCurveTo(-0.42, -0.3, -0.5, -0.12);
  ctx.quadraticCurveTo(-0.4, -0.06, -0.28, 0.0);
  ctx.closePath();
  ink(ctx, p.hoodShade);
  ctx.beginPath();
  ctx.moveTo(-0.34, 0.24);
  ctx.bezierCurveTo(-0.42, 0.0, -0.36, -0.32, -0.02, -0.36);
  ctx.bezierCurveTo(0.3, -0.38, 0.42, -0.12, 0.4, 0.12);
  ctx.bezierCurveTo(0.39, 0.28, 0.3, 0.34, 0.1, 0.35);
  ctx.bezierCurveTo(-0.1, 0.36, -0.28, 0.33, -0.34, 0.24);
  ctx.closePath();
  ink(ctx, p.hood);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.hoodShade;
  ctx.beginPath();
  ctx.ellipse(-0.3, 0.1, 0.14, 0.4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(0.12, -0.28, 0.16, 0.05, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0.06, 0.07, 0.29, 0.28, 0, 0, Math.PI * 2);
  ink(ctx, p.trim, 0.04);
  face(ctx, p, blink, opts.shout, true, opts.grin);
}

function face(ctx, p, blink, shout, hair = true, grin = false) {
  ctx.beginPath();
  ctx.ellipse(0.07, 0.09, 0.245, 0.235, 0, 0, Math.PI * 2);
  ink(ctx, p.skin, 0.035);
  ctx.fillStyle = p.blush;
  ctx.globalAlpha *= 0.7;
  ellipse(ctx, 0.23, 0.17, 0.035, 0.022);
  ctx.fill();
  ctx.globalAlpha /= 0.7;
  if (hair) {
    ctx.beginPath();
    ctx.moveTo(-0.17, 0.12);
    const zig = [[-0.12, 0.0], [-0.06, 0.07], [0.0, -0.03], [0.07, 0.05], [0.12, -0.04], [0.2, 0.04], [0.24, -0.03], [0.32, 0.06]];
    for (const [x, y] of zig) ctx.lineTo(x, y);
    ctx.quadraticCurveTo(0.3, -0.2, 0.06, -0.19);
    ctx.quadraticCurveTo(-0.2, -0.18, -0.17, 0.12);
    ctx.closePath();
    ink(ctx, p.hair, 0.035);
    ctx.strokeStyle = p.hairLight;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.12); ctx.lineTo(0.02, -0.06);
    ctx.moveTo(0.12, -0.13); ctx.lineTo(0.17, -0.06);
    ctx.stroke();
  }
  for (const ex of [0.03, 0.18]) {
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(ex - 0.035, 0.12);
      ctx.lineTo(ex + 0.035, 0.12);
      ctx.lineWidth = 0.022;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    } else {
      ellipse(ctx, ex, 0.12, 0.034, 0.048);
      ink(ctx, p.eye, 0.018);
      ctx.fillStyle = '#fff';
      ellipse(ctx, ex + 0.012, 0.1, 0.011, 0.014);
      ctx.fill();
    }
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.025, 0.035); ctx.lineTo(0.07, 0.065);
  ctx.moveTo(0.14, 0.065); ctx.lineTo(0.235, 0.03);
  ctx.stroke();
  ctx.lineWidth = 0.018;
  if (grin) {
    // уверенная ухмылка: рот-полумесяц с зубами, правый уголок выше
    ctx.save();
    ctx.translate(0.115, 0.215);
    ctx.rotate(-0.16);
    ctx.beginPath();
    ctx.moveTo(-0.055, 0);
    ctx.quadraticCurveTo(0, 0.075, 0.06, -0.008);
    ctx.closePath();
    ctx.fillStyle = '#5a1e24';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-0.06, -0.01, 0.13, 0.022);
    ctx.restore();
    ctx.stroke();
    ctx.restore();
    ctx.lineCap = 'butt';
    return;
  }
  ctx.beginPath();
  if (shout) ctx.ellipse(0.11, 0.22, 0.03, 0.025, 0, 0, Math.PI * 2);
  else ctx.arc(0.11, 0.245, 0.03, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// Стальной шлем мечника с плюмажем.
export function helmHead(ctx, p, opts = {}) {
  face(ctx, p, opts.blink, opts.shout, false);
  ctx.beginPath();
  ctx.moveTo(-0.24, 0.12);
  ctx.bezierCurveTo(-0.3, -0.3, 0.42, -0.34, 0.36, 0.06);
  ctx.lineTo(0.3, 0.04);
  ctx.quadraticCurveTo(0.08, -0.05, -0.14, 0.06);
  ctx.lineTo(-0.12, 0.3);
  ctx.lineTo(-0.24, 0.26);
  ctx.closePath();
  ink(ctx, p.hood);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.hoodShade;
  ctx.fillRect(-0.3, -0.05, 0.16, 0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, 0.1, -0.2, 0.14, 0.04, -0.15);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.rect(0.07, -0.02, 0.04, 0.15);
  ink(ctx, p.hoodShade, 0.02);
  ctx.beginPath();
  ctx.rect(-0.22, -0.04, 0.6, 0.05);
  ink(ctx, p.trim, 0.02);
  // плюмаж
  ctx.beginPath();
  ctx.moveTo(0.02, -0.26);
  ctx.quadraticCurveTo(-0.25, -0.5, -0.45, -0.3);
  ctx.quadraticCurveTo(-0.3, -0.36, -0.1, -0.2);
  ctx.closePath();
  ink(ctx, p.plume || '#d93a3a', 0.03);
}

// Кепка с козырьком и борода — рабочие.
export function capHead(ctx, p, opts = {}) {
  face(ctx, p, opts.blink, false, false);
  ctx.beginPath();
  ctx.moveTo(-0.14, 0.18);
  ctx.quadraticCurveTo(-0.1, 0.36, 0.1, 0.36);
  ctx.quadraticCurveTo(0.3, 0.34, 0.31, 0.2);
  ctx.quadraticCurveTo(0.2, 0.26, 0.1, 0.25);
  ctx.quadraticCurveTo(-0.02, 0.26, -0.14, 0.18);
  ctx.closePath();
  ink(ctx, p.hair, 0.03);
  ctx.beginPath();
  ctx.moveTo(-0.22, 0.04);
  ctx.bezierCurveTo(-0.24, -0.3, 0.38, -0.32, 0.34, 0.02);
  ctx.closePath();
  ink(ctx, p.hood);
  ctx.beginPath();
  ctx.moveTo(0.1, 0.0);
  ctx.quadraticCurveTo(0.36, -0.04, 0.46, 0.04);
  ctx.quadraticCurveTo(0.34, 0.06, 0.1, 0.05);
  ctx.closePath();
  ink(ctx, p.hoodShade, 0.03);
  ellipse(ctx, 0.04, -0.24, 0.04, 0.03);
  ink(ctx, p.trim, 0.02);
}

// Остроконечная шляпа мага.
export function wizardHead(ctx, p, opts = {}) {
  face(ctx, p, opts.blink, opts.shout, false);
  ctx.beginPath();
  ctx.moveTo(-0.12, 0.2);
  ctx.quadraticCurveTo(0.1, 0.5, 0.32, 0.2);
  ctx.quadraticCurveTo(0.2, 0.3, 0.1, 0.28);
  ctx.quadraticCurveTo(0.0, 0.3, -0.12, 0.2);
  ctx.closePath();
  ink(ctx, p.hair, 0.03);
  ctx.beginPath();
  ctx.ellipse(0.07, 0.0, 0.42, 0.09, 0, 0, Math.PI * 2);
  ink(ctx, p.hood);
  ctx.beginPath();
  ctx.moveTo(-0.22, -0.02);
  ctx.quadraticCurveTo(-0.08, -0.35, 0.0, -0.62);
  ctx.quadraticCurveTo(-0.2, -0.62, -0.35, -0.5);
  ctx.quadraticCurveTo(0.05, -0.6, 0.1, -0.35);
  ctx.quadraticCurveTo(0.3, -0.2, 0.36, -0.02);
  ctx.closePath();
  ink(ctx, p.hood);
  ctx.beginPath();
  ctx.rect(-0.2, -0.1, 0.54, 0.07);
  ink(ctx, p.trim, 0.02);
  ctx.fillStyle = p.emblem;
  for (const [x, y] of [[0.05, -0.3], [-0.06, -0.18], [0.18, -0.2]]) {
    poly(ctx, [[x, y - 0.035], [x + 0.012, y - 0.01], [x + 0.035, y], [x + 0.012, y + 0.01], [x, y + 0.035], [x - 0.012, y + 0.01], [x - 0.035, y], [x - 0.012, y - 0.01]]);
    ctx.fill();
  }
}

// Череп: варианты капюшона, шлема, короны, шляпы.
export function skullHead(ctx, p, opts = {}) {
  const hood = opts.hood ?? (opts.helmet ? null : 'tattered');
  if (hood === 'tattered' || hood === 'tall') {
    const tall = hood === 'tall';
    ctx.beginPath();
    ctx.moveTo(-0.3, 0.3);
    ctx.lineTo(-0.36, 0.22);
    ctx.lineTo(-0.44, 0.24);
    ctx.lineTo(-0.42, 0.1);
    ctx.lineTo(-0.5, 0.02);
    if (tall) {
      ctx.quadraticCurveTo(-0.5, -0.4, -0.2, -0.62);
      ctx.quadraticCurveTo(0.05, -0.55, 0.1, -0.38);
    } else ctx.quadraticCurveTo(-0.46, -0.3, -0.1, -0.36);
    ctx.bezierCurveTo(0.22, -0.4, 0.42, -0.2, 0.42, 0.08);
    ctx.lineTo(0.4, 0.3);
    ctx.lineTo(0.33, 0.26);
    ctx.lineTo(0.3, 0.36);
    ctx.lineTo(0.22, 0.3);
    ctx.closePath();
    ink(ctx, p.hood);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = p.hoodShade;
    ellipse(ctx, -0.34, 0.06, 0.16, 0.36, 0.3);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ellipse(ctx, -0.26, -0.06, 0.025, 0.035);
    ctx.fill();
    ellipse(ctx, -0.36, 0.14, 0.018, 0.026);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0.08, 0.06, 0.29, 0.29, 0, Math.PI * 0.75, Math.PI * 2.25);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.09;
    ctx.stroke();
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 0.05;
    ctx.stroke();
  }
  // череп
  ctx.beginPath();
  ctx.moveTo(-0.14, 0.13);
  ctx.bezierCurveTo(-0.22, -0.02, -0.12, -0.22, 0.08, -0.22);
  ctx.bezierCurveTo(0.28, -0.22, 0.36, -0.05, 0.31, 0.11);
  ctx.lineTo(0.27, 0.15);
  ctx.lineTo(0.27, 0.28);
  ctx.lineTo(-0.04, 0.29);
  ctx.lineTo(-0.06, 0.18);
  ctx.closePath();
  ink(ctx, p.bone, 0.04);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.boneShade;
  ellipse(ctx, -0.1, 0.12, 0.1, 0.22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(27,19,32,0.4)';
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0.16, -0.21); ctx.lineTo(0.12, -0.14); ctx.lineTo(0.15, -0.1);
  ctx.stroke();
  ctx.restore();
  for (const [ex, flip] of [[0.02, 1], [0.19, -1]]) {
    ctx.beginPath();
    ctx.moveTo(ex - 0.07, -0.01 - flip * 0.02);
    ctx.lineTo(ex + 0.07, -0.01 + flip * 0.03);
    ctx.quadraticCurveTo(ex + 0.07, 0.1, ex, 0.1);
    ctx.quadraticCurveTo(ex - 0.08, 0.1, ex - 0.07, -0.01 - flip * 0.02);
    ctx.closePath();
    ctx.fillStyle = OUTLINE;
    ctx.fill();
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = p.eye;
    ellipse(ctx, ex + 0.01, 0.045, 0.045, 0.045);
    ctx.fill();
    ctx.globalAlpha /= 0.35;
    ctx.fillStyle = p.eye;
    ellipse(ctx, ex + 0.012, 0.045, 0.018, 0.026);
    ctx.fill();
  }
  poly(ctx, [[0.1, 0.11], [0.075, 0.16], [0.125, 0.16]]);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-0.01, 0.185, 0.25, 0.08);
  ink(ctx, '#f7f0de', 0.025);
  ctx.beginPath();
  for (let i = 1; i < 5; i++) { ctx.moveTo(-0.01 + i * 0.05, 0.185); ctx.lineTo(-0.01 + i * 0.05, 0.265); }
  ctx.moveTo(-0.01, 0.225);
  ctx.lineTo(0.24, 0.225);
  ctx.lineWidth = 0.014;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (opts.bandage) {
    ctx.strokeStyle = '#e8e0c8';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.05); ctx.lineTo(0.34, 0.02);
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.012;
    ctx.stroke();
  }
  if (opts.helmet === 'horned') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0.08 + sx * 0.2, -0.16);
      ctx.quadraticCurveTo(0.08 + sx * 0.42, -0.2, 0.08 + sx * 0.4, -0.42);
      ctx.quadraticCurveTo(0.08 + sx * 0.3, -0.26, 0.08 + sx * 0.14, -0.24);
      ctx.closePath();
      ink(ctx, '#efe3c8');
    }
  }
  if (opts.helmet === 'horned' || opts.helmet === 'iron') {
    ctx.beginPath();
    ctx.moveTo(-0.2, 0.0);
    ctx.bezierCurveTo(-0.22, -0.3, 0.38, -0.3, 0.36, 0.0);
    ctx.lineTo(0.36, 0.03);
    ctx.lineTo(-0.2, 0.03);
    ctx.closePath();
    ink(ctx, p.hood);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ellipse(ctx, 0.12, -0.16, 0.12, 0.035, -0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-0.22, -0.01, 0.6, 0.06);
    ink(ctx, p.trim, 0.03);
    for (let i = 0; i < 5; i++) { ellipse(ctx, -0.16 + i * 0.12, 0.02, 0.015, 0.015); ctx.fillStyle = OUTLINE; ctx.fill(); }
    ctx.beginPath();
    ctx.rect(0.065, -0.01, 0.03, 0.14);
    ink(ctx, p.hoodShade, 0.02);
  }
  if (opts.helmet === 'great') {
    ctx.beginPath();
    ctx.moveTo(-0.22, 0.3);
    ctx.lineTo(-0.24, -0.08);
    ctx.bezierCurveTo(-0.22, -0.34, 0.38, -0.34, 0.38, -0.08);
    ctx.lineTo(0.36, 0.3);
    ctx.closePath();
    ink(ctx, p.hood);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = p.hoodShade;
    ctx.fillRect(-0.3, -0.4, 0.14, 0.8);
    ctx.restore();
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(-0.12, 0.03, 0.44, 0.06);
    ctx.fillStyle = p.eye;
    ctx.fillRect(-0.04, 0.045, 0.08, 0.03);
    ctx.fillRect(0.14, 0.045, 0.08, 0.03);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(0.02 + i * 0.06, 0.14); ctx.lineTo(0.02 + i * 0.06, 0.24); }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.06, -0.3);
    ctx.quadraticCurveTo(-0.2, -0.6, -0.48, -0.36);
    ctx.quadraticCurveTo(-0.3, -0.42, 0.0, -0.26);
    ctx.closePath();
    ink(ctx, p.plume || '#b02a2a', 0.03);
  }
  if (opts.hat === 'witch') {
    ctx.beginPath();
    ctx.ellipse(0.06, -0.14, 0.44, 0.08, -0.08, 0, Math.PI * 2);
    ink(ctx, p.hood);
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.16);
    ctx.quadraticCurveTo(-0.05, -0.5, 0.15, -0.75);
    ctx.quadraticCurveTo(0.1, -0.5, 0.32, -0.18);
    ctx.closePath();
    ink(ctx, p.hood);
    ctx.beginPath();
    ctx.rect(-0.17, -0.24, 0.46, 0.06);
    ink(ctx, p.trim, 0.02);
  }
  if (opts.crown) {
    poly(ctx, [[-0.14, -0.2], [-0.16, -0.38], [-0.06, -0.28], [0.06, -0.44], [0.16, -0.28], [0.28, -0.38], [0.27, -0.2]]);
    ink(ctx, p.trim);
    ctx.fillStyle = p.eye;
    ellipse(ctx, 0.06, -0.27, 0.03, 0.03);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, -0.08, -0.25, 0.015, 0.015);
    ctx.fill();
    ellipse(ctx, 0.2, -0.25, 0.015, 0.015);
    ctx.fill();
  }
}

export function dogSkull(ctx, p) {
  // вытянутая морда
  ctx.beginPath();
  ctx.moveTo(-0.18, -0.12);
  ctx.quadraticCurveTo(0.0, -0.24, 0.18, -0.1);
  ctx.lineTo(0.44, 0.0);
  ctx.quadraticCurveTo(0.5, 0.08, 0.42, 0.12);
  ctx.lineTo(0.1, 0.16);
  ctx.quadraticCurveTo(-0.12, 0.2, -0.2, 0.08);
  ctx.closePath();
  ink(ctx, p.bone, 0.04);
  // уши
  poly(ctx, [[-0.14, -0.12], [-0.22, -0.34], [-0.04, -0.17]]);
  ink(ctx, p.fur, 0.03);
  ctx.beginPath();
  ctx.ellipse(0.06, -0.04, 0.06, 0.05, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  ctx.fillStyle = p.eye;
  ellipse(ctx, 0.07, -0.04, 0.022, 0.022);
  ctx.fill();
  // клыки
  ctx.fillStyle = '#ffffff';
  for (const x of [0.2, 0.3]) { poly(ctx, [[x, 0.12], [x + 0.03, 0.22], [x + 0.06, 0.12]]); ctx.fill(); ctx.lineWidth = 0.012; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
  ellipse(ctx, 0.45, 0.04, 0.03, 0.025);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
}

export function ghostHead(ctx, p, opts = {}) {
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.3);
  ctx.bezierCurveTo(-0.42, -0.1, -0.24, -0.4, 0.06, -0.4);
  ctx.bezierCurveTo(0.36, -0.4, 0.46, -0.1, 0.38, 0.3);
  ctx.quadraticCurveTo(0.04, 0.2, -0.3, 0.3);
  ctx.closePath();
  ink(ctx, p.hood);
  ctx.beginPath();
  ctx.ellipse(0.06, 0.04, 0.24, 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a14';
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = p.eye;
  for (const x of [-0.02, 0.15]) {
    ctx.globalAlpha *= 0.4;
    ellipse(ctx, x, 0.02, 0.07, 0.06);
    ctx.fill();
    ctx.globalAlpha /= 0.4;
    ellipse(ctx, x, 0.02, 0.035, 0.022);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.ellipse(0.06, 0.04, 0.27, 0.27, 0, Math.PI * 0.8, Math.PI * 2.2);
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 0.035;
  ctx.stroke();
  if (opts.crown) {
    poly(ctx, [[-0.16, -0.34], [-0.18, -0.56], [-0.06, -0.44], [0.06, -0.62], [0.18, -0.44], [0.3, -0.56], [0.28, -0.34]]);
    ink(ctx, '#f2c14e');
  }
}

export function batHead(ctx, p) {
  for (const sx of [-1, 1]) {
    poly(ctx, [[0.06 + sx * 0.08, -0.12], [0.06 + sx * 0.24, -0.42], [0.06 + sx * 0.22, -0.06]]);
    ink(ctx, p.ear, 0.03);
  }
  ellipse(ctx, 0.06, 0.02, 0.24, 0.2);
  ink(ctx, p.fur);
  ctx.fillStyle = p.eye;
  for (const x of [-0.02, 0.14]) { ellipse(ctx, x, -0.02, 0.04, 0.03); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  for (const x of [0.0, 0.1]) { poly(ctx, [[x, 0.1], [x + 0.025, 0.18], [x + 0.05, 0.1]]); ctx.fill(); }
}

export function golemHead(ctx, p) {
  poly(ctx, [[-0.24, -0.2], [0.32, -0.24], [0.36, 0.2], [-0.22, 0.24]]);
  ink(ctx, p.stone);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.stoneShade;
  ctx.fillRect(-0.3, 0.06, 0.8, 0.3);
  ctx.fillStyle = p.moss;
  ellipse(ctx, -0.05, -0.22, 0.2, 0.06);
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = p.eye;
  for (const x of [0.0, 0.18]) {
    ctx.globalAlpha *= 0.4; ellipse(ctx, x, -0.02, 0.07, 0.05); ctx.fill(); ctx.globalAlpha /= 0.4;
    ctx.fillRect(x - 0.04, -0.035, 0.08, 0.03);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.1, 0.12); ctx.lineTo(0.26, 0.12);
  ctx.stroke();
}

export function mawHead(ctx, p, t = 0) {
  const open = 0.08 + Math.abs(Math.sin(t * 3)) * 0.06;
  ellipse(ctx, 0.04, 0, 0.42, 0.34);
  ink(ctx, p.skin);
  ctx.beginPath();
  ctx.ellipse(0.12, 0.08, 0.3, open + 0.06, 0, 0, Math.PI * 2);
  ink(ctx, p.gum, 0.03);
  ctx.fillStyle = p.teeth;
  for (let i = 0; i < 7; i++) {
    const x = -0.14 + i * 0.075;
    poly(ctx, [[x, 0.08 - open - 0.04], [x + 0.035, 0.08 - 0.01], [x + 0.07, 0.08 - open - 0.04]]);
    ctx.fill();
    poly(ctx, [[x, 0.08 + open + 0.04], [x + 0.035, 0.08 + 0.01], [x + 0.07, 0.08 + open + 0.04]]);
    ctx.fill();
  }
  ctx.fillStyle = p.eye;
  for (const [x, y] of [[-0.1, -0.2], [0.1, -0.24], [0.26, -0.16]]) {
    ellipse(ctx, x, y, 0.045, 0.045);
    ink(ctx, p.eye, 0.02);
    ctx.fillStyle = OUTLINE;
    ellipse(ctx, x + 0.01, y, 0.015, 0.03);
    ctx.fill();
  }
}

export function drakeSkull(ctx, p) {
  // рога
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-0.1 + sx * 0.05, -0.12);
    ctx.quadraticCurveTo(-0.3 + sx * 0.08, -0.32, -0.42, -0.45 + sx * 0.06);
    ctx.quadraticCurveTo(-0.24, -0.24, -0.02, -0.14);
    ctx.closePath();
    ink(ctx, p.spike, 0.03);
  }
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.1);
  ctx.quadraticCurveTo(0.0, -0.24, 0.24, -0.12);
  ctx.lineTo(0.56, -0.02);
  ctx.lineTo(0.58, 0.06);
  ctx.lineTo(0.2, 0.08);
  ctx.lineTo(0.5, 0.14);
  ctx.lineTo(0.46, 0.2);
  ctx.lineTo(0.06, 0.2);
  ctx.quadraticCurveTo(-0.2, 0.18, -0.2, -0.1);
  ctx.closePath();
  ink(ctx, p.bone, 0.04);
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, 0.08, -0.04, 0.06, 0.05);
  ctx.fill();
  ctx.fillStyle = p.eye;
  ellipse(ctx, 0.09, -0.04, 0.025, 0.025);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const x of [0.26, 0.36, 0.44]) { poly(ctx, [[x, 0.08], [x + 0.02, 0.13], [x + 0.04, 0.08]]); ctx.fill(); }
}

// ---------- описание внешности ----------

export const LOOKS = {
  hero: { head: 'hood', body: 'tunic', pal: 'hero', scale: 1 },
  swordsman: { head: 'helm', body: 'tunic', pal: 'swordsman', scale: 0.82, weapon: 'sword', armorTier: 2 },
  archer: { head: 'hood', body: 'tunic', pal: 'ranger', scale: 0.8, weapon: 'bow' },
  mage: { head: 'wizard', body: 'robe', pal: 'mage', scale: 0.84, weapon: 'staff' },
  worker: { head: 'cap', body: 'apron', pal: 'worker', scale: 0.72, weapon: 'tool' },
  repairer: { head: 'cap', body: 'apron', pal: 'repairer', scale: 0.7, weapon: 'hammer' },

  skeleton: { head: 'skull', body: 'armor', pal: 'skeleton', scale: 0.95, headOpts: { hood: 'tattered' } },
  hound: { head: 'dog', body: 'hound', pal: 'hound', scale: 0.85, headY: -0.32, hopSpeed: 18 },
  brute: { head: 'skull', body: 'armor', pal: 'brute', scale: 1.3, headOpts: { helmet: 'horned' }, heavy: true, weapon: 'mace' },
  skelArcher: { head: 'skull', body: 'armor', pal: 'skelArcher', scale: 0.92, headOpts: { hood: 'tattered' }, weapon: 'boneBow' },
  shieldbearer: { head: 'skull', body: 'armor', pal: 'shieldbearer', scale: 1.1, headOpts: { helmet: 'iron' }, heavy: true, weapon: 'shield' },
  wraith: { head: 'ghost', body: 'wisp', pal: 'wraith', scale: 1, alpha: 0.82, float: 0.35 },
  necromancer: { head: 'skull', body: 'robe', pal: 'necromancer', scale: 1, headOpts: { hood: 'tall' }, weapon: 'skullStaff' },
  plague: { head: 'skull', body: 'bloated', pal: 'plague', scale: 1.1, headOpts: { hood: null, bandage: true }, headY: -0.7 },
  bat: { head: 'bat', body: 'drake', pal: 'bat', scale: 0.7, float: 0.6, bodyPal: { bone: '#3a2a4a', boneShade: '#261a32', wing: '#5a3a6a', wingShade: '#3a2448' } },
  golem: { head: 'golem', body: 'stone', pal: 'golem', scale: 1.4, headY: -0.78 },
  witch: { head: 'skull', body: 'robe', pal: 'witch', scale: 1, headOpts: { hood: null, hat: 'witch' }, weapon: 'skullStaff' },
  deathKnight: { head: 'skull', body: 'armor', pal: 'deathKnight', scale: 1.25, headOpts: { helmet: 'great' }, heavy: true, weapon: 'greatsword' },
  drake: { head: 'drake', body: 'drake', pal: 'drake', scale: 1.15, float: 0.55 },
  devourer: { head: 'maw', body: 'bulk', pal: 'devourer', scale: 1.7, headY: -0.68 },
  colossus: { head: 'skull', body: 'armor', pal: 'colossus', scale: 2.3, headOpts: { hood: 'tattered', crown: true }, heavy: true, weapon: 'mace' },
  mistQueen: { head: 'ghost', body: 'wisp', pal: 'mistQueen', scale: 2, headOpts: { crown: true }, alpha: 0.88, float: 0.5 },
  lich: { head: 'skull', body: 'robe', pal: 'lich', scale: 2, headOpts: { hood: 'tall', crown: true }, weapon: 'skullStaff' },
  boneDragon: { head: 'drake', body: 'drake', pal: 'boneDragon', scale: 2.4, float: 0.6 },
};

export function drawHead(ctx, look, p, t, opts = {}) {
  switch (look.head) {
    case 'hood': return hoodHead(ctx, p, opts);
    case 'helm': return helmHead(ctx, p, opts);
    case 'cap': return capHead(ctx, p, opts);
    case 'wizard': return wizardHead(ctx, p, opts);
    case 'skull': return skullHead(ctx, p, look.headOpts || {});
    case 'dog': return dogSkull(ctx, p);
    case 'ghost': return ghostHead(ctx, p, look.headOpts || {});
    case 'bat': return batHead(ctx, p);
    case 'golem': return golemHead(ctx, p);
    case 'maw': return mawHead(ctx, p, t);
    case 'drake': return drakeSkull(ctx, p);
    default: return null;
  }
}

export function drawBody(ctx, look, p, t, armorTier = 0) {
  switch (look.body) {
    case 'tunic': return tunicBody(ctx, p, armorTier || look.armorTier || 0);
    case 'apron': return apronBody(ctx, p);
    case 'robe': return robeBody(ctx, p);
    case 'armor': return armorBody(ctx, p, look.heavy);
    case 'hound': return houndBody(ctx, p);
    case 'wisp': return wispBody(ctx, p, t);
    case 'bloated': return bloatedBody(ctx, p);
    case 'stone': return stoneBody(ctx, p);
    case 'drake': return drakeBody(ctx, look.bodyPal ? { ...p, ...look.bodyPal } : p, t);
    case 'bulk': return bulkBody(ctx, p);
    default: return null;
  }
}
