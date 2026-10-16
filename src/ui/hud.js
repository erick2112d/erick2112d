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
import { TUTORIAL } from '../data/index.js';
import { keepDecoded } from './preload.js';
import { resIcon, buildingIcon, itemIcon, portrait, enemyPortrait, uiIcon, heroFigure } from './icons.js';

// Картинки вставляем с синхронной расшифровкой: они уже готовы заранее, и окно не мигает пустыми слотами.
const syncImgs = (html) => html.replace(/<img /g, '<img decoding="sync" ');

// Обновление разметки «по месту»: меняем только отличающиеся узлы, а одинаковые (картинки слотов,
// иконки) остаются теми же элементами — им нечему мигать при перерисовке окна на телефоне.
function morphNode(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.data !== b.data) a.data = b.data; return; }
  if (a.isEqualNode(b)) return;
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name) && at.name !== 'class') a.removeAttribute(at.name);
  for (const at of b.attributes) {
    let v = at.value;
    if (at.name === 'class' && a.classList.contains('tut-target')) v += ' tut-target'; // подсветку обучения не сбрасываем
    if (a.getAttribute(at.name) !== v) a.setAttribute(at.name, v);
  }
  if (!b.hasAttribute('class') && a.hasAttribute('class')) {
    if (a.classList.contains('tut-target')) a.setAttribute('class', 'tut-target'); else a.removeAttribute('class');
  }
  morphChildren(a, b);
}
function morphChildren(a, b) {
  const an = a.childNodes;
  const bn = b.childNodes;
  for (let i = 0; i < bn.length; i++) {
    if (i < an.length) morphNode(an[i], bn[i]);
    else a.appendChild(bn[i].cloneNode(true));
  }
  while (an.length > bn.length) a.removeChild(a.lastChild);
}
function setHTML(el, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = syncImgs(html);
  morphChildren(el, tpl.content);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SIDE_ARROWS = { N: '↑', E: '→', S: '↓', W: '←' };
const fmt = (n) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
};
const pct = (v) => `${Math.round(v * 100)}%`;
const ico = (name, cls = 'ico') => `<img class="${cls}" src="${uiIcon(name)}" alt="">`;
const divider = (text) => `<div class="divider"><span>${text}</span></div>`;
const winHead = (title, extra = '') => `<div class="win-head"><div class="ribbon"><span>${title}</span></div>${extra}
  <button class="icon-btn close" data-action="closeWindow" title="Закрыть (Esc)">✕</button></div>`;

// Пока идёт обучение, эти кнопки недоступны.
const TUT_BLOCKED = new Set(['inventory', 'shop', 'achievements', 'journal', 'pickWave', 'upgrade', 'upgradeGems', 'upgradeSegment', 'demolishAsk', 'openCraft', 'openMarket']);

const MELEE = ['sword', 'mace', 'daggers', 'scythe', 'halberd'];
const RANGED = ['bow', 'crossbow'];
const MAGIC = ['fireStaff', 'frostStaff', 'lightningStaff'];
const BAG_FILTERS = [
  { id: 'all', name: 'Всё', icon: 'bagAll', test: () => true },
  { id: 'melee', name: 'Ближний бой', item: 'swordIron', test: (it) => MELEE.includes(it.wtype) },
  { id: 'ranged', name: 'Стрелковое', item: 'bowHunter', test: (it) => RANGED.includes(it.wtype) },
  { id: 'magic', name: 'Посохи', item: 'staffFlame', test: (it) => MAGIC.includes(it.wtype) },
  { id: 'gear', name: 'Доспехи и украшения', icon: 'gear', test: (it) => it.slot !== 'weapon' },
];
const SLOT_ICON = { weapon: 'damage', armor: 'gear', amulet: 'trinket', ring: 'trinket' };
const STAT_INFO = {
  hp: { name: 'Здоровье', icon: 'hp', fmt: (v) => `+${v}` },
  armor: { name: 'Броня', icon: 'armor', fmt: (v) => `+${v}` },
  damage: { name: 'Урон', icon: 'damage', fmt: (v) => `+${pct(v)}` },
  regen: { name: 'Лечение', icon: 'regen', fmt: (v) => `+${v}/с` },
  speed: { name: 'Скорость', icon: 'speed', fmt: (v) => `+${pct(v)}` },
  attackSpeed: { name: 'Скорость атаки', icon: 'haste', fmt: (v) => `+${pct(v)}` },
  crit: { name: 'Крит. шанс', icon: 'crit', fmt: (v) => `+${pct(v)}` },
  goldFind: { name: 'Монеты', icon: 'goldFind', fmt: (v) => `+${pct(v)}` },
};

function costHtml(cost, res) {
  return Object.entries(cost).map(([k, v]) => {
    const lack = (res[k] || 0) < v;
    return `<span class="cost ${lack ? 'lack' : ''}" title="${esc(resName(k))}"><img src="${resIcon(k)}" alt="">${fmt(v)}</span>`;
  }).join('');
}

// Крупные плитки цены: сколько нужно и сколько есть.
function costTiles(cost, res) {
  return `<div class="cost-tiles">${Object.entries(cost).map(([k, v]) => {
    const have = res[k] || 0;
    const lack = have < v;
    return `<div class="ctile ${lack ? 'lack' : ''}" title="${esc(resName(k))}"><img src="${resIcon(k, 40)}" alt=""><b>${fmt(v)}</b><small>${lack ? `есть ${fmt(have)}` : '✓'}</small></div>`;
  }).join('')}</div>`;
}
const gemCost = (n) => `<span class="cost gem"><img src="${resIcon('gems')}" alt="">${n}</span>`;

function weaponLine(it) {
  const t = WEAPON_TYPES[it.wtype];
  return { damage: BASE_DAMAGE[it.wtype] * TIER_POWER[it.tier], cooldown: t.cooldown, range: t.range, t };
}

export function describeItem(game, id) {
  const it = ITEMS[id];
  if (it.slot === 'weapon') {
    const w = weaponLine(it);
    const parts = [`Урон <b>${Math.round(w.damage)}</b>`, `удар раз в ${w.cooldown.toFixed(2)} с`, `дальность ${w.range}`];
    return parts.join(' · ') + `<br><span class="muted">${esc(w.t.name)}: ${esc(w.t.desc)}</span>`;
  }
  const s = it.stats || {};
  return Object.entries(s).map(([k, v]) => (STAT_INFO[k] ? `${STAT_INFO[k].fmt(v)} ${STAT_INFO[k].name.toLowerCase()}` : '')).join(' · ');
}

// Сравнение предмета с надетым в тот же слот: строки «показатель — значение — разница».
function compareRows(game, id) {
  const it = ITEMS[id];
  const cur = ITEMS[game.inventory.equipped[it.slot]];
  const rows = [];
  const diff = (a, b, better = 1, f = (x) => Math.round(x)) => {
    if (!cur || cur.id === id) return '';
    const d = (a - b) * better;
    if (Math.abs(a - b) < 1e-6) return '<i class="eq">=</i>';
    return `<i class="${d > 0 ? 'plus' : 'minus'}">${a > b ? '+' : '−'}${f(Math.abs(a - b))}</i>`;
  };
  if (it.slot === 'weapon') {
    const a = weaponLine(it);
    const b = cur ? weaponLine(cur) : a;
    rows.push(['damage', 'Урон', Math.round(a.damage), diff(a.damage, b.damage)]);
    rows.push(['haste', 'Удар раз в', `${a.cooldown.toFixed(2)} с`, diff(a.cooldown, b.cooldown, -1, (x) => x.toFixed(2))]);
    rows.push(['speed', 'Дальность', a.range, diff(a.range, b.range, 1, (x) => x.toFixed(1))]);
    if (a.t.crit) rows.push(['crit', 'Крит. шанс', pct(a.t.crit), '']);
  } else {
    const keys = new Set([...Object.keys(it.stats || {}), ...Object.keys(cur?.stats || {})]);
    for (const k of keys) {
      const info = STAT_INFO[k];
      if (!info) continue;
      const a = it.stats?.[k] || 0;
      const b = cur?.stats?.[k] || 0;
      const isPct = ['damage', 'speed', 'attackSpeed', 'crit', 'goldFind'].includes(k);
      rows.push([info.icon, info.name, a ? info.fmt(a) : '—', diff(a, b, 1, (x) => (isPct ? pct(x) : Math.round(x * 10) / 10))]);
    }
  }
  return `<div class="cmp">${rows.map(([icon, name, val, d]) => `<div class="cmp-row">${ico(icon)}<span>${name}</span><b>${val}</b>${d}</div>`).join('')}</div>`;
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
            <div class="bar"><div class="fill heart-fill" id="heartFill"></div><em>Сердце</em><span id="heartText"></span></div>
          </div>
          <div class="bar-row" title="Хранитель">
            <img class="bar-icon" src="${portrait('hero')}" alt="">
            <div class="bar"><div class="fill hero-fill" id="heroFill"></div><em>Хранитель</em><span id="heroText"></span></div>
          </div>
        </div>
        <div class="currencies" id="currencies"></div>
        <div class="top-buttons">
          <button class="icon-btn" data-tut-lock data-action="inventory" title="Инвентарь (I)"><img src="${uiIcon('bag')}" alt=""></button>
          <button class="icon-btn" data-tut-lock data-action="achievements" title="Достижения"><img src="${uiIcon('trophy')}" alt=""><i class="dot hidden" id="achDot"></i></button>
          <button class="icon-btn" data-tut-lock data-action="shop" title="Магазин"><img src="${uiIcon('shop')}" alt=""></button>
          <button class="icon-btn" data-tut-lock data-action="journal" title="Журнал"><img src="${uiIcon('scroll')}" alt=""><i class="dot hidden" id="journalDot"></i></button>
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
      <div class="tut-pointer hidden" id="tutPointer"><i></i></div>
    `;
  }

  bind() {
    this.root.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-action]');
      if (!el || el.disabled) return;
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

  sfx(name) { this.hooks.sfx?.(name); }

  // Системная кнопка «Назад»: закрывает верхнее окно, иначе открывает паузу. Всегда «обработано».
  back() {
    if (this.modal === 'menu') this.closeModal();
    else if (this.modal && this.modal !== 'result') this.closeModal();
    else if (this.modal) return true;
    else if (this.window) this.closeWindow();
    else if (this.buildType) this.cancelBuild();
    else if (this.card) this.closeCard();
    else this.openMenu();
    return true;
  }

  confirm(text, onYes, opts = {}) {
    this.confirmFn = onYes;
    this.openModal(`${opts.icon ? `<img class="modal-icon" src="${opts.icon}" alt="">` : ''}<div class="ribbon ${opts.danger ? 'dark' : ''}"><span>${opts.title || 'Подтверди'}</span></div>
      <div class="modal-text">${text}</div>
      <div class="result-actions"><button data-action="closeModal">Отмена</button><button class="${opts.danger ? 'danger' : 'primary'}" data-action="confirmYes">${opts.yes || 'Да'}</button></div>`, 'confirm');
  }

  gemSpend(cost, label, fn) {
    const n = this.game.gemPrice(cost);
    if (this.game.res.gems < n) { this.toast(`Нужно ${n} самоцветов`, true); this.openShop(); return; }
    this.confirm(`${label} за <b>${n}</b> <img class="inl" src="${resIcon('gems')}" alt="">?<div class="muted small">Самоцветы заменят все недостающие ресурсы.</div>`, fn, { title: 'За самоцветы', icon: uiIcon('shop', 64) });
  }

  action(name, data) {
    const g = this.game;
    this.hooks.click?.();
    const id = Number(data.id);
    const tut = g.tutorialStep();
    if (tut) {
      const wrongBuild = (name === 'pickBuild' || name === 'pickBuildGems') && data.type !== tut.build;
      if (TUT_BLOCKED.has(name) || wrongBuild || (name === 'startWave' && !tut.wave)) {
        this.toast(wrongBuild ? `Сейчас по обучению: «${BUILDINGS[tut.build]?.name || '…'}»` : 'Сначала пройди обучение — подсказка внизу экрана', true);
        return;
      }
    }
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
      case 'demolishAsk': this.askDemolish(id); break;
      case 'closeCard': this.closeCard(); break;
      case 'openCraft': this.openCraft(data.line); break;
      case 'openMarket': this.openMarket(); break;
      // окна
      case 'closeWindow': this.closeWindow(); break;
      case 'inventory': this.openInventory(); break;
      case 'invTab': this.window.tab = data.tab; this.window.sel = null; this.renderWindow(); break;
      case 'bagFilter': this.window.filter = data.filter; this.renderWindow(); break;
      case 'selItem': this.window.sel = data.item; this.renderWindow(); break;
      case 'equip': if (g.equip(data.item)) this.sfx('equip'); this.renderWindow(); this.renderHotbar(); break;
      case 'unequip': g.unequip(data.slot); this.renderWindow(); break;
      case 'toHotbar': g.setHotbar(Number(data.slot), data.item); this.renderWindow(); this.renderHotbar(); break;
      case 'craftTab': this.window.tab = data.tab; this.window.sel = null; this.renderWindow(); break;
      case 'craftSel': this.window.sel = data.item; this.renderWindow(); break;
      case 'craft': if (g.craft(data.item)) this.toast(`Изучено: ${ITEMS[data.item].name}`); this.renderWindow(); this.renderHotbar(); break;
      case 'craftGems': this.gemSpend(ITEMS[data.item].cost, `Изучить «${ITEMS[data.item].name}»`, () => { g.craft(data.item, true); this.renderWindow(); this.renderHotbar(); }); break;
      case 'sell': g.marketSell(data.mat, Number(data.n)); this.sfx('coin'); this.renderWindow(); break;
      case 'buy': g.marketBuy(data.mat, Number(data.n)); this.sfx('coin'); this.renderWindow(); break;
      case 'shop': this.openShop(); break;
      case 'shopTab': this.window.tab = data.tab; this.renderWindow(); break;
      case 'buyProduct': this.hooks.buyProduct(data.product, () => this.renderWindow()); break;
      case 'buyOffer': if (g.buyGemOffer(data.offer)) this.sfx('chest'); this.renderWindow(); break;
      case 'adGems': this.hooks.rewarded(() => { g.grantAdGems(); this.sfx('gem'); this.renderWindow(); }); break;
      case 'merchantBuy': if (g.buyFromMerchant(Number(data.i))) this.sfx('coin'); this.renderWindow(); break;
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
      case 'exitApp': this.hooks.save?.(); window.LLAndroid?.exit(); break;
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
      <button class="primary" data-action="cancelBuild">Готово</button>`;
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
    const tabs = BUILD_CATEGORIES.map((c) => {
      const open = BUILD_ORDER.filter((t) => BUILDINGS[t].category === c.id && g.isUnlocked(t)).length;
      return `<button class="tab ${w.tab === c.id ? 'on' : ''}" data-action="buildTab" data-tab="${c.id}">${ico(c.id)}<span>${c.name}</span><i>${open}</i></button>`;
    }).join('');
    const tut = g.tutorialStep();
    const list = BUILD_ORDER.filter((t) => BUILDINGS[t].category === w.tab).map((t) => {
      const cfg = BUILDINGS[t];
      if (tut && t !== tut.build) {
        return `<div class="btile locked">
          <div class="btile-art"><img src="${buildingIcon(t)}" alt=""><div class="lock-ov">${ico('lock', 'lock-ico')}<span>После обучения</span></div></div>
          <div class="btile-name">${esc(cfg.name)}</div><div class="btile-desc">${esc(cfg.desc)}</div></div>`;
      }
      const unlocked = g.isUnlocked(t);
      const count = g.buildings.filter((b) => b.type === t).length;
      const afford = g.canAfford(cfg.cost);
      return `<div class="btile ${unlocked ? '' : 'locked'} ${afford ? '' : 'poor'} ${tut ? 'tut-pick' : ''}">
        <div class="btile-art"><img src="${buildingIcon(t)}" alt="">
          ${count ? `<span class="count">×${count}</span>` : ''}
          ${cfg.evolutions ? '<span class="evo-tag" title="Есть эволюции на 10, 20 и 30 уровне">✦</span>' : ''}
          ${unlocked ? '' : `<div class="lock-ov">${ico('lock', 'lock-ico')}<span>Сердце ${cfg.unlock} ур.</span></div>`}</div>
        <div class="btile-name">${esc(cfg.name)}</div>
        <div class="btile-desc">${esc(cfg.desc)}</div>
        ${unlocked ? `<div class="btile-cost">${costHtml(cfg.cost, g.res)}</div>
          <div class="btile-actions"><button class="primary" data-action="pickBuild" data-type="${t}" ${afford ? '' : 'data-poor="1"'}>Строить</button>
          ${afford ? '' : `<button class="gem-btn" data-action="pickBuildGems" data-type="${t}" title="Построить за самоцветы">${gemCost(g.gemPrice(cfg.cost))}</button>`}</div>` : ''}
      </div>`;
    }).join('');
    return `${winHead('Строительство')}
      <div class="tabs">${tabs}</div><div class="pane bgrid scroll-area">${list}</div>`;
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
    const tut = g.tutorialStep();
    document.body.classList.toggle('tut-lock', !!tut);
    this.$('#objective').classList.toggle('tut', !!tut);
    if (tut && this.objective) {
      // стрелка на карте — к дереву или к подсказанному месту, когда выбрана нужная постройка
      if (tut.build) this.objective.target = this.buildType === tut.build ? this.objective.spotTarget : null;
      const n = g.tutorial.step;
      const steps = TUTORIAL.length;
      this.setText('#objective', `<div class="tut-head"><span class="tut-badge">Обучение</span><b>${esc(tut.title)}</b><span class="tut-steps">${n + 1}/${steps}</span></div>
        <div class="tut-text">${esc(tut.build && this.buildType === tut.build
    ? 'Нажми на подсвеченное место рядом с Сердцем — или на любое другое свободное место на освещённой земле.'
    : this.objective.text.replace(/^Обучение \d+\/\d+: /, ''))}</div>`);
    } else {
      this.setText('#objective', this.objective && !this.card && !this.buildType ? `<span class="star">★</span> ${esc(this.objective.text)}` : '');
    }
    this.updateTutorialPointer(tut);
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

  // Подсветка нужной кнопки и прыгающая стрелка над ней.
  updateTutorialPointer(tut) {
    let sel = null;
    if (tut && !this.modal) {
      if (tut.build) {
        if (this.buildType === tut.build) sel = null;
        else if (this.window?.kind === 'build') {
          const cat = BUILDINGS[tut.build].category;
          if (this.window.tab !== cat) { this.window.tab = cat; this.renderWindow(); }
          sel = `[data-action="pickBuild"][data-type="${tut.build}"]`;
        } else if (!this.window) sel = '[data-action="buildMenu"]';
      } else if (tut.wave && !this.window) sel = '[data-action="startWave"]';
    }
    const el = sel ? this.$(sel) : null;
    if (this.tutEl && this.tutEl !== el) this.tutEl.classList.remove('tut-target');
    this.tutEl = el;
    const ptr = this.$('#tutPointer');
    if (!el) { ptr.classList.add('hidden'); return; }
    el.classList.add('tut-target');
    const zoom = parseFloat(getComputedStyle(this.root).zoom) || 1;
    const r = el.getBoundingClientRect();
    const below = r.top < 90 || sel.includes('pickBuild'); // в меню стройки стрелка снизу, чтобы не закрывать цену
    ptr.classList.toggle('up', below);
    ptr.style.left = `${(r.left + r.width / 2) / zoom}px`;
    ptr.style.top = `${(below ? r.bottom + 6 : r.top - 6) / zoom}px`;
    ptr.classList.remove('hidden');
  }

  setText(id, html) {
    if (this.last[id] === html) return;
    this.last[id] = html;
    setHTML(this.$(id), html);
  }

  renderBars() {
    const g = this.game;
    const heart = g.heart();
    this.$('#heartFill').style.width = `${(heart.hp / heart.maxHp) * 100}%`;
    this.setText('#heartText', `${fmt(Math.ceil(heart.hp))} / ${fmt(heart.maxHp)}`);
    this.setText('#heartLvl', String(g.heartLevel));
    const h = g.hero;
    this.$('#heroFill').style.width = `${h.dead ? 0 : (h.hp / h.maxHp) * 100}%`;
    this.setText('#heroText', h.dead ? `Возрождение ${Math.ceil(h.respawn)} с` : `${fmt(Math.ceil(h.hp))} / ${fmt(h.maxHp)}`);
  }

  renderCurrencies() {
    const g = this.game;
    const html = ['gold', 'gems', 'food'].map((k) => `<div class="cur ${k}" title="${CURRENCIES[k].name}"><img src="${resIcon(k, 32)}" alt=""><b>${fmt(g.res[k] || 0)}</b>${k === 'gems' ? '<button class="plus" data-action="shop" title="Магазин">+</button>' : ''}</div>`).join('');
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
      html = `<div class="wave-title">${ico('damage')} Волна ${w.plan.number} · ${w.plan.kindName}${w.plan.boss ? ' · <b class="boss">Босс</b>' : ''}</div>
        <div class="wave-progress"><div style="width:${p}%"></div><span>${w.killed} / ${w.plan.total}</span></div>
        <div class="wave-sub">Осталось: ${left} · ${w.plan.sides.map((s) => SIDE_ARROWS[s] + ' ' + SIDE_NAMES[s]).join(', ')}</div>`;
    } else {
      const plan = g.wavePreview();
      const comp = Object.entries(plan.counts).map(([t, n]) =>
        `<span class="enemy-chip ${ENEMIES[t].boss ? 'boss' : ''}" title="${esc(ENEMIES[t].name)}: ${esc(ENEMIES[t].desc)}"><img src="${enemyPortrait(t)}" alt="">×${n}</span>`).join('');
      const hc = g.progress.highestCleared;
      const choose = hc >= 1 ? `<div class="wave-choice">
          <button class="chip ${g.progress.nextWave === hc ? 'on' : ''}" data-action="pickWave" data-wave="${hc}">Повтор ${hc}</button>
          <button class="chip ${g.progress.nextWave === hc + 1 ? 'on' : ''}" data-action="pickWave" data-wave="${hc + 1}">Новая ${hc + 1}</button></div>` : '';
      html = `<div class="wave-title">${ico('damage')} Волна ${plan.number} · ${plan.kindName}${plan.boss ? ' · <b class="boss">Босс</b>' : ''}${plan.event ? ` · <b class="event" title="${esc(plan.event.text)}">${plan.event.name}</b>` : ''}</div>
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
    setHTML(this.$('#hotbar'), html);
  }

  // ---------- карточка постройки ----------

  selectBuilding(id) {
    if (this.game.tutorialStep()) return; // во время обучения карточки зданий не открываются
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
    setHTML(el, html);
    el.classList.remove('hidden');
  }

  cardHead(b, title, sub, maxLevel) {
    return `<div class="card-head">
      <div class="card-art"><img src="${buildingIcon(b.type)}" alt=""><span class="lvl" title="Уровень">${b.level}</span></div>
      <div class="card-title"><h3>${esc(title)}</h3><div class="sub">${sub}</div>
        <div class="lvl-track"><div style="width:${(b.level / maxLevel) * 100}%"></div><span>ур. ${b.level} / ${maxLevel}</span></div></div>
      <button class="icon-btn close" data-action="closeCard" title="Закрыть">✕</button></div>`;
  }

  hpBar(hp, maxHp) {
    const r = Math.max(0, Math.min(1, hp / maxHp));
    return `<div class="hpbar ${r < 0.35 ? 'low' : ''}">${ico('hp')}<div class="hp-track"><div style="width:${r * 100}%"></div><span>${fmt(Math.ceil(hp))} / ${fmt(maxHp)}</span></div></div>`;
  }

  upgradeBox(b, cost, check, extraButtons = '') {
    const g = this.game;
    return `<div class="upgrade-box">
      <div class="up-head">${ico('up')}<span>Улучшение</span><b class="lv">${b.level}</b><i>➜</i><b class="lv next">${b.level + 1}</b></div>
      ${costTiles(cost, g.res)}
      <div class="card-actions">
        <button class="primary" data-action="upgrade" data-id="${b.id}" ${check.ok ? '' : 'disabled'} title="${esc(check.reason || '')}">${ico('up')}Улучшить</button>
        ${check.heart || check.evo ? '' : `<button class="gem-btn" data-action="upgradeGems" data-id="${b.id}" ${g.phase === 'wave' && b.type === 'heart' ? 'disabled' : ''} title="Улучшить за самоцветы">${gemCost(g.gemPrice(cost))}</button>`}
        ${extraButtons}
      </div>
      ${!check.ok && check.reason ? `<div class="lock">${esc(check.reason)}</div>` : ''}
    </div>`;
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
    const fix = b.hp < b.maxHp && g.phase === 'build'
      ? `<div class="card-foot"><button data-action="repairNow" data-id="${b.id}" ${g.canAfford(g.manualRepairCost(b)) ? '' : 'disabled'}>${ico('repair')}Починить ${costHtml(g.manualRepairCost(b), g.res)}</button></div>` : '';
    return `${this.cardHead(b, 'Сердце Светоча', 'Последний огонь края', HEART.maxLevel)}
      ${this.hpBar(b.hp, b.maxHp)}
      <div class="stat-list">
        <div class="row">${ico('crit')}Свет: радиус <b>${g.radius().toFixed(1)}</b></div>
        <div class="row">${ico('defense')}Земли: <b>${esc(zone.name)}</b></div>
        ${next ? `<div class="row">${ico('speed')}До «${esc(next.name)}» ещё ~<b>${levelsToNext}</b> ур.</div>` : '<div class="row good">Свет покрыл весь край</div>'}
        <div class="row muted">Каждый уровень раздвигает мглу, даёт +${HEART.hpPerLevel} прочности и +${WORLD.storagePerHeartLevel} к складу. Уровень построек не выше уровня Сердца.</div>
      </div>
      ${maxed ? '<div class="status ok">Сердце сияет в полную силу</div>' : this.upgradeBox(b, cost, check)}
      ${fix}`;
  }

  buildingCard(b) {
    const g = this.game;
    const cfg = BUILDINGS[b.type];
    const st = g.statusOf(b);
    const m = evoMods(b);
    const lines = [];
    if (cfg.energyOut) lines.push(`<img class="ico" src="${resIcon('energy')}" alt="">Даёт энергии: <b>${g.energyOut(b)}</b>`);
    if (cfg.energyUse) lines.push(`<img class="ico" src="${resIcon('energy')}" alt="">Потребляет <b>${cfg.energyUse}</b> · приоритет <b>${b.priority}</b>
      <span class="mini-btns"><button data-action="prio" data-id="${b.id}" data-delta="-1">−</button><button data-action="prio" data-id="${b.id}" data-delta="1">+</button></span>`);
    if (cfg.recipes) {
      const r = g.recipeOf(b);
      const speed = g.productionSpeed(b);
      const inp = Object.entries(r.input).map(([k, v]) => `${v}<img class="inl" src="${resIcon(k)}" alt="">`).join(' ') || '—';
      const out = Object.entries(r.output).map(([k, v]) => `${Math.round(v * (m.output || 1) * 10) / 10}<img class="inl" src="${resIcon(k)}" alt="">`).join(' ');
      lines.push(`${ico('production')}Цикл: ${inp} → ${out}${m.bonusGold ? ` +${m.bonusGold}<img class="inl" src="${resIcon('gold')}" alt="">` : ''} за ${(r.seconds / speed).toFixed(1)} с`);
      lines.push(`<div class="progress"><div style="width:${Math.round((b.progress / r.seconds) * 100)}%"></div></div>`);
      if (cfg.recipes.length > 1) {
        lines.push(`<div class="chips">${cfg.recipes.map((x) => `<button class="chip ${x.id === r.id ? 'on' : ''}" data-action="recipe" data-id="${b.id}" data-recipe="${x.id}" ${x.minLevel && b.level < x.minLevel ? 'disabled' : ''}>${esc(x.name)}${x.minLevel && b.level < x.minLevel ? ` (ур. ${x.minLevel})` : ''}</button>`).join('')}</div>`);
      }
      if (cfg.reserve !== undefined) {
        const k = Object.keys(r.input)[0];
        if (k) lines.push(`${ico('lock')}Не трогать последние <b>${b.reserve}</b> <img class="inl" src="${resIcon(k)}" alt=""><span class="mini-btns"><button data-action="reserve" data-id="${b.id}" data-delta="-1">−</button><button data-action="reserve" data-id="${b.id}" data-delta="1">+</button></span>`);
      }
    }
    const ts = towerStats(b);
    if (ts) {
      lines.push(`<span class="stat-pill">${ico('damage')}<b>${Math.round(ts.damage)}</b></span><span class="stat-pill">${ico('speed')}<b>${ts.range.toFixed(1)}</b></span><span class="stat-pill">${ico('haste')}<b>${ts.cooldown.toFixed(2)} с</b></span>`);
      const extra = [];
      if (ts.multishot > 1) extra.push(`целей: ${ts.multishot}`);
      if (ts.splash) extra.push(`область ${ts.splash.toFixed(1)}`);
      if (ts.slow) extra.push(`замедление ${pct(ts.slow)}`);
      if (ts.burn) extra.push(`горение ${Math.round(ts.burn)}/с`);
      if (ts.pierce) extra.push(`пробитие ${ts.pierce}`);
      if (ts.chain) extra.push(`цепь ${ts.chain}`);
      if (ts.crit) extra.push(`крит ${pct(ts.crit)}`);
      if (extra.length) lines.push(`<span class="muted">${extra.join(' · ')}</span>`);
      if (b.aura?.damage) lines.push(`<span class="good">Сторожевая башня: +${pct(b.aura.damage)} урона, +${b.aura.range.toFixed(1)} дальности</span>`);
    }
    if (cfg.aura) lines.push(`${ico('crit')}Аура ${(cfg.aura.radius + 0.1 * (b.level - 1)).toFixed(1)}: башням +${pct(cfg.aura.damage * (1 + 0.05 * (b.level - 1)))} урона`);
    if (cfg.trap) lines.push(`${ico('damage')}Урон по наступившим: <b>${Math.round(cfg.trap.damage * (1 + 0.15 * (b.level - 1)))}</b> раз в ${cfg.trap.cooldown} с`);
    if (cfg.spawns) {
      const u = UNITS[cfg.spawns.unit];
      lines.push(`${ico('army')}Отряд: до <b>${g.squadSize(b)}</b> (${esc(u.name.toLowerCase())}) · наём ${cfg.spawns.foodCost} <img class="inl" src="${resIcon('food')}" alt="">`);
    }
    if (cfg.workers) {
      lines.push(`${ico('economy')}Рабочих: до <b>${g.workerCount(b)}</b> · наём ${cfg.workers.foodCost} <img class="inl" src="${resIcon('food')}" alt="">`);
      lines.push(`<div class="chips">${Object.entries(WORKER_FILTERS).map(([k, f]) => `<button class="chip ${b.filter === k ? 'on' : ''}" data-action="filter" data-id="${b.id}" data-filter="${k}">${esc(f.name)}</button>`).join('')}</div>`);
    }
    if (cfg.repair) {
      const est = g.repairEstimate();
      lines.push(`${ico('repair')}Ремонтников: <b>${g.repairerCount(b)}</b> · ремонт базы ≈ <b>${est.wood}</b> <img class="inl" src="${resIcon('wood')}" alt="">`);
    }
    if (cfg.storage) lines.push(`${ico('bag')}Склад: +${cfg.storage * b.level} к пределу (всего ${fmt(g.storageCap())})`);
    if (cfg.training) lines.push(`${ico('hp')}Герою: +${cfg.training.hp * b.level} здоровья, +${pct(cfg.training.damage * b.level)} урона`);
    if (cfg.crafting) lines.push(`<button class="primary wide" data-action="openCraft" data-line="${cfg.crafting}">${ico('hero')}Мастерская: ${esc(CRAFT_LINES[cfg.crafting].name.toLowerCase())}</button>`);
    if (cfg.market) lines.push(`<button class="primary wide" data-action="openMarket">${ico('economy')}Торговать</button>`);

    let hpHtml = this.hpBar(b.hp, b.maxHp);
    if (cfg.wall) {
      const gh = g.wallGroupHp(b);
      hpHtml = `${this.hpBar(gh.hp, gh.maxHp)}
        <div class="row muted small">Цельный забор: <b>${gh.count}</b> секц. ${b.level}-го уровня с общей прочностью — если сломать одну, рухнут все.</div>`;
    }
    const tier = g.pendingEvolution(b);
    let evoHtml = '';
    if (tier) {
      evoHtml = `<div class="evo-box"><div class="evo-title">✦ Эволюция ${tier} уровня — выбери путь</div>
        ${cfg.evolutions[tier].map((o) => `<button class="evo-opt" data-action="evolve" data-id="${b.id}" data-opt="${o.id}"><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></button>`).join('')}</div>`;
    } else if (cfg.evolutions && b.level < 10) {
      lines.push('<span class="muted small">✦ На 10, 20 и 30 уровне — эволюция с выбором из двух путей</span>');
    }
    const up = g.canUpgrade(b);
    const maxed = b.level >= cfg.maxLevel;
    let upHtml = '';
    if (!maxed && !tier) {
      const seg = cfg.wall && g.wallSegment(b).length > 1
        ? `<button data-action="upgradeSegment" data-id="${b.id}" ${up.ok || up.noMoney ? '' : 'disabled'} title="Улучшить все секции этого забора">Весь забор ${costHtml(g.segmentUpgradeCost(b).cost, g.res)}</button>` : '';
      upHtml = this.upgradeBox(b, g.upgradeCost(b), up, seg);
    } else if (maxed) upHtml = '<div class="status ok">Максимальный уровень</div>';
    const foot = [];
    if (g.missingHp(b) > 0.5 && g.phase === 'build') foot.push(`<button data-action="repairNow" data-id="${b.id}" ${g.canAfford(g.manualRepairCost(b)) ? '' : 'disabled'}>${ico('repair')}Починить ${costHtml(g.manualRepairCost(b), g.res)}</button>`);
    if (cfg.energyUse || cfg.recipes || cfg.repair) foot.push(`<button data-action="toggle" data-id="${b.id}">${ico('power')}${b.enabled ? 'Выключить' : 'Включить'}</button>`);
    foot.push(`<button class="danger-soft" data-action="demolishAsk" data-id="${b.id}" ${g.phase === 'wave' ? 'disabled title="Только между волнами"' : 'title="Снести и вернуть часть ресурсов"'}>${ico('demolish')}Снести</button>`);
    const cat = BUILD_CATEGORIES.find((c) => c.id === cfg.category)?.name || '';
    return `${this.cardHead(b, buildingName(b), `${esc(cfg.name)}${cat ? ` · ${cat}` : ''}`, cfg.maxLevel)}
      ${hpHtml}
      <div class="status ${st.bad ? 'bad' : st.evolve ? 'evo' : 'ok'}">${esc(st.text)}</div>
      ${evoHtml}
      ${lines.length ? `<div class="stat-list">${lines.map((l) => `<div class="row">${l}</div>`).join('')}</div>` : ''}
      ${upHtml}
      <div class="card-foot">${foot.join('')}</div>`;
  }

  askDemolish(id) {
    const g = this.game;
    const b = g.byId(id);
    if (!b) return;
    const check = g.canDemolish(b);
    if (!check.ok) { this.toast(check.reason, true); return; }
    const refund = g.demolishRefund(b);
    const cfg = BUILDINGS[b.type];
    const part = cfg.wall ? 'Сносится только эта секция забора.' : '';
    const back = Object.keys(refund).length
      ? `<div class="muted small">Вернётся половина вложенного:</div><div class="cost-tiles center">${Object.entries(refund).map(([k, v]) => `<div class="ctile"><img src="${resIcon(k, 40)}" alt=""><b>+${fmt(v)}</b></div>`).join('')}</div>`
      : '<div class="muted small">Возвращать нечего.</div>';
    this.confirm(`Снести «${esc(buildingName(b))}» ${b.level} ур.? ${part}${back}`, () => {
      if (g.demolish(id)) { this.closeCard(); this.sfx('demolish'); }
    }, { title: 'Снос постройки', yes: 'Снести', danger: true, icon: buildingIcon(b.type) });
  }

  // ---------- окна ----------

  openWindow(w) {
    if (w.kind !== 'build' && this.game.tutorialStep()) { this.toast('Сначала пройди обучение', true); return; }
    const was = !!this.window;
    this.window = w;
    this.renderWindow();
    this.$('#windowWrap').classList.remove('hidden');
    if (!was) this.sfx('open');
    this.hooks.modalChanged?.(true);
  }

  closeWindow() {
    if (this.window) this.sfx('close');
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
    el.className = `window win-${w.kind}`;
    setHTML(el, html);
  }

  openInventory() { this.closeCard(); this.openWindow({ kind: 'inventory', tab: 'gear', sel: null, filter: 'all' }); }

  renderInventory(w) {
    const g = this.game;
    const tabs = `<div class="tabs"><button class="tab ${w.tab === 'gear' ? 'on' : ''}" data-action="invTab" data-tab="gear">${ico('hero')}<span>Снаряжение</span></button>
      <button class="tab ${w.tab === 'mats' ? 'on' : ''}" data-action="invTab" data-tab="mats">${ico('bag')}<span>Ресурсы</span><i>${g.found.length}/${MATERIAL_ORDER.length}</i></button></div>`;
    const body = w.tab === 'mats' ? this.renderMaterials() : this.renderGear(w);
    return `${winHead('Инвентарь')}${tabs}${body}`;
  }

  renderMaterials() {
    const g = this.game;
    const cap = g.storageCap();
    const cur = ['gold', 'gems', 'food'].map((k) => `<div class="rtile cur-tile ${k}">
        <div class="rtile-art"><img src="${resIcon(k, 64)}" alt=""></div>
        <b class="rtile-count">${fmt(g.res[k] || 0)}</b><div class="rtile-name">${esc(CURRENCIES[k].name)}</div></div>`).join('');
    const tiles = MATERIAL_ORDER.map((k) => {
      const mat = MATERIALS[k];
      if (!g.isFound(k)) {
        return `<div class="rtile unknown" title="Этот материал ещё не найден">
          <div class="rtile-art"><span class="qmark">?</span></div>
          <b class="rtile-count">???</b><div class="rtile-name">Не найдено</div>
          <div class="rtile-desc">Расширяй свет Сердца и исследуй новые земли</div></div>`;
      }
      const v = g.res[k] || 0;
      const rar = RARITY[Math.min(7, mat.tier || 1)];
      const full = v >= cap;
      return `<div class="rtile" style="--rar:${rar.color};--mat:${mat.color || rar.color}" title="${esc(mat.desc)}">
          <span class="rtile-tier">${esc(rar.name)}</span>
          <div class="rtile-art"><img src="${resIcon(k, 64)}" alt=""></div>
          <b class="rtile-count">${fmt(v)}<small> / ${fmt(cap)}</small></b>
          <div class="rtile-name">${esc(mat.name)}</div>
          <div class="cap ${full ? 'full' : ''}"><div style="width:${Math.min(100, (v / cap) * 100)}%"></div></div>
          <div class="rtile-desc">${esc(mat.desc)}</div></div>`;
    }).join('');
    return `<div class="pane scroll-area">
      ${divider('Казна')}<div class="rgrid">${cur}</div>
      ${divider(`Материалы · склад ${fmt(cap)} каждого`)}<div class="rgrid">${tiles}</div>
      <div class="muted small center">Предел склада растёт со Складами и уровнем Сердца.</div></div>`;
  }

  renderGear(w) {
    const g = this.game;
    const eq = g.inventory.equipped;
    const slot = (sid, pos) => {
      const s = EQUIP_SLOTS.find((x) => x.id === sid);
      const id = eq[sid];
      const it = id && ITEMS[id];
      return `<button class="doll-slot ${pos} ${id ? '' : 'empty'} ${w.sel && w.sel === id ? 'sel' : ''}" data-action="${id ? 'selItem' : 'bagFilter'}" data-item="${id || ''}" data-filter="${sid === 'weapon' ? 'all' : 'gear'}"
        style="${it ? `--rar:${RARITY[it.tier].color}` : ''}" title="${it ? esc(it.name) : s.name + ': пусто'}">
        ${it ? `<img src="${itemIcon(id)}" alt="">` : `<img class="ghost" src="${uiIcon(SLOT_ICON[sid])}" alt="">`}<span>${s.name}</span></button>`;
    };
    const st = g.heroStats;
    const ws = g.weaponStats();
    const stat = (icon, name, val) => `<div class="hstat">${ico(icon)}<span>${name}</span><b>${val}</b></div>`;
    const stats = `<div class="hstats">
      ${stat('hp', 'Здоровье', fmt(g.hero.maxHp))}${stat('armor', 'Броня', st.armor)}
      ${stat('damage', 'Урон', Math.round(ws.damage))}${stat('haste', 'Удар раз в', ws.cooldown.toFixed(2) + ' с')}
      ${stat('crit', 'Крит', pct(ws.crit))}${stat('speed', 'Скорость', '+' + pct(st.speed))}
      ${stat('regen', 'Лечение', st.regen.toFixed(1) + '/с')}${stat('goldFind', 'Монеты', '+' + pct(st.goldFind || 0))}</div>`;
    const figUrl = heroFigure(eq.armor, eq.amulet, eq.weapon);
    keepDecoded(figUrl);
    const doll = `<div class="doll">
        <div class="doll-stage"><img class="doll-fig" src="${figUrl}" alt="Хранитель"></div>
        ${slot('weapon', 'p-wl')}${slot('armor', 'p-al')}${slot('amulet', 'p-ar')}${slot('ring', 'p-rr')}
      </div>`;

    const filter = BAG_FILTERS.find((f) => f.id === (w.filter || 'all')) || BAG_FILTERS[0];
    const chips = BAG_FILTERS.map((f) => `<button class="fchip ${f.id === filter.id ? 'on' : ''}" data-action="bagFilter" data-filter="${f.id}" title="${f.name}">${f.item ? `<img class="ico" src="${itemIcon(f.item)}" alt="">` : ico(f.icon)}</button>`).join('');
    const items = g.inventory.items.filter((id) => filter.test(ITEMS[id]))
      .sort((a, b) => (ITEMS[b].tier - ITEMS[a].tier) || ITEMS[a].slot.localeCompare(ITEMS[b].slot));
    const cells = items.map((id) => {
      const it = ITEMS[id];
      const on = Object.values(eq).includes(id);
      const hot = g.inventory.hotbar.indexOf(id);
      return `<button class="bag-cell ${w.sel === id ? 'sel' : ''} ${on ? 'equipped' : ''}" data-action="selItem" data-item="${id}" style="--rar:${RARITY[it.tier].color}" title="${esc(it.name)}">
          <img src="${itemIcon(id)}" alt="">${on ? '<i class="eq-mark">✓</i>' : ''}${hot >= 0 ? `<i class="hot-mark">${hot + 1}</i>` : ''}</button>`;
    });
    while (cells.length < 24 || cells.length % 6) cells.push('<div class="bag-cell blank"></div>');

    let detail = `<div class="item-detail empty">${ico('bag', 'big-ico')}<div class="muted small">Выбери предмет — увидишь характеристики и сравнение с надетым.
      Оружие изучается в Кузне, Мастерской стрелка и Чародейской башне, доспехи и украшения — в Бронной мастерской.</div></div>`;
    if (w.sel && ITEMS[w.sel]) {
      const it = ITEMS[w.sel];
      const rar = RARITY[it.tier];
      const on = eq[it.slot] === w.sel;
      const kind = it.slot === 'weapon' ? WEAPON_TYPES[it.wtype].name : EQUIP_SLOTS.find((s) => s.id === it.slot).name;
      detail = `<div class="item-detail" style="--rar:${rar.color}">
        <div class="id-top"><div class="id-frame"><img src="${itemIcon(w.sel)}" alt=""></div>
          <div><div class="item-name" style="color:${rar.color}">${esc(it.name)}</div><div class="rar-tag">${esc(rar.name)} · ${esc(kind)}</div>
          ${it.slot === 'weapon' ? `<div class="muted small">${esc(WEAPON_TYPES[it.wtype].desc)}</div>` : ''}</div></div>
        ${compareRows(g, w.sel)}
        <div class="card-actions">${on ? (it.slot === 'weapon' ? '<span class="good">✓ В руках</span>' : `<button data-action="unequip" data-slot="${it.slot}">Снять</button>`) : `<button class="primary" data-action="equip" data-item="${w.sel}">Надеть</button>`}
          ${it.slot === 'weapon' ? `<span class="hot-pick">Слот: ${[0, 1, 2].map((i) => `<button class="chip ${g.inventory.hotbar[i] === w.sel ? 'on' : ''}" data-action="toHotbar" data-slot="${i}" data-item="${w.sel}">${i + 1}</button>`).join('')}</span>` : ''}</div>
      </div>`;
    }
    return `<div class="inv-layout">
      <div class="inv-left pane">${divider('Хранитель')}${doll}${stats}
        ${divider('Быстрые слоты')}<div class="quick">${g.inventory.hotbar.map((id, i) => `<button class="bag-cell ${id ? '' : 'blank'} ${id && w.sel === id ? 'sel' : ''}" ${id ? `data-action="selItem" data-item="${id}" style="--rar:${RARITY[ITEMS[id].tier].color}"` : ''} title="${id ? esc(ITEMS[id].name) : 'Пусто: выбери оружие и нажми номер слота'}">
          ${id ? `<img src="${itemIcon(id)}" alt="">` : ''}<i class="hot-mark">${i + 1}</i></button>`).join('')}</div></div>
      <div class="inv-right"><div class="bag-head">${divider(`Сумка · ${g.inventory.items.length}`)}<div class="fchips">${chips}</div></div>
        <div class="bag-grid pane scroll-area">${cells.join('')}</div>${detail}</div></div>`;
  }

  openCraft(line) { this.closeCard(); this.openWindow({ kind: 'craft', line, tab: null, sel: null }); }

  renderCraft(w) {
    const g = this.game;
    const L = CRAFT_LINES[w.line];
    const groups = L.types ? L.types.map((t) => ({ id: t, name: WEAPON_TYPES[t].name, items: Object.values(ITEMS).filter((it) => it.wtype === t && it.building) }))
      : L.slots.map((s) => ({ id: s, name: EQUIP_SLOTS.find((x) => x.id === s).name, items: Object.values(ITEMS).filter((it) => it.slot === s && it.building) }));
    const tab = w.tab || groups[0].id;
    const group = groups.find((x) => x.id === tab) || groups[0];
    const building = Object.values(ITEMS).find((it) => it.building && (L.types ? L.types.includes(it.wtype) : L.slots.includes(it.slot)))?.building;
    const lvl = g.craftLevel(building);
    const tabs = groups.map((x) => `<button class="tab ${x.id === group.id ? 'on' : ''}" data-action="craftTab" data-tab="${x.id}"><img class="ico" src="${itemIcon(x.items[Math.min(1, x.items.length - 1)].id)}" alt=""><span>${esc(x.name)}</span></button>`).join('');
    if (!w.sel || !group.items.some((it) => it.id === w.sel)) {
      w.sel = (group.items.find((it) => !g.owns(it.id)) || group.items[group.items.length - 1]).id;
    }
    const rows = group.items.map((it) => {
      const c = g.canCraft(it.id);
      const owned = g.owns(it.id);
      const locked = !owned && lvl < it.level;
      const badge = owned ? '<i class="badge ok">✓</i>' : locked ? `<i class="badge lock">ур. ${it.level}</i>` : c.ok ? '<i class="badge go">!</i>' : '';
      return `<button class="crow ${w.sel === it.id ? 'sel' : ''} ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}" data-action="craftSel" data-item="${it.id}" style="--rar:${RARITY[it.tier].color}">
        <div class="crow-ico"><img src="${itemIcon(it.id)}" alt=""></div><span style="color:${RARITY[it.tier].color}">${esc(it.name)}</span>${badge}</button>`;
    }).join('');
    const it = ITEMS[w.sel];
    const rar = RARITY[it.tier];
    const owned = g.owns(it.id);
    const c = g.canCraft(it.id);
    const detail = `<div class="craft-detail pane" style="--rar:${rar.color}">
      <div class="cd-art"><img src="${itemIcon(it.id)}" alt=""></div>
      <div class="item-name center" style="color:${rar.color}">${esc(it.name)}</div>
      <div class="rar-tag center">${esc(rar.name)}</div>
      ${compareRows(g, it.id)}
      ${owned ? '<div class="status ok">Изучено — есть в инвентаре</div>' : `${divider('Нужно')}${costTiles(it.cost, g.res)}`}
      ${!owned && lvl < it.level ? `<div class="lock center">Нужен ${it.level} уровень здания (сейчас ${lvl})</div>` : ''}
      <div class="card-actions center">${owned ? (g.inventory.equipped[it.slot] === it.id ? '<span class="good">✓ Надето</span>' : `<button class="primary" data-action="equip" data-item="${it.id}">Надеть</button>`)
        : `<button class="primary big" data-action="craft" data-item="${it.id}" ${c.ok ? '' : 'disabled'}>${ico('hero')}Изучить</button>
           ${c.noMoney ? `<button class="gem-btn" data-action="craftGems" data-item="${it.id}" title="Изучить за самоцветы">${gemCost(g.gemPrice(it.cost))}</button>` : ''}`}</div>
    </div>`;
    return `${winHead(`${esc(BUILDINGS[building].name)} · ур. ${lvl}`)}
      <div class="tabs">${tabs}</div><div class="craft-layout"><div class="craft-list pane scroll-area">${rows}</div>${detail}</div>`;
  }

  openMarket() { this.closeCard(); this.openWindow({ kind: 'market' }); }

  renderMarket() {
    const g = this.game;
    const tiles = MATERIAL_ORDER.filter((k) => g.isFound(k) && ((g.res[k] || 0) >= 1 || g.canBuyAtMarket(k))).map((k) => {
      const have = Math.floor(g.res[k] || 0);
      const sell = g.sellPrice(k);
      const canBuy = g.canBuyAtMarket(k);
      const rar = RARITY[Math.min(7, MATERIALS[k].tier || 1)];
      return `<div class="rtile market" style="--rar:${rar.color}">
        <div class="rtile-art"><img src="${resIcon(k, 64)}" alt=""></div>
        <b class="rtile-count">${fmt(have)}</b><div class="rtile-name">${esc(MATERIALS[k].name)}</div>
        <div class="mt-actions">
          <button data-action="sell" data-mat="${k}" data-n="10" ${have >= 10 ? '' : 'disabled'} title="Продать 10">−10 <span class="cost"><img src="${resIcon('gold')}" alt="">${Math.floor(sell * 10)}</span></button>
          <button data-action="sell" data-mat="${k}" data-n="100" ${have >= 100 ? '' : 'disabled'} title="Продать 100">−100</button>
          ${canBuy ? `<button class="primary" data-action="buy" data-mat="${k}" data-n="10" ${g.res.gold >= g.buyPrice(k) * 10 ? '' : 'disabled'} title="Купить 10">+10 <span class="cost"><img src="${resIcon('gold')}" alt="">${g.buyPrice(k) * 10}</span></button>` : ''}
        </div></div>`;
    }).join('');
    return `${winHead('Рынок', `<div class="cur gold"><img src="${resIcon('gold', 32)}" alt=""><b>${fmt(g.res.gold)}</b></div>`)}
      <div class="muted small center">Чем выше уровень рынка, тем дороже продажа. Покупаются только простые материалы.</div>
      <div class="pane scroll-area"><div class="rgrid">${tiles || '<p class="muted">Пока нечего продавать.</p>'}</div></div>`;
  }

  openMerchant() { this.closeCard(); this.openWindow({ kind: 'merchant' }); }

  renderMerchant() {
    const g = this.game;
    const m = g.activities.merchant;
    if (!m) return `${winHead('Торговец ушёл')}`;
    const cards = m.offers.map((o, i) => {
      const [main] = Object.keys(o.give);
      return `<div class="shop-card ${o.sold ? 'sold' : ''}">
      <div class="shop-art"><img src="${resIcon(main, 64)}" alt=""></div>
      <div class="cost-list center">${Object.entries(o.give).map(([k, v]) => `<span class="cost"><img src="${resIcon(k)}" alt="">${v}</span>`).join(' ')}</div>
      ${o.sold ? '<span class="muted">Продано</span>' : `<button class="primary" data-action="merchantBuy" data-i="${i}" ${g.res.gold >= o.price ? '' : 'disabled'}>Купить <span class="cost"><img src="${resIcon('gold')}" alt="">${o.price}</span></button>`}</div>`;
    }).join('');
    return `${winHead('Бродячий торговец', `<div class="cur gold"><img src="${resIcon('gold', 32)}" alt=""><b>${fmt(g.res.gold)}</b></div>`)}
      <div class="muted small center">Уйдёт, когда начнётся следующая волна.</div><div class="pane scroll-area"><div class="shop-grid">${cards}</div></div>`;
  }

  openShop() { this.closeCard(); this.openWindow({ kind: 'shop', tab: 'gems' }); }

  renderShop(w) {
    const g = this.game;
    const tabs = `<div class="tabs"><button class="tab ${w.tab === 'gems' ? 'on' : ''}" data-action="shopTab" data-tab="gems">${ico('shop')}<span>Самоцветы</span></button>
      <button class="tab ${w.tab === 'goods' ? 'on' : ''}" data-action="shopTab" data-tab="goods">${ico('economy')}<span>Товары</span></button></div>`;
    let body;
    if (w.tab === 'goods') {
      body = `<div class="pane scroll-area"><div class="shop-grid">${GEM_OFFERS.map((o) => {
        const locked = o.zone && g.openZone() < o.zone;
        const [main] = Object.keys(o.give);
        return `<div class="shop-card ${locked ? 'locked' : ''}"><div class="shop-name">${esc(o.name)}</div>
          <div class="shop-art"><img src="${resIcon(main, 64)}" alt="">${locked ? `<div class="lock-ov">${ico('lock', 'lock-ico')}</div>` : ''}</div>
          <div class="cost-list center">${Object.entries(o.give).map(([k, v]) => `<span class="cost"><img src="${resIcon(k)}" alt="">${fmt(v)}</span>`).join('')}</div>
          ${locked ? `<div class="lock">Откроется в землях «${esc(ZONES[o.zone - 1].name)}»</div>` : `<button class="gem-btn" data-action="buyOffer" data-offer="${o.id}" ${g.res.gems >= o.price ? '' : 'disabled'}>${gemCost(o.price)}</button>`}</div>`;
      }).join('')}</div></div>`;
    } else {
      const ad = g.adGemsReadyIn();
      const art = { gems_small: uiIcon('shop', 72), gems_medium: uiIcon('gemPile', 72), gems_large: uiIcon('gemChest', 72) };
      const app = this.hooks.isApp?.() && !this.hooks.paymentsReady();
      const ads = this.hooks.adsAvailable?.() !== false;
      // в приложении — только товары, заведённые в консоли RuStore (у них есть цена)
      const inApp = this.hooks.isApp?.();
      const products = app ? '' : PRODUCTS.filter((p) => !(p.once && g.shop.starterBought) && (!inApp || this.hooks.productPrice(p.id))).map((p) => `<div class="shop-card ${p.once ? 'special' : ''}">
          ${p.bonus ? `<span class="ribbon-tag">${p.bonus}</span>` : ''}${p.once ? '<span class="ribbon-tag hot">Один раз</span>' : ''}
          <div class="shop-name">${esc(p.name)}</div>
          <div class="shop-art"><img src="${p.item ? itemIcon(p.item) : art[p.id] || uiIcon('shop', 72)}" alt=""></div>
          <div class="shop-gems"><img src="${resIcon('gems', 32)}" alt=""><b>${p.gems}</b></div>
          ${p.desc ? `<div class="muted small">${esc(p.desc)}</div>` : ''}
          <button class="primary" data-action="buyProduct" data-product="${p.id}" ${this.hooks.paymentsReady() ? '' : 'disabled'}>${esc(this.hooks.productPrice(p.id) || p.fallbackPrice)}</button></div>`).join('');
      body = `<div class="pane scroll-area"><div class="shop-grid">
        ${ads ? `<div class="shop-card ad"><div class="shop-name">Подарок за рекламу</div><div class="shop-art"><img src="${uiIcon('ad', 72)}" alt=""></div>
          <div class="shop-gems"><img src="${resIcon('gems', 32)}" alt=""><b>${AD_GEMS.amount}</b></div>
          <button class="ad-btn" data-action="adGems" ${ad > 0 ? 'disabled' : ''}>${ad > 0 ? `Через ${Math.floor(ad / 60)}:${String(ad % 60).padStart(2, '0')}` : '▶ Смотреть'}</button></div>` : ''}
        ${products}</div>
        ${app ? '<div class="muted small center">Покупка самоцветов появится в одной из следующих версий. Загляни во вкладку «Товары».</div>'
          : this.hooks.paymentsReady() ? '' : '<div class="muted small center">Покупки доступны в игре на Яндекс Играх.</div>'}
        <div class="muted small center">Самоцветы также выпадают с волн (0–2), боссов, сундуков и за достижения. За них можно строить и улучшать без ресурсов.</div></div>`;
    }
    return `${winHead('Магазин', `<div class="cur gems"><img src="${resIcon('gems', 32)}" alt=""><b>${fmt(g.res.gems)}</b></div>`)}${tabs}${body}`;
  }

  openAchievements() { this.newAch = 0; this.openWindow({ kind: 'achievements' }); }

  renderAchievements() {
    const g = this.game;
    const done = g.achievements.length;
    const order = [...ACHIEVEMENTS].sort((a, b) => Number(g.achievements.includes(b.id)) - Number(g.achievements.includes(a.id)));
    const rows = order.map((a) => {
      const ok = g.achievements.includes(a.id);
      const v = Math.min(a.goal, g.statValue(a.stat));
      return `<div class="ach ${ok ? 'done' : ''}"><div class="ach-medal">${ico('medal', 'medal')}</div><div class="ach-body"><b>${esc(a.name)}</b><span class="muted small">${esc(a.desc)}</span>
        <div class="cap"><div style="width:${(v / a.goal) * 100}%"></div></div><span class="small">${fmt(v)} / ${fmt(a.goal)}</span></div>
        <div class="ach-reward">${ok ? '<span class="good">✓</span>' : ''}${gemCost(a.gems)}</div></div>`;
    }).join('');
    return `${winHead(`Достижения · ${done}/${ACHIEVEMENTS.length}`)}
      <div class="ach-summary"><div class="cap big"><div style="width:${(done / ACHIEVEMENTS.length) * 100}%"></div></div></div>
      <div class="pane scroll-area"><div class="ach-list">${rows}</div></div>`;
  }

  openJournal() { this.game.story.unread = []; this.openWindow({ kind: 'journal' }); }

  renderJournal() {
    const g = this.game;
    const entries = g.story.seen.map((id) => storyEntry(id)).filter(Boolean).reverse()
      .map((s) => `<div class="journal-entry ${s.note ? 'note' : ''}"><h4>${s.note ? '✉ ' : '✦ '}${esc(s.title)}</h4><p>${esc(s.text)}</p></div>`).join('');
    const notes = g.activities.notesTaken.length;
    return `${winHead(`Журнал · записки ${notes}/10`)}
      <div class="journal pane scroll-area">${entries || '<p class="muted">Пока пусто.</p>'}</div>`;
  }

  // ---------- модальные окна ----------

  openModal(html, kind = 'info') {
    this.modal = kind;
    const el = this.$('#modal');
    el.className = `modal modal-${kind}`;
    el.innerHTML = syncImgs(html);
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
    this.openModal(`<div class="story-mark">${s.note ? '✉' : '✦'}</div><div class="ribbon"><span>${esc(s.title)}</span></div><p class="story">${esc(s.text)}</p>
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
      this.openModal(`<div class="result-mark win">✦</div><div class="ribbon"><span>Волна ${n} отражена!</span></div>
        <div class="reward-list">${items.map(([k, v]) => `<div class="reward ${k === 'gems' ? 'gem' : ''}"><img src="${resIcon(k, 48)}" alt=""><b>+${fmt(v)}</b><span>${esc(resName(k))}</span></div>`).join('')}</div>
        ${loot.length ? `<div class="muted">Добыча с тварей: ${loot.map(([k, v]) => `${fmt(v)} <img class="inl" src="${resIcon(k)}" alt="">`).join(' · ')}</div>` : ''}
        ${est.hp > 0 ? `<div class="muted small">${g.buildings.some((b) => b.type === 'repairHouse' && !b.destroyed) ? 'Ремонтники уже идут чинить базу.' : 'Постройки повреждены — почини их в карточках или построй Дом ремонтников.'}</div>` : ''}
        ${this.hooks.adsAvailable?.() === false ? '' : `<button class="ad-btn" data-action="rewarded">▶ Реклама: ещё +${fmt(rw.gold)} монет</button>`}
        <div class="result-actions"><button data-action="nextWave" data-wave="${n}">Повторить ${n}</button>
          <button class="primary" data-action="nextWave" data-wave="${next}">Дальше: волна ${next}</button></div>`, 'result');
    } else {
      this.openModal(`<div class="result-mark lose">✕</div><div class="ribbon dark"><span>Сердце едва не погасло</span></div>
        <p>Волна ${r.wave} прорвалась к Сердцу. Твари отступили в мглу, база цела — разрушенное можно отстроить.</p>
        <p class="muted small">Совет: улучши башни и генераторы, построй казармы, поставь сплошной забор, изучи новое оружие.</p>
        <div class="result-actions"><button class="primary" data-action="nextWave" data-wave="${r.wave}">Подготовиться</button></div>`, 'result');
    }
  }

  openMenu() {
    this.openModal(`<div class="ribbon"><span>Пауза</span></div>
      <div class="help">
        <div>${ico('speed')}<span><b>Движение</b> — WASD/стрелки или касание земли; на телефоне — джойстик слева</span></div>
        <div>${ico('melee')}<span><b>Оружие</b> — 1, 2, 3 — быстрые слоты; I — инвентарь; Q — авто/ручной бой</span></div>
        <div>${ico('crit')}<span><b>Ручной бой</b> — клик по земле или Пробел атакует в сторону курсора</span></div>
        <div>${ico('hammer')}<span><b>Стройка</b> — B или кнопка «Строить»; забор — зажми и тяни; Esc — отмена</span></div>
        <div>${ico('defense')}<span><b>Здание</b> — нажми на него: улучшение, эволюция, мастерская, ремонт, снос</span></div>
        <div>${ico('hp')}<span><b>Сердце</b> — нажми на него, чтобы раздвинуть мглу и открыть новые земли</span></div>
      </div>
      <div class="result-actions"><button data-action="newGameAsk">Новая игра</button>${window.LLAndroid ? '<button data-action="exitApp">Выйти</button>' : ''}<button class="primary" data-action="resume">Продолжить</button></div>`, 'menu');
  }

  openConfirmNew() {
    this.openModal(`<div class="ribbon dark"><span>Начать заново?</span></div><p>Текущая база, волны, предметы и Сердце будут удалены без возможности вернуть.</p>
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
    if (bad) this.sfx('error');
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
      } else if (e.type === 'found') {
        this.toast('', false, { gold: true, long: true, html: `<img class="inl big" src="${resIcon(e.res, 32)}" alt=""> Новый материал: <b>${esc(MATERIALS[e.res].name)}</b>` });
      } else if (e.type === 'heartUp') this.toast(`Сердце достигло ${e.level} уровня — мгла отступила`, false);
      else if (e.type === 'zoneOpen') this.toast(`Открыты новые земли: «${ZONES[e.zone - 1].name}»`, false, { long: true });
      else if (e.type === 'evolutionReady') this.toast('Постройка готова к эволюции — открой её карточку', false);
      else if (e.type === 'crafted') this.toast(`Изучено: ${ITEMS[e.item].name}`);
      else if (e.type === 'tutorialGift') this.toast('', false, { gold: true, html: `Сердце делится запасами: ${Object.entries(e.gift).map(([k, v]) => `+${fmt(v)} <img class="inl" src="${resIcon(k)}" alt="">`).join(' ')}` });
      else if (e.type === 'tutorialStep') { this.sfx('build'); this.last['#objective'] = null; }
      else if (e.type === 'tutorialDone') {
        this.toast('', false, { gold: true, long: true, html: `Обучение пройдено! ${Object.entries(e.reward).map(([k, v]) => `+${v} <img class="inl" src="${resIcon(k)}" alt="">`).join(' ')}` });
      }
    }
    if (this.pendingResult && !this.modal && !this.window) {
      const r = this.pendingResult;
      this.pendingResult = null;
      this.showResult(r);
    }
  }
}
