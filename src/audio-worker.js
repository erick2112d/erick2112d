// Фоновый поток: синтезирует звуки и ноты, чтобы основной поток игры не тормозил.
import { synth } from './audio-synth.js';

self.onmessage = (e) => {
  const { job, sr } = e.data;
  let data;
  try { data = synth(job, sr); } catch { data = [new Float32Array(1)]; }
  self.postMessage({ job, data }, data.map((d) => d.buffer));
};
