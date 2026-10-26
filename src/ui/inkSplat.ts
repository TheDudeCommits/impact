type SplatSpec = {
  seed: number;
  body: number; lump: number;
  spikes: number; reach: [number, number];
  toward: number; bias: number;
  bulbs: number;
  drips: number;
  droplets: number;
};

const SPECS: readonly SplatSpec[] = [
  { seed: 11, body: 27, lump: .07, spikes: 15, reach: [4, 15], toward: 0, bias: 0, bulbs: 3, drips: 1, droplets: 9 },
  { seed: 29, body: 28, lump: .1, spikes: 8, reach: [4, 12], toward: 90, bias: .3, bulbs: 4, drips: 3, droplets: 6 },
  { seed: 47, body: 26, lump: .08, spikes: 12, reach: [5, 20], toward: -15, bias: .75, bulbs: 5, drips: 1, droplets: 10 },
  { seed: 83, body: 26, lump: .05, spikes: 20, reach: [3, 11], toward: 200, bias: .2, bulbs: 2, drips: 2, droplets: 13 },
  { seed: 131, body: 28, lump: .06, spikes: 7, reach: [8, 18], toward: 135, bias: .35, bulbs: 7, drips: 1, droplets: 7 },
  { seed: 173, body: 27, lump: .13, spikes: 11, reach: [4, 16], toward: 220, bias: .55, bulbs: 4, drips: 2, droplets: 8 },
];

const TAU = Math.PI * 2;
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f = (v: number) => (Math.round(v * 10) / 10).toString();
const turn = (a: number, b: number) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function closed(pts: [number, number][]) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
  if (area < 0) pts.reverse();
  const n = pts.length, mid = (i: number) => { const p = pts[i % n], q = pts[(i + 1) % n]; return `${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`; };
  let d = `M${mid(n - 1)}`;
  for (let i = 0; i < n; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${mid(i)}`;
  return d + 'Z';
}
const circle = (x: number, y: number, r: number) => closed(Array.from({ length: 12 }, (_, i): [number, number] => [x + r * Math.cos(i / 12 * TAU), y + r * Math.sin(i / 12 * TAU)]));
function droplet(x: number, y: number, r: number) {
  const len = Math.hypot(x, y) || 1, ux = x / len, uy = y / len, vx = -uy, vy = ux, tail = r * 2.4;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 - (i / 10) * Math.PI; pts.push([x + (ux * Math.cos(a) + vx * Math.sin(a)) * r, y + (uy * Math.cos(a) + vy * Math.sin(a)) * r]); }
  pts.push([x - ux * tail, y - uy * tail]);
  return closed(pts);
}

function draw(spec: SplatSpec) {
  const rnd = seeded(spec.seed), toward = spec.toward * Math.PI / 180;
  const lumps = [2, 3, 4, 5, 7, 9].map(k => ({ k, a: (rnd() * 2 - 1) * spec.lump / Math.sqrt(k / 2), p: rnd() * TAU }));
  const spikes: { a: number; reach: number; width: number; bulb: boolean }[] = [];
  for (let i = 0; i < spec.spikes; i++) {
    let a = (i + .2 + rnd() * .6) / spec.spikes * TAU;
    a += turn(toward, a) * spec.bias * rnd();
    const facing = (1 + Math.cos(turn(a, toward))) / 2;
    const reach = spec.reach[0] + (spec.reach[1] - spec.reach[0]) * Math.pow(rnd(), 1.4) * (1 - spec.bias * .6 + spec.bias * .6 * facing * 1.4);
    spikes.push({ a, reach, width: .055 + rnd() * .07 + reach * .002, bulb: rnd() * 10 < spec.bulbs });
  }
  const drips: { a: number; reach: number }[] = [];
  for (let i = 0; i < spec.drips; i++) drips.push({ a: Math.PI / 2 + (rnd() * 2 - 1) * .55, reach: 11 + rnd() * 9 });
  const radius = (t: number) => {
    let r = spec.body;
    for (const l of lumps) r += spec.body * l.a * Math.sin(l.k * t + l.p);
    for (const s of spikes) { const d = Math.abs(turn(t, s.a)); if (d < s.width) r += s.reach * Math.pow(1 - d / s.width, 1.9); }
    for (const s of drips) { const d = Math.abs(turn(t, s.a)); if (d < .085) r += s.reach * Math.pow(1 - d / .085, 1.15); }
    return r;
  };
  const pts: [number, number][] = [];
  const N = 200;
  for (let i = 0; i < N; i++) { const t = i / N * TAU, r = radius(t); pts.push([r * Math.cos(t), r * Math.sin(t)]); }
  let d = closed(pts);
  for (const s of spikes) if (s.bulb) { const r = radius(s.a) - .6, b = 1.3 + s.reach * .09; d += circle(Math.cos(s.a) * r, Math.sin(s.a) * r, b); }
  for (const s of drips) { const r = radius(s.a) - 1, b = 2.1 + rnd() * 1.2; d += circle(Math.cos(s.a) * r, Math.sin(s.a) * (r + b * .4), b); }
  for (let i = 0; i < spec.droplets; i++) {
    let a = rnd() * TAU; a += turn(toward, a) * spec.bias * .7 * rnd();
    const r = spec.body * (1.3 + rnd() * .42), size = .8 + Math.pow(rnd(), 2) * 2.2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (Math.abs(x) + size > 49 || Math.abs(y) + size > 49) continue;
    d += rnd() < .55 ? droplet(x, y, size) : circle(x, y, size);
  }
  return d;
}

let drawn: string[] | undefined;
export function inkSplats(): readonly string[] { return drawn ??= SPECS.map(draw); }

export function brushStroke(seed = 7, body = .47): string {
  const rnd = seeded(seed), phase = rnd() * TAU, end = 1000 * body;
  const middle = (x: number) => 100 + 5 * Math.sin(x / 260 + phase) + 2 * Math.sin(x / 70 + phase * 2);
  const half = (x: number) => (x < 80 ? 68 * Math.sqrt(Math.max(0, 1 - ((80 - x) / 62) ** 2)) : 68 + 3 * Math.sin(x / 150 + phase)) * (x > end ? 1 - (x - end) / 900 : 1);
  const top: [number, number][] = [], bottom: [number, number][] = [];
  const close = end + 30, last = Math.min(990, end + 170);
  for (let x = 18; x <= last; x += 6) {
    const h = half(x) * (x > close ? Math.sqrt(Math.max(0, 1 - ((x - close) / (last - close)) ** 2)) : 1), m = middle(x);
    top.push([x, m - h + (rnd() * 2 - 1) * 2.4 - (rnd() < .07 ? rnd() * 5 : 0)]);
    bottom.push([x, m + h + (rnd() * 2 - 1) * 2.4 + (rnd() < .07 ? rnd() * 5 : 0)]);
  }
  let d = closed([...top, ...bottom.reverse()]);
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    const k = (i + .5) / bands, from = end + rnd() * 90, to = Math.min(995, end + 290 + rnd() * 225 * (1 - Math.abs(k - .45) * .9)), weight = .5 + rnd() * .55;
    const upper: [number, number][] = [], lower: [number, number][] = [];
    for (let x = from; x <= to; x += 9) {
      const h = half(Math.min(x, last)) * (1 - Math.max(0, x - last) / 900), m = middle(x), y = m - h + 2 * h * k;
      const along = (x - from) / (to - from), t = (h / bands) * weight * Math.min(1, (1 - along) * 2.4);
      upper.push([x, y - t]); lower.push([x, y + t]);
    }
    if (upper.length > 2) d += closed([...upper, ...lower.reverse()]);
  }
  for (let i = 0; i < 8; i++) { const x = 20 + rnd() * 160, y = 100 + (rnd() < .5 ? -1 : 1) * (76 + rnd() * 16); d += circle(x, y, 1.2 + rnd() * 3.4); }
  return d;
}
