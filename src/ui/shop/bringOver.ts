import { playerTwo, type PlayerTwoApi } from '../../boot/playerTwo';
import { Refused, account as browserAccount, type AccountClient } from './account';

export const HOME = new URL((import.meta.env?.VITE_IMPACT_HOME as string | undefined) || 'https://impact.dude.work').origin;
const WAIT = 10 * 60_000;

export interface BringOverDeps {
  account: Pick<AccountClient, 'linkCode' | 'start'>;
  find: () => Promise<Pick<PlayerTwoApi, 'identity'> | undefined>;
  open: (url: string, name: string, features: string) => Window | null;
  page: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export async function bringOver(deps: BringOverDeps = { account: browserAccount, find: playerTwo, open: (url, name, features) => window.open(url, name, features), page: window }): Promise<'moved' | 'left'> {
  const popup = deps.open(`${HOME}/#p2link`, 'impact-bring-over', 'popup,width=520,height=720');
  if (!popup) throw new Refused('The browser blocked the window. Let this page open pop-ups, and try again.');
  let code: string | undefined, ready = false, settle: (how: 'moved' | 'left') => void = () => {};
  const send = () => { if (code && ready && !popup.closed) popup.postMessage({ p2link: 'code', code }, HOME); };
  const heard = (event: MessageEvent) => {
    if (event.origin !== HOME || event.source !== popup) return;
    const what = (event.data as { p2link?: unknown } | null)?.p2link;
    if (what === 'ready') { ready = true; send(); } else if (what === 'done') settle('moved');
  };
  deps.page.addEventListener('message', heard as EventListener);
  const began = Date.now();
  const ended = new Promise<'moved' | 'left'>(resolve => {
    const timer = setInterval(() => { if (popup.closed || Date.now() - began > WAIT) settle('left'); }, 500);
    settle = how => { clearInterval(timer); deps.page.removeEventListener('message', heard as EventListener); resolve(how); };
  });
  try {
    const p2 = await deps.find();
    if (!p2) throw new Refused('Sign in to Player Two first.');
    code = await deps.account.linkCode(await p2.identity());
    send();
  } catch (error) { settle('left'); popup.close(); throw error; }
  const how = await ended;
  await deps.account.start();
  return how;
}
