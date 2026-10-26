import { picture, plateRoot, txt, type ProtoSkin, type Side } from './proto';


type Pt = readonly [number, number];
const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => (t: number): Pt => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};
const half = (width: number, t: number) => .5 + width * Math.pow(Math.sin(Math.PI * t), .75);
const aside = (at: (t: number) => Pt, t: number, w: number): Pt => {
  const [x, y] = at(t), [ax, ay] = at(Math.max(0, t - .01)), [bx, by] = at(Math.min(1, t + .01));
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  return [x + dy / len * w, y - dx / len * w];
};
function crescent(p0: Pt, p1: Pt, p2: Pt, p3: Pt, width: number) {
  const at = cubic(p0, p1, p2, p3), n = 56, left: string[] = [], right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    left.push(f(aside(at, t, -half(width, t))));
    right.push(f(aside(at, t, half(width, t))));
  }
  return { line: `M${f(p0)}C${f(p1)} ${f(p2)} ${f(p3)}`, blade: `M${left.join('L')}L${right.reverse().join('L')}Z` };
}
const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const CX = 152, CY = 200, K = 1.45, BLADE = 9;
const at = (dx: number, dy: number, mirror = false): Pt => [CX + (mirror ? -dx : dx) * K, CY + dy * K];
const ULT_PTS = [at(-98, -91), at(-60, -35), at(20, 25), at(98, 43)] as const;
const ULT = crescent(...ULT_PTS, BLADE);
const AWK = crescent(at(-98, -91, true), at(-60, -35, true), at(20, 25, true), at(98, 43, true), BLADE);
const [ULT_END, AWK_END] = [at(98, 43), at(98, 43, true)];
const VEE = (() => {
  const arm = cubic(...ULT_PTS), gap = 5, side: Pt[] = [];
  for (let t = 0; t <= 1; t += .02) {
    const p = aside(arm, t, half(BLADE, t) + gap);
    if (p[0] >= CX) { const q = side[side.length - 1]; side.push([CX, q[1] + (p[1] - q[1]) * (CX - q[0]) / (p[0] - q[0])]); break; }
    side.push(p);
  }
  const [p0, p1] = ULT_PTS, up = (CY + 300) / (p1[1] - p0[1]);
  side.unshift([side[0][0] - (p1[0] - p0[0]) * up, side[0][1] - (p1[1] - p0[1]) * up]);
  const pts = [...side, ...side.slice(0, -1).reverse().map(([x, y]): Pt => [2 * CX - x, y])];
  const css = ([x, y]: Pt) => `calc(var(--x-l) - var(--im-l) + ${x.toFixed(1)}px * var(--x-s)) calc(var(--x-t) - var(--im-t) + ${y.toFixed(1)}px * var(--x-s))`;
  return `polygon(${pts.map(css).join(',')})`;
})();
const STAR = 'M0 -15C1.4 -4 4 -1.4 15 0C4 1.4 1.4 4 0 15C-1.4 4 -4 1.4 -15 0C-4 -1.4 -1.4 -4 0 -15Z';
const LIQUID = (bubbles: number) => `<span class="hl-liq"><i class="hl-fill"></i><i class="hl-flow"></i><i class="hl-flow hl-flow-b"></i><i class="hl-ripple"></i><b class="hl-bubbles">${'<i></i>'.repeat(bubbles)}</b></span>`;
const FRONT = '<span class="hl-front"><i></i></span>';
const INFINITY = 'M32 16 C26 6 18 4 13 4 C7 4 3 9 3 16 C3 23 7 28 13 28 C18 28 26 26 32 16 C38 6 46 4 51 4 C57 4 61 9 61 16 C61 23 57 28 51 28 C46 28 38 26 32 16 Z';

const blade = (id: string, bar: 'ult' | 'awk', c: { line: string; blade: string }) => `<g class="hl-blade hl-${bar}" data-hd-bar="${bar}">`
  + `<mask id="${id}-${bar}-m" maskUnits="userSpaceOnUse" x="-30" y="30" width="370" height="260"><path class="hl-reveal" d="${c.line}" pathLength="1"/></mask>`
  + `<mask id="${id}-${bar}-e" maskUnits="userSpaceOnUse" x="-30" y="30" width="370" height="260"><path class="hl-reveal hl-reveal-echo" d="${c.line}" pathLength="1"/></mask>`
  + `<path class="hl-blade-track" d="${c.blade}"/>`
  + `<path class="hl-blade-echo" d="${c.blade}" mask="url(#${id}-${bar}-e)"/>`
  + `<path class="hl-blade-glow" d="${c.blade}" fill="url(#${id}-${bar}-g)" filter="url(#${id}-blur)" mask="url(#${id}-${bar}-m)"/>`
  + `<path class="hl-blade-fill" d="${c.blade}" fill="url(#${id}-${bar}-g)" mask="url(#${id}-${bar}-m)"/>`
  + `<path class="hl-blade-core" d="${c.line}" pathLength="1"/>`
  + `<path class="hl-blade-streak" d="${c.line}" pathLength="1"/>`
  + `<path class="hl-blade-sheen" d="${c.line}" pathLength="1"/></g>`;
const star = (bar: 'ult' | 'awk', x: number, y: number) => `<g class="hl-star hl-star-${bar}" transform="translate(${x} ${y})"><g class="hl-star-in">`
  + `<circle class="hl-star-glow" r="16"/><path class="hl-star-rays" d="M-24 0H24M0 -24V24"/><path class="hl-star-body" d="${STAR}"/></g>`
  + `<circle class="hl-star-burst" r="14"/></g>`;

const plate = (side: Side) => {
  const id = `hl-${side}`;
  return plateRoot('halo', side,
    '<span class="hl-bloom" data-hd-glow></span>'
    + `<span class="hl-name-row">${txt('name', 'hl-name')}</span>`
    + `<span class="hl-hpnum hd-txt">${txt('hp', 'hl-hp-v', 'b')}<small>/${txt('hpmax', '', 'span')}</small></span>`
    + '<span class="hl-hp" data-hd-bar="hp"><i class="hl-pool"></i><span class="hl-lv hl-chunk"><i></i></span><span class="hl-lv hl-glow"><i></i></span>'
    + '<span class="hl-lv hl-body">' + LIQUID(5) + '</span>'
    + `<span class="hl-spill"><i></i><i></i></span><span class="hl-hits"><i class="hl-slash"></i><span class="hl-spray">${'<i><b></b></i>'.repeat(8)}</span><i class="hl-shock"></i></span></span>`
    + '<span class="hl-st" data-hd-bar="st"><i class="hl-pool"></i><span class="hl-lv hl-chunk"><i></i></span><span class="hl-lv hl-glow"><i></i></span>'
    + '<span class="hl-lv hl-body">' + LIQUID(8) + '</span>' + FRONT + '<span class="hl-fizz"><i></i><i></i><i></i><i></i></span></span>'
    + `<span class="hl-awktag hd-txt">${txt('form', 'hl-form', 'b')}<em>${txt('awk', '', 'span')}<small>SEC</small></em></span>`
    + picture('bust', 'hl-bust').replace('<img ', `<img style="clip-path:${VEE}" `)
    + `<svg class="hl-x" viewBox="0 0 310 290" overflow="visible"><defs>`
    + `<linearGradient id="${id}-ult-g" gradientUnits="userSpaceOnUse" x1="10" y1="68" x2="294" y2="262"><stop offset="0" stop-color="#1a2cff"/><stop offset=".4" stop-color="#1f6bff"/><stop offset=".78" stop-color="#04d9ff"/><stop offset="1" stop-color="#d4fbff"/></linearGradient>`
    + `<linearGradient id="${id}-awk-g" gradientUnits="userSpaceOnUse" x1="294" y1="68" x2="10" y2="262"><stop offset="0" stop-color="#4d000d"/><stop offset=".38" stop-color="#a3001b"/><stop offset=".75" stop-color="#dc143c"/><stop offset="1" stop-color="#ffb0bd"/></linearGradient>`
    + `<filter id="${id}-blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs>`
    + blade(id, 'awk', AWK) + blade(id, 'ult', ULT) + star('ult', ...ULT_END) + star('awk', ...AWK_END) + '</svg>');
};

export const HALO: ProtoSkin = {
  id: 'halo', portrait: 'bust', plate,
  clock: () => '<div class="hd-clock hd-halo" aria-hidden="true"><span class="hl-clock-ring"></span>'
    + `<svg class="hl-inf" viewBox="0 0 64 32" overflow="visible"><path d="${INFINITY}"/></svg><b class="hl-time" data-hd-time></b></div>`,
};
