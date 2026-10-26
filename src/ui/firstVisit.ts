import './firstVisit.css';
import { CONTACT, CREDITS_PAGE, FAN_MADE, PRIVACY_PAGE, REPO_PAGE, TERMS_PAGE } from './legalLinks';

export const NOTICE_KEY = 'jump-fan-notice';
export const NOTICE_VERSION = '2';

export const NOTICE_LINES = {
  fan: 'Impact is purely a fan game, made by lovers of anime and manga who grew up watching these characters day in and day out.',
  free: 'The game is open source. It has no monetization whatsoever, and it never will, in any form or shape.',
  takedown: 'If you are an IP owner, or someone whose models, effects or other assets have been used in the game, and you would like them removed, email',
  promise: 'and they will be removed promptly.',
  terms: 'By playing you accept the',
} as const;

export function noticeDue(at: { seen: string | null; webdriver: boolean; forced: boolean }): boolean {
  return at.forced || (!at.webdriver && at.seen !== NOTICE_VERSION);
}

export function noticeHtml(): string {
  const out = (href: string, label: string, focus: string) => `<a class="first-visit-link" href="${href}" target="_blank" rel="noopener" data-focus="${focus}">${label} <span aria-hidden="true">↗</span></a>`;
  return `<p class="first-visit-eyebrow">BEFORE YOU PLAY</p>
    <h2 id="first-visit-title">A FAN GAME, MADE WITH LOVE</h2>
    <p>${NOTICE_LINES.fan}</p>
    <p>${NOTICE_LINES.free}</p>
    <p class="first-visit-takedown">${NOTICE_LINES.takedown} <a href="mailto:${CONTACT}">${CONTACT}</a> ${NOTICE_LINES.promise}</p>
    <p class="first-visit-small">${FAN_MADE}</p>
    <p class="first-visit-small first-visit-terms">${NOTICE_LINES.terms} <a href="${TERMS_PAGE}" target="_blank" rel="noopener" data-focus="notice-terms">terms of use</a>.</p>
    <nav class="first-visit-links" aria-label="More about the project">${out(PRIVACY_PAGE, 'LEGAL &amp; PRIVACY', 'notice-legal')}${out(CREDITS_PAGE, 'CREDITS', 'notice-credits')}${out(REPO_PAGE, 'GITHUB', 'notice-source')}</nav>
    <button type="button" class="first-visit-go" data-focus="notice-go">GOT IT, LET'S PLAY</button>`;
}

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { } };

export function mountFirstVisit(doc: Document = document): HTMLDialogElement | undefined {
  const forced = new URLSearchParams(doc.defaultView?.location.search ?? '').has('notice');
  if (!noticeDue({ seen: read(NOTICE_KEY), webdriver: !!doc.defaultView?.navigator.webdriver, forced }) || doc.getElementById('first-visit')) return undefined;
  const dialog = doc.createElement('dialog');
  dialog.id = 'first-visit'; dialog.className = 'first-visit'; dialog.setAttribute('aria-labelledby', 'first-visit-title');
  dialog.innerHTML = noticeHtml();
  doc.body.append(dialog);
  const go = dialog.querySelector<HTMLButtonElement>('.first-visit-go')!;
  go.onclick = () => dialog.close();
  let frame = 0, held = true;
  const pad = () => {
    const down = [...(doc.defaultView?.navigator.getGamepads?.() ?? [])].some(p => p && (p.buttons[0]?.pressed || p.buttons[9]?.pressed));
    if (down && !held) { dialog.close(); return; }
    held = down; frame = requestAnimationFrame(pad);
  };
  dialog.addEventListener('close', () => { cancelAnimationFrame(frame); write(NOTICE_KEY, NOTICE_VERSION); dialog.remove(); }, { once: true });
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  go.focus({ preventScroll: true });
  frame = requestAnimationFrame(pad);
  return dialog;
}
