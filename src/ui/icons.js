// Маленькие иконки ресурсов и построек для интерфейса. Нарисованы теми же функциями, что и игра.
import * as art from '../render/art.js';

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
  draw(ctx);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function resIcon(res) {
  return render('res-' + res, 24, 24, (ctx) => {
    ctx.translate(12, 12);
    ctx.scale(20, 20);
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = art.OUTLINE;
    switch (res) {
      case 'wood':
        ctx.rotate(-0.4);
        ctx.beginPath(); ctx.rect(-0.38, -0.16, 0.7, 0.32); ctx.fillStyle = '#9a6234'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0.32, 0, 0.1, 0.16, 0, 0, Math.PI * 2); ctx.fillStyle = '#e0b07a'; ctx.fill(); ctx.stroke();
        break;
      case 'planks':
        for (const y of [-0.22, 0.02]) {
          ctx.beginPath(); ctx.rect(-0.4, y, 0.8, 0.2); ctx.fillStyle = '#e6c27a'; ctx.fill(); ctx.stroke();
        }
        break;
      case 'stone':
        ctx.beginPath(); ctx.moveTo(-0.38, 0.25); ctx.lineTo(-0.3, -0.15); ctx.lineTo(0, -0.35); ctx.lineTo(0.35, -0.1); ctx.lineTo(0.38, 0.25); ctx.closePath();
        ctx.fillStyle = '#a9b0bd'; ctx.fill(); ctx.stroke();
        break;
      case 'gold':
        ctx.beginPath(); ctx.arc(0, 0, 0.36, 0, Math.PI * 2); ctx.fillStyle = '#ffd34d'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 0.2, 0, Math.PI * 2); ctx.strokeStyle = '#c9902a'; ctx.stroke();
        break;
      case 'shards':
        ctx.beginPath(); ctx.moveTo(0, -0.42); ctx.lineTo(0.22, 0); ctx.lineTo(0, 0.42); ctx.lineTo(-0.22, 0); ctx.closePath();
        ctx.fillStyle = '#7ff3ff'; ctx.fill(); ctx.stroke();
        break;
      case 'energy':
        ctx.beginPath(); ctx.moveTo(0.08, -0.42); ctx.lineTo(-0.25, 0.06); ctx.lineTo(-0.02, 0.06); ctx.lineTo(-0.1, 0.42); ctx.lineTo(0.25, -0.08); ctx.lineTo(0.02, -0.08); ctx.closePath();
        ctx.fillStyle = '#ffcf3a'; ctx.fill(); ctx.stroke();
        break;
      default:
    }
  });
}

export function buildingIcon(type) {
  return render('b-' + type, 64, 64, (ctx) => {
    const tall = type === 'archerTower' || type === 'beacon';
    ctx.translate(32, tall ? 60 : 56);
    const k = tall ? 19 : type === 'wall' ? 34 : type === 'heart' ? 14 : 24;
    ctx.scale(k, k);
    switch (type) {
      case 'generator': art.drawGenerator(ctx, 0.3, true); break;
      case 'sawmill': art.drawSawmill(ctx, 0, false); break;
      case 'quarry': art.drawQuarry(ctx, 0, false); break;
      case 'archerTower': art.drawArcherTower(ctx, 0, true, 9); break;
      case 'barracks': art.drawBarracks(ctx, 0); break;
      case 'repairHouse': art.drawRepairHouse(ctx, 0, false); break;
      case 'wall': art.drawWall(ctx, 1); break;
      case 'heart': ctx.translate(0, 0.6); art.drawHeart(ctx, 0, 1); break;
      case 'beacon': art.drawBeacon(ctx, 0, true); break;
      default:
    }
  });
}

export function weaponIcon(w) {
  return render('w-' + w, 48, 48, (ctx) => {
    ctx.translate(24, 24);
    ctx.scale(44, 44);
    ctx.rotate(0.6);
    if (w === 'sword') { ctx.translate(0, 0.2); art.drawSword(ctx); }
    if (w === 'bow') { ctx.rotate(-0.6); art.drawBow(ctx, 0); }
    if (w === 'staff') { ctx.translate(0, 0.15); art.drawStaff(ctx, 0.5, 0, 0.8); }
  });
}

export function portrait(kind) {
  return render('p-' + kind, 48, 48, (ctx) => {
    ctx.translate(22, 26);
    ctx.scale(52, 52);
    if (kind === 'hero') art.drawHoodHead(ctx, art.PALETTES.hero, 0, {});
    else art.drawSkullHead(ctx, art.PALETTES[kind] || art.PALETTES.skeleton, 0, { helmet: kind === 'brute', crown: kind === 'boss' });
  });
}
