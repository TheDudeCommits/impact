const ZONE5 = '.mode-hud>[data-zone="5"]';
const ZONE5_CARD = `#interface:is([data-hud="last-stand"],[data-hud="bad-blood"],[data-hud="rift-war"]) ${ZONE5}:not(:empty)`;
export const PANEL_FLAGS: ReadonlyArray<readonly [flag: string, selector: string]> = [
  ['pf-sv', '.sv-hud:not(.hidden)'],
  ['pf-atlas', '.ascension:not(.hidden)'],
  ['pf-home', '.manga-home:not(.hidden)'],
  ['pf-settings', '.settings-scrim:not(.hidden)'],
  ['pf-behind', '.settings-scrim.gm-behind'],
  ['pf-rift-sheet', '.rift-battle-map[open], .rift-forge[open]'],
  ['pf-sv-modal', '.sv-hud.modal'],
  ['pf-objective', '.objective-scrim:not(.hidden)'],
  ['pf-lab', '.training-lab[open]'],
  ['pf-results', '#results:not(.hidden)>.results-frame, .objective-scrim:not(.hidden)>.results-frame, #sv-results.ux-framed:not(.hidden)'],
  ['pf-sv-results', '#sv-results.ux-framed:not(.hidden)'],
  ['pf-mc-aside', ZONE5_CARD],
  ['pf-mc-training', '#interface[data-hud="training"]'],
];
const PANELS = '.sv-hud, .ascension, .manga-home, .settings-scrim, .rift-battle-map, .rift-forge, .objective-scrim, .training-lab, #results, #sv-results, #interface, .mode-hud';
const FRAME_HOLDERS = '#results, .objective-scrim';

export function panelFlagsUp(has: (selector: string) => boolean) { return PANEL_FLAGS.filter(([, selector]) => has(selector)).map(([flag]) => flag); }

type Asked = { matches(selector: string): boolean; querySelector(selector: string): unknown; firstElementChild: unknown };
type Change = { type: string; target: unknown; attributeName?: string | null; oldValue?: string | null; addedNodes: Iterable<unknown>; removedNodes: Iterable<unknown> };
const isElement = (node: unknown): node is Asked & { getAttribute(name: string): string | null } => !!node && typeof (node as Asked).matches === 'function';

export function carriesPanel(node: Asked) { return node.matches(PANELS) || (node.firstElementChild !== null && node.querySelector(PANELS) !== null); }

export function attributeChanged(record: { target: unknown; attributeName?: string | null; oldValue?: string | null }) {
  return !isElement(record.target) || !record.attributeName || record.target.getAttribute(record.attributeName) !== (record.oldValue ?? null);
}

export function movesFlag(record: Change) {
  if (record.type === 'characterData') { const parent = (record.target as { parentNode?: unknown } | null)?.parentNode; return isElement(parent) && parent.matches(ZONE5); }
  if (!isElement(record.target)) return false;
  if (record.type !== 'childList') return (record.attributeName === 'data-hud' || record.target.matches(PANELS)) && attributeChanged(record);
  if (record.target.matches(FRAME_HOLDERS) || record.target.matches(ZONE5)) return true;
  for (const node of record.addedNodes) if (isElement(node) && carriesPanel(node)) return true;
  for (const node of record.removedNodes) if (isElement(node) && carriesPanel(node)) return true;
  return false;
}

let installed: MutationObserver | undefined;
export function installPanelFlags(root: ParentNode = document, body: HTMLElement = document.body) {
  if (installed) return;
  const sync = () => { const up = new Set(panelFlagsUp(selector => !!root.querySelector(selector))); for (const [flag] of PANEL_FLAGS) if (body.classList.contains(flag) !== up.has(flag)) body.classList.toggle(flag, up.has(flag)); };
  sync();
  installed = new MutationObserver(records => { for (const record of records) if (movesFlag(record)) { sync(); return; } });
  installed.observe(body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'open', 'data-hud'], attributeOldValue: true });
}
