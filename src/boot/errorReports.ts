import { browserOf, cleanReport, signatureOf, type ErrorReport, type ReportKind } from '../game/errorReport';
import { isChunkError, isMissingAsset, whenUnrecovered } from '../loading/staleBuild';
import { economyServer } from '../ui/shop/account';

export const REPORTS_PER_TAB = 10;
export const NOTICE_SEEN_KEY = 'jump-fan-notice';
const SETTINGS_KEY = 'rift-settings';

export interface ReporterHost {
  send(url: string, body: string): void;
  read(key: string): string | null;
  agent: string;
  path(): string;
  build: string;
  server(): string;
  automated: boolean;
}

export function savedChoice(raw: string | null): boolean {
  try { const saved = JSON.parse(raw ?? '{}') as { errorReports?: unknown } | null; return saved?.errorReports !== false; } catch { return true; }
}

export function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object') {
    const { message, name, stack, type } = error as { message?: unknown; name?: unknown; stack?: unknown; type?: unknown };
    if (typeof message === 'string') return { message: typeof name === 'string' && name ? `${name}: ${message}` : message, stack: typeof stack === 'string' ? stack : undefined };
    if (typeof type === 'string') return { message: `${(error as object).constructor?.name ?? 'Event'}: ${type}` };
    return { message: Object.prototype.toString.call(error) };
  }
  return { message: String(error) };
}

export function noise(message: string, stack?: string, file?: string): boolean {
  if (/^ResizeObserver loop/.test(message)) return true;
  if (/^Script error\.?$/.test(message) && !stack) return true;
  return /\b(?:chrome|moz|safari(?:-web)?|ms-browser|webkit-masked)-extension:/.test(`${stack ?? ''}\n${file ?? ''}`);
}

const safely = <T>(read: () => T, fallback: T): T => { try { return read(); } catch { return fallback; } };
const randomTab = () => {
  try { const bytes = crypto.getRandomValues(new Uint8Array(8)); return Array.from(bytes, byte => (byte % 36).toString(36)).join(''); }
  catch { return Math.random().toString(36).slice(2, 10).padEnd(8, '0'); }
};

export type Outcome = 'off' | 'noise' | 'seen' | 'full' | 'held' | 'sent';

export class ErrorReporter {
  enabled: () => boolean = () => savedChoice(this.host.read(SETTINGS_KEY));
  screen: () => string | undefined = () => undefined;
  names: () => readonly string[] = () => [];
  readonly tab: string;
  private readonly seen = new Set<string>();
  private readonly held: ErrorReport[] = [];
  private noticeClosed = false;
  constructor(private readonly host: ReporterHost, tab = randomTab()) { this.tab = tab; }

  lend(parts: { enabled?: () => boolean; screen?: () => string | undefined; names?: () => readonly string[] }) {
    if (parts.enabled) this.enabled = parts.enabled;
    if (parts.screen) this.screen = parts.screen;
    if (parts.names) this.names = parts.names;
  }

  noticeSeen() { return this.noticeClosed || this.host.read(NOTICE_SEEN_KEY) !== null; }
  noticeRead() { this.noticeClosed = true; const held = this.held.splice(0); if (safely(this.enabled, false)) for (const report of held) this.post(report); }

  report(kind: ReportKind, error: unknown, where?: string, file?: string): Outcome {
    try {
      if (this.host.automated || !safely(this.enabled, false)) return 'off';
      const { message, stack } = describe(error);
      if (noise(message, stack, file)) return 'noise';
      const report = cleanReport({ kind, message: where ? `${where}: ${message}` : message, stack, build: this.host.build, path: this.host.path(),
        screen: safely(this.screen, undefined), browser: browserOf(this.host.agent), tab: this.tab }, safely(this.names, []));
      if (!report) return 'noise';
      const id = signatureOf(report).id;
      if (this.seen.has(id)) return 'seen';
      if (this.seen.size >= REPORTS_PER_TAB) return 'full';
      this.seen.add(id);
      if (!this.noticeSeen()) { this.held.push(report); return 'held'; }
      this.post(report);
      return 'sent';
    } catch { return 'noise'; }
  }

  watchCanvas(canvas: Pick<EventTarget, 'addEventListener'>, hidden: () => boolean = () => typeof document === 'object' && document.hidden) {
    canvas.addEventListener('webglcontextlost', () => { if (!hidden()) this.report('webgl', 'the graphics context was lost while the game was on screen'); });
  }

  private post(report: ErrorReport) { try { this.host.send(`${this.host.server()}/errors`, JSON.stringify(report)); } catch { } }
}

const browserHost = (): ReporterHost => ({
  send: (url, body) => { void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } }).catch(() => {}); },
  read: key => { try { return localStorage.getItem(key); } catch { return null; } },
  agent: navigator.userAgent,
  path: () => location.pathname,
  build: import.meta.env.VITE_BUILD_SHA || 'development',
  server: economyServer,
  automated: !!navigator.webdriver && !new URLSearchParams(location.search).has('reports'),
});
const nowhere: ReporterHost = { send: () => {}, read: () => null, agent: '', path: () => '/', build: 'development', server: () => '', automated: true };

export const errorReports = new ErrorReporter(typeof window === 'object' && typeof navigator === 'object' ? browserHost() : nowhere);
export const reportCaught = (error: unknown, where: string) => errorReports.report('caught', error, where);
export function reportStartFailure(error: unknown): Outcome | undefined {
  if (error instanceof Error && error.name === 'Error') return undefined;
  if (isChunkError(error) || isMissingAsset(error)) return undefined;
  return reportCaught(error, 'start');
}

if (typeof window === 'object' && typeof document === 'object') {
  window.addEventListener('error', event => { errorReports.report('error', event.error ?? event.message, undefined, event.filename); });
  window.addEventListener('unhandledrejection', event => { if (!isChunkError(event.reason)) errorReports.report('rejection', event.reason); });
  whenUnrecovered(error => errorReports.report('chunk', error));
  document.addEventListener('close', event => { if ((event.target as Element | null)?.id === 'first-visit') errorReports.noticeRead(); }, true);
}
