// Сквозная проверка в настоящем браузере: игрок проходит весь цикл первой итерации.
// Запуск: npm run e2e  (скриншоты — в test-results/)
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
const viewport = process.env.MOBILE ? { width: 412, height: 860 } : { width: 1280, height: 760 };
const context = await browser.newContext({ viewport, hasTouch: !!process.env.MOBILE });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const log = (...a) => console.log('•', ...a);
let shot = 0;
const snap = (name) => page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const state = () => ev(() => {
  const g = window.__LL.game;
  return {
    res: { ...g.res }, phase: g.phase, hero: { x: g.hero.x, y: g.hero.y, dead: g.hero.dead },
    buildings: g.buildings.map((b) => ({ id: b.id, type: b.type, hp: b.hp, maxHp: b.maxHp, destroyed: b.destroyed, status: g.statusOf(b).code })),
    progress: { ...g.progress }, energy: { ...g.energy }, modal: window.__LL.hud.modal, beacon: g.beacons[0].state,
    unlocked: [...g.unlocked], enemies: g.enemies.length,
  };
});
function check(cond, msg) {
  if (!cond) throw new Error('ПРОВЕРКА НЕ ПРОЙДЕНА: ' + msg);
  log('✔', msg);
}
const sleep = (ms) => page.waitForTimeout(ms);

async function closeModals() {
  for (let i = 0; i < 5; i++) {
    const m = await ev(() => window.__LL.hud.modal);
    if (!m || m === 'result') return;
    await page.click('#modal [data-action="closeModal"], #modal [data-action="resume"]');
    await sleep(150);
  }
}

// Идёт к точке касаниями земли, как игрок на телефоне: тап по точке на экране
// (если цель за краем — тап в её сторону). Герой сам обходит препятствия.
async function walkTo(x, y, near = 0.9, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const h = await ev(() => ({ x: window.__LL.game.hero.x, y: window.__LL.game.hero.y, t: window.__LL.game.hero.moveTarget }));
    if (Math.hypot(x - h.x, y - h.y) < near) return;
    if (!h.t) {
      const [sx, sy] = await ev(([a, b]) => window.__LL.renderer.toScreen(a, b), [x, y]);
      const [hx, hy] = await ev(() => window.__LL.renderer.toScreen(window.__LL.game.hero.x, window.__LL.game.hero.y));
      const x0 = viewport.width * 0.3; const x1 = viewport.width * 0.7;
      const y0 = viewport.height * 0.22; const y1 = viewport.height * 0.7;
      let px = sx; let py = sy;
      if (px < x0 || px > x1 || py < y0 || py > y1) {
        // точка на краю безопасной зоны по направлению к цели
        const dx = sx - hx; const dy = sy - hy;
        const k = Math.min(Math.abs((dx > 0 ? x1 - hx : x0 - hx) / (dx || 1e-6)), Math.abs((dy > 0 ? y1 - hy : y0 - hy) / (dy || 1e-6)), 1);
        px = hx + dx * k; py = hy + dy * k;
      }
      // не попадаем по зданию: сдвигаем точку касания вбок
      const free = await ev(([a, b, w, h]) => {
        const r = window.__LL.renderer;
        const g = window.__LL.game;
        for (const [ox, oy] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [120, 0], [-120, 0], [90, 90], [-90, -90], [90, -90], [-90, 90]]) {
          const X = Math.min(w - 20, Math.max(20, a + ox));
          const Y = Math.min(h * 0.72, Math.max(h * 0.18, b + oy));
          const p = r.toWorld(X, Y);
          const tx = Math.floor(p.x); const ty = Math.floor(p.y);
          if (!g.buildingAt(tx, ty) && !g.buildingAt(tx, ty + 1)) return [X, Y];
        }
        return [a, b];
      }, [px, py, viewport.width, viewport.height]);
      await page.mouse.click(free[0], free[1]);
    }
    await sleep(120);
  }
}

// Рубит ближайшие деревья, пока древесины не станет больше нужного.
async function chopUntil(wood, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (s.res.wood >= wood) return;
    const tree = await ev(() => {
      const g = window.__LL.game;
      const c = g.heartCenter();
      const r = window.__LL.renderer;
      // сначала деревья в видимой части экрана (не под панелями)
      const onScreen = (x) => { const [sx, sy] = r.toScreen(x.x, x.y); return sx > 40 && sx < r.w - 40 && sy > r.h * 0.18 && sy < r.h * 0.72; };
      const n = g.nodes.filter((x) => x.kind === 'tree' && x.hp > 0 && g.inTerritory(x.x, x.y))
        .sort((a, b) => (onScreen(b) - onScreen(a)) || (Math.hypot(a.x - g.hero.x, a.y - g.hero.y) - Math.hypot(b.x - g.hero.x, b.y - g.hero.y)))[0];
      return n ? { x: n.x, y: n.y, id: n.id, cx: c.x, cy: c.y } : null;
    });
    if (!tree) { await sleep(500); continue; }
    // касание дерева: герой сам подходит к нему, автоатака рубит
    await walkTo(tree.x, tree.y, 1.4, 8000);
    const t1 = Date.now();
    while (Date.now() - t1 < 4000) {
      const alive = await ev((id) => window.__LL.game.nodes.find((n) => n.id === id)?.hp > 0, tree.id);
      if (!alive) break;
      await sleep(100);
    }
  }
  const dbg = await ev(() => {
    const g = window.__LL.game;
    const alive = g.nodes.filter((x) => x.kind === 'tree' && x.hp > 0 && g.inTerritory(x.x, x.y));
    return { wood: g.res.wood, alive: alive.length, hero: [g.hero.x.toFixed(1), g.hero.y.toFixed(1)], target: g.hero.moveTarget,
      trees: alive.slice(0, 5).map((t) => [t.x, t.y]), card: !!window.__LL.hud.card, modal: window.__LL.hud.modal };
  });
  throw new Error('не удалось нарубить древесину: ' + JSON.stringify(dbg));
}

// Строит через меню: карточка снизу → клик по месту на карте.
async function buildVia(type, dx, dy) {
  const spot = await ev(([t, x, y]) => {
    const g = window.__LL.game;
    const c = g.heartCenter();
    return g.findSpot(t, c.x + x, c.y + y);
  }, [type, dx, dy]);
  check(spot, `есть место для «${type}»`);
  const before = (await state()).buildings.length;
  // подходим поближе, чтобы место было в центре экрана, а не под панелями
  const size0 = await ev((t) => window.__LL.BUILDINGS[t].size, type);
  await walkTo(spot.tx + size0 / 2, spot.ty + size0 + 1.5, 2.5, 10000);
  await sleep(600);
  await page.click(`.build-card[data-type="${type}"]`);
  await sleep(100);
  const size = await ev((t) => window.__LL.BUILDINGS[t].size, type);
  const [sx, sy] = await ev(([x, y]) => window.__LL.renderer.toScreen(x, y), [spot.tx + size / 2, spot.ty + size / 2]);
  if (sx < 10 || sy < 90 || sx > viewport.width - 10 || sy > viewport.height - 170) throw new Error('место вне видимой части экрана');
  await page.mouse.move(sx, sy);
  await sleep(80);
  await page.mouse.click(sx, sy);
  await sleep(150);
  if (type === 'wall') await page.keyboard.press('Escape');
  const after = await state();
  check(after.buildings.length === before + 1, `построено: ${type}`);
  return after.buildings[after.buildings.length - 1];
}

async function playWave(speed = 3) {
  const s = await state();
  const n = s.progress.nextWave;
  await page.click('[data-action="startWave"]');
  await ev((v) => window.__LL.setSpeed(v), speed);
  check((await state()).phase === 'wave', `волна ${n} началась`);
  let shotTaken = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const st = await state();
    if (!shotTaken && st.enemies >= 3) { await snap(`wave${n}-battle`); shotTaken = true; }
    if (st.modal === 'result' || st.modal === 'story') break;
    await sleep(250);
  }
  await ev(() => window.__LL.setSpeed(1));
  await closeModals();
  await sleep(200);
  const st = await state();
  return { n, victory: st.progress.highestCleared >= n, st };
}

try {
  // новый контекст браузера — пустое хранилище, то есть новая игра
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__LL && !document.getElementById('loader'));
  await snap('intro');
  check((await state()).modal === 'story', 'показано вступление сюжета');
  await closeModals();

  // 1. Добыча древесины атакой по деревьям
  const wood0 = (await state()).res.wood;
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil(wood0 + 20);
  await snap('chopping');
  check((await state()).res.wood > wood0, 'герой добыл древесину ударами по деревьям');
  await chopUntil(60);

  // 2. Генератор и лесопилка → доски (цепочка из двух шагов)
  await buildVia('generator', -4, 1);
  await buildVia('sawmill', 4, 1);
  await chopUntil(35);
  await ev(() => window.__LL.setSpeed(6));
  await sleep(1500);
  let s = await state();
  check(s.res.planks > 0, `лесопилка делает доски из древесины (досок: ${Math.floor(s.res.planks)})`);

  // 3. Башня: без энергии не работает
  await chopUntil(50);
  await page.waitForFunction(() => window.__LL.game.res.planks >= 10, null, { timeout: 30000 });
  await ev(() => window.__LL.setSpeed(1));
  const preview = await ev(() => window.__LL.game.wavePreview().sides[0]);
  const vec = { N: [0, -3], E: [3, 0], S: [0, 3], W: [-3, 0] }[preview];
  const gen = (await state()).buildings.find((b) => b.type === 'generator');
  const tower = await buildVia('archerTower', vec[0], vec[1]);
  s = await state();
  check(s.buildings.find((b) => b.id === tower.id).status === 'working', 'башня получает энергию от генератора');
  // карточка генератора
  const [gx, gy] = await ev((id) => { const g = window.__LL.game; const b = g.byId(id); const c = g.center(b); return window.__LL.renderer.toScreen(c.x, c.y - 0.2); }, gen.id);
  await page.mouse.click(gx, gy);
  await sleep(200);
  await snap('generator-card');
  check(await page.isVisible('#card'), 'карточка здания открывается по клику');

  // 4. Волна 1
  await snap('before-wave1');
  let r = await playWave(3);
  check(r.victory, 'волна 1 отражена');
  await snap('wave1-result');
  check(r.st.res.gold > 0, `получено золото (${Math.floor(r.st.res.gold)})`);
  check(await page.isVisible('#modal [data-action="nextWave"]'), 'есть выбор: повторить или следующая');
  await page.click('#modal .primary[data-action="nextWave"]');
  await sleep(200);
  await closeModals();
  check((await state()).progress.nextWave === 2, 'выбрана следующая волна 2');

  // 5. Казарма мечников
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil(45);
  await ev(() => window.__LL.setSpeed(6));
  await page.waitForFunction(() => window.__LL.game.res.planks >= 15, null, { timeout: 30000 });
  await ev(() => window.__LL.setSpeed(1));
  const side2 = await ev(() => window.__LL.game.wavePreview().sides);
  const v2 = { N: [0, -4], E: [4, 0], S: [0, 4], W: [-4, 0] }[side2[0]];
  await buildVia('barracks', v2[0], v2[1]);
  await ev(() => window.__LL.setSpeed(4));
  await page.waitForFunction(() => window.__LL.game.allies.length >= 2, null, { timeout: 20000 });
  check(true, 'казарма выпустила мечников');

  // 6. Волна 2 — повтор волны 1 проверим кнопкой выбора
  await ev(() => window.__LL.setSpeed(1));
  await page.click('[data-action="pickWave"][data-wave="1"]');
  await sleep(200);
  check((await state()).progress.nextWave === 1, 'на панели можно выбрать повтор волны 1');
  const goldBefore = (await state()).res.gold;
  r = await playWave(3);
  check(r.victory && r.st.res.gold > goldBefore, 'повтор волны 1 дал полную награду');
  await page.click('#modal .primary[data-action="nextWave"]');
  await sleep(200);
  await closeModals();

  // 7. Дом ремонтников + ремонт
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil(60);
  await ev(() => window.__LL.setSpeed(6));
  await page.waitForFunction(() => window.__LL.game.res.planks >= 10 && window.__LL.game.res.gold >= 10, null, { timeout: 30000 });
  await ev(() => window.__LL.setSpeed(1));
  await buildVia('repairHouse', -3, -4);
  await buildVia('wall', vec[0] * 2, vec[1] * 2 + 1);

  for (let i = 0; i < 2; i++) {
    r = await playWave(3);
    log(`волна ${r.n}: ${r.victory ? 'победа' : 'поражение'}, сердце ${Math.round(r.st.buildings[0].hp)}`);
    await snap(`wave${r.n}-result`);
    await page.click('#modal .primary[data-action="nextWave"]');
    await sleep(200);
    await closeModals();
  }
  s = await state();
  const damaged = s.buildings.filter((b) => b.hp < b.maxHp);
  log('повреждено после волн:', damaged.map((b) => `${b.type} ${Math.round(b.hp)}/${b.maxHp}`).join(', ') || 'ничего');
  // если враги ничего не задели, повреждаем стену сами, чтобы проверить ремонт
  const target = damaged.find((b) => b.type !== 'heart') || s.buildings.find((b) => b.type === 'wall');
  if (!damaged.length) await ev((id) => { const g = window.__LL.game; g.damageBuilding(g.byId(id), 100); }, target.id);
  await ev(() => { window.__LL.game.res.wood = Math.max(window.__LL.game.res.wood, 60); });
  await ev(() => window.__LL.setSpeed(4));
  await page.waitForFunction(() => window.__LL.game.repairers.length > 0, null, { timeout: 10000 });
  await snap('repairers');
  check(true, 'ремонтники вышли чинить базу');
  await page.waitForFunction((id) => { const b = window.__LL.game.byId(id); return b && b.hp >= b.maxHp; }, target.id, { timeout: 30000 });
  check(true, `постройка «${target.type}» отремонтирована`);

  // 8. Маяк
  s = await state();
  check(s.progress.highestCleared >= 3, `пройдено волн: ${s.progress.highestCleared}`);
  check(s.beacon === 'ready', 'Северный маяк стал доступен');
  await ev(() => window.__LL.setSpeed(2));
  await chopUntil(80);
  await ev(() => window.__LL.setSpeed(8));
  await page.waitForFunction(() => window.__LL.game.res.planks >= 30, null, { timeout: 40000 });
  await ev(() => window.__LL.setSpeed(1));
  s = await state();
  log('осколков света:', s.res.shards);
  if (s.res.shards < 8) {
    // осколки выпадают с врагов — отыгрываем ещё волну
    r = await playWave(3);
    await page.click('#modal .primary[data-action="nextWave"]');
    await closeModals();
  }
  const bpos = await ev(() => { const b = window.__LL.game.beacons[0].cfg; return { x: b.tx + 1, y: b.ty + 1 }; });
  await walkTo(bpos.x, bpos.y + 4, 1.2);
  await sleep(300);
  const [bx, by] = await ev(([x, y]) => window.__LL.renderer.toScreen(x, y), [bpos.x, bpos.y]);
  await page.mouse.click(bx, by);
  await sleep(200);
  await snap('beacon-card');
  await page.click('[data-action="restoreBeacon"]');
  await sleep(1200);
  s = await state();
  check(s.beacon === 'lit', 'маяк зажжён');
  check(s.unlocked.includes('quarry'), 'открыта каменоломня');
  check(await ev(([x, y]) => window.__LL.game.inTerritory(x, y), [bpos.x, bpos.y - 4]), 'территория расширилась на север');
  await closeModals();
  await snap('beacon-lit');

  // 9. Сохранение и загрузка после перезапуска
  await ev(() => window.__LL.save());
  const beforeReload = await state();
  await page.reload();
  await page.waitForFunction(() => window.__LL && !document.getElementById('loader'));
  await closeModals();
  const afterReload = await state();
  check(afterReload.buildings.length === beforeReload.buildings.length, `после перезапуска на месте все постройки (${afterReload.buildings.length})`);
  check(afterReload.progress.highestCleared === beforeReload.progress.highestCleared, `сохранён прогресс волн (${afterReload.progress.highestCleared})`);
  check(afterReload.beacon === 'lit', 'маяк остался зажжённым');
  check(Math.abs(afterReload.res.planks - beforeReload.res.planks) < 3, 'запасы сохранены');
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
