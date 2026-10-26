import { reportCaught } from '../../boot/errorReports';

let note: HTMLElement | undefined;
let noteUntil = 0;
const seen = new Set<string>();
export const GLITCH_CONTEXT: { round?: number; stage?: string; boss?: string } = {};

export function glitch(error: unknown, where: string) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const key = `${where}|${message}`;
  const stack = error instanceof Error ? (error.stack ?? '').split('\n').slice(0, 6).join('\n') : '';
  try {
    localStorage.setItem('rift-last-error', JSON.stringify({ at: new Date().toISOString(), where, message, stack, ...GLITCH_CONTEXT }));
  } catch { }
  if (seen.has(key)) return;
  seen.add(key);
  console.error(`Survival: ${where} failed`, error);
  if (where !== 'page' && where !== 'promise' && where !== 'graphics') reportCaught(error, `survival ${where}`);
  show(`${where.toUpperCase()} · ${message.slice(0, 120)}`);
}

function show(text: string) {
  if (typeof document !== 'object') return;
  if (!note) {
    note = document.createElement('div');
    note.className = 'sv-glitch';
    note.setAttribute('role', 'status');
    document.body.append(note);
  }
  note.textContent = `GLITCH CAUGHT — ${text}`;
  note.classList.add('on');
  noteUntil = performance.now() + 7000;
  window.setTimeout(() => { if (performance.now() >= noteUntil - 50) note?.classList.remove('on'); }, 7050);
}

let watching = false;
export function watchGlitches(canvas?: HTMLCanvasElement, active: () => boolean = () => true) {
  if (watching || typeof window !== 'object') return;
  watching = true;
  window.addEventListener('error', event => { if (active()) glitch(event.error ?? event.message, 'page'); });
  window.addEventListener('unhandledrejection', event => { if (active()) glitch(event.reason, 'promise'); });
  canvas?.addEventListener('webglcontextlost', () => glitch(new Error('the graphics context was lost (out of GPU memory, or the driver reset)'), 'graphics'));
}
