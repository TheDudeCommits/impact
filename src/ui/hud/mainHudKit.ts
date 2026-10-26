import { BINDINGS_EVENT } from '../../input/bindings';
import type { ModeHudFrame } from './modeHud';


export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}
export function setText(node: Element, value: string) { if (node.textContent !== value) node.textContent = value; }
export function setHtml(node: HTMLElement & { _html?: string }, value: string) { if (node._html !== value) { node._html = value; node.innerHTML = value; } }
export function flag(node: HTMLElement, name: string, on: boolean) {
  if (on === (name in node.dataset)) return;
  if (on) node.dataset[name] = ''; else delete node.dataset[name];
}
export function attr(node: HTMLElement, name: string, value: string | undefined) {
  if (node.dataset[name] === value) return;
  if (value === undefined) delete node.dataset[name]; else node.dataset[name] = value;
}
export function show(node: HTMLElement, on: boolean) { if (node.hidden === on) node.hidden = !on; }

let bindingsVersion = 0;
if (typeof window === 'object') window.addEventListener(BINDINGS_EVENT, () => { bindingsVersion++; });
export class PromptWatch {
  private key = '';
  changed(frame: Pick<ModeHudFrame, 'input' | 'family'>) {
    const key = `${frame.input}|${frame.family}|${bindingsVersion}`;
    if (key === this.key) return false;
    this.key = key; return true;
  }
  reset() { this.key = ''; }
}

export function callName(player: { id: string; name: string; isBot: boolean; fighter: string }, selfId: string, fighterName: (id: string) => string) {
  if (player.id === selfId) return 'YOU';
  const name = player.name?.trim();
  return (player.isBot || !name || name === 'Fighter' ? fighterName(player.fighter) : name).toUpperCase();
}

export const KO_SECONDS = 1.3;
export function centreBusy(root: HTMLElement) {
  if ('cinema' in root.dataset) return true;
  const splash = document.querySelector<HTMLElement>('.vs-splash');
  if (splash && !splash.hidden) return true;
  const message = root.querySelector('#action-message');
  return !!message?.textContent;
}
