const GUARD = 'jump-stale-reload', RESUME = 'jump-stale-resume';
const CHECK_EVERY = 60_000, START_WAIT = 1500;

const CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|is not a valid JavaScript MIME type|Failed to load module script/i;

const words = (error: unknown): string => typeof error === 'string' ? error : error && typeof error === 'object' ? String((error as { message?: unknown }).message ?? '') : '';

export function isChunkError(error: unknown): boolean {
  if (!error) return false;
  if (CHUNK.test(words(error))) return true;
  const cause = typeof error === 'object' ? (error as { cause?: unknown }).cause : undefined;
  return cause !== undefined && cause !== error && isChunkError(cause);
}

export function isMissingAsset(error: unknown): boolean {
  const response = error && typeof error === 'object' ? (error as { response?: { status?: unknown; url?: unknown } }).response : undefined;
  if (response?.status === 404 && typeof response.url === 'string') return /\/assets\//.test(response.url);
  return /fetch for "[^"]*\/assets\/[^"]*" responded with 404\b/.test(words(error));
}

const pathOf = (src: string) => src.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '').split(/[?#]/, 1)[0];

export function entryOf(html: string): string | undefined {
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/\btype\s*=\s*["']?module\b/i.test(tag)) continue;
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (src) return pathOf(src);
  }
  return undefined;
}

export function buildChanged(running: string | undefined, served: string | undefined): boolean {
  return !!running && !!served && pathOf(running) !== pathOf(served);
}

export interface ReloadGuard { from: string; at: number }
export function mayReload(running: string | undefined, guard: ReloadGuard | null, now = Date.now()): boolean {
  if (!running) return false;
  if (!guard) return true;
  return guard.from !== running && now - guard.at > 15_000;
}

const session = (() => { try { return typeof sessionStorage === 'object' ? sessionStorage : undefined; } catch { return undefined; } })();
const readJson = <T>(key: string): T | null => { try { return JSON.parse(session?.getItem(key) ?? 'null') as T | null; } catch { return null; } };
const writeJson = (key: string, value: unknown) => { try { session?.setItem(key, JSON.stringify(value)); return session?.getItem(key) === JSON.stringify(value); } catch { return false; } };

export function runningEntry(): string | undefined {
  if (typeof document !== 'object') return undefined;
  const src = document.querySelector('script[type="module"][src]')?.getAttribute('src');
  return src ? pathOf(src) : undefined;
}

type Result = 'changed' | 'same' | 'unknown';
let checkedAt = -Infinity, checking: Promise<Result> | null = null, stale = false, reloading = false;

function check(force = false): Promise<Result> {
  if (stale) return Promise.resolve('changed');
  if (checking) return checking;
  if (!force && performance.now() - checkedAt < CHECK_EVERY) return Promise.resolve('same');
  if (typeof fetch !== 'function' || typeof location !== 'object') return Promise.resolve('unknown');
  checkedAt = performance.now();
  return checking = fetch('/', { cache: 'no-store', credentials: 'same-origin' })
    .then(async response => response.ok && /html/.test(response.headers.get('content-type') ?? '') ? entryOf(await response.text()) : undefined)
    .then(served => { if (buildChanged(runningEntry(), served)) { stale = true; return 'changed' as const; } return served ? 'same' as const : 'unknown' as const; })
    .catch(() => 'unknown' as const)
    .finally(() => { checking = null; });
}

function notice() {
  if (typeof document !== 'object' || document.querySelector('.stale-notice')) return;
  const el = document.createElement('div');
  el.className = 'stale-notice'; el.setAttribute('role', 'status');
  el.innerHTML = '<b>NEW VERSION</b><span>Updating to the latest version…</span>';
  document.body.append(el);
}

function reload(): boolean {
  if (reloading) return true;
  const running = runningEntry();
  if (!mayReload(running, readJson<ReloadGuard>(GUARD)) || !writeJson(GUARD, { from: running, at: Date.now() })) return false;
  reloading = true;
  const pressed = (selector: string) => document.querySelector<HTMLElement>(`${selector}[aria-pressed="true"]`);
  writeJson(RESUME, { fighter: pressed('.home-fighter')?.dataset.fighter, mode: pressed('.home-mode')?.dataset.mode });
  notice();
  setTimeout(() => location.reload(), 900);
  return true;
}

let inMatch: () => boolean = () => false;
export function watchMatch(on: () => boolean) { inMatch = on; }

export async function beforeStart(): Promise<boolean> {
  const result = await Promise.race([check(), new Promise<Result>(done => setTimeout(() => done('unknown'), START_WAIT))]);
  return result === 'changed' && reload();
}

let unrecovered: (error: unknown) => void = () => {};
export function whenUnrecovered(report: (error: unknown) => void) { unrecovered = report; }

export async function recover(error: unknown): Promise<boolean> {
  if (reloading) return true;
  if (!isChunkError(error) && !isMissingAsset(error)) return false;
  const served = await check(true);
  if (served === 'changed' && inMatch()) return false;
  if (served === 'changed' && reload()) return true;
  unrecovered(error);
  return false;
}

export function restoreSelection(root: ParentNode = document) {
  const saved = readJson<{ fighter?: string; mode?: string }>(RESUME);
  try { session?.removeItem(RESUME); } catch { }
  if (!saved) return;
  const press = (selector: string, value: string | undefined) => { if (value && /^[\w-]+$/.test(value)) root.querySelector<HTMLElement>(selector.replace('?', value))?.click(); };
  press('.home-mode[data-mode="?"]', saved.mode);
  press('.home-fighter[data-fighter="?"]', saved.fighter);
}

if (typeof window === 'object' && typeof document === 'object') {
  window.addEventListener('vite:preloadError', event => { void recover((event as Event & { payload?: unknown }).payload); });
  window.addEventListener('unhandledrejection', event => { if (isChunkError(event.reason)) void recover(event.reason); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
}
