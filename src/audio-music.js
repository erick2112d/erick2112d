// Процедурная фоновая музыка и атмосфера.
// Спокойная фаза: ветер, редкие сверчки и колокольчики, мягкие аккорды-подклады в ре дорийском
// и редкие щипковые ноты арфы. Волна врагов: плавный (≈2 с) переход к тёмному слою —
// низкие барабаны, пульсирующий гул и быстрое зловещее остинато лютни.
// Планировщик с упреждением: setInterval раз в 100 мс ставит ноты на ~0.3 с вперёд по ctx.currentTime.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Аккорды ре дорийского лада: бас, голоса подклада, куда можно пойти дальше.
const CHORDS = {
  i: { bass: 38, pad: [53, 57, 62, 64], next: ['VII', 'III', 'IV', 'v', 'VII'] },
  VII: { bass: 36, pad: [52, 55, 60, 62], next: ['i', 'i', 'IV', 'III'] },
  III: { bass: 41, pad: [53, 57, 60, 64], next: ['VII', 'IV', 'i'] },
  IV: { bass: 43, pad: [50, 55, 59, 62], next: ['i', 'i', 'VII'] },
  v: { bass: 45, pad: [52, 55, 60, 64], next: ['i', 'III', 'IV'] },
};
const MELODY = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
const CHIMES = [86, 88, 93, 95, 98];
// Тревожная прогрессия: Dm — B♭ — C — A, остинато по восьмым.
const TENSE = [
  { root: 38, arp: [50, 57, 62, 57, 53, 57, 62, 65], high: [74, 77] },
  { root: 34, arp: [46, 53, 58, 53, 50, 53, 58, 62], high: [74, 77] },
  { root: 36, arp: [48, 55, 60, 55, 52, 55, 60, 64], high: [72, 76] },
  { root: 33, arp: [45, 52, 57, 52, 49, 52, 57, 61], high: [73, 76] },
];
const STEP = 60 / 92 / 2; // восьмая при 92 уд/мин
const LOOKAHEAD = 0.3;
const XFADE = 2.5;

export class Music {
  constructor(engine) {
    this.e = engine;
    this.ctx = engine.ctx;
    this.tension = false;
    this.switchAt = -100;
    this.calmOn = false;
    this.tenseOn = false;
    this.chord = 'i';
    this.timer = null;
    this.drone = null;
    this.build();
  }

  build() {
    const c = this.ctx;
    const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    this.out = gain(0, this.e.musicBus);
    this.calm = gain(1, this.out);
    this.tense = gain(0, this.out);
    this.amb = gain(1, this.out);
    this.lfos = [];

    // Подклад: аккорды → мягкий НЧ-фильтр с медленным дыханием → хорус из двух модулированных задержек.
    this.padIn = gain(1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4;
    this.padIn.connect(lp);
    lp.connect(this.calm);
    lp.connect(gain(0.6, this.e.revIn));
    this.lfo(0.045, 280, lp.frequency);
    for (const [pan, rate, base] of [[-0.7, 0.23, 0.017], [0.7, 0.31, 0.023]]) {
      const d = c.createDelay(0.1);
      d.delayTime.value = base;
      this.lfo(rate, 0.004, d.delayTime);
      lp.connect(d);
      const wet = gain(0.45);
      d.connect(wet);
      if (this.e.canPan) { const p = c.createStereoPanner(); p.pan.value = pan; wet.connect(p); p.connect(this.calm); } else wet.connect(this.calm);
    }

    // Ветер: петля розового шума через полосовой фильтр с медленными «порывами» (петля подключается в startWind).
    this.windIn = gain(1);
    const wf = c.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 480; wf.Q.value = 0.55;
    const wg = gain(0.95);
    this.windIn.connect(wf); wf.connect(wg); wg.connect(this.amb);
    this.lfo(0.047, 260, wf.frequency);
    this.lfo(0.11, 0.5, wg.gain);
    // тонкий «свист» ветра
    const wh = c.createBiquadFilter();
    wh.type = 'bandpass'; wh.frequency.value = 1300; wh.Q.value = 4;
    const whg = gain(0.2);
    this.windIn.connect(wh); wh.connect(whg); whg.connect(this.amb);
    this.lfo(0.031, 350, wh.frequency);
    this.lfo(0.07, 0.18, whg.gain);
  }

  startWind(buffer) {
    if (this.wind || !buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.windIn);
    src.start();
    this.wind = src;
  }

  lfo(rate, depth, param) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = rate;
    const g = c.createGain();
    g.gain.value = depth;
    o.connect(g); g.connect(param);
    o.start(c.currentTime + Math.random() * 0.01);
    this.lfos.push(o);
  }

  // Пульсирующий низкий гул для тревожного слоя (создаётся при первой волне).
  ensureDrone() {
    if (this.drone) return;
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0.05;
    lp.connect(g); g.connect(this.tense);
    const f = hz(38);
    const oscs = [['sine', 0.5, 1], ['triangle', 1, 0.7], ['triangle', 1.004, 0.6], ['sine', 1.5, 0.35]].map(([type, mul, amp]) => {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = f * mul;
      const og = c.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(lp);
      o.start();
      return [o, mul];
    });
    this.drone = { g, oscs };
  }

  start(auto) {
    const c = this.ctx, t = c.currentTime;
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + 3);
    if (auto) this.timer = setInterval(() => this.tick(), 100);
  }

  setTension(on, immediate = false) {
    on = !!on;
    const c = this.ctx, t = c.currentTime;
    if (on === this.tension && !immediate) return;
    this.tension = on;
    this.switchAt = immediate ? -100 : t;
    if (on) this.ensureDrone();
    const tc = immediate ? 0.01 : 0.6;
    for (const [g, v] of [[this.calm, on ? 0 : 1], [this.tense, on ? 1 : 0], [this.amb, on ? 0.55 : 1]]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.setTargetAtTime(v, t, tc);
    }
  }

  tick() {
    try {
      const c = this.ctx;
      if (c.state !== 'running' || !this.e.on) return; // контекст на паузе — ничего не копим
      this.scheduleUntil(c.currentTime + LOOKAHEAD);
    } catch (e) {
      clearInterval(this.timer);
      console.warn('Музыка остановлена', e);
    }
  }

  scheduleUntil(horizon) {
    const now = this.ctx.currentTime;
    const fading = now < this.switchAt + XFADE;
    if (!this.tension || fading) {
      if (!this.calmOn) { this.calmOn = true; this.nextChord = now + 0.05; this.nextPluck = now + rand(1.5, 3); this.nextNight = now + rand(3, 8); }
      this.scheduleCalm(now, horizon);
    } else this.calmOn = false;
    if (this.tension || fading) {
      if (!this.tenseOn) { this.tenseOn = true; this.nextStep = now + 0.08; this.step = 0; }
      this.scheduleTense(now, horizon);
    } else this.tenseOn = false;
  }

  // ---- спокойный слой ----
  scheduleCalm(now, horizon) {
    // после долгого простоя не догоняем пропущенное, а начинаем с текущего момента
    if (this.nextChord < now - 0.25) this.nextChord = now + 0.02;
    if (this.nextPluck < now - 0.25) this.nextPluck = now + rand(0.5, 2);
    if (this.nextNight < now - 0.25) this.nextNight = now + rand(2, 6);
    while (this.nextChord < horizon) {
      const dur = rand(4.2, 6);
      this.chord = pick(CHORDS[this.chord].next);
      this.playChord(this.nextChord, CHORDS[this.chord], dur);
      this.nextChord += dur;
    }
    while (this.nextPluck < horizon) this.nextPluck = this.phrase(this.nextPluck) + rand(2.5, 6);
    while (this.nextNight < horizon) { this.night(this.nextNight); this.nextNight += rand(5, 12); }
  }

  playChord(t, ch, dur) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 1.6);
    g.gain.setValueAtTime(0.045, t + dur);
    g.gain.setTargetAtTime(0, t + dur, 0.9);
    g.connect(this.padIn);
    const end = t + dur + 5;
    const add = (type, f, det) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); o.stop(end); return o; };
    for (const m of ch.pad) { add('triangle', hz(m), -7 + rand(-2, 2)); add('sine', hz(m), 6 + rand(-2, 2)); }
    add('sine', hz(ch.bass), 0);
    const last = add('triangle', hz(ch.bass + 12), 3);
    last.onended = () => { try { g.disconnect(); } catch { /* уже */ } };
  }

  // Короткая фраза арфы из 1–4 нот, начинается с тона текущего аккорда.
  phrase(t) {
    if (Math.random() < 0.3) return t;
    const tones = CHORDS[this.chord].pad.map((m) => (m < 62 ? m + 12 : m));
    let idx = MELODY.indexOf(pick(tones));
    if (idx < 0) idx = 4;
    const n = 1 + ((Math.random() * 4) | 0);
    let vol = rand(0.16, 0.24);
    for (let j = 0; j < n; j++) {
      const b = this.e.note('harp', MELODY[idx]);
      if (b) this.e._voice(b, t, vol, rand(-0.5, 0.5), this.calm, 2, 1);
      if (j < n - 1) {
        t += rand(0.32, 0.65);
        idx = Math.max(0, Math.min(MELODY.length - 1, idx + pick([-2, -1, -1, 1, 1, 2])));
        vol *= 0.85;
      }
    }
    return t;
  }

  night(t) {
    if (Math.random() < 0.55) {
      const b = this.e.note('cricket', 0);
      if (b) this.e._voice(b, t, rand(0.04, 0.07), rand(-0.8, 0.8), this.amb, 1, rand(0.95, 1.05));
    } else {
      const n = 2 + ((Math.random() * 2) | 0), pan = rand(-0.6, 0.6);
      for (let j = 0; j < n; j++) {
        const b = this.e.note('chime', pick(CHIMES));
        if (b) this.e._voice(b, t + j * rand(0.15, 0.4), rand(0.05, 0.09), pan, this.calm, 3, 1);
      }
    }
  }

  // ---- тревожный слой ----
  scheduleTense(now, horizon) {
    if (this.nextStep < now - 0.25) this.nextStep = now + 0.03;
    const e = this.e;
    while (this.nextStep < horizon) {
      const t = this.nextStep, s = this.step % 8, bar = Math.floor(this.step / 8);
      const ch = TENSE[Math.floor(bar / 2) % 4];
      const fill = bar % 8 === 7;
      if (s === 0 && bar % 2 === 0 && this.drone) {
        for (const [o, mul] of this.drone.oscs) o.frequency.setTargetAtTime(hz(ch.root) * mul, t, 0.08);
      }
      // барабаны
      const drum = (k, v, p = 0) => { const b = e.note(k, 0); if (b) e._voice(b, t, v, p, this.tense, 1, 1); };
      if (s === 0) drum('big', 0.55);
      if (s === 4) drum('mid', 0.38, -0.15);
      if (s === 3) drum('small', 0.2, 0.3);
      if (s === 6 && Math.random() < 0.7) drum('small', 0.16, 0.3);
      if (s === 7 && Math.random() < 0.5) drum('small', 0.13, 0.3);
      if (fill && s >= 5) drum('mid', 0.25 + (s - 5) * 0.08, 0.15);
      // пульс гула
      if (this.drone && s % 2 === 0) {
        const g = this.drone.g.gain;
        g.setTargetAtTime(s === 0 ? 0.2 : 0.15, t, 0.015);
        g.setTargetAtTime(0.06, t + 0.06, 0.16);
      }
      // остинато
      if (s === 0 || Math.random() < 0.82) {
        const b = e.note('dark', ch.arp[s]);
        if (b) e._voice(b, t, s === 0 ? 0.26 : rand(0.14, 0.19), s % 2 ? 0.25 : -0.25, this.tense, 1, 1);
      }
      // редкая высокая тревожная нота
      if (s === 0 && bar % 2 === 1 && Math.random() < 0.55) {
        const b = e.note('harp', pick(ch.high));
        if (b) e._voice(b, t, 0.1, rand(-0.4, 0.4), this.tense, 3, 1);
      }
      this.step++;
      this.nextStep += STEP;
    }
  }
}
