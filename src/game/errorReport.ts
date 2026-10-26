export const REPORT_KINDS = ['error', 'rejection', 'webgl', 'stall', 'caught', 'chunk'] as const;
export type ReportKind = typeof REPORT_KINDS[number];

export interface ErrorReport {
  kind: ReportKind;
  message: string;
  stack?: string;
  build: string;
  path: string;
  screen?: string;
  browser?: string;
  tab?: string;
}

export const MESSAGE_MAX = 300, STACK_FRAMES = 12, STACK_MAX = 2000;
export const BODY_MAX = 8192;

const encoded = (run: string) => /\d/.test(run) && /[A-Za-z]/.test(run) && ((/[A-Z]/.test(run) && /[a-z]/.test(run)) || !/[-_]/.test(run));

const RULES: readonly (readonly [RegExp, string | ((match: string, ...groups: string[]) => string)])[] = [
  [/\bdata:[\w.+/-]*(?:;[\w=.+-]+)*,[^\s'"`()<>]*/gi, 'data:<data>'],
  [/([\w/.-])\?(?=[^\s'"`()<>]*=)[^\s'"`()<>]*?(?=:\d+(?::\d+)?\)?(?:\s|$)|[\s'"`()<>]|$)/gm, '$1'],
  [/(:\/\/[^\s#'"`()<>]*)#[^\s'"`()<>]*/g, '$1'],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 <token>'],
  [/\beyJ[\w-]*\.[\w-]*(?:\.[\w-]*)?/g, '<token>'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, '<email>'],
  [/\bdid:[a-z0-9]+:[\w.-]+/gi, '<id>'],
  [/\bs_[A-Za-z0-9_-]{16,}/g, '<token>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  [/\b(?:0x)?[0-9a-f]{16,}\b/gi, '<hex>'],
  [/[A-Za-z0-9+_=-]{24,}/g, run => encoded(run) ? '<data>' : run],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>'],
  [/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, '<ip>'],
  [/(\/Users\/|\/home\/|[A-Za-z]:\\+Users\\+)[^/\\\s'"`()<>]+/gi, '$1<user>'],
  [/\b(rift|duel|objective|coop|private)-\d{6}\b/gi, '$1-<code>'],
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scrub(text: string, names: readonly string[] = []): string {
  let out = text;
  for (const [pattern, to] of RULES) out = out.replace(pattern, to as string);
  for (const name of names) if (name && name.trim().length >= 3 && name.trim() !== 'Fighter')
    out = out.replace(new RegExp(`<[a-z]+>|${escape(name.trim())}`, 'gi'), found => /^<[a-z]+>$/.test(found) ? found : '<name>');
  return out;
}

const cut = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const plain = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max * 4) : '';

function stackOf(value: unknown, names: readonly string[]): string | undefined {
  const lines = scrub(plain(value, STACK_MAX), names).split('\n').map(line => cut(line.trim(), 300)).filter(Boolean).slice(0, STACK_FRAMES);
  return lines.length ? cut(lines.join('\n'), STACK_MAX) : undefined;
}

export function cleanReport(raw: unknown, names: readonly string[] = []): ErrorReport | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const body = raw as Record<string, unknown>;
  if (!(REPORT_KINDS as readonly unknown[]).includes(body.kind)) return undefined;
  const message = cut(scrub(plain(body.message, MESSAGE_MAX), names).replace(/\s+/g, ' ').trim(), MESSAGE_MAX);
  if (!message) return undefined;
  const report: ErrorReport = { kind: body.kind as ReportKind, message, build: buildOf(body.build), path: pathOf(body.path) };
  const stack = stackOf(body.stack, names); if (stack) report.stack = stack;
  if (typeof body.screen === 'string' && /^[a-z0-9][a-z0-9 _-]{0,23}$/i.test(body.screen)) report.screen = body.screen.toLowerCase();
  if (typeof body.browser === 'string' && /^[A-Za-z][A-Za-z ]{0,19}( \d{1,4})?( \/ [A-Za-z][A-Za-z ]{0,11})?$/.test(body.browser)) report.browser = body.browser;
  if (typeof body.tab === 'string' && /^[a-z0-9]{6,16}$/.test(body.tab)) report.tab = body.tab;
  return report;
}
const buildOf = (value: unknown) => typeof value === 'string' && (/^[0-9a-f]{7,40}$/.test(value) || value === 'development') ? value : 'unknown';
const pathOf = (value: unknown) => {
  const path = typeof value === 'string' ? value.split(/[?#]/, 1)[0] : '';
  return /^\/[\w./-]{0,100}$/.test(path) ? scrub(path) : '/';
};

export function browserOf(agent: string): string {
  const system = /iPhone|iPad|iPod/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /CrOS/.test(agent) ? 'ChromeOS'
    : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS X/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
  const families: readonly (readonly [RegExp, string])[] = [[/\bEdg(?:e|A|iOS)?\/(\d+)/, 'Edge'], [/\b(?:OPR|OPX)\/(\d+)/, 'Opera'],
    [/\bSamsungBrowser\/(\d+)/, 'Samsung Internet'], [/\b(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'], [/\b(?:HeadlessChrome|Chrome|CriOS)\/(\d+)/, 'Chrome'],
    [/\bVersion\/(\d+)[\d.]*(?: Mobile\/\S+)? Safari\//, 'Safari']];
  for (const [pattern, name] of families) {
    const version = pattern.exec(agent)?.[1];
    if (version) return `${name} ${version}${system ? ` / ${system}` : ''}`;
  }
  return system ? `other / ${system}` : 'other';
}

export function firstFrame(stack?: string): string {
  for (const line of (stack ?? '').split('\n')) {
    const frame = line.trim();
    if (!/^at\s/.test(frame) && !/@.*:\d+/.test(frame) && !/^[a-z][a-z0-9+.-]*:\/\/\S*:\d+/i.test(frame)) continue;
    return frame.replace(/^at\s+/, '').replace(/[a-z][a-z0-9+.-]*:\/\/[^/\s)]*/gi, '').replace(/:\d+(?::\d+)?/g, '')
      .replace(/-[A-Za-z0-9_-]{8}(?=\.m?js\b)/g, '').slice(0, 160);
  }
  return '';
}

const fnv = (text: string) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };

export function signatureOf(report: Pick<ErrorReport, 'kind' | 'message' | 'stack'>): { id: string; message: string; frame: string } {
  const message = report.message.replace(/\d+(?:\.\d+)?/g, '#'), frame = firstFrame(report.stack);
  return { id: fnv(`${report.kind}|${message}|${frame}`), message, frame };
}
