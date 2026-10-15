// Интерфейс поверх холста: верхняя панель, меню строительства, инвентарь, карточки, окна.
import {
  BUILDINGS, BUILD_CATEGORIES, BUILD_ORDER, MATERIALS, MATERIAL_ORDER, CURRENCIES, ITEMS, WEAPON_TYPES, BASE_DAMAGE, TIER_POWER,
  RARITY, CRAFT_LINES, EQUIP_SLOTS, ENEMIES, ACHIEVEMENTS, PRODUCTS, GEM_OFFERS, AD_GEMS, ZONES, HEART, WORLD, UNITS,
} from '../data/index.js';
import { SIDE_NAMES } from '../core/waves.js';
import { storyEntry } from '../core/progress.js';
import { towerStats, evoMods, buildingName } from '../core/stats.js';
import { resName } from '../core/economy.js';
import { WORKER_FILTERS } from '../core/units.js';
import { resIcon, buildingIcon, itemIcon, portrait, enemyPortrait, uiIcon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SIDE_ARROWS = { N: '↑', E: '→', S: '↓', W: '←' };
const fmt = (n) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
};
const pct = (v) => `${Math.round(v * 100)}%`;

function costHtml(cost, res) {
  return Object.entries(cost).map(([k, v]) => {
    const lack = (res[k] || 0) < v;
    return `<span class="cost ${lack ? 'lack' : ''}" title="${esc(resName(k))}"><img src="${resIcon(k)}" alt="">${fmt(v)}</span>`;
  }).join('');
}
const gemCost = (n) => `<span class="cost gem"><img src="${resIcon('gems')}" alt="">${n}</span>`;

export function describeItem(game, id) {
  const it = ITEMS[id];
  if (it.slot === 'weapon') {
    const t = WEAPON_TYPES[it.wtype];
    const dmg = BASE_DAMAGE[it.wtype] * TIER_POWER[it.tier];
    const parts = [`Урон <b>${Math.round(dmg)}</b>`, `удар раз в ${t.cooldown.toFixed(2)} с`, `дальность ${t.range}`];
    return parts.join(' · ') + `<br><span class="muted">${esc(t.name)}: ${esc(t.desc)}</span>`;
  }
  const s = it.stats || {};
  const names = { hp: (v) => `+${v} здоровья`, armor: (v) => `+${v} брони`, damage: (v) => `+${pct(v)} урона`, regen: (v) => `+${v} лечения/с`,
    speed: (v) => `+${pct(v)} скорости`, attackSpeed: (v) => `+${pct(v)} скорости атаки`, crit: (v) => `+${pct(v)} крит. шанса`, goldFind: (v) => `+${pct(v)} монет` };
  return Object.entries(s).map(([k, v]) => names[k] ? names[k](v) : '').join(' · ');
}

export class Hud {
  constructor(root, game, renderer, hooks) {
    this.root = root;
    this.game = game;
    this.renderer = renderer;
    this.hooks = hooks;
    this.buildType = null;
    this.buildGems = false;
    this.objective = null;
    this.modal = null;
    this.window = null;       // { kind, tab, ... }
    this.card = null;
    this.last = {};
    this.timer = 0;
    this.storyQueue = [];
    this.root.innerHTML = this.template();
    this.$ = (sel) => this.root.querySelector(sel);
    this.bind();
    this.renderHotbar();
  }

  setGame(game) {
    this.game = game;
    this.buildType = null;
    this.closeCard();
    this.closeWindow();
    this.last = {};
    this.renderHotbar();
  }

  get blocking() { return !!this.modal || !!this.window; }

  template() {
    return `
      <div class="hud-top">
        <div class="bars">
          <div class="bar-row" title="Сердце Светоча">
            <span class="lvl-badge" id="heartLvl">1</span>
            <div class="bar"><div class="fill heart-fill" id="heartFill"></div><span id="heartText"></span></div>
          </div>
          <div class="bar-row" title="Хранитель">
            <img class="bar-icon" src="${portrait('hero')}" alt="">
            <div class="bar"><div class="fill hero-fill" id="heroFill"></div><span id="heroText"></span></div>
          </div>
        </div>
        <div class="currencies" id="currencies"></div>
        <div class="top-buttons">
          <button class="icon-btn" data-action="inventory" title="Инвентарь (I)"><img src="${uiIcon('bag')}" alt=""></button>
          <button class="icon-btn" data-action="achievements" title="Достижения"><img src="${uiIcon('trophy')}" alt=""><i class="dot hidden" id="achDot"></i></button>
          <button class="icon-btn" data-action="shop" title="Магазин"><img src="${uiIcon('shop')}" alt=""></button>
          <button class="icon-btn" data-action="journal" title="Журнал"><img src="${uiIcon('scroll')}" alt=""><i class="dot hidden" id="journalDot"></i></button>
          <button class="icon-btn" data-action="sound" title="Звук" id="soundBtn"><img src="${uiIcon('soundOn')}" alt=""></button>
          <button class="icon-btn" data-action="menu" title="Меню"><img src="${uiIcon('menu')}" alt=""></button>
        </div>
      </div>
      <div class="energy-chip" id="energyChip"></div>
      <div class="wave-panel" id="wavePanel"></div>
      <div class="objective" id="objective"></div>
      <div class="build-mode hidden" id="buildMode"></div>
      <div class="hud-bottom">
        <button class="build-btn" data-action="buildMenu" title="Строить (B)"><img src="${uiIcon('hammer')}" alt=""><span>Строить</span></button>
        <div class="hotbar" id="hotbar"></div>
      </div>
      <div class="card hidden" id="card"></div>
      <div class="toasts" id="toasts"></div>
      <div class="window-wrap hidden" id="windowWrap"><div class="window" id="window"></div></div>
      <div class="modal-wrap hidden" id="modalWrap"><div class="modal" id="modal"></div></div>
      <div class="joystick hidden" id="joystick"><div class="stick" id="stick"></div></div>
    `;
  }

  bind() {
    this.root.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-action]');
      if (!el) return;
      ev.stopPropagation();
      this.action(el.dataset.action, el.dataset, el);
    });
    for (const sel of ['.hud-top', '#wavePanel', '.hud-bottom', '#card', '#modalWrap', '#windowWrap', '#buildMode', '#energyChip']) {
      this.$(sel).addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.$('#windowWrap').addEventListener('click', (e) => { if (e.target.id === 'windowWrap') this.closeWindow(); });
    // пока кнопка зажата — не перерисовываем карточку и окно, иначе нажатие потеряется
    this.root.addEventListener('pointerdown', () => { this.pressing = true; }, true);
    window.addEventListener('pointerup', () => { setTimeout(() => { this.pressing = false; }, 0); });
    window.addEventListener('pointercancel', () => { this.pressing = false; });
  }

  confirm(text, onYes) {
    this.confirmFn = onYes;
    this.openModal(`<h2>Подтверди</h2><p>${text}</p><div class="result-actions"><button data-action="closeModal">Отмена</button><button class="primary" data-action="confirmYes">Да</button></div>`, 'confirm');
  }

  gemSpend(cost, label, fn) {
    const n = this.game.gemPrice(cost);
    if (this.game.res.gems < n) { this.toast(`Нужно ${n} самоцветов`, true); this.openShop(); return; }
    this.confirm(`${label} за <b>${n}</b> <img class="inl" src="${resIcon('gems')}" alt="">?`, fn);
  }

  action(name, data) {
    const g = this.game;
    this.hooks.click?.();
    const id = Number(data.id);
    switch (name) {
      // строительство
      case 'buildMenu': this.openBuildMenu(); break;
      case 'buildTab': this.window.tab = data.tab; this.renderWindow(); break;
      case 'pickBuild': this.closeWindow(); this.startBuild(data.type, false); break;
      case 'pickBuildGems': {
        const type = data.type;
        this.gemSpend(BUILDINGS[type].cost, `Построить «${BUILDINGS[type].name}»`, () => { this.closeWindow(); this.startBuild(type, true); });
        break;
      }
      case 'cancelBuild': this.cancelBuild(); break;
      // оружие
      case 'hotbar': if (!g.useHotbar(Number(data.slot))) this.openInventory(); this.renderHotbar(); break;
      case 'auto': g.toggleAuto(); this.renderHotbar(); break;
      // волна
      case 'startWave': this.closeCard(); this.hooks.startWave(); break;
      case 'pickWave': g.setNextWave(Number(data.wave)); this.last.wave = null; break;
      // карточка здания
      case 'upgrade': g.upgrade(id); this.refreshCard(true); break;
      case 'upgradeGems': {
        const b = g.byId(id);
        const cost = b.type === 'heart' ? g.heartUpgradeCost() : g.upgradeCost(b);
        this.gemSpend(cost, 'Улучшить', () => { g.upgrade(id, true); this.refreshCard(true); });
        break;
      }
      case 'upgradeSegment': g.upgradeSegment(id); this.refreshCard(true); break;
      case 'evolve': g.chooseEvolution(id, data.opt); this.refreshCard(true); break;
      case 'toggle': g.toggleEnabled(id); this.refreshCard(true); break;
      case 'prio': g.changePriority(id, Number(data.delta)); this.refreshCard(true); break;
      case 'reserve': g.changeReserve(id, Number(data.delta)); this.refreshCard(true); break;
      case 'recipe': g.setRecipe(id, data.recipe); this.refreshCard(true); break;
      case 'filter': g.setWorkerFilter(id, data.filter); this.refreshCard(true); break;
      case 'repairNow': g.repairNow(id); this.refreshCard(true); break;
      case 'closeCard': this.closeCard(); break;
      case 'openCraft': this.openCraft(data.line); break;
      case 'openMarket': this.openMarket(); break;
      // окна
      case 'closeWindow': this.closeWindow(); break;
      case 'inventory': this.openInventory(); break;
      case 'invTab': this.window.tab = data.tab; this.window.sel = null; this.renderWindow(); break;
      case 'selItem': this.window.sel = data.item; this.renderWindow(); break;
      case 'equip': g.equip(data.item); this.renderWindow(); this.renderHotbar(); break;
      case 'unequip': g.unequip(data.slot); this.renderWindow(); break;
      case 'toHotbar': g.setHotbar(Number(data.slot), data.item); this.renderWindow(); this.renderHotbar(); break;
      case 'craftTab': this.window.tab = data.tab; this.renderWindow(); break;
      case 'craft': if (g.craft(data.item)) this.toast(`Изучено: ${ITEMS[data.item].name}`); this.renderWindow(); this.renderHotbar(); break;
      case 'craftGems': this.gemSpend(ITEMS[data.item].cost, `Изучить «${ITEMS[data.item].name}»`, () => { g.craft(data.item, true); this.renderWindow(); this.renderHotbar(); }); break;
      case 'sell': g.marketSell(data.mat, Number(data.n)); this.renderWindow(); break;
      case 'buy': g.marketBuy(data.mat, Number(data.n)); this.renderWindow(); break;
      case 'shop': this.openShop(); break;
      case 'shopTab': this.window.tab = data.tab; this.renderWindow(); break;
      case 'buyProduct': this.hooks.buyProduct(data.product, () => this.renderWindow()); break;
      case 'buyOffer': g.buyGemOffer(data.offer); this.renderWindow(); break;
      case 'adGems': this.hooks.rewarded(() => { g.grantAdGems(); this.renderWindow(); }); break;
      case 'merchantBuy': g.buyFromMerchant(Number(data.i)); this.renderWindow(); break;
      case 'achievements': this.openAchievements(); break;
      case 'journal': this.openJournal(); break;
      case 'sound': this.hooks.toggleSound(); break;
      case 'menu': this.openMenu(); break;
      // модальные
      case 'closeModal': this.closeModal(); break;
      case 'confirmYes': { const fn = this.confirmFn; this.confirmFn = null; this.closeModal(); fn?.(); break; }
      case 'nextWave': g.setNextWave(Number(data.wave)); this.closeModal(); this.hooks.afterResult?.(); break;
      case 'rewarded':
        this.hooks.rewarded(() => {
          g.grantBonus();
          const btn = this.$('#modal [data-action="rewarded"]');
          if (btn) { btn.disabled = true; btn.textContent = 'Бонус получен'; }
        });
        break;
      case 'newGameAsk': this.openConfirmNew(); break;
      case 'newGame': this.closeModal(); this.hooks.newGame(); break;
      case 'resume': this.closeModal(); break;
      default:
    }
  }

  // ---------- строительство ----------

  startBuild(type, useGems) {
    this.buildType = type;
    this.buildGems = useGems;
    this.closeCard();
    const cfg = BUILDINGS[type];
    this.$('#buildMode').innerHTML = `<img src="${buildingIcon(type)}" alt=""><div><b>${esc(cfg.name)}</b><span>${cfg.wall ? 'Нажми и тяни — получится ряд' : 'Выбери место на освещённой земле'}${useGems ? ' · за самоцветы' : ''}</span></div>
      <button data-action="cancelBuild">Готово</button>`;
    this.$('#buildMode').classList.remove('hidden');
  }

  cancelBuild() {
    this.buildType = null;
    this.buildGems = false;
    this.renderer.ghost = null;
    this.renderer.wallDrag = null;
    this.$('#buildMode').classList.add('hidden');
  }

  openBuildMenu() {
    this.cancelBuild();
    this.closeCard();
    this.openWindow({ kind: 'build', tab: this.lastBuildTab || 'economy' });
  }

  renderBuildMenu(w) {
    const g = this.game;
    this.lastBuildTab = w.tab;
    const tabs = BUILD_CATEGORIES.map((c) => `<button class="tab ${w.tab === c.id ? 'on' : ''}" data-action="buildTab" data-tab="${c.id}">${c.name}</button>`).join('');
    const list = BUILD_ORDER.filter((t) => BUILDINGS[t].category === w.tab).map((t) => {
      const cfg = BUILDINGS[t];
      const unlocked = g.isUnlocked(t);
      const count = g.buildings.filter((b) => b.type === t).length;
      const afford = g.canAfford(cfg.cost);
      return `<div class="bcard ${unlocked ? '' : 'locked'}">
        <img src="${buildingIcon(t)}" alt="">
        <div class="bcard-body">
          <div class="bcard-title">${esc(cfg.name)}${count ? ` <span class="muted">×${count}</span>` : ''}</div>
          <div class="muted small">${esc(cfg.desc)}</div>
          ${unlocked ? `<div class="bcard-cost">${costHtml(cfg.cost, g.res)}</div>` : `<div class="lock">Нужен ${cfg.unlock} уровень Сердца</div>`}
        </div>
        ${unlocked ? `<div class="bcard-actions"><button class="primary" data-action="pickBuild" data-type="${t}" ${afford ? '' : 'data-poor="1"'}>Строить</button>
          ${afford ? '' : `<button class="gem-btn" data-action="pickBuildGems" data-type="${t}">${gemCost(g.gemPrice(cfg.cost))}</button>`}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="win-head"><h2>Строительство</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>
      <div class="tabs">${tabs}</div><div class="bgrid">${list}</div>`;
  }

  // ---------- кадры ----------

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.12;
    const g = this.game;
    this.objective = g.objective();
    this.renderBars();
    this.renderCurrencies();
    this.renderWavePanel();
    this.setText('#objective', this.objective && !this.card && !this.buildType ? `<span class="star">★</span> ${esc(this.objective.text)}` : '');
    if (!this.pressing) {
      this.refreshCard();
      this.winTimer = (this.winTimer || 0) - 0.12;
      if (this.winTimer <= 0 && this.window && ['build', 'inventory', 'craft', 'market', 'shop', 'merchant'].includes(this.window.kind)) {
        this.winTimer = 0.5;
        this.renderWindow(true);
      }
    }
    this.$('#journalDot').classList.toggle('hidden', !g.story.unread.length);
    this.$('#achDot').classList.toggle('hidden', !(this.newAch > 0));
    const snd = this.hooks.soundOn() ? 'soundOn' : 'soundOff';
    if (this.last.snd !== snd) { this.last.snd = snd; this.$('#soundBtn img').src = uiIcon(snd); }
    const hb = g.inventory.hotbar.join(',') + g.inventory.equipped.weapon + g.settings.auto;
    if (this.last.hb !== hb) this.renderHotbar();
  }

  setText(id, html) {
    if (this.last[id] === html) return;
    this.last[id] = html;
    this.$(id).innerHTML = html;
  }

  renderBars() {
    const g = this.game;
    const heart = g.heart();
    this.$('#heartFill').style.width = `${(heart.hp / heart.maxHp) * 100}%`;
    this.setText('#heartText', `${fmt(Math.ceil(heart.hp))} / ${fmt(heart.maxHp)}`);
    this.setText('#heartLvl', String(g.heartLevel));
    const h = g.hero;
    this.$('#heroFill').style.width = `${h.dead ? 0 : (h.hp / h.maxHp) * 100}%`;
    this.setText('#heroText', h.dead ? `Возрождение через ${Math.ceil(h.respawn)} с` : `${fmt(Math.ceil(h.hp))} / ${fmt(h.maxHp)}`);
  }

  renderCurrencies() {
    const g = this.game;
    const html = ['gold', 'gems', 'food'].map((k) => `<div class="cur ${k}" title="${CURRENCIES[k].name}"><img src="${resIcon(k)}" alt=""><b>${fmt(g.res[k] || 0)}</b>${k === 'gems' ? '<button class="plus" data-action="shop">+</button>' : ''}</div>`).join('');
    this.setText('#currencies', html);
    const e = g.energy;
    const deficit = e.deficit > 0;
    this.setText('#energyChip', e.supply || e.demand ? `<div class="res-chip ${deficit ? 'deficit' : ''}" title="Энергия: потребление / производство"><img src="${resIcon('energy')}" alt="">${e.demand}/${e.supply}${deficit ? ` <b>−${e.deficit}</b>` : ''}</div>` : '');
  }

  renderWavePanel() {
    const g = this.game;
    let html;
    if (g.phase === 'wave') {
      const w = g.wave;
      const left = Math.max(0, w.plan.total - w.killed);
      const p = Math.round((w.killed / w.plan.total) * 100);
      html = `<div class="wave-title">Волна ${w.plan.number} · ${w.plan.kindName}${w.plan.boss ? ' · <b class="boss">Босс</b>' : ''}</div>
        <div class="wave-progress"><div style="width:${p}%"></div></div>
        <div class="wave-sub">Осталось: ${left} · ${w.plan.sides.map((s) => SIDE_ARROWS[s] + ' ' + SIDE_NAMES[s]).join(', ')}</div>`;
    } else {
      const plan = g.wavePreview();
      const comp = Object.entries(plan.counts).map(([t, n]) =>
        `<span class="enemy-chip ${ENEMIES[t].boss ? 'boss' : ''}" title="${esc(ENEMIES[t].name)}: ${esc(ENEMIES[t].desc)}"><img src="${enemyPortrait(t)}" alt="">×${n}</span>`).join('');
      const hc = g.progress.highestCleared;
      const choose = hc >= 1 ? `<div class="wave-choice">
          <button class="chip ${g.progress.nextWave === hc ? 'on' : ''}" data-action="pickWave" data-wave="${hc}">Повтор ${hc}</button>
          <button class="chip ${g.progress.nextWave === hc + 1 ? 'on' : ''}" data-action="pickWave" data-wave="${hc + 1}">Новая ${hc + 1}</button></div>` : '';
      html = `<div class="wave-title">Волна ${plan.number} · ${plan.kindName}${plan.boss ? ' · <b class="boss">Босс</b>' : ''}${plan.event ? ` · <b class="event" title="${esc(plan.event.text)}">${plan.event.name}</b>` : ''}</div>
        <div class="wave-sub">Придут: ${plan.sides.map((s) => `<b class="side">${SIDE_ARROWS[s]} ${SIDE_NAMES[s]}</b>`).join(' ')}</div>
        <div class="wave-comp">${comp}</div>${choose}
        <button class="primary big" data-action="startWave">В бой</button>`;
    }
    this.setText('#wavePanel', html);
  }

  renderHotbar() {
    const g = this.game;
    const hb = g.inventory.hotbar;
    this.last.hb = hb.join(',') + g.inventory.equipped.weapon + g.settings.auto;
    const html = hb.map((id, i) => {
      const on = id && g.inventory.equipped.weapon === id;
      const it = id && ITEMS[id];
      return `<button class="slot ${on ? 'on' : ''} ${id ? '' : 'empty'}" data-action="hotbar" data-slot="${i}" title="${it ? esc(it.name) : 'Пустой слот — открой инвентарь'}" style="${it ? `--rar:${RARITY[it.tier].color}` : ''}">
        ${it ? `<img src="${itemIcon(id)}" alt="">` : '<span class="plus-big">+</span>'}<span class="key">${i + 1}</span></button>`;
    }).join('') + `<button class="slot auto ${g.settings.auto ? 'on' : ''}" data-action="auto" title="Автоатака (Q)">${g.settings.auto ? 'АВТО' : 'РУЧН'}</button>`;
    this.$('#hotbar').innerHTML = html;
  }

  // ---------- карточка постройки ----------

  selectBuilding(id) {
    this.card = { kind: 'building', id };
    this.renderer.selected = id;
    this.refreshCard(true);
  }

  closeCard() {
    this.card = null;
    this.renderer.selected = null;
    this.$('#card').classList.add('hidden');
    this.last.card = null;
  }

  refreshCard(force) {
    if (!this.card) return;
    const g = this.game;
    const b = g.byId(this.card.id);
    if (!b) return this.closeCard();
    const html = b.type === 'heart' ? this.heartCard(b) : this.buildingCard(b);
    if (!force && this.last.card === html) return;
    this.last.card = html;
    const el = this.$('#card');
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  heartCard(b) {
    const g = this.game;
    const L = g.heartLevel;
    const cost = g.heartUpgradeCost();
    const check = g.canUpgradeHeart();
    const zone = ZONES.find((z) => z.id === g.openZone());
    const next = ZONES.find((z) => z.rMin > g.radius());
    const levelsToNext = next ? Math.ceil((next.rMin - g.radius()) / ((HEART.radiusEnd - HEART.radiusStart) / (HEART.maxLevel - 1))) : 0;
    const maxed = L >= HEART.maxLevel;
    return `<div class="card-head"><img src="${buildingIcon('heart')}" alt=""><div><h3>Сердце Светоча</h3><div class="muted">Уровень ${L} из ${HEART.maxLevel}</div></div>
        <button class="icon-btn close" data-action="closeCard">✕</button></div>
      <div class="hpbar"><div style="width:${(b.hp / b.maxHp) * 100}%"></div><span>${fmt(Math.ceil(b.hp))} / ${fmt(b.maxHp)}</span></div>
      <div class="row">Свет: радиус <b>${g.radius().toFixed(1)}</b> · земли: <b>${esc(zone.name)}</b></div>
      ${next ? `<div class="row muted">До земель «${esc(next.name)}» ещё ~${levelsToNext} ур.</div>` : '<div class="row muted">Свет покрыл весь край</div>'}
      <div class="row muted">Каждый уровень раздвигает мглу, даёт +${HEART.hpPerLevel} прочности и +${WORLD.storagePerHeartLevel} к складу. Уровень построек не выше уровня Сердца.</div>
      ${b.hp < b.maxHp && g.phase === 'build' ? `<div class="card-actions"><button data-action="repairNow" data-id="${b.id}" ${g.canAfford(g.manualRepairCost(b)) ? '' : 'disabled'}>Починить ${costHtml(g.manualRepairCost(b), g.res)}</button></div>` : ''}
      ${maxed ? '<div class="status ok">Сердце сияет в полную силу</div>' : `
      <div class="upgrade-box">
        <div class="muted">Улучшение до ${L + 1}:</div>
        <div class="cost-list">${costHtml(cost, g.res)}</div>
        <div class="card-actions">
          <button class="primary" data-action="upgrade" data-id="${b.id}" ${check.ok ? '' : 'disabled'} title="${esc(check.reason || '')}">Улучшить</button>
          <button class="gem-btn" data-action="upgradeGems" data-id="${b.id}" ${g.phase === 'wave' ? 'disabled' : ''}>${gemCost(g.gemPrice(cost))}</button>
        </div>
        ${!check.ok && check.reason ? `<div class="lock">${esc(check.reason)}</div>` : ''}
      </div>`}`;
  }

  buildingCard(b) {
    const g = this.game;
    const cfg = BUILDINGS[b.type];
    const st = g.statusOf(b);
    const m = evoMods(b);
    const lines = [];
    if (cfg.energyOut) lines.push(`Даёт энергии: <b>${g.energyOut(b)}</b>`);
    if (cfg.energyUse) lines.push(`Потребляет <b>${cfg.energyUse}</b> <img class="inl" src="${resIcon('energy')}" alt=""> · приоритет <b>${b.priority}</b>
      <span class="mini-btns"><button data-action="prio" data-id="${b.id}" data-delta="-1">−</button><button data-action="prio" data-id="${b.id}" data-delta="1">+</button></span>`);
    if (cfg.recipes) {
      const r = g.recipeOf(b);
      const speed = g.productionSpeed(b);
      const inp = Object.entries(r.input).map(([k, v]) => `${v}<img class="inl" src="${resIcon(k)}" alt="">`).join(' ') || '—';
      const out = Object.entries(r.output).map(([k, v]) => `${Math.round(v * (m.output || 1) * 10) / 10}<img class="inl" src="${resIcon(k)}" alt="">`).join(' ');
      lines.push(`Цикл: ${inp} → ${out}${m.bonusGold ? ` +${m.bonusGold}<img class="inl" src="${resIcon('gold')}" alt="">` : ''} за ${(r.seconds / speed).toFixed(1)} с`);
      lines.push(`<div class="progress"><div style="width:${Math.round((b.progress / r.seconds) * 100)}%"></div></div>`);
      if (cfg.recipes.length > 1) {
        lines.push(`<div class="chips">${cfg.recipes.map((x) => `<button class="chip ${x.id === r.id ? 'on' : ''}" data-action="recipe" data-id="${b.id}" data-recipe="${x.id}" ${x.minLevel && b.level < x.minLevel ? 'disabled' : ''}>${esc(x.name)}${x.minLevel && b.level < x.minLevel ? ` (ур. ${x.minLevel})` : ''}</button>`).join('')}</div>`);
      }
      if (cfg.reserve !== undefined) {
        const k = Object.keys(r.input)[0];
        if (k) lines.push(`Не трогать последние <b>${b.reserve}</b> <img class="inl" src="${resIcon(k)}" alt=""><span class="mini-btns"><button data-action="reserve" data-id="${b.id}" data-delta="-1">−</button><button data-action="reserve" data-id="${b.id}" data-delta="1">+</button></span>`);
      }
    }
    const ts = towerStats(b);
    if (ts) {
      const extra = [];
      if (ts.multishot > 1) extra.push(`целей: ${ts.multishot}`);
      if (ts.splash) extra.push(`область ${ts.splash.toFixed(1)}`);
      if (ts.slow) extra.push(`замедление ${pct(ts.slow)}`);
      if (ts.burn) extra.push(`горение ${Math.round(ts.burn)}/с`);
      if (ts.pierce) extra.push(`пробитие ${ts.pierce}`);
      if (ts.chain) extra.push(`цепь ${ts.chain}`);
      if (ts.crit) extra.push(`крит ${pct(ts.crit)}`);
      lines.push(`Урон <b>${Math.round(ts.damage)}</b> · дальность <b>${ts.range.toFixed(1)}</b> · раз в ${ts.cooldown.toFixed(2)} с${extra.length ? '<br>' + extra.join(' · ') : ''}`);
      if (b.aura?.damage) lines.push(`<span class="good">Сторожевая башня: +${pct(b.aura.damage)} урона, +${b.aura.range.toFixed(1)} дальности</span>`);
    }
    if (cfg.aura) lines.push(`Аура ${(cfg.aura.radius + 0.1 * (b.level - 1)).toFixed(1)}: башням +${pct(cfg.aura.damage * (1 + 0.05 * (b.level - 1)))} урона`);
    if (cfg.trap) lines.push(`Урон по наступившим: <b>${Math.round(cfg.trap.damage * (1 + 0.15 * (b.level - 1)))}</b> раз в ${cfg.trap.cooldown} с`);
    if (cfg.spawns) {
      const u = UNITS[cfg.spawns.unit];
      lines.push(`Отряд: до <b>${g.squadSize(b)}</b> (${esc(u.name.toLowerCase())}) · наём ${cfg.spawns.foodCost} <img class="inl" src="${resIcon('food')}" alt="">`);
    }
    if (cfg.workers) {
      lines.push(`Рабочих: до <b>${g.workerCount(b)}</b> · наём ${cfg.workers.foodCost} <img class="inl" src="${resIcon('food')}" alt="">`);
      lines.push(`<div class="chips">${Object.entries(WORKER_FILTERS).map(([k, f]) => `<button class="chip ${b.filter === k ? 'on' : ''}" data-action="filter" data-id="${b.id}" data-filter="${k}">${esc(f.name)}</button>`).join('')}</div>`);
    }
    if (cfg.repair) {
      const est = g.repairEstimate();
      lines.push(`Ремонтников: <b>${g.repairerCount(b)}</b> · ремонт базы ≈ <b>${est.wood}</b> <img class="inl" src="${resIcon('wood')}" alt="">`);
    }
    if (cfg.storage) lines.push(`Склад: +${cfg.storage * b.level} к пределу (всего ${fmt(g.storageCap())})`);
    if (cfg.training) lines.push(`Герою: +${cfg.training.hp * b.level} здоровья, +${pct(cfg.training.damage * b.level)} урона`);
    if (cfg.crafting) lines.push(`<button class="primary wide" data-action="openCraft" data-line="${cfg.crafting}">Открыть мастерскую: ${esc(CRAFT_LINES[cfg.crafting].name.toLowerCase())}</button>`);
    if (cfg.market) lines.push('<button class="primary wide" data-action="openMarket">Торговать</button>');

    let hpHtml = `<div class="hpbar"><div style="width:${(b.hp / b.maxHp) * 100}%"></div><span>${fmt(Math.ceil(b.hp))} / ${fmt(b.maxHp)}</span></div>`;
    if (cfg.wall) {
      const gh = g.wallGroupHp(b);
      hpHtml = `<div class="hpbar"><div style="width:${(gh.hp / gh.maxHp) * 100}%"></div><span>${fmt(Math.ceil(gh.hp))} / ${fmt(gh.maxHp)}</span></div>
        <div class="row muted">Цельный забор: <b>${gh.count}</b> секц. ${b.level}-го уровня с общей прочностью — если сломать одну, рухнут все.</div>`;
    }
    const tier = g.pendingEvolution(b);
    let evoHtml = '';
    if (tier) {
      evoHtml = `<div class="evo-box"><div class="evo-title">Эволюция ${tier} уровня — выбери путь</div>
        ${cfg.evolutions[tier].map((o) => `<button class="evo-opt" data-action="evolve" data-id="${b.id}" data-opt="${o.id}"><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></button>`).join('')}</div>`;
    } else if (cfg.evolutions && b.level < 10) {
      lines.push(`<span class="muted">На 10, 20 и 30 уровне — эволюция с выбором из двух путей</span>`);
    }
    const up = g.canUpgrade(b);
    const maxed = b.level >= cfg.maxLevel;
    const upCost = g.upgradeCost(b);
    let upHtml = '';
    if (!maxed && !tier) {
      upHtml = `<div class="upgrade-box"><div class="muted">Улучшение до ${b.level + 1}:</div><div class="cost-list">${costHtml(upCost, g.res)}</div>
        <div class="card-actions"><button class="primary" data-action="upgrade" data-id="${b.id}" ${up.ok ? '' : 'disabled'}>Улучшить</button>
        ${up.heart || up.evo ? '' : `<button class="gem-btn" data-action="upgradeGems" data-id="${b.id}">${gemCost(g.gemPrice(upCost))}</button>`}
        ${cfg.wall && g.wallSegment(b).length > 1 ? `<button data-action="upgradeSegment" data-id="${b.id}" ${up.ok || up.noMoney ? '' : 'disabled'}>Весь забор ${costHtml(g.segmentUpgradeCost(b).cost, g.res)}</button>` : ''}</div>
        ${!up.ok && up.reason ? `<div class="lock">${esc(up.reason)}</div>` : ''}</div>`;
    }
    const fix = g.missingHp(b) > 0.5 && g.phase === 'build'
      ? `<button data-action="repairNow" data-id="${b.id}" ${g.canAfford(g.manualRepairCost(b)) ? '' : 'disabled'}>Починить ${costHtml(g.manualRepairCost(b), g.res)}</button>` : '';
    const toggle = cfg.energyUse || cfg.recipes || cfg.repair ? `<button data-action="toggle" data-id="${b.id}">${b.enabled ? 'Выключить' : 'Включить'}</button>` : '';
    return `<div class="card-head"><img src="${buildingIcon(b.type)}" alt=""><div><h3>${esc(buildingName(b))}</h3><div class="muted">${esc(cfg.name)} · уровень ${b.level}/${cfg.maxLevel}</div></div>
        <button class="icon-btn close" data-action="closeCard">✕</button></div>
      ${hpHtml}
      <div class="status ${st.bad ? 'bad' : st.evolve ? 'evo' : 'ok'}">${esc(st.text)}</div>
      ${evoHtml}
      ${lines.map((l) => `<div class="row">${l}</div>`).join('')}
      ${upHtml}
      ${fix || toggle ? `<div class="card-actions">${fix}${toggle}</div>` : ''}`;
  }

  // ---------- окна ----------

  openWindow(w) {
    this.window = w;
    this.renderWindow();
    this.$('#windowWrap').classList.remove('hidden');
    this.hooks.modalChanged?.(true);
  }

  closeWindow() {
    this.window = null;
    this.$('#windowWrap').classList.add('hidden');
    this.last.window = null;
    this.hooks.modalChanged?.(false);
  }

  renderWindow(soft = false) {
    const w = this.window;
    if (!w) return;
    let html = '';
    if (w.kind === 'build') html = this.renderBuildMenu(w);
    else if (w.kind === 'inventory') html = this.renderInventory(w);
    else if (w.kind === 'craft') html = this.renderCraft(w);
    else if (w.kind === 'market') html = this.renderMarket(w);
    else if (w.kind === 'shop') html = this.renderShop(w);
    else if (w.kind === 'achievements') html = this.renderAchievements();
    else if (w.kind === 'journal') html = this.renderJournal();
    else if (w.kind === 'merchant') html = this.renderMerchant();
    if (soft && this.last.window === html) return;
    this.last.window = html;
    const el = this.$('#window');
    const scroll = el.querySelector('.scroll-area')?.scrollTop || 0;
    el.innerHTML = html;
    const area = el.querySelector('.scroll-area');
    if (area) area.scrollTop = scroll;
  }

  openInventory() { this.closeCard(); this.openWindow({ kind: 'inventory', tab: 'gear', sel: null }); }

  renderInventory(w) {
    const g = this.game;
    const tabs = `<div class="tabs"><button class="tab ${w.tab === 'gear' ? 'on' : ''}" data-action="invTab" data-tab="gear">Снаряжение</button>
      <button class="tab ${w.tab === 'mats' ? 'on' : ''}" data-action="invTab" data-tab="mats">Материалы</button></div>`;
    let body;
    if (w.tab === 'mats') {
      const cap = g.storageCap();
      body = `<div class="muted small">Предел склада: ${fmt(cap)} каждого материала. Склады и уровень Сердца увеличивают его.</div>
        <div class="mat-grid scroll-area">${MATERIAL_ORDER.map((k) => {
          const v = g.res[k] || 0;
          return `<div class="mat ${v <= 0 ? 'zero' : ''}" title="${esc(MATERIALS[k].desc)}"><img src="${resIcon(k)}" alt=""><div><b>${fmt(v)}</b><span>${esc(MATERIALS[k].name)}</span>
            <div class="cap"><div style="width:${Math.min(100, (v / cap) * 100)}%"></div></div></div></div>`;
        }).join('')}</div>`;
    } else {
      const eq = g.inventory.equipped;
      const slots = EQUIP_SLOTS.map((s) => {
        const id = eq[s.id];
        return `<button class="eq-slot ${id ? '' : 'empty'}" data-action="${id ? 'selItem' : ''}" data-item="${id || ''}" style="${id ? `--rar:${RARITY[ITEMS[id].tier].color}` : ''}">
          ${id ? `<img src="${itemIcon(id)}" alt="">` : ''}<span>${s.name}</span></button>`;
      }).join('');
      const st = g.heroStats;
      const ws = g.weaponStats();
      const stats = `<div class="hero-stats"><div>Здоровье <b>${fmt(g.hero.maxHp)}</b></div><div>Броня <b>${st.armor}</b></div>
        <div>Урон оружия <b>${Math.round(ws.damage)}</b></div><div>Крит <b>${pct(ws.crit)}</b></div><div>Скорость <b>+${pct(st.speed)}</b></div><div>Лечение <b>${st.regen.toFixed(1)}/с</b></div></div>`;
      const items = g.inventory.items.slice().sort((a, b) => (ITEMS[b].tier - ITEMS[a].tier) || ITEMS[a].slot.localeCompare(ITEMS[b].slot));
      const grid = items.map((id) => {
        const it = ITEMS[id];
        const on = Object.values(eq).includes(id);
        return `<button class="item ${w.sel === id ? 'sel' : ''} ${on ? 'equipped' : ''}" data-action="selItem" data-item="${id}" style="--rar:${RARITY[it.tier].color}" title="${esc(it.name)}">
          <img src="${itemIcon(id)}" alt="">${on ? '<i class="eq-mark">✓</i>' : ''}</button>`;
      }).join('');
      let detail = '<div class="muted small">Выбери предмет, чтобы надеть его или поставить в быстрый слот. Новое оружие изучается в Кузне, Мастерской стрелка и Чародейской башне, доспехи и украшения — в Бронной мастерской.</div>';
      if (w.sel && ITEMS[w.sel]) {
        const it = ITEMS[w.sel];
        const on = eq[it.slot] === w.sel;
        detail = `<div class="item-detail"><img src="${itemIcon(w.sel)}" alt=""><div>
          <div class="item-name" style="color:${RARITY[it.tier].color}">${esc(it.name)}</div>
          <div class="muted small">${RARITY[it.tier].name} · ${EQUIP_SLOTS.find((s) => s.id === it.slot).name.toLowerCase()}</div>
          <div class="small">${describeItem(g, w.sel)}</div>
          <div class="card-actions">${on ? (it.slot === 'weapon' ? '<span class="good">Надето</span>' : `<button data-action="unequip" data-slot="${it.slot}">Снять</button>`) : `<button class="primary" data-action="equip" data-item="${w.sel}">Надеть</button>`}
          ${it.slot === 'weapon' ? [0, 1, 2].map((i) => `<button class="chip ${g.inventory.hotbar[i] === w.sel ? 'on' : ''}" data-action="toHotbar" data-slot="${i}" data-item="${w.sel}">Слот ${i + 1}</button>`).join('') : ''}</div>
        </div></div>`;
      }
      body = `<div class="inv-layout"><div class="inv-left"><div class="eq-slots">${slots}</div>${stats}</div>
        <div class="inv-right"><div class="item-grid scroll-area">${grid}</div>${detail}</div></div>`;
    }
    return `<div class="win-head"><h2>Инвентарь</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>${tabs}${body}`;
  }

  openCraft(line) { this.closeCard(); this.openWindow({ kind: 'craft', line, tab: null }); }

  renderCraft(w) {
    const g = this.game;
    const L = CRAFT_LINES[w.line];
    const groups = L.types ? L.types.map((t) => ({ id: t, name: WEAPON_TYPES[t].name, items: Object.values(ITEMS).filter((it) => it.wtype === t && it.building) }))
      : L.slots.map((s) => ({ id: s, name: EQUIP_SLOTS.find((x) => x.id === s).name, items: Object.values(ITEMS).filter((it) => it.slot === s && it.building) }));
    const tab = w.tab || groups[0].id;
    const group = groups.find((x) => x.id === tab) || groups[0];
    const building = Object.values(ITEMS).find((it) => it.building && (L.types ? L.types.includes(it.wtype) : L.slots.includes(it.slot)))?.building;
    const lvl = g.craftLevel(building);
    const tabs = groups.map((x) => `<button class="tab ${x.id === group.id ? 'on' : ''}" data-action="craftTab" data-tab="${x.id}">${esc(x.name)}</button>`).join('');
    const rows = group.items.map((it) => {
      const c = g.canCraft(it.id);
      const owned = g.owns(it.id);
      return `<div class="craft-row ${owned ? 'owned' : ''}" style="--rar:${RARITY[it.tier].color}">
        <img src="${itemIcon(it.id)}" alt="">
        <div class="craft-body"><div class="item-name" style="color:${RARITY[it.tier].color}">${esc(it.name)}</div>
          <div class="small">${describeItem(g, it.id)}</div>
          ${owned ? '' : `<div class="cost-list">${costHtml(it.cost, g.res)}</div>`}
          ${!owned && lvl < it.level ? `<div class="lock">Нужен ${it.level} уровень здания (сейчас ${lvl})</div>` : ''}</div>
        <div class="craft-actions">${owned ? (g.inventory.equipped[it.slot] === it.id ? '<span class="good">Надето</span>' : `<button data-action="equip" data-item="${it.id}">Надеть</button>`)
          : `<button class="primary" data-action="craft" data-item="${it.id}" ${c.ok ? '' : 'disabled'}>Изучить</button>
             ${c.noMoney ? `<button class="gem-btn" data-action="craftGems" data-item="${it.id}">${gemCost(g.gemPrice(it.cost))}</button>` : ''}`}</div>
      </div>`;
    }).join('');
    return `<div class="win-head"><h2>${esc(BUILDINGS[building].name)} · ур. ${lvl}</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>
      <div class="tabs">${tabs}</div><div class="craft-list scroll-area">${rows}</div>`;
  }

  openMarket() { this.closeCard(); this.openWindow({ kind: 'market' }); }

  renderMarket() {
    const g = this.game;
    const rows = MATERIAL_ORDER.filter((k) => (g.res[k] || 0) >= 1 || g.canBuyAtMarket(k)).map((k) => {
      const have = Math.floor(g.res[k] || 0);
      const sell = g.sellPrice(k);
      const canBuy = g.canBuyAtMarket(k);
      return `<div class="market-row"><img src="${resIcon(k)}" alt=""><div class="mr-name"><b>${esc(MATERIALS[k].name)}</b><span class="muted small">есть ${fmt(have)}</span></div>
        <div class="mr-actions">
          <button data-action="sell" data-mat="${k}" data-n="10" ${have >= 10 ? '' : 'disabled'}>Продать 10 <span class="cost"><img src="${resIcon('gold')}" alt="">${Math.floor(sell * 10)}</span></button>
          <button data-action="sell" data-mat="${k}" data-n="100" ${have >= 100 ? '' : 'disabled'}>×100</button>
          ${canBuy ? `<button class="primary" data-action="buy" data-mat="${k}" data-n="10" ${g.res.gold >= g.buyPrice(k) * 10 ? '' : 'disabled'}>Купить 10 <span class="cost"><img src="${resIcon('gold')}" alt="">${g.buyPrice(k) * 10}</span></button>` : ''}
        </div></div>`;
    }).join('');
    return `<div class="win-head"><h2>Рынок</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>
      <div class="muted small">Чем выше уровень рынка, тем дороже продажа. Покупаются только простые материалы.</div>
      <div class="market-list scroll-area">${rows || '<p class="muted">Пока нечего продавать.</p>'}</div>`;
  }

  openMerchant() { this.closeCard(); this.openWindow({ kind: 'merchant' }); }

  renderMerchant() {
    const g = this.game;
    const m = g.activities.merchant;
    if (!m) return `<div class="win-head"><h2>Торговец ушёл</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>`;
    const rows = m.offers.map((o, i) => `<div class="market-row ${o.sold ? 'sold' : ''}">
      <div class="mr-name">${Object.entries(o.give).map(([k, v]) => `<span class="cost"><img src="${resIcon(k)}" alt="">${v}</span>`).join(' ')}</div>
      <div class="mr-actions">${o.sold ? '<span class="muted">Продано</span>' : `<button class="primary" data-action="merchantBuy" data-i="${i}" ${g.res.gold >= o.price ? '' : 'disabled'}>Купить <span class="cost"><img src="${resIcon('gold')}" alt="">${o.price}</span></button>`}</div></div>`).join('');
    return `<div class="win-head"><h2>Бродячий торговец</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>
      <div class="muted small">Уйдёт, когда начнётся следующая волна.</div><div class="market-list scroll-area">${rows}</div>`;
  }

  openShop() { this.closeCard(); this.openWindow({ kind: 'shop', tab: 'gems' }); }

  renderShop(w) {
    const g = this.game;
    const tabs = `<div class="tabs"><button class="tab ${w.tab === 'gems' ? 'on' : ''}" data-action="shopTab" data-tab="gems">Самоцветы</button>
      <button class="tab ${w.tab === 'goods' ? 'on' : ''}" data-action="shopTab" data-tab="goods">Товары</button></div>`;
    let body;
    if (w.tab === 'goods') {
      body = `<div class="shop-grid scroll-area">${GEM_OFFERS.map((o) => {
        const locked = o.zone && g.openZone() < o.zone;
        return `<div class="shop-card ${locked ? 'locked' : ''}"><div class="shop-name">${esc(o.name)}</div>
          <div class="cost-list">${Object.entries(o.give).map(([k, v]) => `<span class="cost"><img src="${resIcon(k)}" alt="">${fmt(v)}</span>`).join('')}</div>
          ${locked ? `<div class="lock">Откроется в землях «${esc(ZONES[o.zone - 1].name)}»</div>` : `<button class="gem-btn" data-action="buyOffer" data-offer="${o.id}" ${g.res.gems >= o.price ? '' : 'disabled'}>${gemCost(o.price)}</button>`}</div>`;
      }).join('')}</div>`;
    } else {
      const ad = g.adGemsReadyIn();
      const products = PRODUCTS.filter((p) => !(p.once && g.shop.starterBought)).map((p) => `<div class="shop-card ${p.once ? 'special' : ''}">
          <div class="shop-name">${esc(p.name)}${p.bonus ? ` <span class="bonus">${p.bonus}</span>` : ''}</div>
          <div class="shop-gems"><img src="${resIcon('gems')}" alt=""><b>${p.gems}</b></div>
          ${p.desc ? `<div class="muted small">${esc(p.desc)}</div>` : ''}
          <button class="primary" data-action="buyProduct" data-product="${p.id}" ${this.hooks.paymentsReady() ? '' : 'disabled'}>${esc(this.hooks.productPrice(p.id) || p.fallbackPrice)}</button></div>`).join('');
      body = `<div class="shop-grid scroll-area">
        <div class="shop-card ad"><div class="shop-name">Подарок за рекламу</div><div class="shop-gems"><img src="${resIcon('gems')}" alt=""><b>${AD_GEMS.amount}</b></div>
          <button class="ad-btn" data-action="adGems" ${ad > 0 ? 'disabled' : ''}>${ad > 0 ? `Через ${Math.floor(ad / 60)}:${String(ad % 60).padStart(2, '0')}` : '▶ Смотреть'}</button></div>
        ${products}</div>
        ${this.hooks.paymentsReady() ? '' : '<div class="muted small">Покупки доступны в игре на Яндекс Играх.</div>'}
        <div class="muted small">Самоцветы также выпадают с волн (0–2), боссов, сундуков и за достижения. За них можно строить и улучшать без ресурсов.</div>`;
    }
    return `<div class="win-head"><h2>Магазин</h2><div class="cur gems"><img src="${resIcon('gems')}" alt=""><b>${fmt(g.res.gems)}</b></div><button class="icon-btn close" data-action="closeWindow">✕</button></div>${tabs}${body}`;
  }

  openAchievements() { this.newAch = 0; this.openWindow({ kind: 'achievements' }); }

  renderAchievements() {
    const g = this.game;
    const done = g.achievements.length;
    const rows = ACHIEVEMENTS.map((a) => {
      const ok = g.achievements.includes(a.id);
      const v = Math.min(a.goal, g.statValue(a.stat));
      return `<div class="ach ${ok ? 'done' : ''}"><div class="ach-mark">${ok ? '★' : '☆'}</div><div class="ach-body"><b>${esc(a.name)}</b><span class="muted small">${esc(a.desc)}</span>
        <div class="cap"><div style="width:${(v / a.goal) * 100}%"></div></div><span class="small">${fmt(v)} / ${fmt(a.goal)}</span></div>
        <div class="ach-reward">${gemCost(a.gems)}</div></div>`;
    }).join('');
    return `<div class="win-head"><h2>Достижения · ${done}/${ACHIEVEMENTS.length}</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>
      <div class="ach-list scroll-area">${rows}</div>`;
  }

  openJournal() { this.game.story.unread = []; this.openWindow({ kind: 'journal' }); }

  renderJournal() {
    const g = this.game;
    const entries = g.story.seen.map((id) => storyEntry(id)).filter(Boolean).reverse()
      .map((s) => `<div class="journal-entry ${s.note ? 'note' : ''}"><h4>${s.note ? '✉ ' : ''}${esc(s.title)}</h4><p>${esc(s.text)}</p></div>`).join('');
    const notes = g.activities.notesTaken.length;
    return `<div class="win-head"><h2>Журнал · записки ${notes}/10</h2><button class="icon-btn close" data-action="closeWindow">✕</button></div>
      <div class="journal scroll-area">${entries || '<p class="muted">Пока пусто.</p>'}</div>`;
  }

  // ---------- модальные окна ----------

  openModal(html, kind = 'info') {
    this.modal = kind;
    this.$('#modal').innerHTML = html;
    this.$('#modalWrap').classList.remove('hidden');
    this.hooks.modalChanged?.(true);
  }

  closeModal() {
    this.modal = null;
    this.$('#modalWrap').classList.add('hidden');
    this.hooks.modalChanged?.(false);
    this.showNextStory();
  }

  showStory(id) {
    if (!this.storyQueue.includes(id)) this.storyQueue.push(id);
    if (!this.modal) this.showNextStory();
  }

  showNextStory() {
    if (this.modal) return;
    const id = this.storyQueue.shift();
    if (!id) return;
    const s = storyEntry(id);
    if (!s) return;
    this.game.story.unread = this.game.story.unread.filter((x) => x !== id);
    this.openModal(`<div class="story-mark">${s.note ? '✉' : '✦'}</div><h2>${esc(s.title)}</h2><p class="story">${esc(s.text)}</p>
      <button class="primary big" data-action="closeModal">Дальше</button>`, 'story');
  }

  showResult(r) {
    const g = this.game;
    if (r.victory) {
      const rw = r.rewards;
      const items = Object.entries(rw).filter(([, v]) => v > 0);
      const loot = Object.entries(r.loot).filter(([, v]) => v > 0);
      const n = r.wave;
      const next = g.progress.highestCleared + 1;
      const est = g.repairEstimate();
      this.openModal(`<div class="result-mark win">✦</div><h2>Волна ${n} отражена!</h2>
        <div class="reward-list">${items.map(([k, v]) => `<div class="reward ${k === 'gems' ? 'gem' : ''}"><img src="${resIcon(k)}" alt=""><b>+${fmt(v)}</b><span>${esc(resName(k))}</span></div>`).join('')}</div>
        ${loot.length ? `<div class="muted">Добыча с тварей: ${loot.map(([k, v]) => `${fmt(v)} <img class="inl" src="${resIcon(k)}" alt="">`).join(' · ')}</div>` : ''}
        ${est.hp > 0 ? `<div class="muted">${g.buildings.some((b) => b.type === 'repairHouse' && !b.destroyed) ? 'Ремонтники уже идут чинить базу.' : 'Постройки повреждены — почини их в карточках или построй Дом ремонтников.'}</div>` : ''}
        <button class="ad-btn" data-action="rewarded">▶ Реклама: ещё +${fmt(rw.gold)} монет</button>
        <div class="result-actions"><button data-action="nextWave" data-wave="${n}">Повторить ${n}</button>
          <button class="primary" data-action="nextWave" data-wave="${next}">Дальше: волна ${next}</button></div>`, 'result');
    } else {
      this.openModal(`<div class="result-mark lose">✕</div><h2>Сердце едва не погасло</h2>
        <p>Волна ${r.wave} прорвалась к Сердцу. Твари отступили в мглу, база цела — разрушенное можно отстроить.</p>
        <p class="muted">Совет: улучши башни и генераторы, построй казармы, поставь сплошной забор, изучи новое оружие.</p>
        <div class="result-actions"><button class="primary" data-action="nextWave" data-wave="${r.wave}">Подготовиться</button></div>`, 'result');
    }
  }

  openMenu() {
    this.openModal(`<h2>Пауза</h2>
      <div class="help">
        <div><b>Движение</b> — WASD/стрелки или касание земли; на телефоне — джойстик слева</div>
        <div><b>Оружие</b> — 1, 2, 3 — быстрые слоты; I — инвентарь; Q — авто/ручной бой</div>
        <div><b>Ручной бой</b> — клик по земле или Пробел атакует в сторону курсора</div>
        <div><b>Стройка</b> — B или кнопка «Строить»; забор — зажми и тяни; Esc — отмена</div>
        <div><b>Здание</b> — нажми на него: улучшение, эволюция, мастерская, ремонт</div>
        <div><b>Сердце</b> — нажми на него, чтобы раздвинуть мглу и открыть новые земли</div>
      </div>
      <div class="result-actions"><button data-action="newGameAsk">Новая игра</button><button class="primary" data-action="resume">Продолжить</button></div>`, 'menu');
  }

  openConfirmNew() {
    this.openModal(`<h2>Начать заново?</h2><p>Текущая база, волны, предметы и Сердце будут удалены без возможности вернуть.</p>
      <div class="result-actions"><button data-action="menu">Отмена</button><button class="danger" data-action="newGame">Стереть и начать</button></div>`, 'menu');
  }

  toast(text, bad, opts = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (bad ? ' bad' : '') + (opts.gold ? ' gold' : '');
    el.innerHTML = opts.html || esc(text);
    const box = this.$('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), opts.long ? 3800 : 2400);
    setTimeout(() => el.remove(), opts.long ? 4300 : 2900);
  }

  consume(events) {
    const g = this.game;
    for (const e of events) {
      if (e.type === 'toast') this.toast(e.text, e.bad);
      else if (e.type === 'story') this.showStory(e.id);
      else if (e.type === 'victory' || e.type === 'defeat') this.pendingResult = g.lastResult;
      else if (e.type === 'weapon' || e.type === 'equip') this.renderHotbar();
      else if (e.type === 'waveStart') { this.toast(`Волна ${e.number}! Твари идут: ${e.sides.map((s) => SIDE_NAMES[s]).join(', ')}`, true); this.cancelBuild(); }
      else if (e.type === 'achievement') {
        this.newAch = (this.newAch || 0) + 1;
        this.toast('', false, { gold: true, long: true, html: `🏆 Достижение «${esc(e.name)}» · +${e.gems} <img class="inl" src="${resIcon('gems')}" alt="">` });
      } else if (e.type === 'heartUp') this.toast(`Сердце достигло ${e.level} уровня — мгла отступила`, false);
      else if (e.type === 'zoneOpen') this.toast(`Открыты новые земли: «${ZONES[e.zone - 1].name}»`, false, { long: true });
      else if (e.type === 'evolutionReady') this.toast('Постройка готова к эволюции — открой её карточку', false);
      else if (e.type === 'crafted') this.toast(`Изучено: ${ITEMS[e.item].name}`);
    }
    if (this.pendingResult && !this.modal && !this.window) {
      const r = this.pendingResult;
      this.pendingResult = null;
      this.showResult(r);
    }
  }
}
