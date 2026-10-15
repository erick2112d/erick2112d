// Звук без файлов: короткие синтезированные эффекты и тихий фон.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.on = true;
    this.suspendedBy = new Set();
    this.lastPlay = {};
    try { this.on = localStorage.getItem('lastlight.sound') !== 'off'; } catch { /* нет хранилища */ }
  }

  // AudioContext создаётся только после первого действия игрока (требование браузеров).
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.suspendedBy.size) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.55 : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('lastlight.sound', this.on ? 'on' : 'off'); } catch { /* нет хранилища */ }
    if (this.master) this.master.gain.value = this.on ? 0.55 : 0;
  }

  // Пауза звука (скрытая вкладка, реклама) — по требованиям Яндекс Игр.
  suspend(reason) {
    this.suspendedBy.add(reason);
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume(reason) {
    this.suspendedBy.delete(reason);
    if (this.ctx && !this.suspendedBy.size && this.ctx.state === 'suspended') this.ctx.resume();
  }

  startAmbient() {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0.05;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    f.connect(g);
    g.connect(this.master);
    for (const [freq, det] of [[55, 0], [82.4, 4], [110, -6]]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start();
    }
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.07;
    lg.gain.value = 250;
    lfo.connect(lg);
    lg.connect(f.frequency);
    lfo.start();
    this.ambientFilter = f;
  }

  setTension(on) {
    if (!this.ambientFilter) return;
    this.ambientFilter.frequency.setTargetAtTime(on ? 900 : 500, this.ctx.currentTime, 1.5);
  }

  tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hiss(dur, vol = 0.2, freq = 1200, q = 1, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(name, vol = 1) {
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.04) return; // не забиваем канал
    this.lastPlay[name] = now;
    const v = vol;
    switch (name) {
      case 'chop': this.hiss(0.08, 0.35 * v, 900, 3); this.tone(180, 0.08, 'triangle', 0.2 * v, -60); break;
      case 'rock': this.hiss(0.07, 0.3 * v, 2500, 4); this.tone(300, 0.06, 'square', 0.08 * v, -100); break;
      case 'swing': this.hiss(0.14, 0.18 * v, 3000, 0.8); break;
      case 'bow': this.tone(700, 0.08, 'triangle', 0.12 * v, -400); this.hiss(0.05, 0.08 * v, 4000, 2); break;
      case 'fire': this.hiss(0.25, 0.2 * v, 600, 0.7); this.tone(220, 0.2, 'sawtooth', 0.06 * v, 200); break;
      case 'boom': this.hiss(0.4, 0.35 * v, 300, 0.6); this.tone(90, 0.35, 'sine', 0.3 * v, -50); break;
      case 'hit': this.tone(260, 0.06, 'square', 0.08 * v, -120); break;
      case 'thud': this.tone(110, 0.1, 'sine', 0.2 * v, -40); break;
      case 'bones': this.hiss(0.12, 0.2 * v, 1800, 6); this.tone(520, 0.05, 'square', 0.06 * v, -200); this.tone(420, 0.05, 'square', 0.05 * v, -200, 0.05); break;
      case 'bossDie': this.tone(120, 1.2, 'sawtooth', 0.25, -90); this.hiss(1, 0.3, 400, 0.5); break;
      case 'collapse': this.hiss(0.6, 0.35 * v, 250, 0.5); this.tone(70, 0.5, 'sine', 0.3 * v, -30); break;
      case 'build': [392, 523, 659].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, 0, i * 0.06)); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.13, 0, i * 0.07)); break;
      case 'heroDown': this.tone(330, 0.5, 'triangle', 0.2, -200); break;
      case 'respawn': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.14, 0, i * 0.08)); break;
      case 'horn': this.tone(147, 1.1, 'sawtooth', 0.12, 0); this.tone(220, 1.1, 'sawtooth', 0.08, 0, 0.05); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, 0, i * 0.11)); break;
      case 'defeat': [392, 311, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, 0, i * 0.2)); break;
      case 'beacon': [262, 392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.12, 0, i * 0.12)); break;
      case 'click': this.tone(880, 0.03, 'square', 0.04); break;
      default:
    }
  }
}
