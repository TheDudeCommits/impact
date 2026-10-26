export interface Cutout { url: string; pad: number; width: number; height: number }
export interface CutoutOptions { lum?: number; seal?: number; margin?: number; rim?: number; ink?: string; paper?: string; scale?: number; crop?: readonly [number, number, number, number] }

const cache = new Map<string, Promise<Cutout | undefined>>();
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

export function cutout(src: string, options: CutoutOptions = {}): Promise<Cutout | undefined> {
  const key = `${src}|${JSON.stringify(options)}`;
  let job = cache.get(key);
  if (!job) { job = make(src, options).catch(() => undefined); cache.set(key, job); }
  return job;
}

async function make(src: string, { lum = 236, seal = 1, margin = 3, rim = 5, ink = '#0b0c0e', paper = '#fbf6ea', scale = 1, crop }: CutoutOptions): Promise<Cutout | undefined> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return undefined;
  const img = new Image(); img.decoding = 'async'; img.src = src; await img.decode();
  const [sx, sy, sw, sh] = crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale)), pad = margin + rim + 2;
  const W = w + pad * 2, H = h + pad * 2, N = W * H;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  if (!cx) return undefined;
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, sx, sy, sw, sh, pad, pad, w, h);
  const px = cx.getImageData(0, 0, W, H), d = px.data;
  const wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) wall[i] = .3 * d[i * 4] + .59 * d[i * 4 + 1] + .11 * d[i * 4 + 2] < lum ? 1 : 0;
  const dilate = (m: Uint8Array, r: number) => {
    let a = m;
    for (let k = 0; k < r; k++) {
      const b = new Uint8Array(N);
      for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
        b[i] = a[i] || (x > 0 && a[i - 1]) || (x < W - 1 && a[i + 1]) || (y > 0 && a[i - W]) || (y < H - 1 && a[i + W]) ? 1 : 0;
      }
      a = b;
    }
    return a;
  };
  const sealed = dilate(wall, seal);
  const bg = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  const push = (i: number) => { if (!bg[i] && !sealed[i]) { bg[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (qh < qt) { const i = q[qh++], x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < N - W) push(i + W); }
  const fg = new Uint8Array(N); for (let i = 0; i < N; i++) fg[i] = bg[i] ? 0 : 1;
  const inner = dilate(fg, margin), outer = dilate(inner, rim);
  const pc = hex(paper), ic = hex(ink);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (fg[i]) { d[o] = Math.round(pc[0] * d[o] / 255); d[o + 1] = Math.round(pc[1] * d[o + 1] / 255); d[o + 2] = Math.round(pc[2] * d[o + 2] / 255); d[o + 3] = 255; }
    else if (inner[i]) { d[o] = pc[0]; d[o + 1] = pc[1]; d[o + 2] = pc[2]; d[o + 3] = 255; }
    else if (outer[i]) { d[o] = ic[0]; d[o + 1] = ic[1]; d[o + 2] = ic[2]; d[o + 3] = 255; }
    else d[o + 3] = 0;
  }
  cx.putImageData(px, 0, 0);
  const blob = await new Promise<Blob | null>(resolve => cv.toBlob(resolve, 'image/png'));
  if (!blob) return undefined;
  return { url: URL.createObjectURL(blob), pad, width: W, height: H };
}

export function whenIdle(fn: () => void, timeout = 1500) {
  const w = typeof window === 'object' ? window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number } : undefined;
  if (w?.requestIdleCallback) w.requestIdleCallback(fn, { timeout }); else setTimeout(fn, 60);
}
