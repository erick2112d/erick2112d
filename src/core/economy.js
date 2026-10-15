// Ресурсы, цены, производство, энергия, Сердце, рынок, магазин.
import {
  WORLD, HEART, BUILDINGS, MATERIALS, CURRENCIES, GEM_OFFERS, PRODUCTS, AD_GEMS, ITEMS,
} from '../data/index.js';
import { allocateEnergy } from './energy.js';
import { evoMods, mod } from './stats.js';

export const resName = (k) => (CURRENCIES[k] || MATERIALS[k])?.name || k;
export const valueOf = (k) => (k === 'gold' || k === 'food' ? 1 : k === 'gems' ? WORLD.gemPerValue : MATERIALS[k]?.price ?? 1);

export const economyMixin = {
  // ---------- склад ----------

  storageCap() {
    let cap = WORLD.baseStorage + WORLD.storagePerHeartLevel * this.heartLevel;
    for (const b of this.buildings) {
      const s = BUILDINGS[b.type].storage;
      if (s && !b.destroyed) cap += s * b.level;
    }
    return cap;
  },

  capOf(k) { return CURRENCIES[k] ? Infinity : this.storageCap(); },

  // Добавляет ресурс с учётом склада; возвращает, сколько реально легло.
  addRes(k, v) {
    const before = this.res[k] || 0;
    this.res[k] = Math.min(this.capOf(k), before + v);
    return Math.max(0, this.res[k] - before);
  },

  has(k) { return Math.floor(this.res[k] || 0); },

  canAfford(cost) {
    return Object.entries(cost).every(([k, v]) => (this.res[k] || 0) >= v);
  },

  missing(cost) {
    return Object.entries(cost)
      .filter(([k, v]) => (this.res[k] || 0) < v)
      .map(([k, v]) => `${resName(k).toLowerCase()} ${Math.ceil(v - (this.res[k] || 0))}`);
  },

  pay(cost) {
    for (const [k, v] of Object.entries(cost)) this.res[k] = (this.res[k] || 0) - v;
  },

  gemPrice(cost) {
    const value = Object.entries(cost).reduce((s, [k, v]) => s + valueOf(k) * v, 0);
    return Math.max(1, Math.ceil(value / WORLD.gemPerValue));
  },

  // Платит ресурсами или самоцветами. Возвращает true при успехе.
  spend(cost, useGems = false) {
    if (useGems) {
      const g = this.gemPrice(cost);
      if ((this.res.gems || 0) < g) {
        this.emit('toast', { text: `Нужно ${g} самоцветов`, bad: true, shop: true });
        return false;
      }
      this.res.gems -= g;
      return true;
    }
    if (!this.canAfford(cost)) {
      this.emit('toast', { text: 'Не хватает: ' + this.missing(cost).join(', '), bad: true });
      return false;
    }
    this.pay(cost);
    return true;
  },

  // ---------- Сердце ----------

  heartMaxHp(level = this.heartLevel) { return HEART.hp + HEART.hpPerLevel * (level - 1); },

  heartUpgradeCost(level = this.heartLevel) {
    const g = (c) => Math.ceil(c.amount * Math.pow(c.growth, level - 1));
    const cost = { gold: g(HEART.gold), food: g(HEART.food) };
    const base = HEART.base.amount * Math.pow(HEART.base.growth, level - 1);
    let bi = 0;
    HEART.bands.forEach((band, i) => { if (level >= band.from) bi = i; });
    const add = (mats, k) => {
      for (const [m, w] of Object.entries(mats)) cost[m] = (cost[m] || 0) + Math.max(1, Math.ceil(base * w * k));
    };
    add(HEART.bands[bi].mats, 1);
    if (bi > 0) add(HEART.bands[bi - 1].mats, 0.5);
    return cost;
  },

  canUpgradeHeart() {
    if (this.heartLevel >= HEART.maxLevel) return { ok: false, reason: 'Сердце уже на пределе' };
    if (this.phase === 'wave') return { ok: false, reason: 'Только между волнами' };
    const cost = this.heartUpgradeCost();
    if (!this.canAfford(cost)) return { ok: false, reason: 'Не хватает: ' + this.missing(cost).join(', '), cost };
    return { ok: true, cost };
  },

  upgradeHeart(useGems = false) {
    if (this.heartLevel >= HEART.maxLevel || this.phase === 'wave') {
      this.emit('toast', { text: this.phase === 'wave' ? 'Сердце улучшается только между волнами' : 'Сердце уже на пределе', bad: true });
      return false;
    }
    if (!this.spend(this.heartUpgradeCost(), useGems)) return false;
    const h = this.heart();
    const zoneBefore = this.openZone();
    h.level++;
    const oldMax = h.maxHp;
    h.maxHp = this.heartMaxHp();
    h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - oldMax));
    this.fillNodes(false);
    this.flowDirty = true;
    const c = this.heartCenter();
    this.emit('heartUp', { level: h.level, x: c.x, y: c.y, radius: this.radius() });
    if (h.level >= 5) this.unlockStory('heart5');
    const zoneNow = this.openZone();
    for (let z = zoneBefore + 1; z <= zoneNow; z++) {
      this.unlockStory('zone' + z);
      this.emit('zoneOpen', { zone: z });
    }
    if (h.level >= HEART.maxLevel) this.unlockStory('heart100');
    this.emit('save');
    return true;
  },

  // ---------- энергия ----------

  energyOut(b) {
    const cfg = BUILDINGS[b.type];
    if (!cfg.energyOut) return 0;
    return Math.round((cfg.energyOut + cfg.energyOutPerLevel * (b.level - 1)) * mod(evoMods(b), 'energyOut'));
  },

  recomputeEnergy() {
    let supply = 0;
    const consumers = [];
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (b.destroyed) continue;
      if (cfg.energyOut) supply += this.energyOut(b);
      if (cfg.energyUse) consumers.push({ id: b.id, demand: cfg.energyUse, priority: b.priority, enabled: b.enabled, order: b.id });
    }
    const result = allocateEnergy(supply, consumers);
    for (const b of this.buildings) {
      if (BUILDINGS[b.type].energyUse) b.powered = result.powered.has(b.id);
    }
    this.energy = { supply: result.supply, demand: result.demand, deficit: result.deficit, used: result.used };
  },

  // ---------- производство ----------

  recipeOf(b) {
    const list = BUILDINGS[b.type].recipes;
    if (!list) return null;
    return list.find((r) => r.id === b.recipe) || list[0];
  },

  setRecipe(id, recipeId) {
    const b = this.byId(id);
    const r = b && BUILDINGS[b.type].recipes?.find((x) => x.id === recipeId);
    if (!r) return false;
    if (r.minLevel && b.level < r.minLevel) {
      this.emit('toast', { text: `Рецепт откроется на ${r.minLevel} уровне здания`, bad: true });
      return false;
    }
    b.recipe = recipeId;
    b.progress = 0;
    this.emit('save');
    return true;
  },

  productionSpeed(b) {
    return 1 + (BUILDINGS[b.type].speedPerLevel ?? 0.15) * (b.level - 1);
  },

  changeReserve(id, delta) {
    const b = this.byId(id);
    if (!b || BUILDINGS[b.type].reserve === undefined) return;
    b.reserve = Math.max(0, Math.min(this.storageCap(), b.reserve + delta * 10));
    this.emit('save');
  },

  updateProduction(dt) {
    for (const b of this.buildings) {
      const cfg = BUILDINGS[b.type];
      if (!cfg.recipes) continue;
      const st = this.statusOf(b);
      b.status = st.code;
      if (st.code !== 'working' && st.code !== 'damaged') continue;
      const r = this.recipeOf(b);
      b.progress += dt * this.productionSpeed(b);
      b.workTime = this.time;
      if (b.progress >= r.seconds) {
        b.progress = 0;
        this.pay(r.input);
        const m = evoMods(b);
        const c = this.center(b);
        for (const [k, v] of Object.entries(r.output)) {
          const amount = v * mod(m, 'output');
          this.addRes(k, amount);
          this.emit('gain', { x: c.x, y: c.y - 1.2, res: k, amount });
        }
        if (m.bonusGold) {
          this.addRes('gold', m.bonusGold);
          this.emit('gain', { x: c.x + 0.4, y: c.y - 1.6, res: 'gold', amount: m.bonusGold });
        }
      }
    }
  },

  // ---------- рынок ----------

  bestMarket() {
    let best = null;
    for (const b of this.buildings) if (b.type === 'market' && !b.destroyed && (!best || b.level > best.level)) best = b;
    return best;
  },

  sellPrice(mat) {
    const m = this.bestMarket();
    if (!m) return 0;
    const bonus = 1 + BUILDINGS.market.market.sellBonusPerLevel * (m.level - 1);
    return MATERIALS[mat].price * bonus;
  },

  buyPrice(mat) { return Math.ceil(MATERIALS[mat].price * BUILDINGS.market.market.buyMarkup); },

  canBuyAtMarket(mat) { return MATERIALS[mat].tier <= Math.min(2, this.openZone()) && mat !== 'bones'; },

  marketSell(mat, n) {
    if (!this.bestMarket()) return false;
    n = Math.min(n, this.has(mat));
    if (n <= 0) return false;
    this.res[mat] -= n;
    const gold = Math.floor(this.sellPrice(mat) * n);
    this.addRes('gold', gold);
    this.emit('toast', { text: `Продано: ${resName(mat).toLowerCase()} ×${n} → ${gold} монет` });
    this.emit('save');
    return true;
  },

  marketBuy(mat, n) {
    if (!this.bestMarket() || !this.canBuyAtMarket(mat)) return false;
    const price = this.buyPrice(mat) * n;
    if (!this.spend({ gold: price })) return false;
    const added = this.addRes(mat, n);
    if (added < n) this.res.gold += Math.floor(((n - added) / n) * price); // что не влезло на склад — возвращаем
    this.emit('save');
    return true;
  },

  // ---------- магазин ----------

  buyGemOffer(id) {
    const o = GEM_OFFERS.find((x) => x.id === id);
    if (!o) return false;
    if (o.zone && this.openZone() < o.zone) {
      this.emit('toast', { text: 'Откроется, когда свет дойдёт до нужных земель', bad: true });
      return false;
    }
    if (!this.spend({ gems: o.price })) return false;
    for (const [k, v] of Object.entries(o.give)) this.addRes(k, v);
    this.emit('toast', { text: `Получено: ${o.name}` });
    this.emit('purchase', { id });
    this.emit('save');
    return true;
  },

  // Выдача товара после настоящей покупки (через платежи Яндекса).
  grantProduct(productId) {
    const p = PRODUCTS.find((x) => x.id === productId);
    if (!p) return false;
    if (p.gems) this.addRes('gems', p.gems);
    if (p.gold) this.addRes('gold', p.gold);
    if (p.item && ITEMS[p.item] && !this.inventory.items.includes(p.item)) this.inventory.items.push(p.item);
    if (p.once) this.shop.starterBought = true;
    this.emit('toast', { text: `Покупка получена: ${p.name}` });
    this.emit('purchase', { id: productId });
    this.emit('save');
    return true;
  },

  adGemsReadyIn() { return Math.max(0, Math.ceil(this.shop.adGemsAt + AD_GEMS.cooldown - this.time)); },

  grantAdGems() {
    if (this.adGemsReadyIn() > 0) return false;
    this.shop.adGemsAt = this.time;
    this.addRes('gems', AD_GEMS.amount);
    this.emit('toast', { text: `+${AD_GEMS.amount} самоцветов` });
    this.emit('save');
    return true;
  },
};
