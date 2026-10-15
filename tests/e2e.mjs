// Сквозная проверка в настоящем браузере: игрок проходит основные механики через интерфейс.
// Запуск: npm run e2e  (скриншоты — в test-results/). MOBILE=1 — телефонный экран.
import { mkdirSync } from 'node:fs';
import { startServer } from '../scripts/serve.mjs';

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  ({ chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs'));
}

const OUT = new URL('../test-results/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 8093;
const server = await startServer(PORT);
const browser = await chromium.launch();
const viewport = { width: 1280, height: 760 };
const context = await browser.newContext({ viewport });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('• ОШИБКА СТРАНИЦЫ:', e.stack || e.message); });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const log = (...a) => console.log('•', ...a);
let shot = 0;
const snap = (name) => page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => page.waitForTimeout(ms);
function check(cond, msg) {
  if (!cond) throw new Error('ПРОВЕРКА НЕ ПРОЙДЕНА: ' + msg);
  log('✔', msg);
}
const st = () => ev(() => {
  const g = window.__LL.game;
  return { res: { ...g.res }, phase: g.phase, heart: g.heartLevel, radius: g.radius(), buildings: g.buildings.map((b) => ({ id: b.id, type: b.type, level: b.level })),
    progress: { ...g.progress }, modal: window.__LL.hud.modal, window: window.__LL.hud.window?.kind || null, items: [...g.inventory.items], weapon: g.inventory.equipped.weapon };
});

async function closeModals() {
  for (let i = 0; i < 12; i++) {
    const m = await ev(() => window.__LL.hud.modal);
    if (!m || m === 'result') return;
    await page.click('#modal [data-action="closeModal"], #modal [data-action="resume"]');
    await sleep(120);
  }
}

// Касание земли или цели: герой сам идёт (обходит препятствия).
async function walkTo(x, y, near = 1.2, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const h = await ev(() => ({ x: window.__LL.game.hero.x, y: window.__LL.game.hero.y, t: window.__LL.game.hero.moveTarget }));
    if (Math.hypot(x - h.x, y - h.y) < near) return;
    if (!h.t) {
      const pt = await ev(([a, b, w, hh]) => {
        const r = window.__LL.renderer;
        const g = window.__LL.game;
        let [sx, sy] = r.toScreen(a, b);
        const [hx, hy] = r.toScreen(g.hero.x, g.hero.y);
        const x0 = w * 0.3; const x1 = w * 0.7; const y0 = hh * 0.25; const y1 = hh * 0.7;
        if (sx < x0 || sx > x1 || sy < y0 || sy > y1) {
          const dx = sx - hx; const dy = sy - hy;
          const k = Math.min(Math.abs((dx > 0 ? x1 - hx : x0 - hx) / (dx || 1e-6)), Math.abs((dy > 0 ? y1 - hy : y0 - hy) / (dy || 1e-6)), 1);
          sx = hx + dx * k; sy = hy + dy * k;
        }
        for (const [ox, oy] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [100, 60], [-100, -60]]) {
          const p = r.toWorld(sx + ox, sy + oy);
          const tx = Math.floor(p.x); const ty = Math.floor(p.y);
          if (!g.buildingAt(tx, ty) && !g.buildingAt(tx, ty + 1) && !g.buildingAt(tx, ty + 2)) return [sx + ox, sy + oy];
        }
        return [sx, sy];
      }, [x, y, viewport.width, viewport.height]);
      await page.mouse.click(pt[0], pt[1]);
    }
    await sleep(120);
  }
}

async function chopUntil(res, amount, timeout = 70000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await st();
    if ((s.res[res] || 0) >= amount) return;
    const kinds = res === 'wood' ? ['tree'] : res === 'stone' ? ['rock'] : ['bush'];
    const node = await ev((k) => {
      const g = window.__LL.game;
      const n = g.nodes.filter((x) => k.includes(x.kind) && x.hp > 0 && g.inTerritory(x.x, x.y, 0.6))
        .sort((a, b) => Math.hypot(a.x - g.hero.x, a.y - g.hero.y) - Math.hypot(b.x - g.hero.x, b.y - g.hero.y))[0];
      return n ? { x: n.x, y: n.y, id: n.id } : null;
    }, kinds);
    if (!node) { await sleep(500); continue; }
    await walkTo(node.x, node.y, 1.45, 9000);
    const fr = await ev(() => ({ modal: window.__LL.hud.modal, win: window.__LL.hud.window?.kind || null, t: window.__LL.game.time }));
    if (fr.modal || fr.win) log(`окно мешает добыче: ${JSON.stringify(fr)}`);
    const t1 = Date.now();
    while (Date.now() - t1 < 4000) {
      if (!(await ev((id) => !!window.__LL.game.nodeById(id), node.id))) break;
      await sleep(100);
    }
  }
  throw new Error(`не удалось добыть ${res}: ${JSON.stringify((await st()).res)}`);
}

// Стройка через меню «Строить»: вкладка → карточка → клик по месту на карте.
async function buildVia(type, dx, dy) {
  const info = await ev(([t, x, y]) => {
    const g = window.__LL.game;
    const c = g.heartCenter();
    return { spot: g.findSpot(t, c.x + x, c.y + y), size: window.__LL.BUILDINGS[t].size, cat: window.__LL.BUILDINGS[t].category };
  }, [type, dx, dy]);
  check(info.spot, `есть место для «${type}»`);
  await walkTo(info.spot.tx + info.size / 2, info.spot.ty + info.size + 1.5, 2.5, 10000);
  await sleep(500);
  const before = (await st()).buildings.length;
  await page.click('[data-action="buildMenu"]');
  await page.click(`[data-action="buildTab"][data-tab="${info.cat}"]`);
  await page.click(`[data-action="pickBuild"][data-type="${type}"]`);
  await sleep(100);
  const [sx, sy] = await ev(([x, y]) => window.__LL.renderer.toScreen(x, y), [info.spot.tx + info.size / 2, info.spot.ty + info.size / 2]);
  await page.mouse.move(sx, sy);
  await page.mouse.click(sx, sy);
  await sleep(150);
  await ev(() => window.__LL.hud.cancelBuild());
  const after = await st();
  check(after.buildings.length === before + 1, `построено через меню: ${type}`);
  return after.buildings[after.buildings.length - 1];
}

async function clickBuilding(id) {
  const b = await ev((bid) => { const g = window.__LL.game; const x = g.byId(bid); const c = g.center(x); return { x: c.x, y: x.ty + x.size }; }, id);
  const [ox, oy] = await ev(([x, y]) => window.__LL.renderer.toScreen(x, y), [b.x, b.y]);
  if (ox < 120 || oy < 140 || ox > viewport.width - 360 || oy > viewport.height - 160) {
    await walkTo(b.x, b.y + 1.5, 2, 12000);
    await sleep(600);
  }
  const [sx, sy] = await ev((bid) => { const g = window.__LL.game; const b = g.byId(bid); const c = g.center(b); return window.__LL.renderer.toScreen(c.x, b.ty + b.size - 0.3); }, id);
  await page.mouse.click(sx, sy);
  await sleep(200);
}

async function playWave(speed = 3) {
  const n = (await st()).progress.nextWave;
  await page.click('[data-action="startWave"]');
  await ev((v) => window.__LL.setSpeed(v), speed);
  check((await st()).phase === 'wave', `волна ${n} началась`);
  const t0 = Date.now();
  let shotDone = false;
  while (Date.now() - t0 < 150000) {
    const s = await st();
    if (!shotDone && (await ev(() => window.__LL.game.enemies.length)) >= 3) { await snap(`wave${n}`); shotDone = true; }
    if (s.modal === 'result' || (s.phase === 'build' && s.modal)) break;
    await sleep(250);
  }
  await ev(() => window.__LL.setSpeed(1));
  await closeModals();
  const s = await st();
  return { n, victory: s.progress.highestCleared >= n };
}

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__LL && !document.getElementById('loader'));
  await snap('intro');
  check((await st()).modal === 'story', 'показано вступление');
  await closeModals();
  const top = await page.$$eval('.currencies .cur', (els) => els.length);
  check(top === 3, 'сверху только монеты, самоцветы и еда');

  // 1. Добыча и первые постройки
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil('wood', 30);
  check(true, 'герой добыл древесину');
  await buildVia('workerCamp', -4, 3);
  await ev(() => window.__LL.setSpeed(4));
  await page.waitForFunction(() => window.__LL.game.workers.length >= 1, null, { timeout: 15000 });
  check(true, 'лагерь выпустил рабочих');
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil('wood', 45);
  await buildVia('generator', -4, -2);
  await chopUntil('wood', 40);
  await buildVia('sawmill', 4, -2);
  await chopUntil('wood', 40);
  await ev(() => window.__LL.setSpeed(8));
  await page.waitForFunction(() => window.__LL.game.res.planks >= 10, null, { timeout: 40000 });
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil('wood', 20);
  const side = await ev(() => window.__LL.game.wavePreview().sides[0]);
  const v = { N: [0, -3], E: [3, 0], S: [0, 3], W: [-3, 0] }[side];
  await buildVia('archerTower', v[0], v[1]);
  await snap('base');

  // 2. Волна 1
  const r1 = await playWave(3);
  check(r1.victory, 'волна 1 отражена');
  await snap('result1');
  await page.click('#modal .primary[data-action="nextWave"]');
  await sleep(150);
  await closeModals();

  // 3. Улучшение Сердца через карточку: территория растёт
  await ev(() => window.__LL.setSpeed(3));
  const need = await ev(() => window.__LL.game.heartUpgradeCost());
  log('цена Сердца 1→2:', JSON.stringify(need));
  await chopUntil('wood', need.wood + 5);
  await chopUntil('stone', need.stone);
  await ev(() => window.__LL.setSpeed(1));
  const before = await st();
  await clickBuilding(before.buildings[0].id);
  check(await page.isVisible('#card'), 'карточка Сердца открылась');
  await snap('heart-card');
  if (before.res.food < need.food || before.res.gold < need.gold) log('ресурсов на Сердце не хватает, ждём ферму/монеты');
  await page.click('#card .primary[data-action="upgrade"]');
  await sleep(300);
  await closeModals();
  const after = await st();
  check(after.heart === 2 && after.radius > before.radius, `Сердце 2 уровня, свет шире (${before.radius.toFixed(1)} → ${after.radius.toFixed(1)})`);
  await ev(() => window.__LL.hud.closeCard());

  // Дальше для проверки интерфейса выдаём ресурсы (экономика проверяется юнит-тестами)
  await ev(() => {
    const g = window.__LL.game;
    for (const k of ['wood', 'stone', 'planks', 'bricks', 'iron', 'coal', 'bones']) g.res[k] = 280;
    g.res.gold = 3000; g.res.food = 600; g.res.gems = 120;
    for (let i = 0; i < 4; i++) g.upgradeHeart();
  });
  await closeModals();
  check((await st()).heart === 6, 'Сердце улучшено до 6');

  // 4. Забор протягиванием: одна группа с общей прочностью
  const wallSpot = await ev(() => {
    const g = window.__LL.game;
    const c = g.heartCenter();
    const y = Math.floor(c.y) + 5;
    const x0 = Math.floor(c.x) - 3;
    for (let x = x0 - 1; x <= x0 + 5; x++) for (let yy = y - 1; yy <= y + 1; yy++) { g.removeNodeAt(x, yy); }
    for (const b of g.buildings) if (b.ty <= y && b.ty + b.size > y && b.tx <= x0 + 4 && b.tx + b.size > x0) return null;
    return { x0, y };
  });
  check(wallSpot, 'место для забора свободно');
  await walkTo(wallSpot.x0 + 2, wallSpot.y - 2.5, 1.5);
  await page.click('[data-action="buildMenu"]');
  await page.click('[data-action="buildTab"][data-tab="defense"]');
  await page.click('[data-action="pickBuild"][data-type="wall"]');
  const p0 = await ev(([x, y]) => window.__LL.renderer.toScreen(x + 0.5, y + 0.5), [wallSpot.x0, wallSpot.y]);
  const p1 = await ev(([x, y]) => window.__LL.renderer.toScreen(x + 0.5, y + 0.5), [wallSpot.x0 + 4, wallSpot.y]);
  await page.mouse.move(p0[0], p0[1]);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(p0[0] + ((p1[0] - p0[0]) * i) / 8, p0[1]); await sleep(30); }
  await snap('wall-drag');
  await page.mouse.up();
  await sleep(200);
  await ev(() => window.__LL.hud.cancelBuild());
  const wall = await ev(([x, y]) => {
    const g = window.__LL.game;
    g.update(1 / 60);
    const ws = [0, 1, 2, 3, 4].map((i) => g.buildingAt(x + i, y));
    if (ws.some((w) => !w || w.type !== 'wall')) return null;
    const grp = g.wallGroupHp(ws[0]);
    g.damageBuilding(ws[4], grp.maxHp * 0.5);
    return { same: ws.every((w) => w.wallGroup === ws[0].wallGroup), count: grp.count, ratios: ws.map((w) => Math.round((w.hp / w.maxHp) * 100)) };
  }, [wallSpot.x0, wallSpot.y]);
  check(wall && wall.same && wall.count === 5, 'протянутый забор из 5 секций слился в один');
  check(wall.ratios.every((r) => r === 50), `урон по одной секции поровну у всех: ${wall.ratios.join(', ')}%`);
  await snap('wall');

  // 5. Кузня: изучить оружие, надеть, поставить в слот
  const forge = await buildVia('forge', 5, 4);
  await clickBuilding(forge.id);
  await page.click('[data-action="openCraft"]');
  await sleep(200);
  await snap('craft');
  await page.click('[data-action="craft"][data-item="swordSteel"]');
  await sleep(200);
  await closeModals();
  check((await st()).items.includes('swordSteel'), 'в кузне изучен закалённый меч');
  await page.click('[data-action="closeWindow"]');
  await sleep(150);
  await closeModals();
  await page.click('[data-action="inventory"]');
  await page.click('[data-action="selItem"][data-item="swordSteel"]');
  await page.click('[data-action="equip"][data-item="swordSteel"]');
  await snap('inventory');
  check((await st()).weapon === 'swordSteel', 'меч надет через инвентарь');
  await page.click('[data-action="invTab"][data-tab="mats"]');
  await sleep(150);
  await snap('materials');
  await page.click('[data-action="closeWindow"]');
  await sleep(150);
  await closeModals();
  await page.click('[data-action="hotbar"][data-slot="0"]');
  check((await st()).weapon === 'swordWood', 'быстрый слот 1 переключил оружие');

  // 6. Эволюция башни на 10 уровне
  await ev(() => { const g = window.__LL.game; for (const k of ['wood', 'stone', 'planks', 'bricks', 'iron', 'coal', 'bones', 'ore']) g.res[k] = 300; g.res.food = 500; g.res.gold = 9000; for (let i = 0; i < 6; i++) g.upgradeHeart(); g.res.gold = 9000; g.res.planks = 300; g.res.iron = 200; g.res.bricks = 200; });
  await closeModals();
  const tower = (await st()).buildings.find((b) => b.type === 'archerTower');
  await clickBuilding(tower.id);
  for (let i = 0; i < 9; i++) { await page.click('#card .primary[data-action="upgrade"]'); await sleep(60); }
  await sleep(200);
  check(await page.isVisible('.evo-box'), 'на 10 уровне предложена эволюция');
  await snap('evolution');
  await page.click('[data-action="evolve"][data-opt="volley"]');
  await sleep(200);
  await closeModals();
  check(await ev((id) => window.__LL.game.byId(id).evo[10] === 'volley', tower.id), 'выбрана «Залповая башня»');
  await ev(() => window.__LL.hud.closeCard());

  // 7. Магазин: товар за самоцветы
  await page.click('[data-action="shop"]');
  await page.click('[data-action="shopTab"][data-tab="goods"]');
  const gemsBefore = (await st()).res.gems;
  await page.click('[data-action="buyOffer"][data-offer="crateFood"]');
  await sleep(150);
  await snap('shop');
  check((await st()).res.gems < gemsBefore, 'покупка за самоцветы');
  await page.click('[data-action="closeWindow"]');
  await sleep(150);
  await closeModals();

  // 8. Сундук на карте
  const chest = await ev(() => { const c = window.__LL.game.spawnChest(); return c && { x: c.x, y: c.y }; });
  check(chest, 'на карте появился сундук');
  // касание самого сундука — герой идёт к нему и открывает
  await walkTo(chest.x, chest.y + 3, 2.5, 15000);
  const cp = await ev(([x, y]) => window.__LL.renderer.toScreen(x, y), [chest.x, chest.y]);
  await page.mouse.click(cp[0], cp[1]);
  await page.waitForFunction(() => window.__LL.game.stats.chests >= 1, null, { timeout: 8000 }).catch(() => {});
  check(await ev(() => window.__LL.game.stats.chests >= 1), 'сундук открыт');

  // 9. Достижения
  await page.click('[data-action="achievements"]');
  await sleep(150);
  await snap('achievements');
  check(await ev(() => window.__LL.game.achievements.length >= 2), 'получены достижения');
  await page.click('[data-action="closeWindow"]');
  await sleep(150);
  await closeModals();

  // 10. Сохранение и загрузка
  await ev(() => window.__LL.save());
  const saved = await st();
  await page.reload();
  await page.waitForFunction(() => window.__LL && !document.getElementById('loader'));
  await closeModals();
  const loaded = await st();
  check(loaded.heart === saved.heart, `после перезапуска Сердце ${loaded.heart} уровня`);
  check(loaded.buildings.length === saved.buildings.length, `все постройки на месте (${loaded.buildings.length})`);
  check(loaded.items.includes('swordSteel'), 'изученные предметы на месте');
  check(await ev(([x, y]) => { const g = window.__LL.game; g.update(1 / 60); return g.wallSegment(g.buildingAt(x, y)).length === 5; }, [wallSpot.x0, wallSpot.y]), 'забор после загрузки по-прежнему цельный');
  await snap('after-reload');

  check(errors.length === 0, 'в консоли браузера нет ошибок' + (errors.length ? ':\n' + errors.join('\n') : ''));
  console.log('\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
} catch (e) {
  await snap('failure').catch(() => {});
  console.error('\n' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
