// Интерфейс поверх холста: HUD, меню строительства, карточка здания, окна.
import { BUILDINGS, BUILD_MENU, RESOURCES, WEAPONS, WEAPON_ORDER, ENEMIES, STORY, WORLD } from '../config.js';
import { SIDE_NAMES } from '../core/waves.js';
import { resIcon, buildingIcon, weaponIcon, portrait } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RES_ORDER = ['wood', 'planks', 'stone', 'gold', 'shards'];
const SIDE_ARROWS = { N: '↑', E: '→', S: '↓', W: '←' };

function costHtml(cost, res) {
  return Object.entries(cost).map(([k, v]) => {
    const lack = (res[k] || 0) < v;
    return `<span class="cost ${lack ? 'lack' : ''}"><img src="${resIcon(k)}" alt="">${v}</span>`;
  }).join('');
}

export class Hud {
  constructor(root, game, renderer, hooks) {
    this.root = root;
    this.game = game;
    this.renderer = renderer;
    this.hooks = hooks;
    this.buildType = null;
    this.objective = null;
    this.modal = null;
    this.paused = false;
    this.last = {};
    this.timer = 0;
    this.toastQueue = [];
    this.storyQueue = [];
    this.root.innerHTML = this.template();
    this.$ = (sel) => this.root.querySelector(sel);
    this.bind();
    this.renderBuildBar();
    this.renderWeapons();
  }

  setGame(game) {
    this.game = game;
    this.buildType = null;
    this.closeCard();
    this.last = {};
    this.renderBuildBar();
    this.renderWeapons();
  }

  get blocking() { return !!this.modal || this.paused; }

  template() {
    return `
      <div class="hud-top">
        <div class="bars">
          <div class="bar-row" title="Сердце Светоча">
            <img class="bar-icon" src="${buildingIcon('heart')}" alt="">
            <div class="bar"><div class="fill heart-fill" id="heartFill"></div><span id="heartText"></span></div>
          </div>
          <div class="bar-row" title="Хранитель">
            <img class="bar-icon" src="${portrait('hero')}" alt="">
            <div class="bar"><div class="fill hero-fill" id="heroFill"></div><span id="heroText"></span></div>
          </div>
        </div>
        <div class="resources" id="resources"></div>
        <div class="top-buttons">
          <button class="icon-btn" data-action="journal" title="Журнал"><span>📜</span><i class="dot hidden" id="journalDot"></i></button>
          <button class="icon-btn" data-action="sound" title="Звук" id="soundBtn">🔊</button>
          <button class="icon-btn" data-action="menu" title="Меню">☰</button>
        </div>
      </div>
      <div class="wave-panel" id="wavePanel"></div>
      <div class="objective" id="objective"></div>
      <div class="hud-bottom">
        <div class="build-bar" id="buildBar"></div>
        <div class="weapons" id="weapons"></div>
      </div>
      <div class="card hidden" id="card"></div>
      <div class="toasts" id="toasts"></div>
      <div class="modal-wrap hidden" id="modalWrap"><div class="modal" id="modal"></div></div>
      <div class="joystick hidden" id="joystick"><div class="stick" id="stick"></div></div>
    `;
  }

  bind() {
    this.root.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-action]');
      if (!el) return;
      ev.stopPropagation();
      this.action(el.dataset.action, el.dataset);
    });
    // пока палец/мышь над интерфейсом — холст не получает события
    for (const sel of ['.hud-top', '#wavePanel', '.hud-bottom', '#card', '#modalWrap', '#objective']) {
      this.$(sel).addEventListener('pointerdown', (e) => e.stopPropagation());
    }
  }

  action(name, data) {
    const g = this.game;
    this.hooks.click?.();
    switch (name) {
      case 'build': {
        const type = data.type;
        this.closeCard();
        this.buildType = this.buildType === type ? null : type;
        if (this.buildType) this.toast(`${BUILDINGS[type].name}: выбери место на освещённой земле${type === 'wall' ? ' (можно ставить несколько)' : ''}`);
        this.renderBuildBar();
        break;
      }
      case 'cancelBuild': this.buildType = null; this.renderBuildBar(); break;
      case 'weapon': g.setWeapon(data.weapon); this.renderWeapons(); break;
      case 'auto': g.toggleAuto(); this.renderWeapons(); break;
      case 'startWave': this.closeCard(); this.hooks.startWave(); break;
      case 'pickWave': g.setNextWave(Number(data.wave)); this.last.wave = null; break;
      case 'upgrade': g.upgrade(Number(data.id)); this.refreshCard(true); break;
      case 'toggle': g.toggleEnabled(Number(data.id)); this.refreshCard(true); break;
      case 'prio': g.changePriority(Number(data.id), Number(data.delta)); this.refreshCard(true); break;
      case 'repairNow': g.repairNow(Number(data.id)); this.refreshCard(true); break;
      case 'reserve': g.changeReserve(Number(data.id), Number(data.delta)); this.refreshCard(true); break;
      case 'closeCard': this.closeCard(); break;
      case 'restoreBeacon':
        if (g.restoreBeacon(data.id)) this.closeCard();
        else this.refreshCard(true);
        break;
      case 'journal': this.openJournal(); break;
      case 'sound': this.hooks.toggleSound(); break;
      case 'menu': this.openMenu(); break;
      case 'closeModal': this.closeModal(); break;
      case 'nextWave':
        g.setNextWave(Number(data.wave));
        this.closeModal();
        this.hooks.afterResult?.();
        break;
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

  // ---------- кадры ----------

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.12;
    const g = this.game;
    this.objective = g.objective();
    this.renderBars();
    this.renderResources();
    this.renderWavePanel();
    this.renderObjective();
    this.renderBuildBarState();
    this.refreshCard();
    this.$('#journalDot').classList.toggle('hidden', !g.story.unread.length);
    this.$('#soundBtn').textContent = this.hooks.soundOn() ? '🔊' : '🔇';
  }

  setText(id, text) {
    if (this.last[id] === text) return;
    this.last[id] = text;
    this.$(id).innerHTML = text;
  }

  renderBars() {
    const g = this.game;
    const heart = g.heart();
    this.$('#heartFill').style.width = `${(heart.hp / heart.maxHp) * 100}%`;
    this.setText('#heartText', `${Math.ceil(heart.hp)} / ${heart.maxHp}`);
    const h = g.hero;
    this.$('#heroFill').style.width = `${h.dead ? 0 : (h.hp / h.maxHp) * 100}%`;
    this.setText('#heroText', h.dead ? `Возрождение через ${Math.ceil(h.respawn)} с` : `${Math.ceil(h.hp)} / ${h.maxHp}`);
  }

  renderResources() {
    const g = this.game;
    const parts = RES_ORDER.filter((k) => k !== 'stone' || g.unlocked.has('quarry') || g.res.stone > 0).map((k) => {
      const v = Math.floor(g.res[k]);
      const capped = ['wood', 'planks', 'stone'].includes(k) && v >= WORLD.storageCap;
      return `<div class="res ${capped ? 'full' : ''}" title="${RESOURCES[k].name}${capped ? ' — склад полон' : ''}"><img src="${resIcon(k)}" alt="">${v}</div>`;
    });
    const e = g.energy;
    const deficit = e.deficit > 0;
    parts.push(`<div class="res energy ${deficit ? 'deficit' : ''}" title="Энергия: производство / потребление">
      <img src="${resIcon('energy')}" alt="">${e.demand}/${e.supply}${deficit ? ` <b>−${e.deficit}</b>` : ''}</div>`);
    this.setText('#resources', parts.join(''));
  }

  renderWavePanel() {
    const g = this.game;
    let html;
    if (g.phase === 'wave') {
      const w = g.wave;
      const left = w.plan.total - w.killed;
      const pct = Math.round((w.killed / w.plan.total) * 100);
      html = `<div class="wave-title">Волна ${w.plan.number} · ${w.plan.kindName}${w.plan.boss ? ' · <b class="boss">Босс</b>' : ''}</div>
        <div class="wave-progress"><div style="width:${pct}%"></div></div>
        <div class="wave-sub">Осталось врагов: ${left} · стороны: ${w.plan.sides.map((s) => SIDE_ARROWS[s] + ' ' + SIDE_NAMES[s]).join(', ')}</div>`;
    } else {
      const plan = g.wavePreview();
      const comp = Object.entries(plan.counts).map(([t, n]) =>
        `<span class="enemy-chip" title="${ENEMIES[t].name}"><img src="${portrait(ENEMIES[t].look)}" alt="">×${n}</span>`).join('');
      const hc = g.progress.highestCleared;
      const choose = hc >= 1
        ? `<div class="wave-choice">
            <button class="chip ${g.progress.nextWave === hc ? 'on' : ''}" data-action="pickWave" data-wave="${hc}">Повторить ${hc}</button>
            <button class="chip ${g.progress.nextWave === hc + 1 ? 'on' : ''}" data-action="pickWave" data-wave="${hc + 1}">Следующая ${hc + 1}</button>
          </div>` : '';
      html = `<div class="wave-title">Волна ${plan.number} · ${plan.kindName}${plan.boss ? ' · <b class="boss">Босс</b>' : ''}${plan.event ? ` · <b class="event" title="${esc(plan.event.text)}">${plan.event.name}</b>` : ''}</div>
        <div class="wave-sub">Придут: ${plan.sides.map((s) => `<b class="side">${SIDE_ARROWS[s]} ${SIDE_NAMES[s]}</b>`).join(' ')}</div>
        <div class="wave-comp">${comp}</div>
        ${choose}
        <button class="primary big" data-action="startWave">Начать волну ${plan.number}</button>`;
    }
    this.setText('#wavePanel', html);
  }

  renderObjective() {
    const o = this.objective;
    this.setText('#objective', o ? `<span class="star">★</span> ${esc(o.text)}` : '');
  }

  renderBuildBar() {
    const g = this.game;
    const items = BUILD_MENU.filter((t) => g.unlocked.has(t) || BUILDINGS[t].locked).map((t) => {
      const cfg = BUILDINGS[t];
      const locked = !g.unlocked.has(t);
      const on = this.buildType === t;
      return `<button class="build-card ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-action="${locked ? '' : 'build'}" data-type="${t}" title="${esc(cfg.desc)}">
        <img src="${buildingIcon(t)}" alt="">
        <div class="bname">${cfg.name}</div>
        <div class="bcost" data-cost="${t}">${locked ? '🔒 маяк' : costHtml(cfg.cost, g.res)}</div>
      </button>`;
    });
    if (this.buildType) items.unshift('<button class="build-card cancel" data-action="cancelBuild"><div class="x">✕</div><div class="bname">Отмена</div></button>');
    this.$('#buildBar').innerHTML = items.join('');
    this.last.costs = null;
  }

  renderBuildBarState() {
    const g = this.game;
    const key = RES_ORDER.map((k) => Math.floor(g.res[k])).join(',') + [...g.unlocked].join(',');
    if (this.last.costs === key) return;
    if (this.last.unlockedCount !== g.unlocked.size) {
      this.last.unlockedCount = g.unlocked.size;
      this.renderBuildBar();
    }
    this.last.costs = key;
    for (const el of this.root.querySelectorAll('[data-cost]')) {
      const t = el.dataset.cost;
      if (!g.unlocked.has(t)) continue;
      el.innerHTML = costHtml(BUILDINGS[t].cost, g.res);
      el.closest('.build-card').classList.toggle('poor', !g.canAfford(BUILDINGS[t].cost));
    }
    const o = this.objective;
    for (const el of this.root.querySelectorAll('.build-card')) {
      el.classList.toggle('hint', !!o && o.build === el.dataset.type && this.buildType !== el.dataset.type);
    }
  }

  renderWeapons() {
    const g = this.game;
    const html = WEAPON_ORDER.map((w, i) => `<button class="weapon ${g.hero.weapon === w ? 'on' : ''}" data-action="weapon" data-weapon="${w}" title="${WEAPONS[w].name} (${i + 1})">
      <img src="${weaponIcon(w)}" alt=""><span>${i + 1}</span></button>`).join('')
      + `<button class="weapon auto ${g.settings.auto ? 'on' : ''}" data-action="auto" title="Автоатака (Q)">${g.settings.auto ? 'АВТО' : 'РУЧН'}</button>`;
    this.$('#weapons').innerHTML = html;
  }

  // ---------- карточка ----------

  selectBuilding(id) {
    this.card = { kind: 'building', id };
    this.renderer.selected = id;
    this.refreshCard(true);
  }

  selectBeacon(id) {
    this.card = { kind: 'beacon', id };
    this.renderer.selected = null;
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
    let html;
    if (this.card.kind === 'beacon') {
      const bc = g.beacons.find((b) => b.id === this.card.id);
      if (!bc || bc.state === 'lit') return this.closeCard();
      const ready = bc.state === 'ready';
      html = `<div class="card-head"><img src="${buildingIcon('beacon')}" alt=""><div><h3>${bc.cfg.name}</h3><div class="muted">Погасший маяк</div></div>
          <button class="icon-btn" data-action="closeCard">✕</button></div>
        <p>${ready ? 'Лампа цела. Зажги маяк — свет отгонит туман, откроет новую землю и каменоломню.' : `Маяк скрыт туманом. Отрази волну ${bc.cfg.availableAfterWave}, чтобы до него добраться.`}</p>
        ${ready ? `<div class="row">Нужно: ${costHtml(bc.cfg.cost, g.res)}</div>
          <button class="primary" data-action="restoreBeacon" data-id="${bc.id}" ${g.canAfford(bc.cfg.cost) ? '' : 'disabled'}>Зажечь маяк</button>` : ''}`;
    } else {
      const b = g.byId(this.card.id);
      if (!b) return this.closeCard();
      const cfg = BUILDINGS[b.type];
      const st = g.statusOf(b);
      const lines = [];
      if (cfg.energyOut) lines.push(`Даёт энергии: <b>${g.energyOut(b)}</b>`);
      if (cfg.energyUse) lines.push(`Потребляет: <b>${cfg.energyUse}</b> <img class="inl" src="${resIcon('energy')}" alt=""> · приоритет <b>${b.priority}</b>`);
      if (cfg.recipe) {
        const r = cfg.recipe;
        const speed = 1 + r.speedPerLevel * (b.level - 1);
        const inp = Object.entries(r.input).map(([k, v]) => `${v}<img class="inl" src="${resIcon(k)}" alt="">`).join(' ') || '—';
        const out = Object.entries(r.output).map(([k, v]) => `${v}<img class="inl" src="${resIcon(k)}" alt="">`).join(' ');
        lines.push(`Цикл: ${inp} → ${out} за ${(r.seconds / speed).toFixed(1)} с`);
        lines.push(`<div class="progress"><div style="width:${Math.round((b.progress / r.seconds) * 100)}%"></div></div>`);
        if (r.reserve !== undefined) {
          const k = Object.keys(r.input)[0];
          lines.push(`<span class="prio">Не трогать последние <b>${b.reserve}</b> <img class="inl" src="${resIcon(k)}" alt="">
            <button data-action="reserve" data-id="${b.id}" data-delta="-1">−</button><button data-action="reserve" data-id="${b.id}" data-delta="1">+</button></span>`);
        }
      }
      if (cfg.attack) {
        const a = cfg.attack;
        lines.push(`Урон <b>${Math.round(a.damage * (1 + a.damagePerLevel * (b.level - 1)))}</b> · дальность <b>${(a.range + a.rangePerLevel * (b.level - 1)).toFixed(1)}</b>`);
      }
      if (cfg.spawns) lines.push(`Отряд: до <b>${g.squadSize(b)}</b> мечников`);
      if (cfg.repair) {
        const rc = cfg.repair;
        const est = g.repairEstimate();
        lines.push(`Ремонтников: <b>${rc.workers + rc.workersPerLevel * (b.level - 1)}</b> · скорость ×${(1 + rc.perLevel * (b.level - 1)).toFixed(1)}`);
        lines.push(`Ремонт базы: ${est.hp} ед. ≈ <b>${est.wood}</b> <img class="inl" src="${resIcon('wood')}" alt="">`);
      }
      if (b.hp < b.maxHp) lines.push(`Ремонтниками: ≈ <b>${Math.ceil((b.maxHp - b.hp) * WORLD.repairWoodPerHp)}</b> <img class="inl" src="${resIcon('wood')}" alt="">`);
      const fix = b.hp < b.maxHp && g.phase === 'build'
        ? `<button data-action="repairNow" data-id="${b.id}" ${g.canAfford(g.manualRepairCost(b)) ? '' : 'disabled'}>Починить сейчас ${costHtml(g.manualRepairCost(b), g.res)}</button>` : '';
      const up = g.canUpgrade(b);
      const upCost = g.upgradeCost(b);
      const maxed = b.level >= cfg.maxLevel;
      html = `<div class="card-head"><img src="${buildingIcon(b.type)}" alt=""><div><h3>${cfg.name}</h3><div class="muted">Уровень ${b.level}/${cfg.maxLevel}</div></div>
          <button class="icon-btn" data-action="closeCard">✕</button></div>
        <div class="hpbar"><div style="width:${(b.hp / b.maxHp) * 100}%"></div><span>${Math.ceil(b.hp)} / ${b.maxHp}</span></div>
        <div class="status ${st.bad ? 'bad' : 'ok'}">${esc(st.text)}</div>
        <p class="muted">${esc(cfg.desc)}</p>
        ${lines.map((l) => `<div class="row">${l}</div>`).join('')}
        <div class="card-actions">
          ${fix}
          ${maxed ? '<div class="muted">Максимальный уровень</div>' : `<button class="primary" data-action="upgrade" data-id="${b.id}" ${up.ok ? '' : 'disabled'} title="${esc(up.reason || '')}">Улучшить ${costHtml(upCost, g.res)}</button>`}
          ${cfg.energyUse || cfg.recipe || cfg.repair ? `<button data-action="toggle" data-id="${b.id}">${b.enabled ? 'Выключить' : 'Включить'}</button>` : ''}
          ${cfg.energyUse ? `<span class="prio">Приоритет <button data-action="prio" data-id="${b.id}" data-delta="-1">−</button><button data-action="prio" data-id="${b.id}" data-delta="1">+</button></span>` : ''}
        </div>`;
    }
    if (!force && this.last.card === html) return;
    this.last.card = html;
    const el = this.$('#card');
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  // ---------- окна ----------

  openModal(html, kind = 'info') {
    this.modal = kind;
    this.$('#modal').innerHTML = html;
    this.$('#modalWrap').classList.remove('hidden');
    this.hooks.modalChanged?.(true);
  }

  closeModal() {
    const wasStory = this.modal === 'story';
    this.modal = null;
    this.$('#modalWrap').classList.add('hidden');
    this.hooks.modalChanged?.(false);
    if (wasStory || this.storyQueue.length) this.showNextStory();
  }

  showStory(id) {
    this.storyQueue.push(id);
    if (!this.modal) this.showNextStory();
  }

  showNextStory() {
    if (this.modal) return;
    const id = this.storyQueue.shift();
    if (!id) return;
    const s = STORY[id];
    const g = this.game;
    g.story.unread = g.story.unread.filter((x) => x !== id);
    this.openModal(`<div class="story-mark">✦</div><h2>${esc(s.title)}</h2><p class="story">${esc(s.text)}</p>
      <button class="primary big" data-action="closeModal">Дальше</button>`, 'story');
  }

  showResult(r) {
    const g = this.game;
    if (r.victory) {
      const rw = r.rewards;
      const items = [['gold', rw.gold], ['wood', rw.wood], ['shards', rw.shards]];
      const loot = [['gold', r.loot.gold], ['shards', r.loot.shards]].filter(([, v]) => v > 0);
      const est = g.repairEstimate();
      const hasRepair = g.buildings.some((b) => b.type === 'repairHouse' && !b.destroyed);
      const n = r.wave;
      const next = g.progress.highestCleared + 1;
      this.openModal(`<div class="result-mark win">✦</div>
        <h2>Волна ${n} отражена!</h2>
        <div class="reward-list">${items.map(([k, v]) => `<div class="reward"><img src="${resIcon(k)}" alt=""><b>+${v}</b><span>${RESOURCES[k].name}</span></div>`).join('')}</div>
        ${loot.length ? `<div class="muted">Добыча с врагов: ${loot.map(([k, v]) => `${v} <img class="inl" src="${resIcon(k)}" alt="">`).join(' · ')}</div>` : ''}
        ${est.hp > 0 ? `<div class="muted">${hasRepair ? `Ремонтники уже идут чинить базу (≈ ${est.wood} древесины).` : 'Постройки повреждены — Дом ремонтников починит их.'}</div>` : ''}
        <button class="ad-btn" data-action="rewarded">▶ Реклама: ещё +${rw.gold} золота</button>
        <div class="result-actions">
          <button data-action="nextWave" data-wave="${n}">Повторить волну ${n}</button>
          <button class="primary" data-action="nextWave" data-wave="${next}">Следующая волна ${next}</button>
        </div>`, 'result');
    } else {
      this.openModal(`<div class="result-mark lose">✕</div>
        <h2>Сердце едва не погасло</h2>
        <p>Волна ${r.wave} прорвалась к Сердцу. Твари отступили в туман, но база цела: разрушенное отстроят ремонтники.</p>
        <p class="muted">Совет: поставь больше башен и генераторов, построй казарму, улучши стены.</p>
        <div class="result-actions"><button class="primary" data-action="nextWave" data-wave="${r.wave}">Подготовиться и повторить</button></div>`, 'result');
    }
  }

  openJournal() {
    const g = this.game;
    const entries = g.story.seen.map((id) => `<div class="journal-entry"><h4>${esc(STORY[id].title)}</h4><p>${esc(STORY[id].text)}</p></div>`).reverse().join('');
    g.story.unread = [];
    this.openModal(`<h2>Журнал открытий</h2><div class="journal">${entries || '<p class="muted">Пока пусто.</p>'}</div>
      <button class="primary" data-action="closeModal">Закрыть</button>`, 'journal');
  }

  openMenu() {
    this.openModal(`<h2>Пауза</h2>
      <div class="help">
        <div><b>Движение</b> — WASD/стрелки, на телефоне — джойстик слева или касание земли</div>
        <div><b>Оружие</b> — 1 посох, 2 меч, 3 лук · <b>Q</b> — авто/ручной бой</div>
        <div><b>Ручной бой</b> — клик/касание по земле или Пробел атакует в сторону курсора</div>
        <div><b>Постройка</b> — карта снизу, затем место на освещённой земле · Esc — отмена</div>
        <div><b>Здание</b> — нажми на него: улучшение, приоритет энергии, выключение</div>
      </div>
      <div class="result-actions">
        <button data-action="newGameAsk">Новая игра</button>
        <button class="primary" data-action="resume">Продолжить</button>
      </div>`, 'menu');
  }

  openConfirmNew() {
    this.openModal(`<h2>Начать заново?</h2><p>Текущая база, волны и маяки будут удалены без возможности вернуть.</p>
      <div class="result-actions"><button data-action="menu">Отмена</button><button class="danger" data-action="newGame">Стереть и начать</button></div>`, 'menu');
  }

  toast(text, bad) {
    const el = document.createElement('div');
    el.className = 'toast' + (bad ? ' bad' : '');
    el.textContent = text;
    const box = this.$('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2400);
    setTimeout(() => el.remove(), 2900);
  }

  consume(events) {
    for (const e of events) {
      if (e.type === 'toast') this.toast(e.text, e.bad);
      else if (e.type === 'story') this.showStory(e.id);
      else if (e.type === 'victory' || e.type === 'defeat') {
        this.pendingResult = this.game.lastResult;
      } else if (e.type === 'weapon') this.renderWeapons();
      else if (e.type === 'beaconLit') this.renderBuildBar();
      else if (e.type === 'waveStart') this.toast(`Волна ${e.number}! Враги идут: ${e.sides.map((s) => SIDE_NAMES[s]).join(', ')}`, true);
    }
    if (this.pendingResult && !this.modal) {
      const r = this.pendingResult;
      this.pendingResult = null;
      this.showResult(r);
    }
  }
}
