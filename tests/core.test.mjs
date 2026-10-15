// Тесты симуляции без браузера: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { allocateEnergy } from '../src/core/energy.js';
import { generateWave } from '../src/core/waves.js';
import { towerStats } from '../src/core/stats.js';
import { BUILDINGS } from '../src/data/index.js';

const step = (g, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) g.update(dt); };
const rich = (g) => Object.assign(g.res, {
  wood: 2000, stone: 2000, planks: 2000, bricks: 2000, iron: 2000, coal: 2000, crystal: 2000, silver: 2000,
  mithril: 2000, essence: 2000, parts: 2000, starmetal: 2000, gold: 99999, food: 9999, gems: 0,
});
const bigStorage = (g) => { g.storageCap = () => 100000; };
// Ставит постройку на ближайшее свободное место у точки (смещение от центра Сердца).
const place = (g, type, dx, dy) => {
  const c = g.heartCenter();
  const s = g.findSpot(type, c.x + dx, c.y + dy);
  return s ? g.build(type, s.tx, s.ty) : null;
};
const clearArea = (g, x0, y0, x1, y1) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) g.removeNodeAt(x, y); };
const runWave = (g, max = 300) => { g.startWave(); let t = 0; while (g.phase === 'wave' && t < max) { g.update(1 / 30); t += 1 / 30; } return t; };

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

test('волны детерминированы, боссы сменяются, новые монстры открываются', () => {
  assert.deepEqual(generateWave(7), generateWave(7));
  assert.equal(generateWave(10).bossType, 'colossus');
  assert.equal(generateWave(20).bossType, 'mistQueen');
  assert.equal(generateWave(30).bossType, 'lich');
  assert.equal(generateWave(50).bossType, 'colossus');
  assert.ok(generateWave(50).bossHp > 1, 'второй круг боссов крепче');
  const late = new Set();
  for (let n = 30; n < 45; n++) Object.keys(generateWave(n).counts).forEach((t) => late.add(t));
  assert.ok(late.has('wraith') && late.has('golem') && late.has('deathKnight'), [...late].join(','));
  assert.ok(!Object.keys(generateWave(3).counts).includes('wraith'));
});

test('герой рубит дерево и получает древесину', () => {
  const g = new Game();
  const tree = g.nodes.find((n) => n.kind === 'tree');
  g.hero.x = tree.x + 1.1; g.hero.y = tree.y;
  const before = g.res.wood;
  step(g, 3);
  assert.ok(g.res.wood > before);
});

test('рабочие сами добывают ресурсы и приносят в лагерь (стоят еды)', () => {
  const g = new Game();
  g.res.wood = 100; g.res.food = 100;
  const camp = place(g, 'workerCamp', -4, 3);
  g.hero.x = 1000; g.hero.dead = true; g.hero.respawn = 9999;
  const wood = g.res.wood;
  step(g, 2.5);
  assert.ok(g.res.food < 100, 'за наём заплачена еда');
  step(g, 40);
  assert.ok(g.workers.length >= 2, 'рабочие наняты');
  assert.ok(g.stats.gathered > 0 && g.res.wood + g.res.food + (g.res.stone || 0) > wood, 'ресурсы принесены');
  g.setWorkerFilter(camp.id, 'stone');
  assert.equal(camp.filter, 'stone');
});

test('цепочка: лесопилка без энергии стоит, с генератором делает доски; резерв не трогается', () => {
  const g = new Game();
  g.res.wood = 100;
  const saw = place(g, 'sawmill', 4, 0);
  g.hero.dead = true; g.hero.respawn = 9999;
  step(g, 4);
  assert.equal(g.statusOf(saw).code, 'no_power');
  assert.ok(place(g, 'generator', -4, 0));
  step(g, 120);
  assert.ok(g.res.planks >= 2);
  assert.ok(g.res.wood >= saw.reserve && g.res.wood < saw.reserve + 2);
});

test('башня без энергии не стреляет, дефицит виден', () => {
  const g = new Game();
  rich(g);
  const t = place(g, 'archerTower', 3, 0);
  g.update(1 / 60);
  assert.equal(g.statusOf(t).code, 'no_power');
  assert.equal(g.energy.deficit, 3);
});

test('волна 1: победа, награда с 0–2 самоцветами, выбор повтора', () => {
  const g = new Game();
  rich(g);
  assert.ok(place(g, 'generator', -4, 0));
  for (const [dx, dy] of [[3, -3], [-3, 3], [3, 3], [-3, -3]]) assert.ok(place(g, 'archerTower', dx, dy));
  runWave(g);
  assert.equal(g.lastResult.victory, true);
  assert.ok(g.lastResult.rewards.gems >= 0 && g.lastResult.rewards.gems <= 2);
  assert.equal(g.progress.nextWave, 2);
  g.setNextWave(1);
  assert.equal(g.progress.nextWave, 1);
  assert.ok(g.achievements.includes('wave1') || (step(g, 1), g.achievements.includes('wave1')), 'достижение за первую волну');
});

test('поражение: Сердце выживает частично, волну можно переиграть', () => {
  const g = new Game();
  g.progress.highestCleared = 4; g.progress.nextWave = 5;
  g.hero.dead = true; g.hero.respawn = 9999;
  g.heart().hp = 30;
  runWave(g);
  assert.equal(g.lastResult.victory, false);
  assert.equal(g.progress.nextWave, 5);
  assert.ok(g.heart().hp > 0);
});

test('заборы: стыкующиеся секции одного уровня — общая прочность и падают вместе', () => {
  const g = new Game();
  rich(g);
  const c = g.heartCenter();
  const y = Math.floor(c.y) + 4;
  const x0 = Math.floor(c.x) - 2;
  clearArea(g, x0 - 2, y - 1, x0 + 6, y + 1);
  g.hero.x = c.x; g.hero.y = c.y - 3;
  assert.equal(g.buildLine('wall', x0, y, x0 + 4, y), 5);
  const loose = g.build('wall', x0 + 6, y); // отдельная секция
  g.update(1 / 60);
  const row = [0, 1, 2, 3, 4].map((i) => g.buildingAt(x0 + i, y));
  assert.ok(row.every((w) => w.wallGroup === row[0].wallGroup), 'одна группа');
  assert.notEqual(loose.wallGroup, row[0].wallGroup, 'не стыкуется — отдельно');
  const total = g.wallGroupHp(row[0]);
  assert.equal(total.maxHp, 5 * row[0].maxHp, 'общий запас = сумма');
  g.damageBuilding(row[4], total.maxHp * 0.4);
  assert.ok(row.every((w) => Math.abs(w.hp / w.maxHp - 0.6) < 1e-6), 'урон по одной — у всех');
  g.damageBuilding(row[0], total.maxHp);
  assert.ok(row.every((w) => w.destroyed), 'сломалась одна — сломались все');
  assert.equal(loose.destroyed, false);
  g.update(1 / 60);
  assert.ok(g.repairNow(row[2].id));
  assert.ok(row.every((w) => !w.destroyed && w.hp === w.maxHp), 'ремонт восстанавливает весь забор');
});

test('заборы разного уровня не делят прочность; улучшение всего забора', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 10;
  const c = g.heartCenter();
  const y = Math.floor(c.y) - 4;
  const x0 = Math.floor(c.x) - 1;
  clearArea(g, x0 - 1, y - 1, x0 + 4, y + 1);
  g.hero.x = c.x; g.hero.y = c.y + 3;
  g.buildLine('wall', x0, y, x0 + 3, y);
  g.update(1 / 60);
  const w0 = g.buildingAt(x0, y);
  assert.ok(g.upgrade(w0.id));
  g.update(1 / 60);
  const w1 = g.buildingAt(x0 + 1, y);
  assert.notEqual(w0.wallGroup, w1.wallGroup, 'разный уровень — разные группы');
  assert.equal(g.wallSegment(w1).length, 3);
  assert.ok(g.upgradeSegment(w1.id));
  g.update(1 / 60);
  assert.equal(w0.wallGroup, w1.wallGroup, 'снова одного уровня — снова цельный');
});

test('ворота пропускают героя, но держат врагов', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 5;
  const c = g.heartCenter();
  const gx = Math.floor(c.x) + 4;
  const gy = Math.floor(c.y);
  clearArea(g, gx - 1, gy - 1, gx + 1, gy + 1);
  const gate = g.build('gate', gx, gy);
  assert.ok(gate);
  assert.equal(g.isSolidCell(g.idx(gx, gy), 'friend'), false);
  assert.equal(g.isSolidCell(g.idx(gx, gy), 'enemy'), true);
});

test('мгла непроходима для героя; Сердце раздвигает её', () => {
  const g = new Game();
  const c = g.heartCenter();
  g.hero.input = { x: 1, y: 0 };
  step(g, 6);
  assert.ok(g.distFromHeart(g.hero.x, g.hero.y) <= g.radius(), 'герой остановился у края света');
  const r1 = g.radius();
  rich(g);
  bigStorage(g);
  for (let i = 0; i < 19; i++) assert.ok(g.upgradeHeart(), 'улучшение ' + (i + 2));
  assert.ok(g.radius() > r1 + 5);
  assert.ok(g.openZone() >= 2, 'открылись Ржавые холмы');
  assert.ok(g.story.seen.includes('zone2'));
  assert.ok(g.heart().maxHp > 900);
  const c99 = g.heartUpgradeCost(99);
  assert.ok(c99.starmetal > 0 && !c99.wood, 'поздние уровни просят звёздный металл, а не древесину');
  assert.ok(g.heartUpgradeCost(30).iron > 0);
  step(g, 30);
  assert.ok(g.nodes.some((n) => ['ironVein', 'coalSeam'].includes(n.kind)), 'появились жилы');
  assert.ok(c.x > 0);
});

test('на сотом уровне свет покрывает всю карту', () => {
  const g = new Game();
  g.heart().level = 100;
  for (const [x, y] of [[1, 1], [78, 1], [1, 78], [78, 78]]) assert.ok(g.inTerritory(x, y));
});

test('коллайдеры: между зданиями через клетку и между деревьями можно пройти', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 12;
  const c = g.heartCenter();
  const tx = Math.floor(c.x) + 3;
  const ty = Math.floor(c.y) - 2;
  clearArea(g, tx - 2, ty - 3, tx + 6, ty + 5);
  const a = g.build('generator', tx, ty);
  const b = g.build('farm', tx + 3, ty);
  assert.ok(a && b);
  g.hero.x = tx + 2.5; g.hero.y = ty - 1.5;
  g.hero.input = { x: 0, y: 1 };
  step(g, 1.5);
  assert.ok(g.hero.y > ty + 2.2, 'прошёл по щели в одну клетку: ' + g.hero.y.toFixed(2));
  g.hero.input = { x: 0, y: 0 };
  // два дерева по диагонали не перекрывают проход
  clearArea(g, tx - 2, ty + 4, tx + 2, ty + 7);
  g.addNode('tree', tx - 1, ty + 5);
  g.addNode('tree', tx, ty + 6);
  assert.equal(g.clearLine(tx - 1.5, ty + 7.5, tx + 1.5, ty + 4.5, 0.3), true, 'между стволами по диагонали видна дорога');
  g.hero.x = tx - 0.6; g.hero.y = ty + 6.4; g.resolveSolids(g.hero);
  assert.ok(Math.hypot(g.hero.x - (tx - 0.6), g.hero.y - (ty + 6.4)) < 0.05, 'между стволами стоять можно');
});

test('коллайдеры: между зданиями вплотную можно протиснуться, тап ведёт через щель', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 12;
  const c = g.heartCenter();
  const tx = Math.floor(c.x) + 3;
  const ty = Math.floor(c.y) - 3;
  clearArea(g, tx - 3, ty - 3, tx + 7, ty + 7);
  assert.ok(g.build('farm', tx, ty) && g.build('farm', tx + 2, ty) && g.build('generator', tx, ty + 2));
  // вверх по шву между двумя фермами
  g.hero.x = tx + 2; g.hero.y = ty + 5.5;
  g.hero.input = { x: 0, y: -1 };
  step(g, 2.5);
  assert.ok(g.hero.y < ty - 0.2, 'прошёл шов сверху вниз: ' + g.hero.y.toFixed(2));
  // вправо по шву между фермой и генератором
  g.hero.x = tx - 1.5; g.hero.y = ty + 2;
  g.hero.input = { x: 1, y: 0 };
  step(g, 2.5);
  assert.ok(g.hero.x > tx + 2.5, 'прошёл шов слева направо: ' + g.hero.x.toFixed(2));
  // касание по земле за зданиями — путь через щель
  g.hero.input = { x: 0, y: 0 };
  g.hero.x = tx - 1.5; g.hero.y = ty + 2;
  g.hero.moveTarget = { x: tx + 5.5, y: ty + 2 };
  step(g, 4);
  assert.ok(Math.hypot(g.hero.x - (tx + 5.5), g.hero.y - (ty + 2)) < 0.6, 'дошёл по касанию: ' + g.hero.x.toFixed(2) + ',' + g.hero.y.toFixed(2));
});

test('кузня: изучение оружия, экипировка, быстрые слоты', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 5;
  const base = g.weaponStats().damage;
  assert.equal(g.canCraft('swordSteel').ok, false, 'без кузни нельзя');
  assert.ok(place(g, 'forge', 4, 3));
  assert.ok(g.craft('swordSteel'));
  assert.ok(g.owns('swordSteel'));
  assert.equal(g.inventory.hotbar[1], 'swordSteel', 'встал в свободный слот');
  assert.ok(g.useHotbar(1));
  assert.ok(g.weaponStats().damage > base);
  const forge = g.buildings.find((b) => b.type === 'forge');
  assert.ok(g.upgrade(forge.id));
  assert.ok(g.craft('maceClub'));
  assert.ok(g.equip('maceClub'));
  assert.equal(g.weaponItem().wtype, 'mace');
  assert.equal(g.canCraft('swordIron').ok, false, 'нужен уровень кузни');
  assert.ok(place(g, 'armory', -4, 3));
  const hp = g.hero.maxHp;
  assert.ok(g.craft('armorQuilt') && g.equip('armorQuilt'));
  assert.ok(g.hero.maxHp > hp && g.heroStats.armor > 0);
  assert.ok(g.story.seen.includes('first_craft'));
});

test('все виды оружия бьют врага', () => {
  const g = new Game();
  rich(g);
  for (const id of ['swordWood', 'maceClub', 'daggersKnives', 'scytheSickle', 'halberdSpear', 'bowSimple', 'crossLight', 'staffEmber', 'staffIce', 'staffSpark']) {
    g.inventory.items.push(id);
    g.equip(id);
    const c = g.heartCenter();
    g.hero.x = c.x + 3; g.hero.y = c.y + 3; g.hero.cd = 0;
    const e = g.createEnemy('brute', g.hero.x + 1.2, g.hero.y, { hpMul: 50 });
    e.speed = 0;
    const hp = e.hp;
    step(g, 1.2);
    assert.ok(e.hp < hp, id + ' наносит урон');
    e.dead = true;
    g.cleanup();
  }
});

test('эволюция башни на 10 уровне: выбор пути меняет стрельбу', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 12;
  const t = place(g, 'archerTower', 3, 0);
  for (let i = 1; i < 10; i++) assert.ok(g.upgrade(t.id), 'уровень ' + (i + 1));
  assert.equal(g.canUpgrade(t).evo, true, 'без выбора дальше нельзя');
  assert.ok(g.chooseEvolution(t.id, 'volley'));
  assert.equal(towerStats(t).multishot, 2);
  assert.equal(g.displayName(t), 'Залповая башня');
  assert.ok(g.upgrade(t.id));
  assert.equal(t.level, 11);
});

test('стройка и улучшение за самоцветы', () => {
  const g = new Game();
  g.res.wood = 0; g.res.gems = 100;
  const c = g.heartCenter();
  const s = g.findSpot('generator', c.x - 4, c.y);
  const price = g.gemPrice(BUILDINGS.generator.cost);
  const b = g.build('generator', s.tx, s.ty, { useGems: true });
  assert.ok(b);
  assert.equal(g.res.gems, 100 - price);
  g.res.gems = 0;
  assert.equal(g.upgradeHeart(true), false, 'без самоцветов нельзя');
});

test('рынок: продажа и покупка', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 6;
  assert.ok(place(g, 'market', 4, 3));
  const gold = g.res.gold;
  assert.ok(g.marketSell('wood', 100));
  assert.ok(g.res.gold > gold);
  assert.ok(g.marketBuy('stone', 10));
  assert.equal(g.marketBuy('starmetal', 1), false, 'редкое не продают');
});

test('сундук, записка и святилище подбираются касанием', () => {
  const g = new Game();
  g.storageCap = () => 1000;
  const chest = g.spawnChest();
  assert.ok(chest);
  const gold = g.res.gold;
  g.hero.x = chest.x; g.hero.y = chest.y;
  g.update(1 / 60);
  assert.equal(g.activities.chests.length, 0);
  assert.ok(g.res.gold > gold);
  const note = g.activities.notes.find((n) => n.zone === 1);
  g.hero.x = note.x; g.hero.y = note.y;
  g.update(1 / 60);
  assert.ok(g.story.seen.includes(note.id));
  const shrine = g.activities.shrines.find((s) => s.zone === 1);
  g.hero.x = shrine.x; g.hero.y = shrine.y - 0.5;
  g.update(1 / 60);
  assert.ok(g.activities.buff, 'получено благословение');
});

test('разлом мглы: стражи и награда за закрытие', () => {
  const g = new Game();
  g.storageCap = () => 1000;
  g.progress.highestCleared = 3;
  const rift = g.spawnRift();
  assert.ok(rift);
  const guards = g.enemies.filter((e) => e.guard);
  assert.ok(guards.length >= 3);
  g.damageRift(rift, 99999);
  assert.equal(g.activities.rifts.length, 0);
  assert.ok(g.res.essence > 0);
  assert.equal(g.stats.rifts, 1);
  g.update(1 / 60);
  assert.equal(g.enemies.filter((e) => e.guard).length, 0, 'стражи рассеялись');
});

test('летающие враги пролетают над забором', () => {
  const g = new Game();
  const c = g.heartCenter();
  const e = g.createEnemy('wraith', c.x + 12, c.y, { hpMul: 1 });
  assert.ok(e.flying);
  g.hero.dead = true; g.hero.respawn = 9999;
  step(g, 8);
  assert.ok(g.distFromHeart(e.x, e.y) < 4, 'долетел до Сердца');
});

test('торговец приходит после 5-й волны', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 8;
  for (const [dx, dy] of [[-5, 0], [5, 0], [0, 6]]) place(g, 'generator', dx, dy);
  for (const [dx, dy] of [[3, -3], [-3, 3], [3, 3], [-3, -3], [0, 4], [0, -4]]) place(g, 'archerTower', dx, dy);
  g.progress.highestCleared = 4; g.progress.nextWave = 5;
  runWave(g, 400);
  assert.ok(g.lastResult.victory);
  assert.ok(g.activities.merchant);
  const gold = g.res.gold;
  assert.ok(g.buyFromMerchant(0));
  assert.ok(g.res.gold < gold);
});

test('сохранение v2: база, заборы, инвентарь, эволюции, Сердце', () => {
  const g = new Game();
  rich(g);
  bigStorage(g);
  for (let i = 0; i < 10; i++) g.upgradeHeart();
  const t = place(g, 'archerTower', 3, 0);
  for (let i = 1; i < 10; i++) g.upgrade(t.id);
  g.chooseEvolution(t.id, 'sniper');
  place(g, 'forge', 4, 4);
  g.craft('swordSteel');
  g.equip('swordSteel');
  const c = g.heartCenter();
  clearArea(g, Math.floor(c.x) - 3, Math.floor(c.y) + 6, Math.floor(c.x) + 3, Math.floor(c.y) + 6);
  g.buildLine('wall', Math.floor(c.x) - 2, Math.floor(c.y) + 6, Math.floor(c.x) + 2, Math.floor(c.y) + 6);
  g.update(1 / 60);
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = new Game(data);
  g2.update(1 / 60);
  assert.equal(g2.heartLevel, 11);
  assert.equal(g2.buildings.length, g.buildings.length);
  assert.equal(g2.byId(g2.buildings.find((b) => b.type === 'archerTower').id).evo[10], 'sniper');
  assert.equal(g2.inventory.equipped.weapon, 'swordSteel');
  const w = g2.buildings.find((b) => b.type === 'wall');
  assert.equal(g2.wallSegment(w).length, 5);
  assert.equal(g2.nodes.length, g.nodes.length);
});

test('сохранение во время волны — это состояние до её начала', () => {
  const g = new Game();
  g.startWave();
  step(g, 2);
  assert.equal(g.serialize().progress.nextWave, 1);
});

test('ремонтники чинят после волны за древесину', () => {
  const g = new Game();
  rich(g);
  g.heart().level = 3;
  const gen = place(g, 'generator', -4, 0);
  assert.ok(place(g, 'repairHouse', 4, 0));
  gen.hp = 20;
  const wood = g.res.wood;
  step(g, 30);
  assert.equal(gen.hp, gen.maxHp);
  assert.ok(g.res.wood < wood);
});
