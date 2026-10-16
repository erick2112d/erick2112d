// Волны, сюжет, достижения, подсказки.
import { STORY, ACHIEVEMENTS, NOTES, BUILDINGS, WORLD, MERCHANT, ENEMIES, TUTORIAL } from '../data/index.js';
import { generateWave } from './waves.js';

export function storyEntry(id) {
  if (STORY[id]) return STORY[id];
  const n = NOTES.find((x) => x.id === id);
  return n ? { title: n.title, text: n.text, note: true } : null;
}

export const progressMixin = {
  // ---------- сюжет ----------

  unlockStory(id) {
    if (!storyEntry(id) || this.story.seen.includes(id)) return;
    this.story.seen.push(id);
    this.story.unread.push(id);
    this.emit('story', { id });
  },

  // ---------- волны ----------

  setNextWave(n) {
    if (this.phase !== 'build') return;
    const max = this.progress.highestCleared + 1;
    this.progress.nextWave = Math.max(1, Math.min(max, n));
    this.emit('save');
  },

  startWave() {
    if (this.phase !== 'build') return false;
    if (this.tutorialStep()?.wave) this.completeTutorial();
    const plan = generateWave(this.progress.nextWave);
    this.snapshot = this.serialize();
    this.phase = 'wave';
    this.lastResult = null;
    this.activities.merchant = null;
    this.wave = { plan, t: 0, idx: 0, killed: 0, loot: { gold: 0 } };
    this.emit('waveStart', { number: plan.number, sides: plan.sides, boss: plan.boss });
    return true;
  },

  waveEnemies() { return this.enemies.filter((e) => !e.guard && !e.dead); },

  updateWave(dt) {
    const w = this.wave;
    w.t += dt;
    const spawns = w.plan.spawns;
    while (w.idx < spawns.length && spawns[w.idx].at <= w.t) {
      const s = spawns[w.idx++];
      this.spawnEnemy(s.type, s.side, s.offset, s.boss);
    }
    if (this.heart().hp <= 0) return this.endWave(false);
    if (w.idx >= spawns.length && this.waveEnemies().length === 0) this.endWave(true);
  },

  endWave(victory) {
    const plan = this.wave.plan;
    const n = plan.number;
    const result = { victory, wave: n, loot: { ...this.wave.loot }, rewards: null };
    if (victory) {
      const r = { ...plan.rewards };
      // самоцветы: 0–2 за волну
      const roll = Math.random() * 100;
      const [w0, w1] = WORLD.gemDropWeights;
      r.gems = roll < w0 ? 0 : roll < w0 + w1 ? 1 : 2;
      if (plan.event?.gems) r.gems += plan.event.gems;
      for (const [k, v] of Object.entries(r)) if (v > 0) this.addRes(k, v);
      result.rewards = r;
      this.progress.highestCleared = Math.max(this.progress.highestCleared, n);
      this.progress.nextWave = this.progress.highestCleared + 1;
      this.stats.bestWave = Math.max(this.stats.bestWave, n);
      if (n === 1) this.unlockStory('first_wave');
    } else {
      for (const e of this.waveEnemies()) { e.dead = true; this.emit('poof', { x: e.x, y: e.y, big: true }); }
      const heart = this.heart();
      heart.hp = Math.round(heart.maxHp * WORLD.heartRestoreAfterDefeat);
      heart.destroyed = false;
      this.progress.defeats++;
      this.progress.nextWave = n;
      this.unlockStory('first_defeat');
    }
    this.projectiles = this.projectiles.filter((p) => p.faction === 'player');
    this.phase = 'build';
    this.wave = null;
    this.snapshot = null;
    this.lastResult = result;
    if (victory && n % MERCHANT.everyWaves === 0) this.summonMerchant(n);
    this.emit(victory ? 'victory' : 'defeat', { wave: n });
    this.emit('save');
  },

  grantBonus() {
    // награда за рекламу: ещё раз монеты последней победы
    const r = this.lastResult;
    if (!r || !r.victory || r.bonusTaken) return false;
    r.bonusTaken = true;
    this.addRes('gold', r.rewards.gold);
    this.emit('toast', { text: `+${r.rewards.gold} монет` });
    this.emit('save');
    return true;
  },

  // ---------- достижения ----------

  statValue(stat) {
    if (stat === 'heartLevel') return this.heartLevel;
    if (stat === 'workersNow') return this.workersNow || 0;
    return this.stats[stat] || 0;
  },

  updateProgress(dt) {
    this.achTimer = (this.achTimer || 0) - dt;
    if (this.achTimer > 0) return;
    this.achTimer = 0.5;
    for (const a of ACHIEVEMENTS) {
      if (this.achievements.includes(a.id)) continue;
      if (this.statValue(a.stat) >= a.goal) {
        this.achievements.push(a.id);
        this.addRes('gems', a.gems);
        this.emit('achievement', { id: a.id, name: a.name, gems: a.gems });
        this.emit('save');
      }
    }
  },

  // ---------- подсказка-цель ----------

  objective() {
    const tut = this.tutorialStep();
    if (tut) {
      const n = this.tutorial.step + 1;
      const head = `Обучение ${n}/${TUTORIAL.length}: `;
      if (tut.gather) {
        const got = Math.floor((this.res.wood || 0) - (this.tutorial.base.wood || 0));
        let tree = null; let bd = Infinity;
        for (const nd of this.nodes) {
          if (nd.kind !== 'tree' || nd.hp <= 0 || !this.inTerritory(nd.x, nd.y, 0.6)) continue;
          const d = Math.hypot(nd.x - this.hero.x, nd.y - this.hero.y);
          if (d < bd) { bd = d; tree = nd; }
        }
        return { text: `${head}${tut.text} (${Math.max(0, Math.min(tut.gather.wood, got))}/${tut.gather.wood})`, target: tree ? { x: tree.x, y: tree.y } : null, tutorial: tut };
      }
      const sp = this.tutorial.spot;
      const size = tut.build ? BUILDINGS[tut.build].size : 0;
      return { text: head + tut.text, tutorial: tut, build: tut.build, wave: tut.wave, spotTarget: sp ? { x: sp.tx + size / 2, y: sp.ty + size / 2 } : null };
    }
    if (this.phase === 'wave') {
      const boss = this.enemies.find((e) => !e.dead && ENEMIES[e.type]?.boss);
      if (boss) return { text: `${ENEMIES[boss.type].name} у стен! Сосредоточь удары на боссе`, target: { x: boss.x, y: boss.y } };
      return { text: this.hero.dead ? 'Хранитель скоро вернётся — башни держат оборону' : 'Отрази волну: защищай Сердце и помогай башням' };
    }
    const has = (t) => this.buildings.some((b) => b.type === t);
    const nearestTree = () => {
      const n = this.nearestNode(this.hero.x, this.hero.y, 30);
      return n ? { x: n.x, y: n.y } : null;
    };
    if (!has('workerCamp') && this.res.wood < BUILDINGS.workerCamp.cost.wood) {
      return { text: `Подойди к дереву и бей его — нужно ${BUILDINGS.workerCamp.cost.wood} древесины`, target: nearestTree() };
    }
    if (!has('workerCamp')) return { text: 'Открой «Строить» и поставь Лагерь рабочих — они сами добывают ресурсы', build: 'workerCamp' };
    if (!has('generator')) {
      if (this.res.wood < BUILDINGS.generator.cost.wood) return { text: 'Наруби древесины на Генератор (30)', target: nearestTree() };
      return { text: 'Построй Генератор — он даёт энергию башням', build: 'generator' };
    }
    if (!has('sawmill')) return { text: 'Построй Лесопилку — она делает доски', build: 'sawmill' };
    if (this.energy.deficit > 0) return { text: `Не хватает энергии (${this.energy.deficit}) — улучши генератор или построй новый`, build: 'generator' };
    if (!has('archerTower')) return { text: 'Поставь Башню лучников у Сердца (нужны доски)', build: 'archerTower' };
    if (this.progress.highestCleared === 0) return { text: 'Готово! Начни волну — враги придут с отмеченной стороны', wave: true };
    if (!has('farm')) return { text: 'Построй Ферму — еда нужна для рабочих, воинов и Сердца', build: 'farm' };
    if (this.heartLevel < 2) return { text: 'Нажми на Сердце и улучши его — свет раздвинет мглу', heart: true, target: this.heartCenter() };
    if (!has('barracks')) return { text: 'Построй Казарму мечников', build: 'barracks' };
    if (this.heartLevel >= 3 && !has('forge')) return { text: 'Построй Кузню и изучи новое оружие', build: 'forge' };
    if (this.heartLevel >= 3 && !has('repairHouse')) return { text: 'Построй Дом ремонтников — он чинит базу после волн', build: 'repairHouse' };
    const chest = this.activities.chests[0];
    if (chest) return { text: 'На карте лежит сундук — подойди и открой его', target: chest };
    if (this.activities.merchant) return { text: 'Бродячий торговец ждёт у повозки', target: this.activities.merchant };
    const hc = this.canUpgradeHeart();
    if (hc.ok) return { text: `Сердце можно улучшить до ${this.heartLevel + 1} уровня`, heart: true, target: this.heartCenter() };
    return { text: `Готовься к волне ${this.progress.nextWave}. Добывай ресурсы и улучшай Сердце`, wave: true };
  },
};
