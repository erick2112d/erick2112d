// Предзагрузка: заранее рисуем и расшифровываем все картинки интерфейса (иконки зданий, предметов,
// ресурсов, портреты) и держим их в памяти. Тогда окна при переключении вкладок не мигают на телефоне.
import { BUILDINGS, ITEMS, MATERIAL_ORDER, CURRENCIES, ENEMIES, BUILD_CATEGORIES } from '../data/index.js';
import { resIcon, buildingIcon, itemIcon, portrait, enemyPortrait, uiIcon, heroFigure } from './icons.js';

const KEEP = new Map(); // адрес картинки → расшифрованное изображение (живёт всю игру)

const UI_ICONS = [
  'bag', 'trophy', 'shop', 'scroll', 'soundOn', 'soundOff', 'menu', 'hammer', 'army', 'crit', 'damage', 'defense',
  'demolish', 'economy', 'haste', 'hero', 'hp', 'lock', 'medal', 'melee', 'power', 'production', 'repair', 'speed',
  'up', 'armor', 'bagAll', 'gear', 'goldFind', 'regen', 'trinket', 'swords',
];
const BIG_UI = [['ad', 72], ['gemChest', 72], ['gemPile', 72], ['shop', 64], ['shop', 72]];
const RES_SIZES = [26, 32, 40, 48, 64];

// уступаем поток коротко (экран загрузки успевает перерисоваться), но не ждём целый кадр
const breathe = () => new Promise((ok) => setTimeout(ok, 0));

// Держит картинку расшифрованной; вызывается и для новых картинок (например, фигура героя после смены доспеха).
export function keepDecoded(url) {
  if (!url || KEEP.has(url)) return null;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  KEEP.set(url, img);
  return img.decode ? img.decode().catch(() => {}) : null;
}

export async function preloadAssets(game, onProgress = () => {}) {
  const jobs = [];
  for (const n of UI_ICONS) jobs.push(() => uiIcon(n));
  for (const [n, s] of BIG_UI) jobs.push(() => uiIcon(n, s));
  for (const c of BUILD_CATEGORIES) jobs.push(() => uiIcon(c.id));
  for (const k of [...Object.keys(CURRENCIES), ...MATERIAL_ORDER, 'energy']) for (const s of RES_SIZES) jobs.push(() => resIcon(k, s));
  for (const t of Object.keys(BUILDINGS)) jobs.push(() => buildingIcon(t));
  for (const id of Object.keys(ITEMS)) jobs.push(() => itemIcon(id));
  jobs.push(() => portrait('hero'));
  for (const t of Object.keys(ENEMIES)) jobs.push(() => enemyPortrait(t));
  const eq = game.inventory.equipped;
  jobs.push(() => heroFigure(eq.armor, eq.amulet, eq.weapon));

  const decodes = [];
  let t0 = performance.now();
  for (let i = 0; i < jobs.length; i++) {
    let url = null;
    try { url = jobs[i](); } catch { /* одна иконка не должна ломать загрузку */ }
    const d = keepDecoded(url);
    if (d) decodes.push(d);
    // отдаём кадр экрану загрузки, чтобы полоса двигалась плавно
    if (performance.now() - t0 > 24) {
      onProgress((i + 1) / jobs.length);
      await breathe();
      t0 = performance.now();
    }
  }
  await Promise.all(decodes);
  onProgress(1);
}
