import { economyServer } from '../ui/shop/account';
import { levelOf } from '../game/economy/earn';
import { CURRENCY } from '../game/economy/currency';

export const HOSTED = new URL((import.meta.env?.VITE_P2_HOSTED as string | undefined) || 'https://impact.playertwo.cc').origin;
export const CODE_WAIT = 10_000;

export const isLinkWindow = (hash: string) => hash === '#p2link';

type Opener = { postMessage(message: unknown, targetOrigin: string): void };
export function codeFrom(event: { source: unknown; origin: string; data: unknown }, opener: Opener | null, hosted = HOSTED): string | undefined {
  if (!opener || event.source !== opener || event.origin !== hosted) return undefined;
  const data = event.data as { p2link?: unknown; code?: unknown } | null;
  return data?.p2link === 'code' && typeof data.code === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(data.code) ? data.code : undefined;
}

export function awaitCode(win: Pick<Window, 'addEventListener' | 'removeEventListener'> & { opener: Opener | null }, ms = CODE_WAIT, hosted = HOSTED, every = 1000): Promise<string | undefined> {
  const opener = win.opener;
  if (!opener) return Promise.resolve(undefined);
  return new Promise(resolve => {
    const began = Date.now();
    const ask = () => { try { opener.postMessage({ p2link: 'ready' }, hosted); } catch { } };
    const heard = (event: MessageEvent) => { const code = codeFrom(event, opener, hosted); if (code) finish(code); };
    const again = setInterval(() => { if (Date.now() - began >= ms) finish(undefined); else ask(); }, every);
    function finish(code: string | undefined) { clearInterval(again); win.removeEventListener('message', heard as EventListener); resolve(code); }
    win.addEventListener('message', heard as EventListener);
    ask();
  });
}

export interface Kept { name?: string; level: number; sumi: number }
export function keptOf(remembered: string | null): Kept | null {
  try { const account = (JSON.parse(remembered ?? 'null') as { account?: { name?: string; xp?: number; balance?: number } } | null)?.account; return account ? { name: account.name, level: levelOf(account.xp ?? 0).level, sumi: Math.floor(account.balance ?? 0) } : null; } catch { return null; }
}
export type LinkState = { at: 'reading' } | { at: 'unopened' } | { at: 'none' } | { at: 'ask'; to: { handle: string; name: string }; kept: Kept | null } | { at: 'moving' } | { at: 'done' } | { at: 'refused'; why: string };

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const BUTTON = 'font:700 15px system-ui,sans-serif;letter-spacing:.06em;padding:12px 18px;border:2px solid #111;cursor:pointer';
export function linkHtml(state: LinkState): string {
  const close = `<button type="button" data-link="cancel" style="${BUTTON};background:#fff;color:#111">CLOSE</button>`;
  const head = '<p style="margin:0;font:700 12px system-ui,sans-serif;letter-spacing:.12em;color:#cc202b">IMPACT · PLAYER TWO</p><h1 style="margin:6px 0 14px;font:800 26px/1.15 system-ui,sans-serif">Bring your Impact account to Player Two</h1>';
  if (state.at === 'reading' || state.at === 'moving') return `${head}<p>${state.at === 'reading' ? 'Waiting for Impact in Player Two…' : 'Bringing it over…'}</p>`;
  if (state.at === 'unopened') return `${head}<p>This window does its work only when Impact opens it from Player Two: open Impact on playertwo.lol, and press BRING IT OVER in its ACCOUNT tab. Nothing was moved.</p>${close}`;
  if (state.at === 'none') return `${head}<p>This browser has no Impact account to bring over: nothing was played here on impact.dude.work. Your account in Player Two stays as it is.</p>${close}`;
  if (state.at === 'refused') return `${head}<p>${escape(state.why)}</p>${close}`;
  if (state.at === 'done') return `${head}<p><b>Done.</b> Your Impact account is on Player Two now: the same account here and in Player Two's player. This window closes by itself.</p>`;
  const kept = state.kept ? `${state.kept.name ? `<b>${escape(state.kept.name)}</b>, ` : 'A guest account, '}level ${state.kept.level}, ${state.kept.sumi.toLocaleString('en-US')} ${CURRENCY.name}` : 'The Impact account this browser kept';
  const who = `<b>@${escape(state.to.handle || 'player')}</b>${state.to.name ? ` (${escape(state.to.name)})` : ''}`;
  return `${head}<p>${kept} moves into the Impact account of Player Two player ${who}. Everything on both comes together, and from then on it is one account, here and in Player Two's player. This can't be undone.</p>
    <p style="color:#555">Not your Player Two account? Close this window, and nothing moves.</p>
    <p style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button type="button" data-link="go" style="${BUTTON};background:#cc202b;color:#fff;border-color:#cc202b">MOVE IT TO PLAYER TWO</button>${close}</p>`;
}

async function run() {
  const root = document.createElement('main');
  root.setAttribute('style', 'max-width:460px;margin:0 auto;padding:28px 20px;font:16px/1.5 system-ui,sans-serif;color:#111');
  document.body.replaceChildren(root);
  document.body.setAttribute('style', 'margin:0;background:#fff');
  document.title = 'Bring your account to Player Two · Impact';
  const show = (state: LinkState) => { root.innerHTML = linkHtml(state); root.querySelector<HTMLButtonElement>('[data-link="cancel"]')?.addEventListener('click', () => window.close()); };
  const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${economyServer()}/api/economy/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => { throw new Error('The server could not be reached. Try again in a moment.'); });
    const answer = await response.json().catch(() => ({})) as { error?: string; player?: { handle: string; name: string } };
    if (!response.ok) throw new Error(answer.error ?? `The server answered ${response.status}.`);
    return answer;
  };
  if (!window.opener) { show({ at: 'unopened' }); return; }
  const token = read('jump-account-token');
  if (!token) { show({ at: 'none' }); return; }
  show({ at: 'reading' });
  const code = await awaitCode(window);
  if (!code) { show({ at: 'unopened' }); return; }
  let to: { handle: string; name: string };
  try { to = (await post('p2-link-info', { code })).player!; } catch (error) { show({ at: 'refused', why: (error as Error).message }); return; }
  show({ at: 'ask', to, kept: keptOf(read('jump-account')) });
  root.querySelector<HTMLButtonElement>('[data-link="go"]')?.addEventListener('click', () => void (async () => {
    show({ at: 'moving' });
    try { await post('p2-link', { code, token }); } catch (error) { show({ at: 'refused', why: (error as Error).message }); return; }
    show({ at: 'done' });
    try { window.opener?.postMessage({ p2link: 'done' }, HOSTED); } catch { }
    setTimeout(() => window.close(), 1500);
  })());
}

if (typeof window === 'object' && window.parent === window && isLinkWindow(location.hash)) {
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  void run();
  await new Promise<never>(() => {});
}
