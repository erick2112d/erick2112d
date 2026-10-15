// Природа и активности на карте. Начало координат — точка на земле.
import { OUTLINE, ink, ellipse, poly, shade, hash, planksFill, glow } from './common.js';

const TREE_STYLES = [
  null,
  { leaves: ['#24452f', '#346a3c', '#4c8a46'], trunk: '#5a3a24', kind: 'oak' },
  { leaves: ['#1f3a30', '#2c5640', '#3e7050'], trunk: '#4a3020', kind: 'pine' },
  { leaves: ['#4a5a7a', '#6a7aa0', '#9aaad0'], trunk: '#6a6a80', kind: 'moon' },
  { leaves: ['#1f4a4a', '#2c6a6a', '#5ab0a0'], trunk: '#3a4a4a', kind: 'pine' },
  { leaves: ['#3a2430', '#5a3040', '#7a4050'], trunk: '#2a1a1e', kind: 'dead' },
];

export function tree(ctx, zone = 1, sway = 0, seed = 0) {
  const st = TREE_STYLES[Math.min(5, Math.max(1, zone))];
  // корни
  ctx.fillStyle = shade(st.trunk, -0.2);
  ellipse(ctx, 0, 0, 0.22, 0.07);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.11, 0.04);
  ctx.lineTo(-0.08, -0.38);
  ctx.lineTo(0.08, -0.38);
  ctx.lineTo(0.11, 0.04);
  ctx.quadraticCurveTo(0, 0.08, -0.11, 0.04);
  ctx.closePath();
  ink(ctx, st.trunk);
  ctx.strokeStyle = shade(st.trunk, -0.35);
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.moveTo(-0.03, -0.05); ctx.lineTo(-0.02, -0.3);
  ctx.moveTo(0.04, -0.1); ctx.lineTo(0.03, -0.25);
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -0.3);
  ctx.rotate(sway);
  ctx.translate(0, 0.3);
  if (st.kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const y = -0.35 - i * 0.24;
      const w = 0.42 - i * 0.1;
      poly(ctx, [[-w, y], [0, y - 0.42], [w, y]]);
      ink(ctx, st.leaves[i]);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      poly(ctx, [[0.02, y - 0.38], [w, y], [w * 0.2, y]]);
      ctx.fill();
    }
    if (zone === 4) {
      ctx.fillStyle = '#9ff5e8';
      for (let i = 0; i < 4; i++) { ellipse(ctx, -0.2 + hash(seed + i) * 0.4, -0.5 - hash(seed * 3 + i) * 0.5, 0.025, 0.025); ctx.fill(); }
    }
  } else if (st.kind === 'dead') {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(0, -0.36); ctx.lineTo(0, -0.8);
    ctx.moveTo(0, -0.55); ctx.lineTo(-0.28, -0.85);
    ctx.moveTo(0, -0.65); ctx.lineTo(0.26, -0.95);
    ctx.moveTo(-0.14, -0.7); ctx.lineTo(-0.2, -0.98);
    ctx.stroke();
    ctx.strokeStyle = st.trunk;
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.fillStyle = '#ff7a4a';
    for (let i = 0; i < 3; i++) { ellipse(ctx, -0.15 + i * 0.15, -0.8 - (i % 2) * 0.1, 0.025, 0.025); ctx.fill(); }
  } else {
    const blobs = [[0, -0.55, 0.42, 0], [-0.24, -0.66, 0.28, 1], [0.24, -0.7, 0.28, 1], [0.02, -0.92, 0.3, 2], [-0.1, -0.78, 0.2, 2]];
    for (const [x, y, r, c] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ink(ctx, st.leaves[c]);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ellipse(ctx, -0.08, -0.98, 0.13, 0.08);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ellipse(ctx, 0.16, -0.48, 0.2, 0.12);
    ctx.fill();
    if (st.kind === 'moon') {
      ctx.fillStyle = '#dfe8ff';
      for (let i = 0; i < 5; i++) { ellipse(ctx, -0.25 + hash(seed + i) * 0.5, -0.5 - hash(seed * 5 + i) * 0.5, 0.022, 0.022); ctx.fill(); }
    } else if (hash(seed) > 0.6) {
      // яблоки
      ctx.fillStyle = '#d93a3a';
      for (let i = 0; i < 3; i++) { ellipse(ctx, -0.2 + hash(seed + i * 3) * 0.4, -0.45 - hash(seed * 7 + i) * 0.4, 0.035, 0.035); ink(ctx, '#d93a3a', 0.015); }
    }
  }
  ctx.restore();
}

export function bush(ctx, hp, max) {
  ellipse(ctx, 0, -0.18, 0.32, 0.22);
  ink(ctx, '#2c5a32');
  ellipse(ctx, -0.12, -0.26, 0.18, 0.14);
  ink(ctx, '#3a7a40');
  ellipse(ctx, 0.12, -0.24, 0.16, 0.13);
  ink(ctx, '#3a7a40');
  const n = Math.ceil((hp / max) * 6);
  for (let i = 0; i < n; i++) {
    const x = -0.2 + ((i * 37) % 9) * 0.05;
    const y = -0.32 + ((i * 23) % 5) * 0.05;
    ellipse(ctx, x, y, 0.04, 0.04);
    ink(ctx, i % 2 ? '#d93a6a' : '#7a3aff', 0.015);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ellipse(ctx, x - 0.012, y - 0.012, 0.012, 0.012);
    ctx.fill();
  }
}

function boulder(ctx, base, light, k = 1) {
  ctx.save();
  ctx.scale(k, k);
  poly(ctx, [[-0.4, 0.02], [-0.33, -0.3], [-0.06, -0.46], [0.26, -0.4], [0.42, -0.12], [0.34, 0.06]]);
  ink(ctx, base);
  poly(ctx, [[-0.06, -0.46], [0.02, -0.16], [0.42, -0.12], [0.26, -0.4]]);
  ink(ctx, light, 0.03);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.22); ctx.lineTo(-0.1, -0.06); ctx.lineTo(-0.14, 0.0);
  ctx.stroke();
  ctx.restore();
}

export function rock(ctx, kind, hp, max, t = 0) {
  const k = 0.6 + 0.4 * (hp / max);
  switch (kind) {
    case 'rock': boulder(ctx, '#7d8696', '#a9b0bd', k); break;
    case 'ironVein':
      boulder(ctx, '#6a6070', '#8a8090', k);
      ctx.fillStyle = '#c0703a';
      for (const [x, y] of [[-0.15, -0.2], [0.1, -0.28], [0.2, -0.1], [-0.05, -0.08]]) { poly(ctx, [[x * k, y * k], [(x + 0.06) * k, (y - 0.04) * k], [(x + 0.08) * k, (y + 0.03) * k]]); ink(ctx, '#c0703a', 0.015); }
      break;
    case 'coalSeam':
      boulder(ctx, '#3a3a44', '#55555f', k);
      ctx.fillStyle = '#1a1a20';
      for (const [x, y] of [[-0.18, -0.18], [0.08, -0.25], [0.18, -0.06]]) { ellipse(ctx, x * k, y * k, 0.06 * k, 0.045 * k); ink(ctx, '#15151a', 0.015); }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ellipse(ctx, 0.06 * k, -0.27 * k, 0.02, 0.012);
      ctx.fill();
      break;
    case 'silver':
      boulder(ctx, '#4a5068', '#6a7090', k);
      ctx.strokeStyle = '#eef4ff';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(-0.25 * k, -0.15 * k); ctx.lineTo(-0.05 * k, -0.28 * k); ctx.lineTo(0.12 * k, -0.2 * k); ctx.lineTo(0.3 * k, -0.3 * k);
      ctx.stroke();
      break;
    case 'mithril':
      boulder(ctx, '#2a3a44', '#3e5660', k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(110,255,230,${0.3 + Math.sin(t * 3) * 0.1})`;
      ellipse(ctx, 0, -0.2, 0.35 * k, 0.25 * k);
      ctx.fill();
      ctx.restore();
      for (const [x, y] of [[-0.12, -0.2], [0.12, -0.24], [0.02, -0.08]]) { poly(ctx, [[x * k, (y - 0.08) * k], [(x + 0.04) * k, y * k], [x * k, (y + 0.06) * k], [(x - 0.04) * k, y * k]]); ink(ctx, '#9ff5e8', 0.015); }
      break;
    case 'meteor':
      ellipse(ctx, 0, -0.2 * k, 0.4 * k, 0.3 * k);
      ink(ctx, '#3a2a3a');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,140,240,${0.7 + Math.sin(t * 4) * 0.2})`;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(-0.25 * k, -0.2 * k); ctx.lineTo(-0.05 * k, -0.3 * k); ctx.lineTo(0.05 * k, -0.15 * k); ctx.lineTo(0.25 * k, -0.25 * k);
      ctx.moveTo(-0.05 * k, -0.3 * k); ctx.lineTo(0.0, -0.42 * k);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,140,240,0.25)';
      ellipse(ctx, 0, -0.2 * k, 0.5 * k, 0.4 * k);
      ctx.fill();
      ctx.restore();
      break;
    case 'crystal': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(127,243,255,${0.25 + Math.sin(t * 2.5) * 0.08})`;
      ellipse(ctx, 0, -0.25, 0.45 * k, 0.35 * k);
      ctx.fill();
      ctx.restore();
      ellipse(ctx, 0, 0, 0.3 * k, 0.08);
      ink(ctx, '#3a4258', 0.03);
      const shards = [[-0.16, 0.12, -0.35], [0.0, 0.14, -0.6], [0.16, 0.11, -0.4], [-0.06, 0.08, -0.28], [0.1, 0.08, -0.25]];
      for (const [x, w, h] of shards) {
        poly(ctx, [[(x - w / 2) * k, 0], [(x - w / 3) * k, h * k], [x * k, (h - 0.08) * k], [(x + w / 3) * k, h * k], [(x + w / 2) * k, 0]]);
        ink(ctx, '#7ff3ff', 0.025);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        poly(ctx, [[(x - w / 3) * k, (h * 0.9) * k], [(x - w / 6) * k, (h * 0.85) * k], [(x - w / 4) * k, -0.02]]);
        ctx.fill();
      }
      break;
    }
    default: boulder(ctx, '#7d8696', '#a9b0bd', k);
  }
}

export function chest(ctx, t = 0) {
  const bob = Math.sin(t * 3) * 0.02;
  ctx.save();
  ctx.translate(0, bob);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,210,90,${0.18 + Math.sin(t * 3) * 0.06})`;
  ellipse(ctx, 0, -0.2, 0.5, 0.4);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.rect(-0.3, -0.3, 0.6, 0.3);
  ink(ctx, '#8a5a32');
  ctx.save();
  ctx.clip();
  planksFill(ctx, -0.3, -0.3, 0.6, 0.3, 3, '#8a5a32', false, 4);
  ctx.restore();
  ctx.beginPath();
  ctx.rect(-0.3, -0.3, 0.6, 0.3);
  ink(ctx, null);
  ctx.beginPath();
  ctx.moveTo(-0.32, -0.3);
  ctx.quadraticCurveTo(0, -0.52, 0.32, -0.3);
  ctx.closePath();
  ink(ctx, '#a0683a');
  for (const x of [-0.22, 0.18]) { ctx.beginPath(); ctx.rect(x, -0.44, 0.06, 0.44); ink(ctx, '#f2c14e', 0.02); }
  ctx.beginPath();
  ctx.rect(-0.05, -0.34, 0.1, 0.1);
  ink(ctx, '#f2c14e', 0.02);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(-0.012, -0.3, 0.024, 0.04);
  ctx.restore();
}

export function shrine(ctx, ready, t = 0) {
  ellipse(ctx, 0, 0, 0.5, 0.18);
  ink(ctx, '#4a4a58');
  ctx.beginPath();
  ctx.rect(-0.18, -0.95, 0.36, 0.95);
  ink(ctx, '#7d8696');
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0.02, -0.95, 0.16, 0.95);
  ctx.beginPath();
  ctx.rect(-0.26, -1.05, 0.52, 0.12);
  ink(ctx, '#a9b0bd');
  ctx.strokeStyle = ready ? '#7ff3ff' : '#4a5060';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(0, -0.8); ctx.lineTo(-0.08, -0.6); ctx.lineTo(0.06, -0.5); ctx.lineTo(-0.04, -0.3);
  ctx.stroke();
  if (ready) {
    const y = -1.35 + Math.sin(t * 2) * 0.06;
    glow(ctx, 0, y, 0.7, '127,243,255', 0.8);
    poly(ctx, [[0, y - 0.18], [0.12, y], [0, y + 0.18], [-0.12, y]]);
    ink(ctx, '#bffaff', 0.025);
  }
}

export function rift(ctx, t = 0, hpRatio = 1) {
  glow(ctx, 0, -0.5, 1.3, '180,80,255', 0.6);
  ctx.save();
  ctx.translate(0, -0.55);
  ctx.scale(0.55 + hpRatio * 0.2, 1);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(t * (0.8 + i * 0.4));
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = 0.55 - i * 0.14 + Math.sin(a * 3 + t * 4 + i) * 0.06;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.4);
    }
    ctx.closePath();
    ctx.fillStyle = ['#2a0a4a', '#5a1a8a', '#b07aff'][i];
    ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, 0, 0, 0.05, 0.12);
  ctx.fill();
  ctx.restore();
  // осколки камня вокруг
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t * 0.6;
    const x = Math.cos(a) * 0.7;
    const y = -0.5 + Math.sin(a) * 0.35 + Math.sin(t * 3 + i) * 0.05;
    poly(ctx, [[x - 0.06, y], [x, y - 0.08], [x + 0.06, y + 0.02], [x, y + 0.06]]);
    ink(ctx, '#3a2a4a', 0.02);
  }
}

export function note(ctx, t = 0) {
  ctx.beginPath();
  ctx.rect(-0.03, -0.55, 0.06, 0.55);
  ink(ctx, '#6b3d1f', 0.025);
  const y = -0.62 + Math.sin(t * 2) * 0.02;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,230,160,0.25)';
  ellipse(ctx, 0, y, 0.35, 0.3);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.rect(-0.18, y - 0.14, 0.36, 0.26);
  ink(ctx, '#f6ead6', 0.03);
  for (const yy of [y - 0.14, y + 0.12]) { ellipse(ctx, -0.18, yy, 0.03, 0.03); ink(ctx, '#e0c9a0', 0.015); ellipse(ctx, 0.18, yy, 0.03, 0.03); ink(ctx, '#e0c9a0', 0.015); }
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { ctx.moveTo(-0.12, y - 0.07 + i * 0.06); ctx.lineTo(0.12, y - 0.07 + i * 0.06); }
  ctx.stroke();
  ellipse(ctx, 0.08, y + 0.09, 0.035, 0.035);
  ink(ctx, '#c93a3a', 0.015);
}

export function wagon(ctx, t = 0) {
  // колёса
  for (const x of [-0.5, 0.5]) {
    ellipse(ctx, x, -0.18, 0.2, 0.2);
    ink(ctx, '#6b3d1f');
    ellipse(ctx, x, -0.18, 0.05, 0.05);
    ink(ctx, '#f2c14e', 0.02);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) { ctx.moveTo(x, -0.18); ctx.lineTo(x + Math.cos(a) * 0.18, -0.18 + Math.sin(a) * 0.18); }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.rect(-0.7, -0.6, 1.4, 0.35);
  ink(ctx, '#8a5a32');
  ctx.save();
  ctx.clip();
  planksFill(ctx, -0.7, -0.6, 1.4, 0.35, 3, '#8a5a32', false, 9);
  ctx.restore();
  ctx.beginPath();
  ctx.rect(-0.7, -0.6, 1.4, 0.35);
  ink(ctx, null);
  // тент
  ctx.beginPath();
  ctx.moveTo(-0.66, -0.6);
  ctx.quadraticCurveTo(-0.7, -1.4, 0, -1.45);
  ctx.quadraticCurveTo(0.7, -1.4, 0.66, -0.6);
  ctx.closePath();
  ink(ctx, '#d0b080');
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#b03a3a';
  for (let x = -0.6; x < 0.7; x += 0.3) ctx.fillRect(x, -1.5, 0.14, 1);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-0.66, -0.6);
  ctx.quadraticCurveTo(-0.7, -1.4, 0, -1.45);
  ctx.quadraticCurveTo(0.7, -1.4, 0.66, -0.6);
  ink(ctx, null);
  // вывеска-монета
  const y = -1.65 + Math.sin(t * 2) * 0.04;
  ellipse(ctx, 0, y, 0.15, 0.15);
  ink(ctx, '#ffd34d', 0.03);
  ellipse(ctx, 0, y, 0.08, 0.08);
  ctx.strokeStyle = '#c9902a';
  ctx.lineWidth = 0.02;
  ctx.stroke();
  // товары
  ctx.beginPath();
  ctx.rect(-0.5, -0.78, 0.22, 0.18);
  ink(ctx, '#7a4524', 0.02);
  ellipse(ctx, 0.35, -0.7, 0.12, 0.1);
  ink(ctx, '#c9a06a', 0.02);
}
