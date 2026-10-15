// Тесты симуляции без браузера: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { allocateEnergy } from '../src/core/energy.js';
import { generateWave } from '../src/core/waves.js';

const step = (g, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) g.update(1 / 60); };
// Ставит постройку на ближайшее свободное место у точки (смещение от центра Сердца).
const place = (g, type, dx, dy) => {
  const c = g.heartCenter();
  const s = g.findSpot(type, c.x + dx, c.y + dy);
  return s ? g.build(type, s.tx, s.ty) : null;
};

test('энергия: приоритет, затем порядок постройки; дефицит считается', () => {
  const r = allocateEnergy(5, [
    { id: 1, demand: 3, priority: 1, enabled: true, order: 1 },
    { id: 2, demand: 3, priority: 2, enabled: true, order: 2 },
    { id: 3, demand: 1, priority: 1, enabled: true, order: 3 },
    { id: 4, demand: 1, priority: 9, enabled: false, order: 4 },
  ]);
  assert.deepEqual([...r.powered].sort(), [2, 3]);
  assert.equal(r.deficit, 2);
});

test('волна детерминирована: повтор даёт тот же состав', () => {
  assert.deepEqual(generateWave(7), generateWave(7));
  const w10 = generateWave(10);
  assert.equal(w10.boss, true);
  assert.equal(w10.counts.boss, 1);
  assert.equal(generateWave(1).sides.length, 1);
  assert.equal(generateWave(12).sides.length, 4);
});

test('герой рубит дерево и получает древесину', () => {
  const g = new Game();
  const tree = g.nodes[0];
  g.hero.x = tree.x + 1.2; g.hero.y = tree.y;
  const before = g.res.wood;
  step(g, 3);
  assert.ok(g.res.wood > before, 'древесина выросла');
});

test('цепочка: лесопилка без энергии стоит, с генератором делает доски', () => {
  const g = new Game();
  g.res.wood = 200;
  const c = g.heartCenter();
  const saw = place(g, 'sawmill', 4, 0);
  assert.ok(saw);
  g.hero.x = 5; g.hero.y = 5; // убираем героя от деревьев
  step(g, 4);
  assert.equal(g.statusOf(saw).code, 'no_power');
  assert.equal(g.res.planks, 0);
  assert.ok(place(g, 'generator', -4, 0));
  step(g, 7);
  assert.ok(g.res.planks >= 2, 'доски произведены: ' + g.res.planks);
});

test('башня без энергии не стреляет, дефицит виден', () => {
  const g = new Game();
  Object.assign(g.res, { wood: 500, planks: 200, gold: 100 });
  const c = g.heartCenter();
  const t = place(g, 'archerTower', 3, 0);
  g.update(1 / 60);
  assert.equal(g.statusOf(t).code, 'no_power');
  assert.equal(g.energy.deficit, 3);
});

test('волна 1: башни и герой побеждают, награда начислена, выбор следующей', () => {
  const g = new Game();
  Object.assign(g.res, { wood: 300, planks: 200, gold: 100 });
  const c = g.heartCenter();
  const cx = Math.floor(c.x); const cy = Math.floor(c.y);
  assert.ok(place(g, 'generator', -4, 0));
  for (const [dx, dy] of [[3, -3], [-3, 3], [3, 3], [-3, -3]]) assert.ok(place(g, 'archerTower', dx, dy));
  const gold = g.res.gold;
  g.startWave();
  let t = 0;
  while (g.phase === 'wave' && t < 120) { g.update(1 / 60); t += 1 / 60; }
  assert.equal(g.phase, 'build');
  assert.equal(g.lastResult.victory, true);
  assert.ok(g.res.gold > gold);
  assert.equal(g.progress.highestCleared, 1);
  assert.equal(g.progress.nextWave, 2);
  g.setNextWave(1);
  assert.equal(g.progress.nextWave, 1);
});

test('поражение: Сердце восстанавливается частично, волну можно переиграть', () => {
  const g = new Game();
  g.progress.highestCleared = 4; g.progress.nextWave = 5;
  g.hero.hp = 1; g.hero.x = 2; g.hero.y = 2;
  g.heart().hp = 30;
  g.startWave();
  let t = 0;
  while (g.phase === 'wave' && t < 200) { g.update(1 / 30); t += 1 / 30; }
  assert.equal(g.lastResult.victory, false);
  assert.equal(g.progress.nextWave, 5);
  assert.ok(g.heart().hp > 0);
  assert.equal(g.enemies.length, 0);
});

test('ремонтники чинят после волны за древесину', () => {
  const g = new Game();
  Object.assign(g.res, { wood: 300, planks: 200, gold: 100 });
  const c = g.heartCenter();
  const cx = Math.floor(c.x); const cy = Math.floor(c.y);
  const gen = place(g, 'generator', -4, 0);
  assert.ok(place(g, 'repairHouse', 4, 0));
  gen.hp = 20;
  const wood = g.res.wood;
  step(g, 30);
  assert.equal(gen.hp, gen.maxHp);
  assert.ok(g.res.wood < wood);
});

test('стена на пути — враги её ломают', () => {
  const g = new Game();
  g.res.wood = 400;
  const c = g.heartCenter();
  const cx = Math.floor(c.x); const cy = Math.floor(c.y);
  // кольцо стен вокруг Сердца (деревья на кольце убираем)
  for (let x = cx - 3; x <= cx + 3; x++) for (let y = cy - 3; y <= cy + 3; y++) g.removeNodeAt(x, y);
  g.hero.x = 3; g.hero.y = 3; g.hero.dead = true; g.hero.respawn = 999;
  const walls = [];
  for (let x = cx - 3; x <= cx + 3; x++) for (const y of [cy - 3, cy + 3]) walls.push(g.build('wall', x, y));
  for (let y = cy - 2; y <= cy + 2; y++) for (const x of [cx - 3, cx + 3]) walls.push(g.build('wall', x, y));
  assert.ok(walls.every(Boolean));
  g.progress.nextWave = 3;
  g.startWave();
  step(g, 40);
  assert.ok(walls.some((w) => w.hp < w.maxHp), 'стены повреждены');
});

test('маяк: доступен после рубежа, расширяет территорию и открывает каменоломню', () => {
  const g = new Game();
  const bc = g.beacons[0];
  assert.equal(bc.state, 'hidden');
  g.progress.highestCleared = 3;
  g.updateBeaconAvailability();
  assert.equal(bc.state, 'ready');
  Object.assign(g.res, { planks: 50, shards: 20 });
  const p = { x: bc.cfg.tx + 1, y: bc.cfg.ty + 1 };
  assert.equal(g.inTerritory(p.x, p.y), false);
  assert.ok(g.restoreBeacon('north'));
  assert.equal(g.inTerritory(p.x, p.y), true);
  assert.ok(g.unlocked.has('quarry'));
  assert.ok(g.nodes.some((n) => n.kind === 'rock'));
});

test('сохранение и загрузка восстанавливают базу', () => {
  const g = new Game();
  Object.assign(g.res, { wood: 300, planks: 200, gold: 100, shards: 20 });
  const c = g.heartCenter();
  const gen = place(g, 'generator', -4, 0);
  g.upgrade(gen.id);
  g.progress.highestCleared = 3;
  g.updateBeaconAvailability();
  g.restoreBeacon('north');
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = new Game(data);
  assert.equal(g2.buildings.length, g.buildings.length);
  assert.equal(g2.buildings.find((b) => b.type === 'generator').level, 2);
  assert.equal(g2.beacons[0].state, 'lit');
  assert.ok(g2.unlocked.has('quarry'));
  assert.equal(g2.res.planks, g.res.planks);
  assert.equal(g2.nodes.length, g.nodes.length);
});

test('сохранение во время волны — это состояние до её начала', () => {
  const g = new Game();
  g.startWave();
  step(g, 2);
  assert.equal(g.serialize().progress.nextWave, 1);
});
