type P = readonly [number, number];

const f = (n: number) => +n.toFixed(1);
const area2 = (pts: readonly P[]) => pts.reduce((s, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return s + x * v - u * y; }, 0);
function poly(points: readonly P[], hole = false): string {
  const pts = (area2(points) > 0) !== hole ? points : [...points].reverse();
  return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}
const rot = ([x, y]: P, cx: number, cy: number, a: number): P => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
function ellipse(cx: number, cy: number, rx: number, ry: number, angle = 0, hole = false, n = 48): string {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; pts.push(rot([cx + rx * Math.cos(t), cy + ry * Math.sin(t)], cx, cy, angle)); }
  return poly(pts, hole);
}
const circle = (cx: number, cy: number, r: number, hole = false) => ellipse(cx, cy, r, r, 0, hole);
const ring = (cx: number, cy: number, outer: number, inner: number) => circle(cx, cy, outer) + circle(cx, cy, inner, true);
function rod(x1: number, y1: number, x2: number, y2: number, r: number, hole = false): string {
  const a = Math.atan2(y2 - y1, x2 - x1), pts: P[] = [];
  for (let i = 0; i <= 12; i++) { const t = a + Math.PI / 2 + i / 12 * Math.PI; pts.push([x1 + r * Math.cos(t), y1 + r * Math.sin(t)]); }
  for (let i = 0; i <= 12; i++) { const t = a - Math.PI / 2 + i / 12 * Math.PI; pts.push([x2 + r * Math.cos(t), y2 + r * Math.sin(t)]); }
  return poly(pts, hole);
}
function boneEnd(x: number, y: number, towardX: number, towardY: number): string {
  const a = Math.atan2(towardY - y, towardX - x), side = (s: number): P => [x + Math.cos(a + s * Math.PI / 2) * 5, y + Math.sin(a + s * Math.PI / 2) * 5];
  const [ax, ay] = side(1), [bx, by] = side(-1);
  return rod(x, y, towardX, towardY, 4.2) + circle(ax, ay, 5.2) + circle(bx, by, 5.2);
}
function star(cx: number, cy: number, outer: number, inner: number, points = 5, turn = -Math.PI / 2): string {
  const pts: P[] = [];
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer, t = turn + i * Math.PI / points; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return poly(pts);
}
function skull(cx: number, cy: number, r: number, teeth = true): string {
  const meet = Math.atan2(.835, .55), outline: P[] = [];
  for (let i = 0; i <= 40; i++) { const t = meet - i / 40 * (Math.PI * 2 - (Math.PI - 2 * meet)); outline.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  outline.push([cx - r * .5, cy + r * 1.05], [cx + r * .5, cy + r * 1.05]);
  let d = poly(outline);
  d += ellipse(cx - r * .38, cy + r * .08, r * .26, r * .3, 0, true) + ellipse(cx + r * .38, cy + r * .08, r * .26, r * .3, 0, true);
  d += poly([[cx, cy + r * .42], [cx - r * .12, cy + r * .62], [cx + r * .12, cy + r * .62]], true);
  if (teeth) for (const dx of [-.28, 0, .28]) d += poly([[cx + r * (dx - .05), cy + r * .78], [cx + r * (dx + .05), cy + r * .78], [cx + r * (dx + .05), cy + r * 1.0], [cx + r * (dx - .05), cy + r * 1.0]], true);
  return d;
}
const crossbones = (cx: number, cy: number, r: number) =>
  boneEnd(cx - r * 1.45, cy - r * .55, cx - r * .7, cy - r * .1) + boneEnd(cx + r * 1.45, cy - r * .55, cx + r * .7, cy - r * .1)
  + boneEnd(cx - r * 1.45, cy + r * 1.35, cx - r * .7, cy + r * .9) + boneEnd(cx + r * 1.45, cy + r * 1.35, cx + r * .7, cy + r * .9);

function spiral(cx: number, cy: number, turns: number, step: number, width: number): string {
  const outer: P[] = [], inner: P[] = [], n = Math.round(turns * 64);
  for (let i = 0; i <= n; i++) {
    const t = i / 64 * Math.PI * 2, r = 4 + step * t / (Math.PI * 2), w = width * Math.min(1, .35 + i / 40);
    outer.push([cx + (r + w / 2) * Math.cos(t), cy + (r + w / 2) * Math.sin(t)]);
    inner.push([cx + Math.max(0, r - w / 2) * Math.cos(t), cy + Math.max(0, r - w / 2) * Math.sin(t)]);
  }
  return poly([...outer, ...inner.reverse()]) + circle(cx, cy, width * .55);
}
const feather = (x: number, y: number, a: number, length: number, width: number) =>
  ellipse(x + Math.cos(a) * length / 2, y + Math.sin(a) * length / 2, length / 2, width / 2, a);

function petal(): P[] {
  const pts: P[] = [], t0 = Math.asin(3.2 / 13);
  for (let i = 0; i <= 36; i++) {
    const t = t0 + i / 36 * (Math.PI * 2 - 2 * t0);
    pts.push([50 + 13 * Math.sin(t), 26 - 22 * Math.cos(t)]);
  }
  pts.push([50, 26 - 22 + 7]);
  return pts;
}
export const SYMBOLS = {
  uzumaki: spiral(50, 50, 3.1, 12.2, 8.5),
  rinnegan: circle(50, 50, 6.5) + ring(50, 50, 16, 13) + ring(50, 50, 26, 23) + ring(50, 50, 36, 33) + ring(50, 50, 46, 42),
  star: star(50, 52, 46, 19),
  clock: ring(50, 50, 46, 39) + [...Array(12).keys()].map(i => { const a = i * Math.PI / 6, r1 = i % 3 ? 33 : 30; return rod(50 + Math.cos(a) * r1, 50 + Math.sin(a) * r1, 50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36, i % 3 ? 1.4 : 2.4); }).join('')
    + rod(50, 50, 50, 20, 2.6) + rod(50, 50, 69, 61, 3.2) + circle(50, 50, 5),
  spade: circle(33, 56, 18.5) + circle(67, 56, 18.5) + poly([[50, 6], [16, 52], [50, 64], [84, 52]]) + poly([[50, 56], [63, 93], [37, 93]]),
  heart: circle(35, 37, 18.5) + circle(65, 37, 18.5) + poly([[18.5, 43], [81.5, 43], [50, 88]]),
  bolt: poly([[58, 6], [24, 54], [46, 54], [36, 94], [76, 42], [54, 42], [66, 6]]),
  byakugo: poly([[50, 6], [80, 50], [50, 94], [20, 50]]) + poly([[50, 30], [63, 50], [50, 70], [37, 50]], true),
  uchiha: circle(50, 40, 33) + poly([...[...Array(25).keys()].map((i): P => { const t = i / 24 * Math.PI; return [50 + 26 * Math.cos(t), 42 + 24 * Math.sin(t)]; })], true)
    + poly([[45.5, 66], [54.5, 66], [55.5, 95], [44.5, 95]]),
  cloud: circle(27, 58, 15) + circle(43, 44, 18) + circle(62, 41, 17) + circle(76, 56, 14) + circle(58, 64, 14) + circle(40, 66, 13)
    + poly([[24, 60], [80, 60], [72, 76], [30, 76]]),
  wings: poly([[14, 8], [86, 8], [86, 60], [50, 94], [14, 60]]) + poly([[20, 14], [80, 14], [80, 57], [50, 87], [20, 57]], true)
    + [-105, -122, -139, -156].map((deg, i) => feather(47, 74, deg * Math.PI / 180, 42 - i * 4, 10)).join('')
    + [-75, -58, -41, -24].map((deg, i) => feather(53, 70, deg * Math.PI / 180, 40 - i * 4, 10)).join(''),
  strawHat: skull(50, 52, 21) + crossbones(50, 52, 21) + ellipse(50, 36, 35, 7.5) + ellipse(50, 30, 19, 15)
    + poly([[33, 33.5], [67, 33.5], [66, 37.5], [34, 37.5]], true),
  whitebeard: skull(50, 40, 21, false) + crossbones(50, 40, 21)
    + poly([...[...Array(25).keys()].map((i): P => { const t = i / 24 * Math.PI; return [50 - 46 * Math.cos(t), 50 + 24 * Math.sin(t)]; }),
      ...[...Array(25).keys()].reverse().map((i): P => { const t = i / 24 * Math.PI; return [50 - 30 * Math.cos(t), 52 + 9 * Math.sin(t)]; })]),
  heartPirates: ring(50, 50, 45, 38) + ellipse(38, 39, 6, 9) + ellipse(62, 39, 6, 9)
    + poly([...[...Array(21).keys()].map((i): P => { const t = Math.PI * .1 + i / 20 * Math.PI * .8; return [50 + 27 * Math.cos(t), 50 + 27 * Math.sin(t)]; }),
      ...[...Array(21).keys()].reverse().map((i): P => { const t = Math.PI * .1 + i / 20 * Math.PI * .8; return [50 + 22 * Math.cos(t), 56 + 14 * Math.sin(t)]; })]),
  pinwheel: [0, 1, 2, 3].map(i => poly(([[50, 50], [44, 12], [62, 8], [70, 28]] as P[]).map(p => rot(p, 50, 50, i * Math.PI / 2)))).join('') + circle(50, 50, 6),
  butterfly: ellipse(50, 50, 3.4, 25) + ellipse(32, 36, 16, 20, -.45) + ellipse(68, 36, 16, 20, .45) + ellipse(36, 66, 11, 14, .45) + ellipse(64, 66, 11, 14, -.45)
    + circle(32, 36, 5.5, true) + circle(68, 36, 5.5, true) + rod(48.5, 26, 40, 10, 1.3) + rod(51.5, 26, 60, 10, 1.3),
  brand: rod(50, 8, 50, 92, 5) + rod(30, 26, 70, 26, 5) + rod(50, 44, 22, 74, 5) + rod(50, 44, 78, 74, 5)
    + rod(22, 74, 21, 88, 4.2) + rod(78, 74, 79, 88, 4.2),
  sakura: [0, 1, 2, 3, 4].map(i => poly(petal().map(p => rot(p, 50, 50, i * Math.PI * 2 / 5)))).join('') + circle(50, 50, 5),
  mangekyo: ring(50, 50, 46, 40) + circle(50, 50, 10) + [0, 1, 2].map(i => { const a = i * Math.PI * 2 / 3;
    const pts: P[] = [[50, 50], [41, 30], [50, 12], [61, 22], [58, 38]];
    return poly(pts.map(p => rot(p, 50, 50, a))); }).join(''),
} as const;
export type SymbolName = keyof typeof SYMBOLS;
