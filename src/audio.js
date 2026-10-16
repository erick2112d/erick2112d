// Звук без файлов: всё синтезируется процедурно.
// Одноразовые эффекты один раз «запекаются» в AudioBuffer собственным DSP на Float32Array
// (модальный синтез, Карплус — Стронг, мягкий FM, фильтрованный шум), затем проигрываются дёшево.
// Цепочка: голос → (панорама) → шина эффектов ┐
//                    музыка/атмосфера → шина музыки ┼→ компрессор → мастер → мягкий ограничитель → выход
//                   посыл на свёрточную реверберацию ┘
import { Music } from './audio-music.js';
import { SFX, NOTES, synth } from './audio-synth.js';

const MASTER = 0.8;
const MAX_VOICES = 24;

function softClipCurve() {
  const n = 4097, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3));
  }
  return c;
}

const safe = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.on = true;
    this.suspendedBy = new Set();
    this.lastPlay = {};
    this.buffers = {};
    this.lastVar = {};
    this.activeBy = {};
    this.active = 0;
    this.notes = new Map();
    this.tension = false;
    this.music = null;
    this.queue = [];
    this.broken = false;
    this.offline = false;
    try { this.on = localStorage.getItem('lastlight.sound') !== 'off'; } catch { /* нет хранилища */ }
  }

  static get sounds() { return Object.keys(SFX); }

  // AudioContext создаётся только после первого действия игрока (требование браузеров).
  unlock() {
    if (this.broken) return;
    if (this.ctx) {
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed' && !this.suspendedBy.size) safe(this.ctx.resume());
      return;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { this.broken = true; return; }
    let ctx = null;
    try {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      this._attach(ctx, false);
      if (this.suspendedBy.size && ctx.state === 'running') safe(ctx.suspend());
    } catch (e) {
      console.warn('Звук недоступен', e);
      this.broken = true;
      this.ctx = null;
      this.music = null;
      try { if (ctx) safe(ctx.close()); } catch { /* ничего */ }
    }
  }

  // Строит граф на заданном контексте. offline=true — для проверок в OfflineAudioContext:
  // всё рендерится синхронно, планировщик музыки не запускается.
  _attach(ctx, offline = false) {
    this.ctx = ctx;
    this.offline = offline;
    this.sr = Math.min(ctx.sampleRate, 48000);
    this.canPan = typeof ctx.createStereoPanner === 'function';
    const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };

    const limiter = ctx.createWaveShaper();
    limiter.curve = softClipCurve();
    limiter.connect(ctx.destination);
    this.limiter = limiter;
    this.master = gain(this.on ? MASTER : 0, limiter);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    comp.connect(this.master);
    this.sfxBus = gain(1, comp);
    this.musicBus = gain(0.14, comp);
    this.musicLevel = 0.14;

    const rev = ctx.createConvolver();
    this.rev = rev;
    rev.connect(gain(0.5, comp));
    this.revIn = gain(1, rev);
    this.sends = [null, gain(0.12, this.revIn), gain(0.28, this.revIn), gain(0.55, this.revIn)];

    // Очередь синтеза: сначала первая вариация каждого звука (частые — раньше), потом остальные, потом ноты музыки.
    // Считается в фоновом потоке (воркере); без воркера — небольшими порциями между кадрами.
    const names = Object.keys(SFX);
    const jobs = [{ kind: 'impulse' }];
    for (const n of names) jobs.push({ kind: 'sfx', name: n, i: 0 });
    for (const n of names) for (let i = 1; i < SFX[n].v; i++) jobs.push({ kind: 'sfx', name: n, i });
    for (const k of ['big', 'mid', 'small', 'cricket']) jobs.push({ kind: 'note', k, midi: 0 });
    for (const m of [50, 57, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81]) jobs.push({ kind: 'note', k: 'harp', midi: m });
    for (const m of [45, 46, 48, 49, 50, 52, 53, 55, 57, 58, 60, 61, 62, 64, 65]) jobs.push({ kind: 'note', k: 'dark', midi: m });
    for (const m of [86, 88, 93, 95, 98]) jobs.push({ kind: 'note', k: 'chime', midi: m });
    jobs.splice(8, 0, { kind: 'loop' });
    this.pending = new Set();

    this.music = new Music(this);
    this.music.setTension(this.tension, true);
    if (offline) {
      for (const j of jobs) this._store(j, synth(j, this._rateOf(j)));
      this.music.start(false);
      return;
    }
    this.worker = this._startWorker();
    for (const j of jobs) this._request(j);
    this.music.start(true);
  }

  _rateOf(job) { return job.kind === 'impulse' || job.kind === 'loop' ? this.ctx.sampleRate : this.sr; }

  _key(job) { return job.kind === 'sfx' ? `s:${job.name}:${job.i}` : job.kind === 'note' ? `n:${job.k}${job.midi}` : job.kind; }

  // Фоновый поток синтеза. В однофайловой сборке код воркера лежит в window.__LL_SYNTH_SRC.
  _startWorker() {
    if (typeof Worker === 'undefined') return null;
    let w = null;
    try {
      if (typeof window !== 'undefined' && window.__LL_SYNTH_SRC) {
        w = new Worker(URL.createObjectURL(new Blob([window.__LL_SYNTH_SRC], { type: 'text/javascript' })));
      } else {
        w = new Worker(new URL('./audio-worker.js', import.meta.url), { type: 'module' });
      }
    } catch { return null; }
    w.onmessage = (e) => {
      const { job, data } = e.data || {};
      if (job && data) this._store(job, data);
    };
    w.onerror = (e) => {
      // воркер не завёлся — досчитываем оставшееся на основном потоке
      if (e && e.preventDefault) e.preventDefault();
      if (this.worker !== w) return;
      this.worker = null;
      try { w.terminate(); } catch { /* уже остановлен */ }
      const left = [...(this.jobs?.values() || [])];
      this.pending.clear();
      this.jobs?.clear();
      for (const j of left) this._request(j);
    };
    return w;
  }

  _request(job) {
    const key = this._key(job);
    if (this.pending.has(key)) return;
    if (this.worker) {
      this.pending.add(key);
      this.jobs = this.jobs || new Map();
      this.jobs.set(key, job);
      this.worker.postMessage({ job, sr: this._rateOf(job) });
      return;
    }
    // запасной путь: порциями между кадрами
    this.queue.push(job);
    this.pending.add(key);
    if (!this.pumping) this._pump();
  }

  _pump() {
    this.pumping = true;
    setTimeout(() => {
      const t0 = Date.now();
      try {
        while (this.queue.length && Date.now() - t0 < 6) { const j = this.queue.shift(); this._store(j, synth(j, this._rateOf(j))); }
      } catch (e) { console.warn('Звук: ошибка синтеза', e); }
      if (this.queue.length) this._pump(); else this.pumping = false;
    }, 16);
  }

  // Готовые отсчёты → AudioBuffer в нужное место.
  _store(job, data) {
    if (!this.ctx) return;
    const key = this._key(job);
    this.pending.delete(key);
    this.jobs?.delete(key);
    const sr = this._rateOf(job);
    const b = this.ctx.createBuffer(data.length, data[0].length, sr);
    data.forEach((ch, i) => { if (b.copyToChannel) b.copyToChannel(ch, i); else b.getChannelData(i).set(ch); });
    if (job.kind === 'sfx') (this.buffers[job.name] || (this.buffers[job.name] = [])).push(b);
    else if (job.kind === 'note') this.notes.set(job.k + job.midi, b);
    else if (job.kind === 'impulse') this.rev.buffer = b;
    else if (job.kind === 'loop' && this.music) this.music.startWind(b);
  }

  // Нота инструмента фоновой музыки (кеш по типу и высоте). Если ещё не готова — заказывает и пока молчит.
  note(kind, midi) {
    const b = this.notes.get(kind + midi);
    if (!b && this.ctx && NOTES[kind]) this._request({ kind: 'note', k: kind, midi });
    return b;
  }

  // Общий способ проиграть буфер: источник → громкость → (панорама) → шина + посыл в реверберацию.
  _voice(buffer, t, vol, pan, dest, send, rate, done) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buffer;
    if (rate !== 1) src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g);
    let out = g;
    if (pan && this.canPan) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      out = p;
    }
    out.connect(dest);
    if (send && this.sends[send]) out.connect(this.sends[send]);
    src.onended = () => { try { out.disconnect(); g.disconnect(); } catch { /* уже отключено */ } if (done) done(); };
    src.start(t);
    return src;
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('lastlight.sound', this.on ? 'on' : 'off'); } catch { /* нет хранилища */ }
    if (this.master) {
      try {
        const g = this.master.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.setTargetAtTime(this.on ? MASTER : 0, t, 0.03);
      } catch { this.master.gain.value = this.on ? MASTER : 0; }
    }
  }

  // Пауза звука (скрытая вкладка, реклама) — по требованиям Яндекс Игр.
  suspend(reason) {
    this.suspendedBy.add(reason);
    if (this.ctx && this.ctx.state === 'running') safe(this.ctx.suspend());
  }

  resume(reason) {
    this.suspendedBy.delete(reason);
    if (this.ctx && !this.suspendedBy.size && this.ctx.state === 'suspended') safe(this.ctx.resume());
  }

  setTension(on) {
    this.tension = !!on;
    if (this.music) { try { this.music.setTension(this.tension); } catch { /* ничего */ } }
  }

  play(name, vol = 1, pan = 0) {
    const c = this.ctx;
    if (!c || !this.on || (c.state !== 'running' && !this.offline)) return;
    const r = SFX[name];
    const list = this.buffers[name];
    if (!r || !list || !list.length) return;
    const now = c.currentTime;
    if (now - (this.lastPlay[name] ?? -9) < r.min) return; // не забиваем канал одинаковыми звуками
    if ((this.activeBy[name] || 0) >= r.max) return;
    if (this.active >= MAX_VOICES && !r.imp) return;
    this.lastPlay[name] = now;
    let i = (Math.random() * list.length) | 0;
    if (list.length > 1 && i === this.lastVar[name]) i = (i + 1) % list.length;
    this.lastVar[name] = i;
    const v = Number.isFinite(vol) ? Math.max(0, Math.min(2, vol)) : 1;
    try {
      this.active++;
      this.activeBy[name] = (this.activeBy[name] || 0) + 1;
      this._voice(list[i], now, r.gain * v, Number.isFinite(pan) ? pan : 0, this.sfxBus, r.send, r.rate ? 1 + (Math.random() * 2 - 1) * 0.06 : 1,
        () => { this.active--; this.activeBy[name]--; });
      if (r.duck) this._duck(now, r.duck);
    } catch {
      this.active--; this.activeBy[name]--;
    }
  }

  // Приглушить музыку на время крупного стингера (рог, победа и т. п.).
  _duck(t, dur) {
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(this.musicLevel * 0.45, t, 0.08);
    g.setTargetAtTime(this.musicLevel, t + dur, 0.6);
  }
}
