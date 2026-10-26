export function reloadWhenRestored(page: Pick<Window, 'addEventListener' | 'location'>): void {
  page.addEventListener('pageshow', event => { if ((event as PageTransitionEvent).persisted) page.location.reload(); });
}

export const RESTORE_WAIT = 5000;
type Host = Pick<Window, 'location' | 'setTimeout' | 'clearTimeout'> & { document: Pick<Document, 'hidden' | 'addEventListener'> };
export function reloadIfNotRestored(canvas: Pick<EventTarget, 'addEventListener'>, page: Host, wait = RESTORE_WAIT): void {
  let lost = false, timer: number | undefined;
  const disarm = () => { if (timer !== undefined) page.clearTimeout(timer); timer = undefined; };
  const arm = () => { if (lost && timer === undefined && !page.document.hidden) timer = page.setTimeout(() => { timer = undefined; if (lost && !page.document.hidden) page.location.reload(); }, wait); };
  canvas.addEventListener('webglcontextlost', () => { lost = true; arm(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; disarm(); });
  page.document.addEventListener('visibilitychange', () => { if (page.document.hidden) disarm(); else arm(); });
}
