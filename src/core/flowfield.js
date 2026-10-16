// Поле расстояний до Сердца (Дейкстра по сетке).
// cellCost(i): Infinity — непроходимо, иначе цена входа в клетку.
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export function buildFlowField(w, h, goals, cellCost, isSolid) {
  const n = w * h;
  // цены и непроходимость считаем один раз на клетку, а не на каждого соседа
  const cost = new Float32Array(n);
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    cost[i] = cellCost(i);
    solid[i] = isSolid(i) ? 1 : 0;
  }
  const dist = new Float32Array(n).fill(Infinity);
  const heap = new IndexHeap(n);
  for (const g of goals) {
    dist[g] = 0;
    heap.push(g, 0);
  }
  while (heap.size) {
    const d = heap.topPrio();
    const i = heap.pop();
    if (d > dist[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (let k = 0; k < 8; k++) {
      const dx = DX[k];
      const dy = DY[k];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      // Диагональ только если оба соседних прямых хода свободны — без срезания углов.
      if (k >= 4 && (solid[x + dx + y * w] || solid[x + (y + dy) * w])) continue;
      const ni = nx + ny * w;
      const c = cost[ni];
      if (c === Infinity) continue;
      const nd = d + STEP[k] * c;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        heap.push(ni, nd);
      }
    }
  }
  return dist;
}

const DX = DIRS.map((d) => d[0]);
const DY = DIRS.map((d) => d[1]);
const STEP = DIRS.map((d) => d[2]);

// Двоичная куча на типизированных массивах: без выделения памяти на каждый шаг.
class IndexHeap {
  constructor(cap) {
    this.ids = new Int32Array(cap * 2);
    this.pr = new Float32Array(cap * 2);
    this.size = 0;
  }
  grow() {
    const ids = new Int32Array(this.ids.length * 2); ids.set(this.ids); this.ids = ids;
    const pr = new Float32Array(this.pr.length * 2); pr.set(this.pr); this.pr = pr;
  }
  push(v, p) {
    if (this.size === this.ids.length) this.grow();
    const ids = this.ids; const pr = this.pr;
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      ids[i] = ids[parent]; pr[i] = pr[parent];
      i = parent;
    }
    ids[i] = v; pr[i] = p;
  }
  topPrio() { return this.pr[0]; }
  pop() {
    const ids = this.ids; const pr = this.pr;
    const top = ids[0];
    const n = --this.size;
    if (n > 0) {
      const v = ids[n]; const p = pr[n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && pr[r] < pr[l] ? r : l;
        if (pr[m] >= p) break;
        ids[i] = ids[m]; pr[i] = pr[m];
        i = m;
      }
      ids[i] = v; pr[i] = p;
    }
    return top;
  }
}

// Следующая клетка по полю: соседняя с наименьшим расстоянием.
export function nextCell(dist, w, h, i, isSolid) {
  const x = i % w;
  const y = (i - x) / w;
  let best = -1;
  let bestD = dist[i];
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (dx && dy && (isSolid(x + dx + y * w) || isSolid(x + (y + dy) * w))) continue;
    const ni = nx + ny * w;
    if (dist[ni] < bestD) {
      bestD = dist[ni];
      best = ni;
    }
  }
  return best;
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(v, p) {
    const a = this.items;
    a.push([v, p]);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent][1] <= a[i][1]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// A* по сетке для союзников: путь от клетки start до клетки goal.
// Возвращает массив индексов клеток (без стартовой) или null.
// Память переиспользуется между поисками (метка поколения вместо очистки массивов).
const AS = { n: 0, gen: 0 };
function astarMemory(n) {
  if (AS.n !== n) {
    AS.n = n;
    AS.g = new Float32Array(n);
    AS.came = new Int32Array(n);
    AS.seen = new Uint32Array(n);      // поколение, в котором клетку трогали
    AS.solid = new Uint8Array(n);      // 0 — ещё не спрашивали, 1 — свободно, 2 — занято (в этом поколении)
    AS.solidGen = new Uint32Array(n);
    AS.heap = new IndexHeap(Math.max(64, n >> 2));
    AS.gen = 0;
  }
  AS.gen++;
  if (AS.gen > 0xfffffff0) { AS.seen.fill(0); AS.solidGen.fill(0); AS.gen = 1; }
  AS.heap.size = 0;
  return AS;
}

export function findPath(w, h, start, goal, isSolid, maxNodes = 4000) {
  if (start === goal) return [];
  const m = astarMemory(w * h);
  const { g, came, seen, solid, solidGen, heap } = m;
  const gen = m.gen;
  const blocked = (i) => {
    if (solidGen[i] !== gen) { solidGen[i] = gen; solid[i] = isSolid(i) ? 2 : 1; }
    return solid[i] === 2;
  };
  const gx = goal % w;
  const gy = (goal - gx) / w;
  const heur = (i) => {
    const x = i % w;
    const y = (i - x) / w;
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  seen[start] = gen;
  g[start] = 0;
  heap.push(start, heur(start));
  let expanded = 0;
  while (heap.size && expanded++ < maxNodes) {
    const i = heap.pop();
    if (i === goal) {
      const path = [];
      let c = goal;
      while (c !== start) { path.push(c); c = came[c]; }
      return path.reverse();
    }
    const x = i % w;
    const y = (i - x) / w;
    const gi = g[i];
    for (let k = 0; k < 8; k++) {
      const dx = DX[k];
      const dy = DY[k];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = nx + ny * w;
      if (ni !== goal && blocked(ni)) continue;
      if (k >= 4 && (blocked(x + dx + y * w) || blocked(x + (y + dy) * w))) continue;
      const ng = gi + STEP[k];
      if (seen[ni] !== gen || ng < g[ni]) {
        seen[ni] = gen;
        g[ni] = ng;
        came[ni] = i;
        heap.push(ni, ng + heur(ni));
      }
    }
  }
  return null;
}
