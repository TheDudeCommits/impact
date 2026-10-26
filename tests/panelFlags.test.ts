import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PANEL_FLAGS, attributeChanged, carriesPanel, movesFlag, panelFlagsUp } from '../src/ui/panelFlags';

const cssFiles = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? cssFiles(path) : path.endsWith('.css') ? [path] : []; });
const sheets = cssFiles(join(__dirname, '../src')).map(file => [file, readFileSync(file, 'utf8')] as const);
const PANELS = /\.(sv-hud|ascension|manga-home|settings-scrim|rift-battle-map|rift-forge|objective-scrim|training-lab)\b/;

describe('panel flags', () => {
  it('keeps one class per panel state, and no two states share one', () => {
    const flags = PANEL_FLAGS.map(([flag]) => flag);
    expect(new Set(flags).size).toBe(flags.length);
    expect(flags.every(flag => /^pf-[a-z-]+$/.test(flag))).toBe(true);
  });
  it('is up exactly when the selector it replaces matches something', () => {
    expect(panelFlagsUp(() => false)).toEqual([]);
    expect(panelFlagsUp(selector => selector === '.ascension:not(.hidden)')).toEqual(['pf-atlas']);
    expect(panelFlagsUp(selector => selector.startsWith('.settings-scrim'))).toEqual(['pf-settings', 'pf-behind']);
    expect(panelFlagsUp(() => true)).toEqual(PANEL_FLAGS.map(([flag]) => flag));
  });
  it('is asked by the stylesheets as a class, never as :has() on the body, #interface or #app', () => {
    const offenders: string[] = [];
    for (const [file, css] of sheets)
      for (const match of css.matchAll(/([^\s,{}>+~]*):has\(([^{}]{0,90})/g))
        if (/^(body|#app|#interface)/.test(match[1]) && PANELS.test(match[2])) offenders.push(`${file.split('/src/')[1]}: ${match[0].slice(0, 100)}`);
    expect(offenders).toEqual([]);
  });
  const el = (classes: string, children: ReturnType<typeof make>[] = [], id = '') => make(classes, children, id);
  function make(classes: string, children: { classes: string[]; id: string; all(): unknown[] }[], id: string) {
    const node = {
      classes: classes.split(' ').filter(Boolean), id, searched: 0, attributes: {} as Record<string, string | null>,
      is(selector: string) { return selector.split(',').map(part => part.trim()).some(part => part.startsWith('#') ? part.slice(1) === node.id : node.classes.includes(part.slice(1))); },
      all(): { is(selector: string): boolean }[] { return [node, ...children.flatMap(child => child.all() as { is(selector: string): boolean }[])]; },
      matches(selector: string) { return node.is(selector); },
      querySelector(selector: string) { node.searched++; return node.all().slice(1).find(n => n.is(selector)) ?? null; },
      get firstElementChild() { return children[0] ?? null; },
      getAttribute(name: string) { return name === 'class' ? node.classes.join(' ') : node.attributes[name] ?? null; },
    };
    return node;
  }
  it('asks a node put into the page what it is, and searches it only if something is under it', () => {
    const number = el('damage-number'), toast = el('shop-toast', [el('line'), el('line')]), sheet = el('wrapper', [el('inner', [el('rift-forge')])]), scrim = el('objective-scrim');
    expect(carriesPanel(number)).toBe(false);
    expect(number.searched).toBe(0);
    expect(carriesPanel(toast)).toBe(false);
    expect(toast.searched).toBe(1);
    expect(carriesPanel(scrim)).toBe(true);
    expect(scrim.searched).toBe(0);
    expect(carriesPanel(sheet)).toBe(true);
    expect(carriesPanel(el('', [], 'results'))).toBe(true);
  });
  it('moves a flag when a panel\'s class really changes, not when it is written with what it holds', () => {
    const results = el('hidden', [], 'results'), meter = el('fighter-meter own');
    expect(attributeChanged({ target: results, attributeName: 'class', oldValue: 'hidden' })).toBe(false);
    expect(movesFlag({ type: 'attributes', target: results, attributeName: 'class', oldValue: 'hidden', addedNodes: [], removedNodes: [] })).toBe(false);
    results.classes = [];
    expect(movesFlag({ type: 'attributes', target: results, attributeName: 'class', oldValue: 'hidden', addedNodes: [], removedNodes: [] })).toBe(true);
    expect([{ oldValue: '' }, { oldValue: 'hidden' }].some(r => movesFlag({ type: 'attributes', target: results, attributeName: 'class', addedNodes: [], removedNodes: [], ...r }))).toBe(true);
    const lab = el('training-lab');
    expect(movesFlag({ type: 'attributes', target: lab, attributeName: 'open', oldValue: null, addedNodes: [], removedNodes: [] })).toBe(false);
    lab.attributes.open = '';
    expect(movesFlag({ type: 'attributes', target: lab, attributeName: 'open', oldValue: null, addedNodes: [], removedNodes: [] })).toBe(true);
    expect(movesFlag({ type: 'attributes', target: meter, attributeName: 'class', oldValue: 'fighter-meter', addedNodes: [], removedNodes: [] })).toBe(false);
  });
  it('moves a flag when a panel comes or goes, or a results holder is filled, and for nothing else added to the page', () => {
    const hud = el('combat-hud'), holder = el('', [], 'results'), leaf = el('damage-number'), text = { nodeType: 3 };
    expect(movesFlag({ type: 'childList', target: hud, addedNodes: [leaf, text], removedNodes: [] })).toBe(false);
    expect(leaf.searched).toBe(0);
    expect(movesFlag({ type: 'childList', target: hud, addedNodes: [], removedNodes: [el('wrap', [el('ascension')])] })).toBe(true);
    expect(movesFlag({ type: 'childList', target: hud, addedNodes: [el('rift-battle-map')], removedNodes: [] })).toBe(true);
    expect(movesFlag({ type: 'childList', target: holder, addedNodes: [el('results-frame')], removedNodes: [] })).toBe(true);
    expect(movesFlag({ type: 'childList', target: text, addedNodes: [], removedNodes: [] })).toBe(false);
  });
  it('keeps the music caption\'s flags: #interface\'s data-hud, and what zone 5 of the mode HUD holds', () => {
    const node = (kind: 'interface' | 'zone5' | 'other', attributes: Record<string, string | null> = {}) => ({ kind, attributes,
      matches(selector: string) { return kind === 'zone5' ? selector === '.mode-hud>[data-zone="5"]' : kind === 'interface' ? selector.split(',').some(part => part.trim() === '#interface') : false; },
      querySelector() { return null; }, firstElementChild: null, getAttribute(name: string) { return attributes[name] ?? null; } });
    const iface = node('interface', { 'data-hud': 'royale' }), zone = node('zone5'), other = node('other');
    expect(movesFlag({ type: 'attributes', target: iface, attributeName: 'data-hud', oldValue: 'training', addedNodes: [], removedNodes: [] })).toBe(true);
    expect(movesFlag({ type: 'attributes', target: iface, attributeName: 'data-hud', oldValue: 'royale', addedNodes: [], removedNodes: [] })).toBe(false);
    expect(movesFlag({ type: 'childList', target: zone, addedNodes: [{ nodeType: 3 }], removedNodes: [] })).toBe(true);
    expect(movesFlag({ type: 'childList', target: other, addedNodes: [{ nodeType: 3 }], removedNodes: [] })).toBe(false);
    expect(movesFlag({ type: 'characterData', target: { nodeType: 3, parentNode: zone }, addedNodes: [], removedNodes: [] })).toBe(true);
    expect(movesFlag({ type: 'characterData', target: { nodeType: 3, parentNode: other }, addedNodes: [], removedNodes: [] })).toBe(false);
    expect(movesFlag({ type: 'characterData', target: { nodeType: 3, parentNode: null }, addedNodes: [], removedNodes: [] })).toBe(false);
    expect(carriesPanel(node('interface'))).toBe(true);
    const selectors = Object.fromEntries(PANEL_FLAGS);
    expect(selectors['pf-mc-training']).toBe('#interface[data-hud="training"]');
    expect(selectors['pf-mc-aside']).toBe('#interface:is([data-hud="last-stand"],[data-hud="bad-blood"],[data-hud="rift-war"]) .mode-hud>[data-zone="5"]:not(:empty)');
  });
  it('asks no :has() of the body for the music caption, and keeps the specificity the :has() rules had', () => {
    const manga = readFileSync(join(__dirname, '../src/ui/manga.css'), 'utf8'), training = readFileSync(join(__dirname, '../src/ui/hud/trainingHud.css'), 'utf8');
    for (const css of [manga, training]) expect(css.replace(/\/\*[^]*?\*\//g, '')).not.toMatch(/body:has\([^{}]*\)\s*\.music-caption/);
    expect(manga).toContain('body.pf-mc-aside.pf-mc-aside.pf-mc-aside.pf-mc-aside:is(#interface,*) .music-caption{left:auto;right:30px;bottom:calc(14vh + 40px);translate:46px 0}');
    expect(manga).toContain('body.pf-mc-aside.pf-mc-aside.pf-mc-aside.pf-mc-aside:is(#interface,*) .music-caption.mc-on{translate:0 0}');
    expect(training).toContain('body.pf-mc-training:is(#interface,*) .music-caption{display:none!important}');
  });
  it('is not woken by the HUD on a tick that changes nothing', () => {
    const hud = readFileSync(join(__dirname, '../src/ui/Hud.ts'), 'utf8'), shell = readFileSync(join(__dirname, '../src/ui/results/ResultsShell.ts'), 'utf8'), flags = readFileSync(join(__dirname, '../src/ui/panelFlags.ts'), 'utf8');
    const results = hud.slice(hud.indexOf('private results(snapshot:GameSnapshot'), hud.indexOf('panel.innerHTML=matchResults'));
    expect(results.length).toBeGreaterThan(200);
    expect(results).toMatch(/if\(!show\)\{if\(!opening\)panel\.classList\.add\('hidden'\)/);
    expect(results).toMatch(/if\(opening\)panel\.classList\.remove\('hidden'\)/);
    expect(flags).toMatch(/attributeOldValue: true/);
    expect(shell).toMatch(/attributeOldValue: true/);
    expect(shell).toMatch(/attributeChanged\(record\)/);
    const update = hud.slice(hud.indexOf('  update(snapshot:GameSnapshot,self:PlayerState,target:PlayerState|undefined,connected:boolean){'), hud.indexOf('  private refreshBindingHints(){'));
    expect(update.length).toBeGreaterThan(2000);
    expect(update).not.toMatch(/querySelectorAll/);
  });
  it('uses only flags the module keeps', () => {
    const kept = new Set(PANEL_FLAGS.map(([flag]) => flag));
    const used = new Set<string>();
    for (const [, css] of sheets) for (const match of css.matchAll(/\.(pf-[a-z-]+)/g)) used.add(match[1]);
    expect([...used].filter(flag => !kept.has(flag))).toEqual([]);
    expect([...kept].filter(flag => !used.has(flag))).toEqual([]);
  });
});
