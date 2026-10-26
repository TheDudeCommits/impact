import './legal.css';
import { CONTACT, CREDITS_PAGE, FAN_MADE, PRIVACY_PAGE, TERMS_PAGE } from './legalLinks';

export { CONTACT, CREDITS_PAGE, PRIVACY_PAGE, TERMS_PAGE };

export const legalEntry = () => `<button type="button" class="home-legal-entry" id="home-legal" data-open-legal data-focus="legal"><span>LEGAL<small>FAN-MADE · TAKEDOWNS · PRIVACY</small></span><b aria-hidden="true">→</b></button><button type="button" class="home-legal-entry" id="home-credits" data-open-credits data-focus="credits" aria-label="Credits, in a new tab"><span>CREDITS<small>ARTISTS · MUSIC · CODE</small></span><b aria-hidden="true">↗</b></button>`;

export function legalPage(): string {
  return `<section class="home-legal" id="home-legal-page" aria-label="Legal">
    <button type="button" class="home-options-back" data-legal-back data-focus="legal-back">← OPTIONS</button>
    <p class="home-legal-lead">${FAN_MADE}</p>
    <p>Rights holders: to request the removal of any material, email <a href="mailto:${CONTACT}">${CONTACT}</a> and it will be taken down promptly.</p>
    <div class="home-legal-pages"><button type="button" class="home-legal-privacy" data-open-terms data-focus="terms">TERMS OF USE <span aria-hidden="true">↗</span></button><button type="button" class="home-legal-privacy" data-open-privacy data-focus="privacy">PRIVACY <span aria-hidden="true">↗</span></button></div>
  </section>`;
}

let shown: { host: HTMLElement; kids: HTMLElement[]; title?: string; dialog?: HTMLDialogElement } | undefined;

function open(entry: HTMLElement) {
  close(false);
  const host = entry.closest<HTMLElement>('#home-options-fields') ?? entry.parentElement?.parentElement;
  if (!host) return;
  const kids = [...host.children].filter((kid): kid is HTMLElement => kid instanceof HTMLElement);
  for (const kid of kids) kid.style.setProperty('display', 'none', 'important');
  host.insertAdjacentHTML('beforeend', legalPage());
  const title = document.getElementById('home-dialog-title'), dialog = host.closest('dialog') ?? undefined;
  shown = { host, kids, title: title?.textContent ?? undefined, dialog };
  if (title) title.textContent = 'LEGAL';
  dialog?.addEventListener('close', onClose);
  host.querySelector<HTMLElement>('[data-legal-back]')?.focus({ preventScroll: true });
  host.scrollTop = 0; if (dialog) dialog.scrollTop = 0;
}
const onClose = () => close(false);
function close(focus = true) {
  if (!shown) return;
  const { host, kids, title, dialog } = shown;
  shown = undefined;
  dialog?.removeEventListener('close', onClose);
  host.querySelector('#home-legal-page')?.remove();
  for (const kid of kids) kid.style.removeProperty('display');
  const heading = document.getElementById('home-dialog-title');
  if (heading && title !== undefined) heading.textContent = title;
  if (focus) host.querySelector<HTMLElement>('#home-legal')?.focus({ preventScroll: true });
}

if (typeof document !== 'undefined') document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  const entry = target?.closest<HTMLElement>('[data-open-legal]');
  if (entry) open(entry);
  else if (target?.closest('[data-legal-back]')) close();
  else if (target?.closest('[data-open-terms]')) window.open(TERMS_PAGE, '_blank', 'noopener');
  else if (target?.closest('[data-open-privacy]')) window.open(PRIVACY_PAGE, '_blank', 'noopener');
  else if (target?.closest('[data-open-credits]')) window.open(CREDITS_PAGE, '_blank', 'noopener');
});
