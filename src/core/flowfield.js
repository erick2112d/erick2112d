// Поле расстояний до Сердца (Дейкстра по сетке).
// cellCost(i): Infinity — непроходимо, иначе цена входа в клетку.
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export function buildFlowField(w, h, goals, cellCost, isSolid) {
  const dist = new Float32Array(w * h).fill(Infinity);
  const heap = new MinHeap();
  for (const g of goals) {
    dist[g] = 0;
    heap.push(g, 0);
  }
  while (heap.size) {
    const [i, d] = heap.pop();
    if (d > dist[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy, step] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      // Диагональ только если оба соседних прямых хода свободны — без срезания углов.
      if (dx && dy && (isSolid(x + dx + y * w) || isSolid(x + (y + dy) * w))) continue;
      const ni = nx + ny * w;
      const c = cellCost(ni);
      if (c === Infinity) continue;
      const nd = d + step * c;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        heap.push(ni, nd);
      }
    }
  }
  return dist;
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
