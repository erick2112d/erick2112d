// Игровая симуляция «Последнего Светоча». Не знает ничего о DOM и отрисовке:
// презентация читает состояние и забирает события через drainEvents().
// Методы разнесены по модулям-примесям (world, economy, buildings, hero, combat, units, activities, progress).
import { WORLD, STARTING_ITEMS, MATERIALS } from '../data/index.js';
import { worldMixin } from './world.js';
import { economyMixin } from './economy.js';
import { buildingsMixin } from './buildings.js';
import { heroMixin } from './hero.js';
import { combatMixin } from './combat.js';
import { unitsMixin } from './units.js';
import { activitiesMixin } from './activities.js';
import { progressMixin } from './progress.js';

export const SAVE_VERSION = 2;

export class Game {
  constructor(saveData = null) {
    this.W = WORLD.width;
    this.H = WORLD.height;
    this.time = 0;
    this.nextId = 1;
    this.events = [];
    this.res = { gold: 0, gems: 0, food: 0 };
    this.buildings = [];
    this.bMap = new Map();
    this.nodes = [];
    this.nMap = new Map();
    this.grid = new Int32Array(this.W * this.H);
    this.nodeGrid = new Int32Array(this.W * this.H);
    this.enemies = [];
    this.allies = [];
    this.workers = [];
    this.repairers = [];
    this.projectiles = [];
    this.bolts = [];               // мгновенные молнии (для отрисовки)
    this.wallGroups = new Map();
    this.phase = 'build';
    this.wave = null;
    this.snapshot = null;
    this.lastResult = null;
    this.progress = { highestCleared: 0, nextWave: 1, defeats: 0 };
    this.story = { seen: [], unread: [] };
    this.settings = { auto: true };
    this.energy = { supply: 0, demand: 0, deficit: 0, used: 0 };
    this.stats = { kills: 0, bosses: 0, built: 0, walls: 0, crafted: 0, legendary: 0, evolutions: 0, chests: 0, rifts: 0, notes: 0, gathered: 0, bestWave: 0 };
    this.achievements = [];
    this.found = [];               // материалы, которые уже попадали в руки
    this.inventory = { items: [...STARTING_ITEMS], equipped: { weapon: 'swordWood', armor: null, amulet: null, ring: null }, hotbar: ['swordWood', null, null] };
    this.activities = { chests: [], shrines: [], rifts: [], notes: [], notesTaken: [], merchant: null, buff: null, chestTimer: 40, riftTimer: 90 };
    this.zoneTimers = {};
    this.shop = { starterBought: false, adGemsAt: -9999 };
    this.flowDirty = true;
    this.flow = null;
    this.auraDirty = true;
    this.wallsDirty = true;
    this.repairBlocked = false;
    this.hero = this.makeHero();

    if (saveData) this.load(saveData);
    else this.newGame();
    this.refreshHeroStats();
    this.recomputeEnergy();
  }

  newGame() {
    for (const [k, v] of Object.entries(WORLD.startResources)) { this.res[k] = v; if (MATERIALS[k] && v > 0) this.found.push(k); }
    const h = WORLD.heart;
    this.addBuilding('heart', h.tx, h.ty, { free: true });
    this.generateMap();
    this.fillNodes(true);
    this.unlockStory('intro');
    const c = this.heartCenter();
    this.hero.x = c.x;
    this.hero.y = c.y + 2.4;
  }

  // ---------- общее ----------

  idx(tx, ty) { return tx + ty * this.W; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H; }
  heart() { return this.buildings[0]; }
  get heartLevel() { return this.buildings[0]?.level ?? 1; }
  heartCenter() { return this.center(this.heart()); }
  center(b) { const s = b.size; return { x: b.tx + s / 2, y: b.ty + s / 2 }; }
  emit(type, data = {}) { this.events.push({ ...data, type }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  byId(id) { return this.bMap.get(id); }
  nodeById(id) { return this.nMap.get(id); }

  update(dt) {
    this.time += dt;
    if (this.wallsDirty) this.rebuildWallGroups();
    if (this.flowDirty) this.rebuildFlow();
    if (this.auraDirty) this.recomputeAuras();
    this.recomputeEnergy();
    this.updateNodes(dt);
    this.updateProduction(dt);
    this.updateHero(dt);
    this.updateTowers(dt);
    this.updateTraps(dt);
    this.updateSpawners(dt);
    this.updateAllies(dt);
    this.updateWorkers(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateRepairers(dt);
    this.updateActivities(dt);
    this.separateUnits();
    this.cleanup();
    if (this.phase === 'wave') this.updateWave(dt);
    this.updateProgress(dt);
  }

  cleanup() {
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.allies.some((a) => a.dead)) this.allies = this.allies.filter((a) => !a.dead);
    if (this.workers.some((w) => w.dead)) this.workers = this.workers.filter((w) => !w.dead);
    if (this.repairers.some((r) => r.gone)) this.repairers = this.repairers.filter((r) => !r.gone);
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.bolts.length) this.bolts = this.bolts.filter((b) => this.time - b.t < 0.25);
  }

  // ---------- сохранение ----------

  serialize() {
    if (this.snapshot) return this.snapshot; // во время волны храним состояние до её начала
    return {
      v: SAVE_VERSION,
      time: Math.round(this.time),
      nextId: this.nextId,
      res: { ...this.res },
      progress: { ...this.progress },
      buildings: this.buildings.map((b) => ({
        type: b.type, tx: b.tx, ty: b.ty, level: b.level, hp: Math.round(b.hp), destroyed: b.destroyed,
        enabled: b.enabled, priority: b.priority, reserve: b.reserve, recipe: b.recipe, evo: b.evo, filter: b.filter,
      })),
      nodes: this.nodes.map((n) => ({ kind: n.kind, tx: n.tx, ty: n.ty, hp: n.hp })),
      activities: {
        chests: this.activities.chests.map((c) => ({ x: c.x, y: c.y })),
        shrines: this.activities.shrines.map((s) => ({ readyAt: Math.round(s.readyAt) })),
        rifts: this.activities.rifts.map((r) => ({ x: r.x, y: r.y, hp: r.hp, maxHp: r.maxHp, zone: r.zone })),
        notesTaken: [...this.activities.notesTaken],
        merchant: this.activities.merchant,
        buff: this.activities.buff,
      },
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      story: { seen: [...this.story.seen], unread: [...this.story.unread] },
      stats: { ...this.stats },
      achievements: [...this.achievements],
      found: [...this.found],
      settings: { ...this.settings },
      shop: { ...this.shop },
    };
  }

  load(s) {
    if (!s || s.v !== SAVE_VERSION) throw new Error('Несовместимое сохранение');
    this.time = s.time || 0;
    this.res = { gold: 0, gems: 0, food: 0, ...s.res };
    this.progress = { ...this.progress, ...s.progress };
    for (const sb of s.buildings) {
      const b = this.addBuilding(sb.type, sb.tx, sb.ty, { free: true });
      b.level = sb.level;
      b.maxHp = this.maxHpOf(b);
      b.hp = Math.min(b.maxHp, sb.hp);
      b.destroyed = !!sb.destroyed;
      b.enabled = sb.enabled !== false;
      b.priority = sb.priority ?? b.priority;
      b.reserve = sb.reserve ?? b.reserve;
      b.recipe = sb.recipe ?? b.recipe;
      b.evo = sb.evo || {};
      b.filter = sb.filter || 'all';
    }
    this.generateMap();
    for (const n of s.nodes) this.addNode(n.kind, n.tx, n.ty, n.hp);
    const a = s.activities || {};
    for (const c of a.chests || []) this.activities.chests.push({ id: this.nextId++, x: c.x, y: c.y });
    (a.shrines || []).forEach((sh, i) => { if (this.activities.shrines[i]) this.activities.shrines[i].readyAt = sh.readyAt; });
    for (const r of a.rifts || []) this.spawnRift(r);
    this.activities.notesTaken = [...(a.notesTaken || [])];
    this.activities.notes = this.activities.notes.filter((n) => !this.activities.notesTaken.includes(n.id));
    this.activities.merchant = a.merchant || null;
    this.activities.buff = a.buff || null;
    this.inventory = { ...this.inventory, ...s.inventory };
    this.story = { seen: [...s.story.seen], unread: [...s.story.unread] };
    this.stats = { ...this.stats, ...s.stats };
    this.achievements = [...(s.achievements || [])];
    this.found = [...(s.found || Object.keys(this.res).filter((k) => this.res[k] > 0))];
    this.settings = { ...this.settings, ...s.settings };
    this.shop = { ...this.shop, ...s.shop };
    this.nextId = Math.max(this.nextId, s.nextId || 0);
    const c = this.heartCenter();
    this.hero.x = c.x;
    this.hero.y = c.y + 2.4;
    this.wallsDirty = true;
    this.auraDirty = true;
  }
}

Object.assign(Game.prototype, worldMixin, economyMixin, buildingsMixin, heroMixin, combatMixin, unitsMixin, activitiesMixin, progressMixin);
