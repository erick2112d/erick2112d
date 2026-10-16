// Обязательное обучение: ведёт по шагам из data/tutorial.js и гарантирует стартовые постройки.
import { TUTORIAL, TUTORIAL_REWARD, BUILDINGS } from '../data/index.js';

export const tutorialMixin = {
  tutorialStep() {
    const t = this.tutorial;
    return t && !t.done ? TUTORIAL[t.step] || null : null;
  },

  updateTutorial() {
    const s = this.tutorialStep();
    if (!s) return;
    const t = this.tutorial;
    if (!t.entered) this.enterTutorialStep();
    let ok = false;
    if (s.gather) ok = Object.entries(s.gather).every(([k, v]) => (this.res[k] || 0) - (t.base[k] || 0) >= v);
    else if (s.build) {
      ok = this.buildings.some((b) => b.type === s.build);
      // пока шаг не выполнен, на постройку должно хватать всегда (лесопилка, наём и т. п. могли потратить запас)
      if (!ok) this.topUpForTutorial(s.build);
    }
    if (ok) this.advanceTutorial();
  },

  enterTutorialStep() {
    const s = this.tutorialStep();
    const t = this.tutorial;
    t.entered = true;
    t.base = {};
    t.spot = null;
    if (s.gather) for (const k of Object.keys(s.gather)) t.base[k] = this.res[k] || 0;
    if (s.build) {
      this.topUpForTutorial(s.build, true);
      t.spot = this.tutorialSpot(s);
    }
    this.emit('tutorial', { step: t.step });
  },

  // Не хватает на постройку шага — Сердце делится запасами (сообщение — не чаще раза в несколько секунд).
  topUpForTutorial(type, announce = false) {
    const gift = {};
    for (const [k, v] of Object.entries(BUILDINGS[type].cost)) {
      const lack = v - (this.res[k] || 0);
      if (lack > 0) { this.addRes(k, lack); gift[k] = Math.ceil(lack); }
    }
    if (!Object.keys(gift).length) return;
    const t = this.tutorial;
    if (announce || this.time - (t.giftAt ?? -99) > 6) { t.giftAt = this.time; this.emit('tutorialGift', { gift }); }
  },

  // Подсказанное место для постройки шага (ставить можно и в любом другом).
  tutorialSpot(s) {
    const c = this.heartCenter();
    let [dx, dy] = s.at || [0, 3];
    if (s.toward) {
      const side = this.wavePreview().sides[0];
      [dx, dy] = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[side].map((v) => v * s.toward);
    }
    return this.findSpot(s.build, c.x + dx, c.y + dy);
  },

  advanceTutorial() {
    const t = this.tutorial;
    t.step++;
    t.entered = false;
    this.emit('tutorialStep', { step: t.step });
    this.emit('save');
  },

  completeTutorial() {
    const t = this.tutorial;
    if (t.done) return;
    t.done = true;
    for (const [k, v] of Object.entries(TUTORIAL_REWARD)) this.addRes(k, v);
    this.emit('tutorialDone', { reward: TUTORIAL_REWARD });
    this.emit('save');
  },
};
