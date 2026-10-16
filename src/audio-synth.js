// Синтез звуков: чистые функции над Float32Array, без WebAudio.
// Работают в фоновом потоке (audio-worker.js), чтобы расчёт звука не тормозил кадры игры,
// а при недоступности воркера — на основном потоке.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- DSP-примитивы (работают с Float32Array, без WebAudio) ----------

class BQ {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; }
  set(type, f, q, sr) {
    const w = TAU * Math.min(Math.max(f, 10), sr * 0.45) / sr;
    const cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // полосовой, 0 дБ в пике
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * cs / a0; this.a2 = (1 - al) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const buf = (sr, sec) => new Float32Array(Math.max(1, Math.ceil(sr * sec)));
const envAD = (a, d) => (t) => (t < a ? t / a : Math.exp(-(t - a) / d));
// колоколообразная огибающая: рост до доли pk длительности, затем спад
const swell = (dur, pk, p1 = 2, p2 = 1.5) => (t) => {
  const u = t / dur;
  if (u >= 1) return 0;
  return u < pk ? Math.pow(u / pk, p1) : Math.pow(1 - (u - pk) / (1 - pk), p2);
};
// рваная огибающая (искры, хруст бумаги): случайные включения с общим спадом
function gate(dur, decay, rLo, rHi, on = 0.6) {
  const segs = [];
  for (let t = 0; t < dur; t += 1 / rand(rLo, rHi)) segs.push(t, Math.random() < on ? rand(0.35, 1) : 0.05);
  let k = 0;
  return (t) => {
    while (k + 2 < segs.length && segs[k + 2] <= t) k += 2;
    return segs[k + 1] * Math.exp(-t / decay);
  };
}

// Фильтрованный шум (белый/розовый/коричневый) с огибающей и, при желании, плавающей частотой фильтра.
function noise(o, sr, p) {
  const at = p.at || 0, amp = p.amp ?? 1, env = p.env || (() => 1);
  const type = p.type || 'bp', q = p.q ?? 0.7, f = p.f ?? 1000, color = p.color || 'white';
  const i0 = Math.floor(at * sr), n = Math.min(Math.floor(p.dur * sr), o.length - i0);
  if (n <= 0) return;
  const fFn = typeof f === 'function' ? f : null;
  const fs = [];
  for (let s = 0; s < (p.stages || 1); s++) { const b = new BQ(); b.set(type, fFn ? fFn(0) : f, q, sr); fs.push(b); }
  let p0 = 0, p1 = 0, p2 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (fFn && (i & 15) === 0 && i) { const ff = fFn(t); for (const b of fs) b.set(type, ff, q, sr); }
    let w = Math.random() * 2 - 1;
    if (color === 'pink') { p0 = 0.99765 * p0 + w * 0.099046; p1 = 0.963 * p1 + w * 0.2965164; p2 = 0.57 * p2 + w * 1.0526913; w = (p0 + p1 + p2 + w * 0.1848) * 0.22; }
    else if (color === 'brown') { br = (br + 0.02 * w) / 1.02; w = br * 3.5; }
    for (let s = 0; s < fs.length; s++) w = fs[s].run(w);
    o[i0 + i] += amp * env(t) * w;
  }
}

// Модальный синтез: сумма затухающих синусоид (рекурсивный резонатор, без Math.sin в цикле).
// list: [частота, амплитуда, постоянная затухания в секундах]
function modes(o, sr, at, list, amp = 1, attack = 0.0008) {
  const i0 = Math.floor(at * sr), na = Math.max(1, attack * sr);
  for (const [f, a, dec] of list) {
    if (f >= sr * 0.45 || f <= 0) continue;
    const w = TAU * f / sr, r = Math.exp(-1 / (dec * sr)), c = 2 * r * Math.cos(w), r2 = r * r;
    const n = Math.min(o.length - i0, Math.ceil(dec * sr * 7));
    let cur = 0, next = a * amp * r * Math.sin(w);
    for (let k = 0; k < n; k++) {
      o[i0 + k] += k < na ? cur * k / na : cur;
      const nn = c * next - r2 * cur; cur = next; next = nn;
    }
  }
}

// То же, но резонаторы возбуждаются произвольным сигналом (скрип, трение).
function resonate(o, sr, at, ex, list) {
  const i0 = Math.floor(at * sr);
  for (const [f, a, dec] of list) {
    const w = TAU * f / sr, r = Math.exp(-1 / (dec * sr)), c = 2 * r * Math.cos(w), r2 = r * r, g = a * (1 - r);
    const n = Math.min(o.length - i0, ex.length + Math.ceil(dec * sr * 7));
    let y1 = 0, y2 = 0;
    for (let k = 0; k < n; k++) {
      const y = (k < ex.length ? ex[k] * g : 0) + c * y1 - r2 * y2;
      y2 = y1; y1 = y; o[i0 + k] += y;
    }
  }
}

// Низкое «тело» удара: синус с падением высоты.
function thump(o, sr, at, f0, f1, amp, dec, pdec = 0.03, attack = 0.002) {
  const i0 = Math.floor(at * sr), n = Math.min(o.length - i0, Math.ceil(dec * sr * 7)), na = Math.max(1, attack * sr);
  const da = Math.exp(-1 / (dec * sr)), dp = Math.exp(-1 / (pdec * sr)), k0 = TAU / sr;
  let ph = 0, e = amp, pf = f0 - f1;
  for (let k = 0; k < n; k++) {
    ph += k0 * (f1 + pf);
    o[i0 + k] += (k < na ? k / na : 1) * e * Math.sin(ph);
    e *= da; pf *= dp;
  }
}

// Щипковая струна Карплуса — Стронга с дробной задержкой (всепропускающий фильтр) и позицией щипка.
function pluck(o, sr, at, f, amp, { t60 = 1.5, bright = 0.6, pos = 0.15, soft = 0.4 } = {}) {
  const i0 = Math.floor(at * sr), n = Math.min(o.length - i0, Math.ceil(t60 * sr * 1.1));
  const total = sr / f - (1 - bright);
  let L = Math.floor(total), frac = total - L;
  if (frac < 0.2) { L -= 1; frac += 1; }
  if (n <= 0 || L < 2) return;
  const C = (1 - frac) / (1 + frac);
  const ex = new Float32Array(L), d = new Float32Array(L);
  let lp = 0, mean = 0, peak = 0;
  for (let k = 0; k < L; k++) { lp += (1 - soft) * (Math.random() * 2 - 1 - lp); ex[k] = lp; mean += lp; }
  mean /= L;
  const pk = Math.max(1, Math.round(pos * L));
  for (let k = 0; k < L; k++) { d[k] = ex[k] - mean - (k >= pk ? ex[k - pk] - mean : 0); peak = Math.max(peak, Math.abs(d[k])); }
  for (let k = 0; k < L; k++) d[k] /= peak || 1;
  const g = Math.pow(10, -3 / (f * t60));
  let idx = 0, x1 = 0, apx = 0, apy = 0, dcx = 0, dcy = 0;
  for (let k = 0; k < n; k++) {
    const x = d[idx];
    const lpv = g * (bright * x + (1 - bright) * x1); x1 = x;
    const ap = C * lpv + apx - C * apy; apx = lpv; apy = ap;
    d[idx] = ap; idx = idx + 1 === L ? 0 : idx + 1;
    const y = x - dcx + 0.995 * dcy; dcx = x; dcy = y;
    const tail = n - k < 400 ? (n - k) / 400 : 1;
    o[i0 + k] += amp * y * tail;
  }
}

// Мягкий FM-колокол: несущая + неагармоничный модулятор с затухающим индексом + обертон 2.76.
// Модулятор и обертон — рекурсивные осцилляторы, затухания — умножением (дёшево).
function bell(o, sr, at, f, amp, { ratio = 3.5, index = 1.2, idecay = 0.2, decay = 0.8, attack = 0.002, part = 0.2 } = {}) {
  const i0 = Math.floor(at * sr), n = Math.min(o.length - i0, Math.ceil(decay * sr * 7));
  const w = TAU * f / sr, wm = w * ratio, w2 = w * 2.76, na = Math.max(1, attack * sr);
  const pa = f * 2.76 * 1.2 < sr * 0.45 ? part : 0;
  const cm = 2 * Math.cos(wm), c2 = 2 * Math.cos(w2);
  let m0 = 0, m1 = Math.sin(wm), q0 = 0, q1 = Math.sin(w2);
  let e = amp, I = index, pe = pa;
  const de = Math.exp(-1 / (decay * sr)), di = Math.exp(-1 / (idecay * sr)), dp = Math.exp(-1 / (decay * 0.35 * sr));
  for (let k = 0; k < n; k++) {
    o[i0 + k] += (k < na ? k / na : 1) * e * (Math.sin(w * k + I * m0) + pe * q0);
    const mn = cm * m1 - m0; m0 = m1; m1 = mn;
    const qn = c2 * q1 - q0; q0 = q1; q1 = qn;
    e *= de; I *= di; pe *= dp;
  }
}

// Мягкий тон-подклад (аддитивный, с лёгким вибрато) для подкладок в стингерах.
// Гармоники — рекуррентой Чебышёва: один sin и один cos на отсчёт.
function padTone(o, sr, at, f, dur, amp, { attack = 0.5, release = 0.6, harm = [1, 0.35, 0.12], vib = 0.003, trem = 0 } = {}) {
  const i0 = Math.floor(at * sr), n = Math.min(o.length - i0, Math.ceil((dur + release * 5) * sr));
  const na = attack * sr, nd = dur * sr, dr = Math.exp(-1 / (release * sr)), H = harm.length;
  const wv = TAU * 4.6 / sr, wt = TAU * 5.5 / sr, cv = 2 * Math.cos(wv), ct = 2 * Math.cos(wt);
  let v0 = 0, v1 = Math.sin(wv), u0 = 0, u1 = Math.sin(wt), rel = 1, ph = 0;
  const w = TAU * f / sr;
  for (let k = 0; k < n; k++) {
    let e = k < na ? 0.5 - 0.5 * Math.cos(Math.PI * k / na) : 1;
    if (k > nd) { rel *= dr; e *= rel; }
    if (trem) e *= 1 - trem * (0.5 + 0.5 * u0);
    ph += w * (1 + vib * v0);
    const s1 = Math.sin(ph), c = 2 * Math.cos(ph);
    let sp = 0, sc = s1, s = harm[0] * s1;
    for (let h = 1; h < H; h++) { const sn = c * sc - sp; sp = sc; sc = sn; s += harm[h] * sc; }
    o[i0 + k] += amp * e * s;
    const vn = cv * v1 - v0; v0 = v1; v1 = vn;
    const un = ct * u1 - u0; u0 = u1; u1 = un;
  }
}

// Боевой рог: аддитивная «медь» — яркость растёт с громкостью, подъезд высоты в атаке, вибрато, дыхание.
// Управляющие величины пересчитываются раз в 16 отсчётов, гармоники — рекуррентой Чебышёва.
function horn(o, sr, at, f, dur, amp, { bmax = 4, vib = 0.011 } = {}) {
  const i0 = Math.floor(at * sr), rel = 0.16, n = Math.min(o.length - i0, Math.ceil((dur + rel * 5) * sr));
  const H = Math.max(2, Math.min(Math.floor(4200 / f), Math.ceil(2 + 5.8 * (0.5 + bmax))));
  const tilt = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) tilt[h] = 1 / Math.pow(h, 0.55);
  let ph = 0, L = 0, rho = 0, dph = 0;
  for (let k = 0; k < n; k++) {
    if ((k & 15) === 0) {
      const t = k / sr;
      L = t < 0.16 ? Math.sin(0.5 * Math.PI * t / 0.16) : 1;
      L *= 0.85 + 0.15 * Math.min(1, t / 0.9);
      if (t > dur) L *= Math.exp(-(t - dur) / rel);
      const va = vib * Math.min(1, Math.max(0, (t - 0.3) / 0.5));
      dph = TAU * f * (1 - 0.035 * Math.exp(-t / 0.05)) * (1 + va * Math.sin(TAU * 5.2 * t)) / sr;
      rho = Math.exp(-1 / (0.5 + bmax * L * L));
    }
    ph += dph;
    if (ph > TAU) ph -= TAU;
    const s1 = Math.sin(ph), c2 = 2 * Math.cos(ph);
    let sp = 0, sc = s1, a = 1, sum = s1;
    for (let h = 2; h <= H; h++) { const sn = c2 * sc - sp; sp = sc; sc = sn; a *= rho; sum += a * tilt[h] * sc; }
    o[i0 + k] += amp * L * sum;
  }
  noise(o, sr, { at, dur: dur + 0.3, amp: amp * 0.06, color: 'pink', env: (t) => (t < 0.1 ? t / 0.1 : 1) * (t > dur ? Math.exp(-(t - dur) / rel) : 1), type: 'bp', f: f * 6, q: 1.2 });
}

// Россыпь мелких зёрен шума (треск огня, щепки, гравий).
function grains(o, sr, at, dur, count, amp, fLo, fHi, glen = 0.005, dist = (u) => u) {
  for (let j = 0; j < count; j++) {
    const t = at + dur * dist(Math.random()), g = glen * rand(0.5, 1.5);
    noise(o, sr, { at: t, dur: g * 6, amp: amp * rand(0.3, 1), env: envAD(0.0004, g), type: 'bp', f: rand(fLo, fHi), q: 1.4 });
  }
}

function filter(o, sr, type, f, q = 0.707) { const b = new BQ(); b.set(type, f, q, sr); for (let i = 0; i < o.length; i++) o[i] = b.run(o[i]); }
function sat(o, drive) { const k = Math.tanh(drive); for (let i = 0; i < o.length; i++) o[i] = Math.tanh(o[i] * drive) / k; }

// Убрать постоянку, нормировать пик, отрезать тишину в хвосте, мягко погасить конец.
function finish(o, sr, peak = 0.9) {
  let x1 = 0, y1 = 0, m = 0;
  const R = 1 - TAU * 20 / sr;
  for (let i = 0; i < o.length; i++) { const y = o[i] - x1 + R * y1; x1 = o[i]; y1 = y; o[i] = y; if (Math.abs(y) > m) m = Math.abs(y); }
  if (!(m > 0)) return o;
  const k = peak / m, thr = m * 0.0006;
  let end = o.length;
  while (end > 1 && Math.abs(o[end - 1]) < thr) end--;
  end = Math.min(o.length, end + Math.floor(sr * 0.01));
  const out = end < o.length ? o.subarray(0, end) : o;
  const fade = Math.min(Math.floor(sr * 0.01), out.length);
  for (let i = 0; i < out.length; i++) out[i] *= k * (i >= out.length - fade ? (out.length - i) / fade : 1);
  return out;
}

// ---------- Составные «звуки-кирпичики» ----------

function woodKnock(o, sr, at, amp, k = 1) {
  thump(o, sr, at, 200 * k, 100 * k, 0.9 * amp, 0.05, 0.015);
  modes(o, sr, at, [[230 * k, 0.6, 0.06], [480 * k, 0.45, 0.045], [820 * k, 0.3, 0.03], [1290 * k, 0.16, 0.02], [1980 * k, 0.08, 0.012]], amp);
  noise(o, sr, { at, dur: 0.03, amp: 0.8 * amp, env: envAD(0.0008, 0.007), type: 'bp', f: 1700 * k, q: 0.9 });
}
function coinHit(o, sr, at, amp) {
  const f = rand(1900, 2500);
  modes(o, sr, at, [[f, 0.5, 0.2], [f * 1.47, 0.35, 0.15], [f * 2.09, 0.24, 0.1], [f * 2.56, 0.16, 0.08], [f * 3.4, 0.08, 0.05]], amp, 0.0005);
  noise(o, sr, { at, dur: 0.005, amp: 0.25 * amp, env: envAD(0.0002, 0.001), type: 'hp', f: 4000 });
}
function boneClick(o, sr, at, amp) {
  const f = rand(850, 1700);
  modes(o, sr, at, [[f, 0.5, rand(0.015, 0.03)], [f * rand(2.2, 2.6), 0.3, 0.014], [f * rand(3.8, 4.4), 0.14, 0.009]], amp, 0.0004);
  noise(o, sr, { at, dur: 0.012, amp: 0.25 * amp, env: envAD(0.0003, 0.003), type: 'bp', f: f * 2, q: 1 });
}
function bonk(o, sr, at, f, amp) {
  thump(o, sr, at, f * 1.12, f, amp, 0.08, 0.012, 0.004);
  modes(o, sr, at, [[f * 2.4, 0.14 * amp, 0.035], [f * 4.1, 0.05 * amp, 0.018]], 1, 0.003);
}
function bones(o, sr, at, n, amp) {
  let t = at, gap = rand(0.06, 0.1), a = amp;
  for (let j = 0; j < n; j++) {
    boneClick(o, sr, t, a);
    if (Math.random() < 0.35) boneClick(o, sr, t + rand(0.005, 0.02), a * 0.6);
    t += gap * rand(0.5, 1.2); gap *= 0.86; a *= 0.84;
  }
}
const LUTE = { t60: 1.3, bright: 0.68, pos: 0.13, soft: 0.25 };
const HARP = { t60: 2.4, bright: 0.58, pos: 0.27, soft: 0.35 };
const GLASS = { ratio: 3.5, index: 0.9, idecay: 0.06, decay: 0.5, part: 0.15 };
const WARM_BELL = { ratio: 1.41, index: 1.6, idecay: 0.35, decay: 1.1, part: 0.25 };

// ---------- Рецепты эффектов ----------
// v — число вариаций, gain — громкость, send — уровень реверберации (0..3), rate — случайный ±6% питч,
// min — минимальный интервал повтора (с), max — одновременных голосов этого имени, imp — важный (мимо лимита голосов)

const SFX = {
  click: { v: 3, gain: 0.22, send: 0, rate: 1, min: 0.03, max: 3, r(sr) {
    const o = buf(sr, 0.1), f = rand(950, 1150);
    modes(o, sr, 0, [[f, 0.5, 0.012], [f * 2.3, 0.22, 0.007], [f * 0.55, 0.35, 0.014]], 1, 0.0006);
    noise(o, sr, { dur: 0.006, amp: 0.12, env: envAD(0.0003, 0.0015), type: 'bp', f: f * 1.6 });
    filter(o, sr, 'lp', 5000);
    return o;
  } },
  chop: { v: 4, gain: 0.5, send: 1, rate: 1, min: 0.05, max: 4, r(sr, i) {
    const o = buf(sr, 0.5), k = rand(0.9, 1.08);
    woodKnock(o, sr, 0, 1, k * 0.85);
    noise(o, sr, { dur: 0.01, amp: 0.35, env: envAD(0.0003, 0.002), type: 'hp', f: 3000 });
    grains(o, sr, 0.03, 0.16, 2 + (i % 3), 0.12, 1200, 3500);
    return o;
  } },
  rock: { v: 4, gain: 0.45, send: 1, rate: 1, min: 0.05, max: 4, r(sr, i) {
    const o = buf(sr, 0.5), k = rand(0.93, 1.07);
    modes(o, sr, 0, [[2150 * k, 0.3, 0.05], [3420 * k, 0.22, 0.04], [4870 * k, 0.12, 0.028], [6200 * k, 0.06, 0.018]], 1, 0.0008);
    modes(o, sr, 0, [[520 * k, 0.4, 0.03], [880 * k, 0.35, 0.025], [1340 * k, 0.25, 0.02]]);
    thump(o, sr, 0, 240 * k, 120 * k, 0.5, 0.035, 0.01);
    noise(o, sr, { dur: 0.05, amp: 0.8, env: envAD(0.0005, 0.01), type: 'bp', f: 1100 * k, q: 0.8 });
    grains(o, sr, 0.02, 0.24, 4 + (i % 4), 0.2, 1500, 4200, 0.006, (u) => u * u);
    filter(o, sr, 'lp', 7000);
    return o;
  } },
  swing: { v: 4, gain: 0.32, send: 1, rate: 1, min: 0.05, max: 3, r(sr) {
    const d = rand(0.19, 0.27), o = buf(sr, d + 0.05), pk = rand(0.35, 0.5), fc = rand(800, 1300), env = swell(d, pk, 2, 1.6);
    noise(o, sr, { dur: d, amp: 1, color: 'pink', env, type: 'bp', f: (t) => fc * (0.45 + 1.1 * Math.sin(Math.PI * Math.min(1, t / d * 1.1))), q: 1.1 });
    noise(o, sr, { dur: d, amp: 0.18, env, type: 'hp', f: 3200 });
    return o;
  } },
  bow: { v: 4, gain: 0.4, send: 1, rate: 1, min: 0.045, max: 5, r(sr) {
    const o = buf(sr, 0.5), k = rand(0.92, 1.08);
    pluck(o, sr, 0, 112 * k, 0.8, { t60: 0.3, bright: 0.8, pos: 0.18, soft: 0.2 });
    thump(o, sr, 0, 210 * k, 100 * k, 0.45, 0.03, 0.01);
    noise(o, sr, { at: 0.005, dur: 0.2, amp: 0.5, env: envAD(0.012, 0.05), type: 'bp', f: (t) => 2200 * Math.exp(-t * 9) + 500, q: 1.2 });
    noise(o, sr, { dur: 0.006, amp: 0.3, env: envAD(0.0003, 0.0015), type: 'hp', f: 2500 });
    return o;
  } },
  hit: { v: 4, gain: 0.45, send: 1, rate: 1, min: 0.04, max: 5, r(sr, i) {
    const o = buf(sr, 0.3), k = rand(0.9, 1.1);
    thump(o, sr, 0, 230 * k, 110 * k, 0.8, 0.045, 0.012);
    noise(o, sr, { dur: 0.07, amp: 0.9, color: 'pink', env: envAD(0.0008, 0.012), type: 'lp', f: 2600 * k, q: 0.6 });
    modes(o, sr, 0, [[340 * k, 0.3, 0.03], [610 * k, 0.2, 0.02]]);
    if (i % 2) modes(o, sr, 0.002, [[1850 * k, 0.12, 0.06], [2930 * k, 0.09, 0.05], [4100 * k, 0.05, 0.035]]);
    sat(o, 1.4);
    return o;
  } },
  hurt: { v: 3, gain: 0.5, send: 1, rate: 1, min: 0.08, max: 2, r(sr) {
    const o = buf(sr, 0.35), k = rand(0.9, 1.1);
    thump(o, sr, 0, 170 * k, 75 * k, 0.9, 0.07, 0.015);
    noise(o, sr, { dur: 0.09, amp: 0.7, color: 'pink', env: envAD(0.001, 0.02), type: 'lp', f: 1400 });
    modes(o, sr, 0.005, [[1500 * k, 0.08, 0.08], [2380 * k, 0.06, 0.06], [3600 * k, 0.04, 0.04]]);
    sat(o, 1.5);
    return o;
  } },
  thud: { v: 3, gain: 0.55, send: 1, rate: 1, min: 0.06, max: 4, r(sr) {
    const o = buf(sr, 0.7), k = rand(0.92, 1.08);
    thump(o, sr, 0, 105 * k, 48 * k, 1, 0.15, 0.04, 0.003);
    noise(o, sr, { dur: 0.14, amp: 0.7, color: 'brown', env: envAD(0.002, 0.04), type: 'lp', f: 600 });
    modes(o, sr, 0, [[130 * k, 0.4, 0.09], [275 * k, 0.3, 0.06], [470 * k, 0.15, 0.035]]);
    noise(o, sr, { dur: 0.02, amp: 0.25, env: envAD(0.0005, 0.005), type: 'bp', f: 1500, q: 0.8 });
    return o;
  } },
  bones: { v: 4, gain: 0.42, send: 1, rate: 1, min: 0.06, max: 4, r(sr, i) {
    const o = buf(sr, 0.9);
    thump(o, sr, 0, 180, 90, 0.35, 0.04, 0.01);
    bones(o, sr, 0.005, 6 + (i % 3) * 2, 1);
    noise(o, sr, { dur: 0.3, amp: 0.15, color: 'pink', env: envAD(0.005, 0.08), type: 'bp', f: 900 });
    return o;
  } },
  coin: { v: 4, gain: 0.26, send: 2, rate: 1, min: 0.06, max: 3, r(sr, i) {
    const o = buf(sr, 0.6);
    coinHit(o, sr, 0, 1);
    if (i % 2) coinHit(o, sr, rand(0.05, 0.09), 0.55);
    filter(o, sr, 'lp', 8500);
    return o;
  } },
  fire: { v: 3, gain: 0.45, send: 2, rate: 1, min: 0.06, max: 4, r(sr) {
    const o = buf(sr, 0.9);
    noise(o, sr, { dur: 0.75, amp: 1, color: 'pink', env: envAD(0.05, 0.17), type: 'lp', f: (t) => 300 + 2600 * Math.exp(-Math.pow((t - 0.08) / 0.12, 2)), q: 0.8 });
    thump(o, sr, 0, 120, 60, 0.4, 0.12, 0.06, 0.02);
    grains(o, sr, 0.02, 0.6, 12 + ((Math.random() * 6) | 0), 0.4, 1800, 6000, 0.003, (u) => u * u);
    return o;
  } },
  boom: { v: 3, gain: 0.7, send: 2, rate: 1, min: 0.08, max: 2, r(sr) {
    const o = buf(sr, 1.8), k = rand(0.9, 1.1);
    noise(o, sr, { dur: 0.015, amp: 0.7, env: envAD(0.0005, 0.004), type: 'lp', f: 5000 });
    thump(o, sr, 0, 95 * k, 38 * k, 1, 0.33, 0.06, 0.003);
    noise(o, sr, { dur: 1.6, amp: 1.1, color: 'brown', env: envAD(0.01, 0.38), type: 'lp', f: (t) => 140 + 900 * Math.exp(-t * 5), q: 0.7, stages: 2 });
    grains(o, sr, 0.05, 0.9, 18, 0.2, 700, 3500, 0.006, (u) => u * u);
    sat(o, 1.6);
    return o;
  } },
  zap: { v: 3, gain: 0.42, send: 2, rate: 1, min: 0.06, max: 3, r(sr) {
    const o = buf(sr, 0.8);
    noise(o, sr, { dur: 0.32, amp: 0.8, env: gate(0.32, 0.1, 40, 140), type: 'bp', f: 3000, q: 0.6 });
    noise(o, sr, { dur: 0.008, amp: 0.8, env: envAD(0.0003, 0.002), type: 'hp', f: 2000 });
    thump(o, sr, 0.01, 90, 45, 0.45, 0.14, 0.05);
    noise(o, sr, { at: 0.01, dur: 0.6, amp: 0.7, color: 'brown', env: envAD(0.01, 0.18), type: 'lp', f: 260 });
    filter(o, sr, 'lp', 8000);
    return o;
  } },
  ice: { v: 3, gain: 0.38, send: 3, rate: 1, min: 0.06, max: 3, r(sr) {
    const o = buf(sr, 1.0);
    [88, 95, 100].forEach((m, j) => bell(o, sr, j * rand(0.02, 0.04), hz(m) * rand(0.995, 1.005), 0.32 - j * 0.06, GLASS));
    noise(o, sr, { dur: 0.35, amp: 0.45, env: envAD(0.01, 0.09), type: 'hp', f: 5000 });
    modes(o, sr, 0, [[3100, 0.25, 0.02], [5300, 0.15, 0.015]]);
    filter(o, sr, 'lp', 10000);
    return o;
  } },
  summon: { v: 2, gain: 0.5, send: 3, rate: 1, min: 0.2, max: 2, *r(sr) {
    const o = buf(sr, 2.0);
    noise(o, sr, { dur: 1.3, amp: 0.9, color: 'pink', env: swell(1.3, 0.75, 2, 3), type: 'bp', f: (t) => 180 + 900 * t / 1.3, q: 2.2 });
    yield;
    padTone(o, sr, 0, 73.4, 1.0, 0.45, { attack: 0.6, release: 0.3, harm: [1, 0.5, 0.3, 0.15], trem: 0.4 });
    yield;
    padTone(o, sr, 0.1, 103.8, 0.9, 0.2, { attack: 0.6, release: 0.3, harm: [1, 0.4, 0.2] });
    bell(o, sr, 0.6, hz(75), 0.1, { ...WARM_BELL, index: 2, decay: 0.6 });
    return o;
  } },
  collapse: { v: 2, gain: 0.62, send: 2, rate: 1, min: 0.15, max: 2, imp: 1, r(sr) {
    const o = buf(sr, 2.0);
    thump(o, sr, 0, 85, 40, 0.9, 0.25, 0.06);
    noise(o, sr, { dur: 1.7, amp: 1, color: 'brown', env: (t) => (t < 0.03 ? t / 0.03 : 1) * Math.exp(-t / 0.5), type: 'lp', f: (t) => 180 + 1100 * Math.exp(-t * 2.2), q: 0.6, stages: 2 });
    for (let j = 0; j < 7; j++) woodKnock(o, sr, rand(0, 0.9) * (j / 7), rand(0.3, 0.8) * (1 - j / 10), rand(0.6, 1.4));
    grains(o, sr, 0.05, 1.3, 40, 0.22, 600, 3000, 0.008, (u) => Math.pow(u, 1.5));
    sat(o, 1.3);
    return o;
  } },
  demolish: { v: 2, gain: 0.5, send: 2, rate: 1, min: 0.15, max: 2, imp: 1, r(sr) {
    const o = buf(sr, 1.2);
    thump(o, sr, 0, 120, 60, 0.5, 0.12, 0.04);
    noise(o, sr, { dur: 1.0, amp: 0.6, color: 'brown', env: (t) => (t < 0.02 ? t / 0.02 : 1) * Math.exp(-t / 0.28), type: 'lp', f: (t) => 250 + 1200 * Math.exp(-t * 3), q: 0.6 });
    for (let j = 0; j < 4; j++) woodKnock(o, sr, j * rand(0.07, 0.14), 0.6 - j * 0.1, rand(0.8, 1.5));
    grains(o, sr, 0.04, 0.7, 22, 0.18, 800, 3200, 0.007, (u) => Math.pow(u, 1.5));
    return o;
  } },
  build: { v: 2, gain: 0.5, send: 2, min: 0.12, max: 2, imp: 1, r(sr) {
    const o = buf(sr, 2.0);
    woodKnock(o, sr, 0, 1, 1.1);
    woodKnock(o, sr, 0.13, 0.75, 1.15);
    [62, 69, 74].forEach((m, j) => pluck(o, sr, 0.28 + j * 0.08, hz(m), 0.32, LUTE));
    return o;
  } },
  upgrade: { v: 1, gain: 0.5, send: 2, min: 0.2, max: 2, imp: 1, r(sr) {
    const o = buf(sr, 2.6);
    [62, 65, 69, 74, 76].forEach((m, j) => pluck(o, sr, j * 0.085, hz(m), 0.32, HARP));
    bell(o, sr, 0.43, hz(81), 0.12, WARM_BELL);
    return o;
  } },
  equip: { v: 2, gain: 0.36, send: 2, rate: 1, min: 0.1, max: 2, r(sr) {
    const o = buf(sr, 1.0), f = rand(1150, 1300);
    noise(o, sr, { dur: 0.18, amp: 0.5, env: swell(0.18, 0.6), type: 'bp', f: (t) => 3000 + 3000 * t / 0.18, q: 3 });
    modes(o, sr, 0.13, [[f, 0.3, 0.32], [f * 2.32, 0.22, 0.24], [f * 3.89, 0.15, 0.17], [f * 5.4, 0.08, 0.11]], 1, 0.002);
    filter(o, sr, 'lp', 8500);
    return o;
  } },
  gem: { v: 2, gain: 0.36, send: 3, min: 0.08, max: 2, r(sr) {
    const o = buf(sr, 1.4), s = rand(0, 1) < 0.5 ? 0 : 2;
    [88 + s, 95 + s, 100 + s].forEach((m, j) => bell(o, sr, j * 0.07, hz(m), 0.32 - j * 0.07, { ...GLASS, decay: 0.6 }));
    noise(o, sr, { dur: 0.5, amp: 0.06, env: swell(0.5, 0.3), type: 'hp', f: 6000 });
    return o;
  } },
  chest: { v: 1, gain: 0.5, send: 2, min: 0.2, max: 2, imp: 1, r(sr) {
    const o = buf(sr, 2.0), ex = buf(sr, 0.3);
    for (let t = 0, j = 0; t < 0.28; t += 1 / (65 + 45 * Math.sin(t * 22)), j++) ex[Math.floor(t * sr)] = Math.sin(Math.PI * t / 0.28) * rand(0.5, 1);
    resonate(o, sr, 0, ex, [[420, 1, 0.012], [930, 0.7, 0.01], [1650, 0.4, 0.008]]);
    let m = 0;
    for (let i = 0; i < o.length; i++) m = Math.max(m, Math.abs(o[i]));
    for (let i = 0; i < o.length; i++) o[i] *= 0.35 / (m || 1);
    woodKnock(o, sr, 0.27, 0.35, 1.2);
    [0.3, 0.37, 0.46, 0.52].forEach((t, j) => coinHit(o, sr, t, 0.22 - j * 0.03));
    [81, 86, 88, 93].forEach((mm, j) => bell(o, sr, 0.42 + j * 0.08, hz(mm), 0.13, GLASS));
    return o;
  } },
  page: { v: 2, gain: 0.32, send: 1, min: 0.15, max: 2, r(sr) {
    const o = buf(sr, 0.9);
    noise(o, sr, { dur: 0.36, amp: 0.55, env: gate(0.36, 0.2, 30, 90, 0.7), type: 'bp', f: (t) => 2600 + 1300 * Math.sin(t * 20), q: 0.7 });
    noise(o, sr, { dur: 0.32, amp: 0.4, color: 'pink', env: swell(0.32, 0.4), type: 'bp', f: 900, q: 0.8 });
    bell(o, sr, 0.14, hz(81), 0.06, { ...GLASS, decay: 0.5 });
    return o;
  } },
  open: { v: 2, gain: 0.2, send: 1, min: 0.06, max: 2, r(sr) {
    const o = buf(sr, 0.35);
    noise(o, sr, { dur: 0.2, amp: 1, color: 'pink', env: swell(0.2, 0.55, 2, 2), type: 'bp', f: (t) => 400 + 900 * t / 0.2, q: 0.9 });
    modes(o, sr, 0.17, [[700, 0.22, 0.015], [1600, 0.1, 0.01]]);
    return o;
  } },
  close: { v: 2, gain: 0.15, send: 1, min: 0.06, max: 2, r(sr) {
    const o = buf(sr, 0.3);
    noise(o, sr, { dur: 0.15, amp: 0.9, color: 'pink', env: swell(0.15, 0.4), type: 'bp', f: (t) => 1100 - 600 * t / 0.15, q: 0.9 });
    modes(o, sr, 0.12, [[520, 0.25, 0.015], [1200, 0.1, 0.01]]);
    return o;
  } },
  error: { v: 1, gain: 0.32, send: 1, min: 0.15, max: 1, r(sr) {
    const o = buf(sr, 0.5);
    bonk(o, sr, 0, 196, 0.8);
    bonk(o, sr, 0.12, 147, 0.7);
    filter(o, sr, 'lp', 1800);
    return o;
  } },
  heroDown: { v: 1, gain: 0.55, send: 2, min: 0.3, max: 1, imp: 1, *r(sr) {
    const o = buf(sr, 3.2);
    thump(o, sr, 0, 140, 60, 0.6, 0.12, 0.03);
    noise(o, sr, { dur: 0.25, amp: 0.4, color: 'brown', env: envAD(0.003, 0.07), type: 'lp', f: 700 });
    for (const [t, m] of [[0.15, 69], [0.5, 65], [0.88, 62], [0.88, 50]]) { pluck(o, sr, t, hz(m), 0.3, { ...HARP, t60: 2.2 }); yield; }
    padTone(o, sr, 0.8, hz(38), 1.0, 0.25, { attack: 0.4, release: 0.6 });
    return o;
  } },
  respawn: { v: 1, gain: 0.5, send: 3, min: 0.3, max: 1, imp: 1, *r(sr) {
    const o = buf(sr, 3.0);
    noise(o, sr, { dur: 1.0, amp: 0.3, color: 'pink', env: swell(1.0, 0.7), type: 'bp', f: (t) => 600 + 3000 * t, q: 1.5 });
    padTone(o, sr, 0, hz(62), 0.9, 0.12, { attack: 0.7, release: 0.5 });
    padTone(o, sr, 0, hz(69), 0.9, 0.1, { attack: 0.7, release: 0.5 });
    yield;
    [74, 81, 86].forEach((m, j) => bell(o, sr, 0.55 + j * 0.15, hz(m), 0.2, WARM_BELL));
    return o;
  } },
  horn: { v: 1, gain: 0.6, send: 3, min: 1, max: 1, imp: 1, duck: 2.2, *r(sr) {
    const o = buf(sr, 2.6);
    horn(o, sr, 0, 110, 0.38, 0.5);
    horn(o, sr, 0.003, 110 * 1.004, 0.38, 0.3);
    yield;
    horn(o, sr, 0.48, 146.83, 1.35, 0.55);
    yield;
    horn(o, sr, 0.485, 146.83 * 1.005, 1.35, 0.32);
    yield;
    horn(o, sr, 0.5, 73.4, 1.33, 0.25, { bmax: 2.5 });
    yield;
    filter(o, sr, 'lp', 3200, 0.6);
    sat(o, 1.2);
    return o;
  } },
  victory: { v: 1, gain: 0.55, send: 3, min: 1, max: 1, imp: 1, duck: 2.5, *r(sr) {
    const o = buf(sr, 3.6);
    thump(o, sr, 0, 90, 55, 0.5, 0.25, 0.04);
    [57, 62, 66, 69].forEach((m, j) => pluck(o, sr, j * 0.11, hz(m), 0.3, LUTE));
    thump(o, sr, 0.5, 90, 55, 0.5, 0.3, 0.04);
    yield;
    for (const [j, m] of [62, 66, 69, 74, 78].entries()) { pluck(o, sr, 0.5 + j * 0.028, hz(m), 0.26, HARP); if (j % 2) yield; }
    yield;
    [[0.58, 81], [0.68, 86], [0.82, 90]].forEach(([t, m]) => bell(o, sr, t, hz(m), 0.12, WARM_BELL));
    padTone(o, sr, 0.4, hz(50), 1.6, 0.1, { attack: 0.5, release: 0.7 });
    yield;
    padTone(o, sr, 0.4, hz(57), 1.6, 0.08, { attack: 0.5, release: 0.7 });
    return o;
  } },
  defeat: { v: 1, gain: 0.55, send: 3, min: 1, max: 1, imp: 1, duck: 3, *r(sr) {
    const o = buf(sr, 4.4);
    thump(o, sr, 0, 80, 42, 0.7, 0.4, 0.05);
    for (const [t, m] of [[0, 69], [0.45, 65], [0.9, 64], [1.45, 62], [1.45, 50]]) { pluck(o, sr, t, hz(m), 0.3, { ...HARP, t60: 2.6 }); yield; }
    padTone(o, sr, 0, hz(38), 2.2, 0.2, { attack: 0.8, release: 0.8 });
    yield;
    padTone(o, sr, 0, hz(45), 2.2, 0.12, { attack: 0.8, release: 0.8 });
    yield;
    padTone(o, sr, 0.3, hz(53), 1.9, 0.07, { attack: 0.8, release: 0.8 });
    return o;
  } },
  beacon: { v: 1, gain: 0.55, send: 3, min: 0.5, max: 1, imp: 1, duck: 2.5, *r(sr) {
    const o = buf(sr, 4.0);
    padTone(o, sr, 0, hz(38), 1.8, 0.3, { attack: 0.6, release: 0.7 });
    padTone(o, sr, 0, hz(50), 1.8, 0.12, { attack: 0.6, release: 0.7 });
    yield;
    noise(o, sr, { dur: 1.6, amp: 0.12, color: 'pink', env: swell(1.6, 0.35), type: 'hp', f: 4000 });
    yield;
    [74, 81, 86, 88, 93].forEach((m, j) => bell(o, sr, 0.1 + j * 0.14, hz(m), 0.2 - j * 0.02, j % 2 ? GLASS : WARM_BELL));
    return o;
  } },
  bossDie: { v: 1, gain: 0.72, send: 3, min: 0.5, max: 1, imp: 1, duck: 2.5, *r(sr) {
    const o = buf(sr, 3.4);
    thump(o, sr, 0, 80, 30, 1, 0.55, 0.15, 0.005);
    noise(o, sr, { dur: 2.4, amp: 1, color: 'brown', env: envAD(0.02, 0.6), type: 'lp', f: (t) => 120 + 700 * Math.exp(-t * 2.5), q: 0.7, stages: 2 });
    noise(o, sr, { dur: 1.2, amp: 0.35, color: 'pink', env: envAD(0.06, 0.3), type: 'bp', f: (t) => 420 - 200 * t, q: 4 });
    yield;
    bones(o, sr, 0.2, 10, 0.5);
    [86, 81, 77, 74].forEach((m, j) => bell(o, sr, 0.5 + j * 0.22, hz(m), 0.18, WARM_BELL));
    sat(o, 1.3);
    return o;
  } },
  evolve: { v: 1, gain: 0.6, send: 3, min: 1, max: 1, imp: 1, duck: 3.5, *r(sr) {
    const o = buf(sr, 5.0);
    noise(o, sr, { dur: 2.4, amp: 0.4, color: 'pink', env: swell(2.4, 0.75, 2, 1.2), type: 'bp', f: (t) => 300 + 3700 * Math.pow(Math.min(1, t / 1.8), 2), q: 1.4 });
    for (const m of [50, 57, 62, 66]) { yield; padTone(o, sr, 0, hz(m), 2.6, 0.09, { attack: 1.7, release: 0.9, vib: 0.004 }); }
    yield;
    thump(o, sr, 1.8, 70, 40, 0.6, 0.45, 0.05);
    [74, 78, 81, 86, 90, 93].forEach((m, j) => bell(o, sr, 1.82 + j * 0.1, hz(m), 0.17, j % 2 ? GLASS : WARM_BELL));
    yield;
    return o;
  } },
};

// Инструменты для фоновой музыки (рендерятся по нотам и кешируются).
const NOTES = {
  harp: (sr, m) => { const t60 = 2.6 * Math.pow(0.5, (m - 62) / 24), o = buf(sr, t60 * 1.15); pluck(o, sr, 0, hz(m), 1, { ...HARP, t60 }); filter(o, sr, 'lp', 5000); return o; },
  dark: (sr, m) => { const o = buf(sr, 1.1); pluck(o, sr, 0, hz(m), 1, { t60: 0.9, bright: 0.56, pos: 0.2, soft: 0.45 }); filter(o, sr, 'lp', 2400); return o; },
  chime: (sr, m) => { const o = buf(sr, 1.6); bell(o, sr, 0, hz(m), 1, { ratio: 3.5, index: 0.7, idecay: 0.1, decay: 1.1, part: 0.15 }); return o; },
  big: (sr) => {
    const o = buf(sr, 1.0);
    thump(o, sr, 0, 74, 44, 1, 0.3, 0.04, 0.002);
    noise(o, sr, { dur: 0.3, amp: 0.5, color: 'brown', env: envAD(0.002, 0.07), type: 'lp', f: 380 });
    noise(o, sr, { dur: 0.05, amp: 0.25, env: envAD(0.0005, 0.01), type: 'bp', f: 220, q: 1 });
    sat(o, 1.3);
    return o;
  },
  mid: (sr) => { const o = buf(sr, 0.5); thump(o, sr, 0, 118, 76, 1, 0.15, 0.03); noise(o, sr, { dur: 0.1, amp: 0.45, env: envAD(0.001, 0.025), type: 'lp', f: 900 }); return o; },
  small: (sr) => { const o = buf(sr, 0.25); thump(o, sr, 0, 230, 170, 0.6, 0.05, 0.02); noise(o, sr, { dur: 0.05, amp: 0.7, env: envAD(0.0005, 0.012), type: 'bp', f: 1500, q: 0.8 }); return o; },
  cricket: (sr) => {
    const o = buf(sr, 1.2), f = rand(4300, 4900);
    for (let c = 0; c < 3; c++) for (let p = 0; p < 4; p++) {
      const i0 = Math.floor((c * 0.34 + p * 0.03) * sr), n = Math.floor(0.018 * sr);
      for (let k = 0; k < n && i0 + k < o.length; k++) { const s = Math.sin(Math.PI * k / n); o[i0 + k] += s * s * Math.sin(TAU * f * k / sr) * (1 - c * 0.15); }
    }
    return o;
  },
};
const NOTE_PEAK = 0.8;

// Хвост свёрточной реверберации: затухающий стереошум, темнеющий со временем.
function impulse(sr, sec = 1.8) {
  const len = Math.floor(sr * sec), pre = Math.floor(sr * 0.012);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(len);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const t = i / sr;
      y += (0.12 + 0.6 * Math.exp(-t * 2.5)) * (Math.random() * 2 - 1 - y);
      d[i] = y * Math.exp(-6.9 * t / sec);
    }
    out.push(d);
  }
  return out;
}

// Петля розового шума для ветра (стерео, с перекрёстным склеиванием краёв).
function noiseLoop(sr, sec = 4) {
  const len = Math.floor(sr * sec), x = Math.floor(sr * 0.25);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + x);
    noise(raw, sr, { dur: (len + x) / sr, color: 'pink', type: 'lp', f: 8000 });
    const d = new Float32Array(len);
    for (let i = 0; i < len; i++) d[i] = raw[i];
    for (let i = 0; i < x; i++) { const u = i / x; d[i] = raw[i] * Math.sqrt(u) + raw[len + i] * Math.sqrt(1 - u); }
    let m = 0;
    for (let i = 0; i < len; i++) m = Math.max(m, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] *= 0.9 / (m || 1);
    out.push(d);
  }
  return out;
}

// Одно задание синтеза → массив каналов (Float32Array).
// { kind: 'sfx', name, i } — вариация эффекта; { kind: 'note', k, midi } — нота музыки;
// { kind: 'impulse' } — реверберация; { kind: 'loop' } — шум ветра.
export function synth(job, sr) {
  if (job.kind === 'sfx') {
    let res = SFX[job.name].r(sr, job.i);
    if (res && typeof res.next === 'function') { let s; do { s = res.next(); } while (!s.done); res = s.value; }
    return [finish(res, sr, 0.9)];
  }
  if (job.kind === 'note') return [finish(NOTES[job.k](sr, job.midi), sr, NOTE_PEAK)];
  if (job.kind === 'impulse') return impulse(sr);
  if (job.kind === 'loop') return noiseLoop(sr);
  return [new Float32Array(1)];
}

export { SFX, NOTES, NOTE_PEAK, finish };
