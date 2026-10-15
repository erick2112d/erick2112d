// Векторные рисунки персонажей, оружия, построек и природы.
// Стиль: толстый тёмный контур, плоская заливка, одна тень и один блик.
// Персонажи — отдельные голова и тело, без рук и ног; оружие парит рядом.
// Координаты — в клетках карты (ctx уже отмасштабирован).

export const OUTLINE = '#1b1320';
const LW = 0.045;

export const PALETTES = {
  hero: {
    hood: '#1f6fd1', hoodShade: '#174f9a', trim: '#f2c14e', skin: '#fde6cf', blush: '#f4a68c',
    hair: '#7a4524', hairLight: '#a8653a', eye: '#4a2a17',
    body: '#1f6fd1', bodyShade: '#174f9a', collar: '#f6ead6', belt: '#6b3d1f', buckle: '#f2c14e', emblem: '#f2c14e',
  },
  swordsman: {
    hood: '#9aa5b8', hoodShade: '#6c778b', trim: '#f2c14e', skin: '#fde6cf', blush: '#f4a68c',
    hair: '#3d2a1e', hairLight: '#5c4130', eye: '#2a1a10',
    body: '#2f80d8', bodyShade: '#235fa0', collar: '#dfe6f0', belt: '#6b3d1f', buckle: '#d9dee8', emblem: '#f6ead6',
  },
  repairer: {
    hood: '#8a5a32', hoodShade: '#6a4224', trim: '#e0b060', skin: '#f6d7bb', blush: '#f0a080',
    hair: '#c27a3a', hairLight: '#e09a5a', eye: '#3a2412',
    body: '#b5793f', bodyShade: '#8d5a2b', collar: '#efe2c8', belt: '#5a3218', buckle: '#c9ccd4', emblem: '#5a3218',
  },
  skeleton: {
    hood: '#4b3366', hoodShade: '#36244b', trim: '#c99a3e', bone: '#efe3c8', boneShade: '#cbb994', eye: '#3ff0ff',
    armor: '#4a4a5a', armorShade: '#363644', cape: '#4b3366', capeShade: '#36244b', belt: '#6b3d1f', buckle: '#c99a3e',
  },
  runner: {
    hood: '#2f5a3a', hoodShade: '#1f4029', trim: '#a8b04a', bone: '#dfe8c8', boneShade: '#b5c294', eye: '#c8ff3f',
    armor: '#3c4a3e', armorShade: '#2c372e', cape: '#2f5a3a', capeShade: '#1f4029', belt: '#4a3a24', buckle: '#a8b04a',
  },
  brute: {
    hood: '#7d8696', hoodShade: '#5b6372', trim: '#c99a3e', bone: '#e8dcc0', boneShade: '#c2b28c', eye: '#ff9a3c',
    armor: '#5c6270', armorShade: '#434855', cape: '#6b2f3a', capeShade: '#4d1f28', belt: '#5a3218', buckle: '#c99a3e',
  },
  archer: {
    hood: '#6b3a2a', hoodShade: '#4d281c', trim: '#c99a3e', bone: '#efe3c8', boneShade: '#cbb994', eye: '#ff5f7a',
    armor: '#4e4540', armorShade: '#3a332f', cape: '#6b3a2a', capeShade: '#4d281c', belt: '#6b3d1f', buckle: '#c99a3e',
  },
  boss: {
    hood: '#2d1a40', hoodShade: '#1d102b', trim: '#f2c14e', bone: '#f3e9d2', boneShade: '#cdbd98', eye: '#ff3cf0',
    armor: '#3a3448', armorShade: '#2a2536', cape: '#5a2d7a', capeShade: '#3f1f57', belt: '#4a2a14', buckle: '#f2c14e',
  },
};

// Палитра «вспышки» при попадании: всё белое, контур остаётся.
const flashCache = new Map();
export function flashPalette(p) {
  if (!flashCache.has(p)) {
    const f = {};
    for (const k of Object.keys(p)) f[k] = k === 'eye' ? p[k] : '#ffffff';
    flashCache.set(p, f);
  }
  return flashCache.get(p);
}

function ink(ctx, fill, lw = LW) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

// ---------- тела ----------

// Тело-«яйцо» героя и союзников: низ на y=0, верх на y=-h.
function eggPath(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.42, -h, w * 0.53, -h * 0.45, w * 0.5, -h * 0.2);
  ctx.bezierCurveTo(w * 0.48, -h * 0.02, w * 0.25, 0.01, 0, 0.02);
  ctx.bezierCurveTo(-w * 0.25, 0.01, -w * 0.48, -h * 0.02, -w * 0.5, -h * 0.2);
  ctx.bezierCurveTo(-w * 0.53, -h * 0.45, -w * 0.42, -h, 0, -h);
  ctx.closePath();
}

export function drawTunicBody(ctx, p, w = 0.54, h = 0.56) {
  eggPath(ctx, w, h);
  ctx.fillStyle = p.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // тень справа
  ctx.fillStyle = p.bodyShade;
  ctx.beginPath();
  ctx.ellipse(w * 0.42, -h * 0.45, w * 0.22, h * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // золотые канты
  ctx.fillStyle = p.trim;
  for (const sx of [-1, 1]) {
    ctx.fillRect(sx * w * 0.33 - 0.022, -h, 0.044, h);
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.018;
  for (const sx of [-1, 1]) {
    ctx.strokeRect(sx * w * 0.33 - 0.022, -h - 0.1, 0.044, h + 0.2);
  }
  // подол
  ctx.beginPath();
  ctx.moveTo(-w, -0.05);
  ctx.lineTo(0, 0.03);
  ctx.lineTo(w, -0.05);
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = p.trim;
  ctx.stroke();
  // ремень
  ctx.fillStyle = p.belt;
  ctx.fillRect(-w, -h * 0.34, w * 2, 0.075);
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(-w, -h * 0.34, w * 2, 0.075);
  ctx.restore();
  // пряжка
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
  // герб
  drawFleur(ctx, 0, -h * 0.58, 0.075, p.emblem);
  eggPath(ctx, w, h);
  ink(ctx, null);
}

function drawFleur(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.35, s * 0.28, s * 0.55, 0, 0, Math.PI * 2);
  ctx.ellipse(x - s * 0.45, y - s * 0.05, s * 0.22, s * 0.38, -0.7, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.45, y - s * 0.05, s * 0.22, s * 0.38, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - s * 0.55, y + s * 0.12, s * 1.1, s * 0.16);
  ctx.fillRect(x - s * 0.1, y + s * 0.1, s * 0.2, s * 0.5);
}

// Доспех скелета: серый панцирь, рваный плащ на плечах, рёбра, ремень.
export function drawArmorBody(ctx, p, w = 0.56, h = 0.56, heavy = false) {
  const top = -h;
  // рваный низ плаща за спиной
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, top + 0.12);
  ctx.lineTo(-w * 0.6, -0.02);
  ctx.lineTo(-w * 0.42, 0.04);
  ctx.lineTo(-w * 0.3, -0.03);
  ctx.lineTo(-w * 0.15, 0.05);
  ctx.lineTo(0, -0.02);
  ctx.lineTo(w * 0.15, 0.05);
  ctx.lineTo(w * 0.3, -0.03);
  ctx.lineTo(w * 0.42, 0.04);
  ctx.lineTo(w * 0.6, -0.02);
  ctx.lineTo(w * 0.55, top + 0.12);
  ctx.closePath();
  ink(ctx, p.capeShade);
  // панцирь
  eggPath(ctx, w * 0.86, h * 0.98);
  ctx.fillStyle = p.armor;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.armorShade;
  ctx.fillRect(0.02, -h, w, h);
  // рёбра
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
  // ремень
  ctx.fillStyle = p.belt;
  ctx.fillRect(-w, -h * 0.3, w * 2, 0.08);
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(-w, -h * 0.3, w * 2, 0.08);
  // золотой кант по низу
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-w, -0.06);
  ctx.lineTo(-w * 0.2, -0.02);
  ctx.lineTo(-w * 0.2, -h * 0.22);
  ctx.stroke();
  ctx.restore();
  eggPath(ctx, w * 0.86, h * 0.98);
  ink(ctx, null);
  ctx.beginPath();
  ctx.rect(-0.05, -h * 0.3 - 0.01, 0.1, 0.1);
  ink(ctx, p.buckle, 0.022);
  // плечи: плащ и золотые наплечники
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
  }
  // ромб на груди
  ctx.beginPath();
  ctx.moveTo(0, top + 0.03);
  ctx.lineTo(0.05, top + 0.1);
  ctx.lineTo(0, top + 0.18);
  ctx.lineTo(-0.05, top + 0.1);
  ctx.closePath();
  ink(ctx, p.trim, 0.025);
  ctx.beginPath();
  ctx.moveTo(0, top + 0.07);
  ctx.lineTo(0.022, top + 0.1);
  ctx.lineTo(0, top + 0.14);
  ctx.lineTo(-0.022, top + 0.1);
  ctx.closePath();
  ctx.fillStyle = OUTLINE;
  ctx.fill();
}

// ---------- головы ----------

// Голова героя: синий капюшон с золотой каймой, каштановые волосы, хмурый взгляд.
export function drawHoodHead(ctx, p, t, opts = {}) {
  const blink = opts.blink;
  // хвост капюшона
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.28);
  ctx.quadraticCurveTo(-0.42, -0.3, -0.5, -0.12);
  ctx.quadraticCurveTo(-0.4, -0.06, -0.28, 0.0);
  ctx.closePath();
  ink(ctx, p.hoodShade);
  // капюшон
  ctx.beginPath();
  ctx.moveTo(-0.34, 0.24);
  ctx.bezierCurveTo(-0.42, 0.0, -0.36, -0.32, -0.02, -0.36);
  ctx.bezierCurveTo(0.3, -0.38, 0.42, -0.12, 0.4, 0.12);
  ctx.bezierCurveTo(0.39, 0.28, 0.3, 0.34, 0.1, 0.35);
  ctx.bezierCurveTo(-0.1, 0.36, -0.28, 0.33, -0.34, 0.24);
  ctx.closePath();
  ink(ctx, p.hood);
  // тень капюшона
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.hoodShade;
  ctx.beginPath();
  ctx.ellipse(-0.3, 0.1, 0.14, 0.4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // золотая кайма вокруг лица
  ctx.beginPath();
  ctx.ellipse(0.06, 0.07, 0.29, 0.28, 0, 0, Math.PI * 2);
  ink(ctx, p.trim, 0.04);
  // лицо
  ctx.beginPath();
  ctx.ellipse(0.07, 0.09, 0.245, 0.235, 0, 0, Math.PI * 2);
  ink(ctx, p.skin, 0.035);
  // румянец
  ctx.fillStyle = p.blush;
  ctx.globalAlpha *= 0.7;
  ellipse(ctx, 0.23, 0.17, 0.035, 0.022);
  ctx.fill();
  ctx.globalAlpha /= 0.7;
  // волосы-чёлка
  ctx.beginPath();
  ctx.moveTo(-0.17, 0.12);
  ctx.lineTo(-0.12, 0.0);
  ctx.lineTo(-0.06, 0.07);
  ctx.lineTo(0.0, -0.03);
  ctx.lineTo(0.07, 0.05);
  ctx.lineTo(0.12, -0.04);
  ctx.lineTo(0.2, 0.04);
  ctx.lineTo(0.24, -0.03);
  ctx.lineTo(0.32, 0.06);
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
  // глаза и брови
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
  // рот
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  if (opts.shout) ctx.ellipse(0.11, 0.22, 0.03, 0.025, 0, 0, Math.PI * 2);
  else ctx.arc(0.11, 0.245, 0.03, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// Голова-череп в рваном капюшоне (или в шлеме — для латника).
export function drawSkullHead(ctx, p, t, opts = {}) {
  const helmet = opts.helmet;
  if (!helmet) {
    // рваный капюшон
    ctx.beginPath();
    ctx.moveTo(-0.3, 0.3);
    ctx.lineTo(-0.36, 0.22);
    ctx.lineTo(-0.44, 0.24);
    ctx.lineTo(-0.42, 0.1);
    ctx.lineTo(-0.5, 0.02);
    ctx.quadraticCurveTo(-0.46, -0.3, -0.1, -0.36);
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
    ctx.restore();
    // кайма с выщерблинами
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
  ctx.restore();
  // глазницы со злым изломом
  for (const [ex, flip] of [[0.02, 1], [0.19, -1]]) {
    ctx.beginPath();
    ctx.moveTo(ex - 0.07, -0.01 - flip * 0.02);
    ctx.lineTo(ex + 0.07, -0.01 + flip * 0.03);
    ctx.quadraticCurveTo(ex + 0.07, 0.1, ex, 0.1);
    ctx.quadraticCurveTo(ex - 0.08, 0.1, ex - 0.07, -0.01 - flip * 0.02);
    ctx.closePath();
    ctx.fillStyle = OUTLINE;
    ctx.fill();
    // светящийся зрачок
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = p.eye;
    ellipse(ctx, ex + 0.01, 0.045, 0.045, 0.045);
    ctx.fill();
    ctx.globalAlpha /= 0.35;
    ctx.fillStyle = p.eye;
    ellipse(ctx, ex + 0.012, 0.045, 0.018, 0.026);
    ctx.fill();
  }
  // нос
  ctx.beginPath();
  ctx.moveTo(0.1, 0.11);
  ctx.lineTo(0.075, 0.16);
  ctx.lineTo(0.125, 0.16);
  ctx.closePath();
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  // зубы
  ctx.beginPath();
  ctx.rect(-0.01, 0.185, 0.25, 0.08);
  ink(ctx, '#f7f0de', 0.025);
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    ctx.moveTo(-0.01 + i * 0.05, 0.185);
    ctx.lineTo(-0.01 + i * 0.05, 0.265);
  }
  ctx.moveTo(-0.01, 0.225);
  ctx.lineTo(0.24, 0.225);
  ctx.lineWidth = 0.014;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  if (helmet) {
    // железный шлем с рогами
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0.08 + sx * 0.2, -0.16);
      ctx.quadraticCurveTo(0.08 + sx * 0.42, -0.2, 0.08 + sx * 0.4, -0.42);
      ctx.quadraticCurveTo(0.08 + sx * 0.3, -0.26, 0.08 + sx * 0.14, -0.24);
      ctx.closePath();
      ink(ctx, '#efe3c8');
    }
    ctx.beginPath();
    ctx.moveTo(-0.2, 0.0);
    ctx.bezierCurveTo(-0.22, -0.3, 0.38, -0.3, 0.36, 0.0);
    ctx.lineTo(0.36, 0.03);
    ctx.lineTo(-0.2, 0.03);
    ctx.closePath();
    ink(ctx, p.hood);
    ctx.beginPath();
    ctx.rect(-0.22, -0.01, 0.6, 0.06);
    ink(ctx, p.trim, 0.03);
    ctx.beginPath();
    ctx.rect(0.065, -0.01, 0.03, 0.14);
    ink(ctx, p.hoodShade, 0.02);
  }
  if (opts.crown) {
    ctx.beginPath();
    ctx.moveTo(-0.14, -0.2);
    ctx.lineTo(-0.16, -0.38);
    ctx.lineTo(-0.06, -0.28);
    ctx.lineTo(0.06, -0.44);
    ctx.lineTo(0.16, -0.28);
    ctx.lineTo(0.28, -0.38);
    ctx.lineTo(0.27, -0.2);
    ctx.closePath();
    ink(ctx, p.trim);
    ctx.fillStyle = p.eye;
    ellipse(ctx, 0.06, -0.27, 0.03, 0.03);
    ctx.fill();
  }
}

// ---------- оружие (рукоять в начале координат, клинок вверх) ----------

export function drawSword(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  // клинок
  ctx.beginPath();
  ctx.moveTo(-0.045, -0.06);
  ctx.lineTo(-0.05, -0.5);
  ctx.lineTo(0, -0.6);
  ctx.lineTo(0.05, -0.5);
  ctx.lineTo(0.045, -0.06);
  ctx.closePath();
  ink(ctx, '#e6e9ef', 0.035);
  ctx.beginPath();
  ctx.moveTo(0, -0.08);
  ctx.lineTo(0, -0.57);
  ctx.lineTo(0.045, -0.5);
  ctx.lineTo(0.04, -0.08);
  ctx.closePath();
  ctx.fillStyle = '#a8b0bf';
  ctx.fill();
  // гарда
  ctx.beginPath();
  ctx.moveTo(-0.17, -0.09);
  ctx.quadraticCurveTo(0, -0.02, 0.17, -0.09);
  ctx.lineTo(0.15, -0.03);
  ctx.quadraticCurveTo(0, 0.02, -0.15, -0.03);
  ctx.closePath();
  ink(ctx, '#f2c14e', 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -0.1); ctx.lineTo(0.035, -0.055); ctx.lineTo(0, -0.01); ctx.lineTo(-0.035, -0.055);
  ctx.closePath();
  ink(ctx, '#2f6fe0', 0.02);
  // рукоять
  ctx.beginPath();
  ctx.rect(-0.03, -0.02, 0.06, 0.15);
  ink(ctx, '#6b3d1f', 0.03);
  ctx.beginPath();
  ctx.arc(0, 0.16, 0.045, 0, Math.PI * 2);
  ink(ctx, '#f2c14e', 0.03);
  ctx.beginPath();
  ctx.arc(0, 0.16, 0.022, 0, Math.PI * 2);
  ctx.fillStyle = '#2f6fe0';
  ctx.fill();
  ctx.restore();
}

export function drawBow(ctx, pull = 0, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  // тетива
  ctx.beginPath();
  ctx.moveTo(0.04, -0.36);
  ctx.lineTo(0.04 - pull * 0.16, 0);
  ctx.lineTo(0.04, 0.36);
  ctx.strokeStyle = '#e8c766';
  ctx.lineWidth = 0.014;
  ctx.stroke();
  // плечи лука
  ctx.beginPath();
  ctx.moveTo(0.05, -0.38);
  ctx.bezierCurveTo(-0.14, -0.3, -0.1, -0.08, -0.13, 0);
  ctx.bezierCurveTo(-0.1, 0.08, -0.14, 0.3, 0.05, 0.38);
  ctx.lineWidth = 0.1;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.055;
  ctx.strokeStyle = '#7a4524';
  ctx.stroke();
  // золотые наконечники
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.06, sy * 0.4);
    ctx.lineTo(0.0, sy * 0.3);
    ctx.lineTo(-0.05, sy * 0.33);
    ctx.closePath();
    ink(ctx, '#f2c14e', 0.022);
  }
  ctx.beginPath();
  ctx.moveTo(-0.13, -0.06); ctx.lineTo(-0.09, 0); ctx.lineTo(-0.13, 0.06); ctx.lineTo(-0.17, 0);
  ctx.closePath();
  ink(ctx, '#f2c14e', 0.02);
  ctx.beginPath();
  ctx.moveTo(-0.13, -0.035); ctx.lineTo(-0.11, 0); ctx.lineTo(-0.13, 0.035); ctx.lineTo(-0.15, 0);
  ctx.closePath();
  ctx.fillStyle = '#3fd6ff';
  ctx.fill();
  if (pull > 0.05) {
    ctx.save();
    ctx.translate(0.04 - pull * 0.16, 0);
    drawArrow(ctx, 0.75);
    ctx.restore();
  }
  ctx.restore();
}

export function drawArrow(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, -0.016, 0.5, 0.032);
  ink(ctx, '#7a4524', 0.02);
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.02, 0);
    ctx.lineTo(-0.02, sy * 0.07);
    ctx.lineTo(0.1, sy * 0.06);
    ctx.lineTo(0.14, 0);
    ctx.closePath();
    ink(ctx, '#2f9df2', 0.018);
  }
  ctx.beginPath();
  ctx.rect(0.13, -0.022, 0.03, 0.044);
  ink(ctx, '#f2c14e', 0.012);
  ctx.beginPath();
  ctx.moveTo(0.48, -0.05);
  ctx.lineTo(0.6, 0);
  ctx.lineTo(0.48, 0.05);
  ctx.closePath();
  ink(ctx, '#c9ced8', 0.02);
  ctx.restore();
}

export function drawStaff(ctx, glow = 0, t = 0, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-0.025, 0.3);
  ctx.lineTo(-0.03, -0.42);
  ctx.lineTo(0.03, -0.42);
  ctx.lineTo(0.025, 0.3);
  ctx.closePath();
  ink(ctx, '#7a4524', 0.03);
  // оправа
  ctx.beginPath();
  ctx.moveTo(-0.09, -0.4);
  ctx.quadraticCurveTo(-0.13, -0.55, -0.04, -0.66);
  ctx.moveTo(0.09, -0.4);
  ctx.quadraticCurveTo(0.13, -0.55, 0.04, -0.66);
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = '#f2c14e';
  ctx.stroke();
  // огненная сфера
  const r = 0.085 + glow * 0.03 + Math.sin(t * 6) * 0.006;
  ctx.globalAlpha *= 0.35 + glow * 0.4;
  ctx.fillStyle = '#ff9a3c';
  ctx.beginPath();
  ctx.arc(0, -0.53, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.35 + glow * 0.4;
  ctx.beginPath();
  ctx.arc(0, -0.53, r, 0, Math.PI * 2);
  ink(ctx, '#ffb347', 0.025);
  ctx.beginPath();
  ctx.arc(-0.02, -0.55, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-0.05, -0.42, 0.1, 0.05);
  ink(ctx, '#f2c14e', 0.02);
  ctx.restore();
}

export function drawHammer(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.022, -0.2, 0.044, 0.38);
  ink(ctx, '#8a5a32', 0.025);
  ctx.beginPath();
  ctx.rect(-0.12, -0.3, 0.24, 0.12);
  ink(ctx, '#9aa5b8', 0.03);
  ctx.restore();
}

export function drawMace(ctx, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-0.025, -0.3, 0.05, 0.45);
  ink(ctx, '#5a3218', 0.025);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 0.1 : 0.15;
    ctx.lineTo(Math.cos(a) * r, -0.38 + Math.sin(a) * r);
  }
  ctx.closePath();
  ink(ctx, '#7d8696', 0.03);
  ctx.restore();
}

export function drawBoneBow(ctx, pull = 0) {
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

// ---------- природа ----------

export function drawTree(ctx, t, sway, hitShake, variant) {
  ctx.save();
  ctx.translate(hitShake, 0);
  // ствол
  ctx.beginPath();
  ctx.moveTo(-0.1, 0.05);
  ctx.lineTo(-0.07, -0.35);
  ctx.lineTo(0.07, -0.35);
  ctx.lineTo(0.1, 0.05);
  ctx.closePath();
  ink(ctx, '#5a3a24');
  ctx.rotate(sway);
  const greens = variant ? ['#1f4a3a', '#2c6a4a', '#3f8a5a'] : ['#24452f', '#346a3c', '#4c8a46'];
  const blobs = [
    [0, -0.55, 0.42, 0], [-0.22, -0.68, 0.28, 1], [0.22, -0.7, 0.28, 1], [0, -0.9, 0.3, 2],
  ];
  for (const [x, y, r, c] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ink(ctx, greens[c]);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(-0.06, -0.97, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStump(ctx) {
  ctx.beginPath();
  ctx.ellipse(0, -0.05, 0.16, 0.08, 0, 0, Math.PI * 2);
  ctx.rect(-0.16, -0.05, 0.32, 0.1);
  ink(ctx, '#5a3a24');
  ctx.beginPath();
  ctx.ellipse(0, -0.06, 0.13, 0.06, 0, 0, Math.PI * 2);
  ink(ctx, '#c9a06a', 0.025);
}

export function drawRock(ctx, hp, max, hitShake) {
  ctx.save();
  ctx.translate(hitShake, 0);
  const k = 0.55 + 0.45 * (hp / max);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(-0.38, 0.05);
  ctx.lineTo(-0.3, -0.3);
  ctx.lineTo(-0.05, -0.45);
  ctx.lineTo(0.25, -0.38);
  ctx.lineTo(0.4, -0.1);
  ctx.lineTo(0.32, 0.08);
  ctx.closePath();
  ink(ctx, '#7d8696');
  ctx.beginPath();
  ctx.moveTo(-0.05, -0.45);
  ctx.lineTo(0.02, -0.15);
  ctx.lineTo(0.4, -0.1);
  ctx.lineTo(0.25, -0.38);
  ctx.closePath();
  ink(ctx, '#a9b0bd', 0.03);
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.2); ctx.lineTo(-0.1, -0.05);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.025;
  ctx.stroke();
  ctx.restore();
}

// ---------- постройки ----------
// Начало координат — центр низа постройки (у южной кромки клетки), высота растёт вверх.

function box(ctx, x, y, w, h, front, top, topH = 0.2) {
  // фронтальная грань
  ctx.beginPath();
  ctx.rect(x, y - h, w, h);
  ink(ctx, front);
  // крыша/верх
  ctx.beginPath();
  ctx.rect(x, y - h - topH, w, topH);
  ink(ctx, top);
}

function stoneLines(ctx, x, y, w, h, rows = 3) {
  ctx.strokeStyle = 'rgba(27,19,32,0.35)';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  for (let i = 1; i < rows; i++) {
    const yy = y - (h * i) / rows;
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    const off = i % 2 ? w / 4 : w / 2;
    for (let xx = x + off; xx < x + w; xx += w / 2) {
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + h / rows);
    }
  }
  ctx.stroke();
}

export function drawHeart(ctx, t, hpRatio) {
  // платформа-восьмиугольник
  const oct = (r, y, h, fill, top) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.lineTo(Math.cos(a) * r, y + Math.sin(a) * r * 0.5);
    }
    ctx.closePath();
    ink(ctx, fill);
    if (top) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.lineTo(Math.cos(a) * r, y - h + Math.sin(a) * r * 0.5);
      }
      ctx.closePath();
      ink(ctx, top);
    }
  };
  oct(1.45, -1.2, 0, '#3a3f52');
  oct(1.45, -1.3, 0.15, '#4b5268', '#6a7390');
  oct(1.0, -1.45, 0.15, '#5a6280', '#8892b0');
  // руны на кольце
  ctx.save();
  ctx.translate(0, -1.6);
  ctx.scale(1, 0.5);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = `rgba(242,193,78,${0.5 + 0.3 * Math.sin(t * 2)})`;
  ctx.lineWidth = 0.06;
  ctx.setLineDash([0.18, 0.14]);
  ctx.beginPath();
  ctx.arc(0, 0, 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // сияние
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const cy = -2.55 + Math.sin(t * 1.6) * 0.1;
  const g = ctx.createRadialGradient(0, cy, 0.1, 0, cy, 1.6);
  g.addColorStop(0, `rgba(255,236,160,${0.55 * hpRatio + 0.15})`);
  g.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, cy, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // кристалл
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(1 + pulse * 0.04, 1 - pulse * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -0.75);
  ctx.lineTo(0.38, -0.15);
  ctx.lineTo(0.22, 0.55);
  ctx.lineTo(-0.22, 0.55);
  ctx.lineTo(-0.38, -0.15);
  ctx.closePath();
  ink(ctx, '#7ff3ff', 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -0.75);
  ctx.lineTo(0.38, -0.15);
  ctx.lineTo(0.22, 0.55);
  ctx.lineTo(0.02, 0.55);
  ctx.lineTo(0.06, -0.1);
  ctx.closePath();
  ctx.fillStyle = '#3fc6e8';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.16, -0.25);
  ctx.lineTo(-0.06, -0.5);
  ctx.lineTo(-0.02, -0.2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

export function drawGenerator(ctx, t, on) {
  box(ctx, -0.85, -0.1, 1.7, 0.45, '#3f4458', '#5a6178', 0.9);
  stoneLines(ctx, -0.85, -0.1, 1.7, 0.45, 2);
  // обелиск
  ctx.beginPath();
  ctx.moveTo(-0.22, -0.9);
  ctx.lineTo(-0.15, -1.9);
  ctx.lineTo(0, -2.1);
  ctx.lineTo(0.15, -1.9);
  ctx.lineTo(0.22, -0.9);
  ctx.closePath();
  ink(ctx, '#4b5268');
  ctx.beginPath();
  ctx.moveTo(0, -2.1); ctx.lineTo(0.15, -1.9); ctx.lineTo(0.22, -0.9); ctx.lineTo(0.03, -0.9);
  ctx.closePath();
  ctx.fillStyle = '#3a3f52';
  ctx.fill();
  const glow = on ? 0.8 + 0.2 * Math.sin(t * 8) : 0.15;
  ctx.fillStyle = `rgba(90,200,255,${glow})`;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, -1.15 - i * 0.25, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  // вращающееся кольцо
  ctx.save();
  ctx.translate(0, -1.5);
  ctx.scale(1, 0.4);
  ctx.rotate(on ? t * 2.5 : 0);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = on ? '#5ac8ff' : '#4a5a6a';
  ctx.lineWidth = 0.06;
  ctx.setLineDash([0.3, 0.15]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  if (on && Math.sin(t * 13) > 0.85) {
    ctx.strokeStyle = '#bfefff';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -2.05);
    ctx.lineTo(0.18, -2.25);
    ctx.lineTo(0.05, -2.3);
    ctx.lineTo(0.25, -2.55);
    ctx.stroke();
  }
}

function roofed(ctx, w, h, wall, wallShade, roof, roofShade) {
  box(ctx, -w / 2, -0.1, w, h, wall, wallShade, 0.0);
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 0.12, -0.1 - h);
  ctx.lineTo(-w / 2 + 0.2, -0.1 - h - 0.75);
  ctx.lineTo(w / 2 - 0.2, -0.1 - h - 0.75);
  ctx.lineTo(w / 2 + 0.12, -0.1 - h);
  ctx.closePath();
  ink(ctx, roof);
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 0.12, -0.1 - h);
  ctx.lineTo(w / 2 + 0.12, -0.1 - h);
  ctx.lineTo(w / 2 + 0.06, -0.1 - h - 0.18);
  ctx.lineTo(-w / 2 - 0.06, -0.1 - h - 0.18);
  ctx.closePath();
  ink(ctx, roofShade, 0.03);
}

export function drawSawmill(ctx, t, on) {
  // поленница
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(-0.75 + i * 0.16, -0.18, 0.09, 0.09, 0, 0, Math.PI * 2);
    ink(ctx, '#c98a4b', 0.03);
  }
  roofed(ctx, 1.4, 0.75, '#8a5a32', '#6a4224', '#7a2f2a', '#5a1f1c');
  ctx.strokeStyle = 'rgba(27,19,32,0.4)';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  for (let x = -0.5; x < 0.7; x += 0.25) { ctx.moveTo(x, -0.1); ctx.lineTo(x, -0.85); }
  ctx.stroke();
  // пила
  ctx.save();
  ctx.translate(0.45, -0.5);
  ctx.rotate(on ? t * 12 : 0);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 0.26 : 0.32;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ink(ctx, '#c9ced8', 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, 0.07, 0, Math.PI * 2);
  ink(ctx, '#f2c14e', 0.02);
  ctx.restore();
  // доска на козлах
  ctx.beginPath();
  ctx.rect(-0.55, -0.42, 0.7, 0.1);
  ink(ctx, '#e6c27a', 0.025);
}

export function drawQuarry(ctx, t, on) {
  ctx.beginPath();
  ctx.ellipse(0, -0.55, 0.85, 0.45, 0, 0, Math.PI * 2);
  ink(ctx, '#2a2830');
  for (const [x, y, r] of [[-0.35, -0.55, 0.16], [0.1, -0.45, 0.2], [0.4, -0.65, 0.13]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ink(ctx, '#8a92a0', 0.03);
  }
  // журавль
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  ctx.moveTo(-0.7, -0.2); ctx.lineTo(-0.7, -1.5); ctx.lineTo(0.2 + (on ? Math.sin(t * 2) * 0.1 : 0), -1.3);
  ctx.stroke();
  ctx.strokeStyle = '#8a5a32';
  ctx.lineWidth = 0.05;
  ctx.stroke();
  const dy = on ? Math.sin(t * 2) * 0.25 : 0;
  ctx.strokeStyle = '#c9b48a';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(0.2, -1.3); ctx.lineTo(0.2, -0.9 + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(0.08, -0.9 + dy, 0.24, 0.16);
  ink(ctx, '#7d8696', 0.03);
}

export function drawArcherTower(ctx, t, on, attackAge) {
  box(ctx, -0.42, -0.1, 0.84, 1.3, '#59607a', '#6a7390', 0);
  stoneLines(ctx, -0.42, -0.1, 0.84, 1.3, 4);
  // площадка
  ctx.beginPath();
  ctx.rect(-0.52, -1.55, 1.04, 0.2);
  ink(ctx, '#8a5a32');
  // лучник-голова выглядывает
  ctx.save();
  ctx.translate(0, -1.72 + (attackAge < 0.15 ? -0.06 : 0));
  ctx.scale(0.6, 0.6);
  drawHoodHead(ctx, PALETTES.hero, t, {});
  ctx.restore();
  // крыша-конус
  ctx.beginPath();
  ctx.moveTo(-0.58, -1.95);
  ctx.lineTo(0, -2.6);
  ctx.lineTo(0.58, -1.95);
  ctx.closePath();
  ink(ctx, '#2f4fa0');
  ctx.beginPath();
  ctx.moveTo(0, -2.6); ctx.lineTo(0.58, -1.95); ctx.lineTo(0.1, -1.95);
  ctx.closePath();
  ctx.fillStyle = '#233c7c';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(-0.45, -1.55); ctx.lineTo(-0.45, -1.98);
  ctx.moveTo(0.45, -1.55); ctx.lineTo(0.45, -1.98);
  ctx.stroke();
  // флажок
  const f = Math.sin(t * 5) * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, -2.6); ctx.lineTo(0, -2.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -2.95);
  ctx.lineTo(0.3, -2.88 + f);
  ctx.lineTo(0, -2.78);
  ctx.closePath();
  ink(ctx, on ? '#f2c14e' : '#6a6a6a', 0.025);
}

export function drawBarracks(ctx, t) {
  roofed(ctx, 1.6, 0.8, '#59607a', '#4b5268', '#2f4fa0', '#233c7c');
  stoneLines(ctx, -0.8, -0.1, 1.6, 0.8, 3);
  // ворота
  ctx.beginPath();
  ctx.moveTo(-0.22, -0.1);
  ctx.lineTo(-0.22, -0.55);
  ctx.quadraticCurveTo(0, -0.75, 0.22, -0.55);
  ctx.lineTo(0.22, -0.1);
  ctx.closePath();
  ink(ctx, '#3a2414');
  // знамёна
  for (const sx of [-1, 1]) {
    const f = Math.sin(t * 3 + sx) * 0.03;
    ctx.beginPath();
    ctx.moveTo(sx * 0.55 - 0.13, -0.85);
    ctx.lineTo(sx * 0.55 + 0.13, -0.85);
    ctx.lineTo(sx * 0.55 + 0.13 + f, -0.35);
    ctx.lineTo(sx * 0.55 + f, -0.45);
    ctx.lineTo(sx * 0.55 - 0.13 + f, -0.35);
    ctx.closePath();
    ink(ctx, '#1f6fd1', 0.03);
    drawFleur(ctx, sx * 0.55 + f * 0.5, -0.66, 0.07, '#f2c14e');
  }
  // скрещённые мечи на фронтоне
  ctx.save();
  ctx.translate(0, -1.2);
  for (const r of [-0.6, 0.6]) {
    ctx.save();
    ctx.rotate(r);
    drawSword(ctx, 0.45);
    ctx.restore();
  }
  ctx.restore();
}

export function drawRepairHouse(ctx, t, working) {
  roofed(ctx, 1.4, 0.7, '#a0784a', '#8a6038', '#6a4a2a', '#4d3420');
  ctx.beginPath();
  ctx.rect(-0.18, -0.55, 0.36, 0.45);
  ink(ctx, '#3a2414');
  // вывеска-молот
  ctx.save();
  ctx.translate(0.5, -0.65);
  ctx.rotate(working ? Math.sin(t * 10) * 0.4 : -0.3);
  drawHammer(ctx, 1.1);
  ctx.restore();
  // шестерня
  ctx.save();
  ctx.translate(-0.45, -0.55);
  ctx.rotate(t * 0.8);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 0.15 : 0.2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ink(ctx, '#c9ced8', 0.03);
  ctx.restore();
}

export function drawWall(ctx, level) {
  const stone = level > 1 ? '#7d8696' : '#8a6a48';
  const top = level > 1 ? '#a9b0bd' : '#b08a5a';
  box(ctx, -0.5, -0.02, 1, 0.55, stone, top, 0.35);
  if (level > 1) stoneLines(ctx, -0.5, -0.02, 1, 0.55, 2);
  else {
    ctx.strokeStyle = 'rgba(27,19,32,0.4)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let x = -0.25; x < 0.5; x += 0.25) { ctx.moveTo(x, -0.02); ctx.lineTo(x, -0.57); }
    ctx.stroke();
  }
  // зубцы
  for (const x of [-0.42, -0.08, 0.26]) {
    ctx.beginPath();
    ctx.rect(x, -1.06, 0.16, 0.14);
    ink(ctx, top, 0.03);
  }
}

export function drawBeacon(ctx, t, lit) {
  box(ctx, -0.6, -0.1, 1.2, 2.2, lit ? '#59607a' : '#3a3d4a', lit ? '#6a7390' : '#4a4d5a', 0);
  stoneLines(ctx, -0.6, -0.1, 1.2, 2.2, 6);
  ctx.beginPath();
  ctx.rect(-0.75, -2.5, 1.5, 0.22);
  ink(ctx, lit ? '#8a5a32' : '#4a3a2a');
  if (lit) {
    const g = ctx.createRadialGradient(0, -2.9, 0.05, 0, -2.9, 2.2);
    g.addColorStop(0, 'rgba(255,230,140,0.7)');
    g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -2.9, 2.2, 0, Math.PI * 2);
    ctx.fill();
    const f = Math.sin(t * 9) * 0.05;
    ctx.beginPath();
    ctx.moveTo(-0.22, -2.55);
    ctx.quadraticCurveTo(-0.25, -3.0, 0 + f, -3.35);
    ctx.quadraticCurveTo(0.25, -3.0, 0.22, -2.55);
    ctx.closePath();
    ink(ctx, '#ffb347', 0.04);
    ctx.beginPath();
    ctx.moveTo(-0.1, -2.6);
    ctx.quadraticCurveTo(-0.1, -2.9, f, -3.1);
    ctx.quadraticCurveTo(0.1, -2.9, 0.1, -2.6);
    ctx.closePath();
    ctx.fillStyle = '#fff3c4';
    ctx.fill();
  } else {
    // разбитый верх
    ctx.beginPath();
    ctx.moveTo(-0.5, -2.5);
    ctx.lineTo(-0.3, -2.85);
    ctx.lineTo(-0.1, -2.6);
    ctx.lineTo(0.15, -2.95);
    ctx.lineTo(0.5, -2.5);
    ctx.closePath();
    ink(ctx, '#3a3d4a');
  }
}

export function drawRubble(ctx, size, t) {
  const w = size * 0.8;
  for (let i = 0; i < 6 + size * 2; i++) {
    const x = (((i * 37) % 17) / 17 - 0.5) * w;
    const y = -0.1 - (((i * 23) % 11) / 11) * 0.35 * size;
    ctx.beginPath();
    ctx.arc(x, y, 0.1 + ((i * 13) % 5) * 0.025, 0, Math.PI * 2);
    ink(ctx, i % 3 ? '#5a5f70' : '#7a5a3a', 0.03);
  }
  ctx.save();
  ctx.translate(-w * 0.2, -0.3);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.rect(-0.3, -0.04, 0.6, 0.08);
  ink(ctx, '#8a5a32', 0.025);
  ctx.restore();
  // дымок
  ctx.fillStyle = 'rgba(90,90,100,0.25)';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.5 + i / 3) % 1;
    ctx.save();
    ctx.globalAlpha *= 1 - ph;
    ctx.beginPath();
    ctx.arc(Math.sin(i * 2 + t) * 0.1, -0.4 - ph * 1.2, 0.1 + ph * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
