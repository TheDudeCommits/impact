let listening = false, stale = true, w = 0, h = 0, pw = 0, ph = 0;
function read() {
  const g = globalThis as { innerWidth?: number; innerHeight?: number; document?: Document };
  w = g.innerWidth ?? 0; h = g.innerHeight ?? 0;
  const root = g.document?.documentElement;
  pw = root?.clientWidth || w; ph = root?.clientHeight || h;
  stale = false;
}
function fresh() {
  if (!listening) {
    const g = globalThis as { addEventListener?: Window['addEventListener']; visualViewport?: EventTarget | null };
    if (typeof g.addEventListener !== 'function') { read(); return; }
    listening = true;
    const mark = () => { stale = true; };
    g.addEventListener('resize', mark); g.addEventListener('orientationchange', mark); g.visualViewport?.addEventListener('resize', mark);
  }
  if (stale) read();
}
export const viewWidth = () => { fresh(); return w; };
export const viewHeight = () => { fresh(); return h; };
export const pageWidth = () => { fresh(); return pw; };
export const pageHeight = () => { fresh(); return ph; };
