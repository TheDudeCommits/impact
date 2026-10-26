import { isReleasedFighter } from '../../game/rosterAvailability';
import { isLaboratoryPreviewFighter } from '../../fighterLab';
import { FIGHTERS } from '../../config';
import type { AttackSlot, CoreSlot, FighterId } from '../../game/types';
import { ATTACK_SLOTS, CORE_SLOTS, ELEMENT_KITS, FIGHTER_IDS, authoredSource, elementKitsOf, simSpec, type ElementKitId } from '../../engine/sim';
import type { ArmoryEffectInfo } from '../../engine/client/forgeLive';
import { fits, type StudioItem, type StudioTarget } from '../../engine/client/forgeStudio';
import { LazyPictures, SLOT_WORDS, el, facesOf, nameOf, slotKey } from './studioDom';

export type LibraryTab = 'moves' | 'vfx';
export type ArmoryShelf = 'missing' | 'loading' | 'ready';

interface Row { key: string; item: StudioItem; node: HTMLElement; group: Group; search: string; kits: readonly string[]; school?: string }
interface Group { key: string; node: HTMLElement; rows: Row[] }
interface Shelf { tree: HTMLElement; rows: Row[]; groups: Group[]; byKey: Map<string, Row>; cursor?: string }

const SCHOOLS: Readonly<Record<string, { label: string; accent: string }>> = {
  frost: { label: 'Frost', accent: '#7ecbe0' }, flame: { label: 'Flame', accent: '#ff8a3c' }, storm: { label: 'Storm', accent: '#7fb4ff' },
  stone: { label: 'Stone', accent: '#a89880' }, verdant: { label: 'Verdant', accent: '#7fc85f' }, void: { label: 'Void', accent: '#a98bff' },
  arcane: { label: 'Arcane', accent: '#ffd27a' }, blood: { label: 'Blood', accent: '#e04a5a' }, aether: { label: 'Aether', accent: '#8fe8d8' },
  tide: { label: 'Tide', accent: '#3fb9c8' }, forge: { label: 'Forge', accent: '#d8763a' }, lumen: { label: 'Lumen', accent: '#ffeec2' },
  ink: { label: 'Ink', accent: '#d8d2c4' }, chrono: { label: 'Chrono', accent: '#d5be8c' }, hive: { label: 'Hive', accent: '#b8a44a' },
  ki: { label: 'Ki', accent: '#fff04a' }, blade: { label: 'Blade', accent: '#ff3355' }, beast: { label: 'Beast', accent: '#ff6ad5' },
  tech: { label: 'Tech', accent: '#4dffa6' }, fx: { label: 'FX Lib', accent: '#9cff57' },
  ice: { label: 'ICE kit', accent: '#9fe6ff' },
};
export const schoolOf = (id: string) => SCHOOLS[id] ?? { label: id ? id[0].toUpperCase() + id.slice(1) : 'Other', accent: '#9fb3bf' };
export const kitLabel = (kit?: string) => kit && kit in ELEMENT_KITS ? ELEMENT_KITS[kit as ElementKitId].label : '';
export function moveName(id: FighterId, slot: AttackSlot): string {
  const source = authoredSource(id, slot), core = CORE_SLOTS.indexOf(source.slot as CoreSlot);
  return (core >= 0 ? FIGHTERS[source.fighter]?.moves?.[core] : undefined) ?? simSpec(id)?.kit.slots[slot]?.name ?? slot;
}
type MoveItem = Extract<StudioItem, { kind: 'move' }>;
export function libraryMoves(own: FighterId): { id: FighterId; moves: { item: MoveItem; name: string }[] }[] {
  const ids = FIGHTER_IDS.filter(id => isReleasedFighter(id) || isLaboratoryPreviewFighter(id)).sort((a, b) => (a === own ? -1 : b === own ? 1 : nameOf(a).localeCompare(nameOf(b))));
  return ids.map(id => ({ id, moves: ATTACK_SLOTS.filter(slot => !!simSpec(id)?.kit.slots[slot])
    .map(slot => ({ item: { kind: 'move' as const, from: id, fromSlot: slot }, name: moveName(id, slot) })) }));
}
export const itemKey = (item: StudioItem) => item.kind === 'move' ? `m:${item.from}:${item.fromSlot}` : `f:${item.effect}`;
const idle = (work: () => void) => { const ask = (globalThis as { requestIdleCallback?: (go: () => void, options?: { timeout: number }) => number }).requestIdleCallback; if (ask) ask(work, { timeout: 1500 }); else setTimeout(work, 50); };

export interface LibraryHooks {
  onTry(item: StudioItem): void;
  onTab(tab: LibraryTab): void;
  onWarm?(item: StudioItem): void;
  onSeen?(fighter: FighterId): void;
}

export class StudioLibrary {
  readonly root: HTMLElement;
  tab: LibraryTab = 'moves';
  private readonly pictures: LazyPictures;
  private readonly shelves: Record<LibraryTab, Shelf>;
  private readonly tabs: Record<LibraryTab, HTMLButtonElement>;
  private readonly search: HTMLInputElement;
  private readonly kitFilter: HTMLSelectElement;
  private readonly schoolFilter: HTMLSelectElement;
  private readonly count: HTMLElement;
  private readonly note: HTMLElement;
  private readonly body: HTMLElement;
  private shelf: ArmoryShelf = 'missing';
  private target: StudioTarget = 'special';
  private effectsKey = '';
  private marks = new Map<string, string>();
  private trying?: string;
  private busy?: string;
  private painted = '';
  private readonly seenGroups = new Set<string>();
  private groupsInView?: IntersectionObserver;

  constructor(private readonly hooks: LibraryHooks, private readonly own: FighterId) {
    this.search = el('input', { type: 'search', placeholder: 'Search fighters and moves', spellcheck: false, autocomplete: 'off', className: 'fs-search-input' });
    this.search.setAttribute('aria-label', 'Search the library');
    this.kitFilter = el('select', { className: 'fs-filter', title: 'Element kit' });
    this.kitFilter.setAttribute('aria-label', 'Filter by element kit');
    this.schoolFilter = el('select', { className: 'fs-filter', title: 'Armory school', hidden: true });
    this.schoolFilter.setAttribute('aria-label', 'Filter by school');
    this.count = el('em', { className: 'fs-count' });
    this.note = el('p', { className: 'fs-note', hidden: true });
    const tab = (id: LibraryTab, text: string) => {
      const b = el('button', { type: 'button', className: 'fs-tab', role: 'tab' }, el('span', { textContent: text }), el('em'));
      b.addEventListener('click', () => this.show(id));
      return b;
    };
    this.tabs = { moves: tab('moves', 'MOVES'), vfx: tab('vfx', 'VFX') };
    this.body = el('div', { className: 'fs-tree-wrap' });
    this.root = el('section', { className: 'fs-panel fs-library' },
      el('header', { className: 'fs-phead' }, el('b', { textContent: 'LIBRARY' }), this.count),
      el('div', { className: 'fs-tabs', role: 'tablist' }, this.tabs.moves, this.tabs.vfx),
      el('label', { className: 'fs-search' }, el('span', { className: 'fs-glass' }), this.search, el('kbd', { textContent: '/' })),
      el('div', { className: 'fs-filters' }, this.kitFilter, this.schoolFilter),
      this.note, this.body,
      el('footer', { className: 'fs-libfoot' }, el('span', { textContent: 'Click or Space: try' }), el('span', { textContent: 'Enter: assign' })));
    this.root.setAttribute('aria-label', 'Forge library');
    this.pictures = new LazyPictures(this.body);
    if (typeof IntersectionObserver === 'function') this.groupsInView = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.group;
        if (!entry.isIntersecting || !id || this.seenGroups.has(id)) continue;
        this.seenGroups.add(id); this.groupsInView?.unobserve(entry.target);
        idle(() => this.hooks.onSeen?.(id as FighterId));
      }
    }, { root: this.body, rootMargin: '200px 0px' });
    this.shelves = { moves: this.shelfOf(), vfx: this.shelfOf() };
    this.buildMoves();
    this.search.addEventListener('input', () => this.filter());
    this.search.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); this.search.blur(); this.move(1); }
      else if (event.key === 'Enter') { event.preventDefault(); const first = this.visible()[0]; if (first) { this.search.blur(); this.setCursor(first.key); this.hooks.onTry(first.item); } }
    });
    for (const select of [this.kitFilter, this.schoolFilter]) select.addEventListener('change', () => { this.filter(); select.blur(); });
    this.show('moves', false);
  }

  private shelfOf(): Shelf {
    const tree = el('div', { className: 'fs-tree', role: 'listbox', hidden: true });
    tree.addEventListener('click', event => {
      const node = (event.target as HTMLElement).closest<HTMLElement>('.fs-row');
      const row = node && this.current().byKey.get(node.dataset.key ?? '');
      if (!row) return;
      this.setCursor(row.key, false);
      this.hooks.onTry(row.item);
    });
    let resting: ReturnType<typeof setTimeout> | undefined;
    tree.addEventListener('pointerover', event => {
      const node = (event.target as HTMLElement).closest<HTMLElement>('.fs-row');
      const row = node && this.current().byKey.get(node.dataset.key ?? '');
      clearTimeout(resting);
      if (row) resting = setTimeout(() => this.hooks.onWarm?.(row.item), 90);
      const group = !row && this.tab === 'moves' ? (event.target as HTMLElement).closest<HTMLElement>('.fs-grp')?.dataset.group : undefined;
      if (group) this.hooks.onSeen?.(group as FighterId);
    });
    tree.addEventListener('pointerleave', () => clearTimeout(resting));
    this.body.append(tree);
    return { tree, rows: [], groups: [], byKey: new Map() };
  }
  private current() { return this.shelves[this.tab]; }


  private buildMoves() {
    const shelf = this.shelves.moves;
    const kits = new Set<string>();
    for (const { id, moves } of libraryMoves(this.own)) {
      const card = FIGHTERS[id], series = card?.series ?? '', fighterKits = elementKitsOf(id);
      fighterKits.forEach(kit => kits.add(kit));
      const head = el('div', { className: 'fs-gh' }, this.pictures.image(facesOf(id), 'fs-face'), el('b', { textContent: nameOf(id) }),
        el('small', { textContent: id === this.own ? 'THIS BODY' : series }));
      const node = el('div', { className: `fs-grp${id === this.own ? ' fs-own' : ''}` }, head);
      node.dataset.group = id;
      const group: Group = { key: id, node, rows: [] };
      for (const { item, name } of moves) {
        const slot = item.fromSlot;
        const rowNode = el('div', { className: 'fs-row fs-move', role: 'option', title: `${name} · ${nameOf(id)}'s ${SLOT_WORDS[slot].toLowerCase()}` },
          el('kbd', { textContent: slotKey(slot) }), el('span', { className: 'fs-tx', textContent: name }), el('i', { className: 'fs-in' }));
        const row: Row = { key: `m:${id}:${slot}`, item, node: rowNode, group, search: `${nameOf(id)} ${series} ${name} ${SLOT_WORDS[slot]} ${id}`.toLowerCase(), kits: fighterKits };
        rowNode.dataset.key = row.key;
        group.rows.push(row); shelf.rows.push(row); shelf.byKey.set(row.key, row);
        node.append(rowNode);
      }
      shelf.groups.push(group);
      shelf.tree.append(node);
      this.groupsInView?.observe(node);
    }
    this.countMoves();
    this.fillKits([...kits]);
  }

  setEffects(list: readonly ArmoryEffectInfo[] | undefined, shelf: ArmoryShelf) {
    this.shelf = shelf;
    const key = list ? `${list.length}:${list[0]?.id ?? ''}:${list[list.length - 1]?.id ?? ''}` : '';
    if (key !== this.effectsKey) {
      this.effectsKey = key;
      const vfx = this.shelves.vfx;
      vfx.tree.replaceChildren(); vfx.rows = []; vfx.groups = []; vfx.byKey.clear(); vfx.cursor = undefined;
      const schools = new Map<string, ArmoryEffectInfo[]>();
      for (const info of list ?? []) schools.set(info.school, [...(schools.get(info.school) ?? []), info]);
      for (const [school, effects] of [...schools].sort(([a], [b]) => schoolOf(a).label.localeCompare(schoolOf(b).label))) {
        const { label, accent } = schoolOf(school);
        const node = el('div', { className: 'fs-grp fs-school' }, el('div', { className: 'fs-gh' }, el('i', { className: 'fs-dot' }), el('b', { textContent: label }), el('small', { textContent: String(effects.length) })));
        node.style.setProperty('--accent', accent);
        node.dataset.group = school;
        const group: Group = { key: school, node, rows: [] };
        for (const info of [...effects].sort((a, b) => a.label.localeCompare(b.label))) {
          const tile = el('span', { className: 'fs-th' }, this.pictures.image(info.thumb ? [info.thumb] : [], 'fs-thumb'), el('b', { className: 'fs-initial', textContent: info.label.charAt(0) }));
          const meta = [label, kitLabel(info.kit), info.cast === 'zone' ? 'zone' : 'line'].filter(Boolean).join(' · ');
          const rowNode = el('div', { className: 'fs-row fs-fx', role: 'option', title: info.label },
            tile, el('span', { className: 'fs-tx' }, el('b', { textContent: info.label }), el('small', { textContent: meta })), el('i', { className: 'fs-in' }));
          const row: Row = { key: `f:${info.id}`, item: { kind: 'fx', effect: info.id }, node: rowNode, group, school,
            search: `${info.label} ${info.id} ${label} ${kitLabel(info.kit)} ${info.cast}`.toLowerCase(), kits: info.kit ? [info.kit] : [] };
          rowNode.dataset.key = row.key;
          group.rows.push(row); vfx.rows.push(row); vfx.byKey.set(row.key, row);
          node.append(rowNode);
        }
        vfx.groups.push(group); vfx.tree.append(node);
      }
      const schoolsSeen = [...schools.keys()].sort((a, b) => schoolOf(a).label.localeCompare(schoolOf(b).label));
      const keepSchool = this.schoolFilter.value;
      this.schoolFilter.replaceChildren(el('option', { value: '', textContent: 'Every school' }), ...schoolsSeen.map(id => el('option', { value: id, textContent: schoolOf(id).label })));
      this.schoolFilter.value = schoolsSeen.includes(keepSchool) ? keepSchool : '';
      this.tabs.vfx.querySelector('em')!.textContent = list?.length ? String(list.length) : '';
      this.paintMarks();
    }
    this.note.hidden = this.tab !== 'vfx' || shelf === 'ready' && !!list?.length;
    this.note.textContent = shelf === 'missing' ? 'The VFX Armory is on its way to the game: its effects appear here, ready to try, the moment this build carries them.'
      : shelf === 'loading' || !list?.length ? 'Loading the VFX Armory…' : '';
    this.note.classList.toggle('fs-loading', shelf === 'loading');
    if (this.tab === 'vfx') this.filter();
  }

  private fillKits(kits: readonly string[]) {
    const order = Object.keys(ELEMENT_KITS).filter(kit => kits.includes(kit));
    this.kitFilter.replaceChildren(el('option', { value: '', textContent: 'Every element kit' }), ...order.map(kit => el('option', { value: kit, textContent: kitLabel(kit) })));
  }


  show(tab: LibraryTab, notify = true) {
    this.tab = tab;
    for (const [id, b] of Object.entries(this.tabs) as [LibraryTab, HTMLButtonElement][]) { b.classList.toggle('on', id === tab); b.setAttribute('aria-selected', String(id === tab)); }
    for (const [id, shelf] of Object.entries(this.shelves) as [LibraryTab, Shelf][]) shelf.tree.hidden = id !== tab;
    this.search.placeholder = tab === 'moves' ? 'Search fighters and moves' : 'Search effects, schools, kits';
    this.schoolFilter.hidden = tab !== 'vfx';
    this.note.hidden = tab !== 'vfx' || this.shelf === 'ready' && this.shelves.vfx.rows.length > 0;
    this.filter();
    if (notify) this.hooks.onTab(tab);
  }
  setTarget(target: StudioTarget) {
    if (target === this.target) return;
    this.target = target;
    this.countMoves();
    this.filter();
    const moves = this.shelves.moves, row = moves.cursor ? moves.byKey.get(moves.cursor) : undefined;
    if (row && !fits(target, row.item)) { row.node.classList.remove('cur'); row.node.removeAttribute('aria-selected'); moves.cursor = undefined; }
  }
  private countMoves() { this.tabs.moves.querySelector('em')!.textContent = String(this.shelves.moves.rows.filter(row => fits(this.target, row.item)).length); }
  private filter() {
    const shelf = this.current(), words = this.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const kit = this.kitFilter.value, school = this.tab === 'vfx' ? this.schoolFilter.value : '';
    let shown = 0, listed = 0;
    for (const group of shelf.groups) {
      let any = false;
      for (const row of group.rows) {
        const fit = fits(this.target, row.item);
        if (fit) listed++;
        const on = fit && (!kit || row.kits.includes(kit)) && (!school || row.school === school) && words.every(word => row.search.includes(word));
        if (row.node.hidden === on) row.node.hidden = !on;
        if (on) { any = true; shown++; }
      }
      if (group.node.hidden === any) group.node.hidden = !any;
    }
    this.count.textContent = `${shown} / ${listed}`;
  }
  private visible() { return this.current().rows.filter(row => !row.node.hidden); }


  move(step: number) {
    const rows = this.visible();
    if (!rows.length) return;
    const at = rows.findIndex(row => row.key === this.current().cursor);
    const next = at < 0 ? (step > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, at + step));
    this.setCursor(rows[next].key);
  }
  jump(step: number) {
    const shelf = this.current(), groups = shelf.groups.filter(group => !group.node.hidden);
    if (!groups.length) return;
    const at = groups.findIndex(group => group.rows.some(row => row.key === shelf.cursor));
    const next = groups[at < 0 ? 0 : Math.max(0, Math.min(groups.length - 1, at + step))];
    const row = next.rows.find(each => !each.node.hidden);
    if (row) this.setCursor(row.key);
  }
  setCursor(key: string, reveal = true) {
    const shelf = this.current(), was = shelf.cursor ? shelf.byKey.get(shelf.cursor) : undefined;
    was?.node.classList.remove('cur'); was?.node.removeAttribute('aria-selected');
    shelf.cursor = key;
    const row = shelf.byKey.get(key);
    if (!row) return;
    row.node.classList.add('cur');
    row.node.setAttribute('aria-selected', 'true');
    if (reveal) { row.node.scrollIntoView({ block: 'nearest' }); this.hooks.onWarm?.(row.item); }
  }
  cursorItem(): StudioItem | undefined { const shelf = this.current(); return shelf.cursor ? shelf.byKey.get(shelf.cursor)?.item : undefined; }
  focusSearch() { this.search.focus(); this.search.select(); }


  setMarks(marks: Map<string, string>, trying?: string, busy?: string) {
    const painted = `${[...marks].join(';')}|${trying}|${busy}`;
    if (painted === this.painted) return;
    this.painted = painted; this.marks = marks; this.trying = trying; this.busy = busy;
    this.paintMarks();
  }
  private paintMarks() {
    for (const shelf of Object.values(this.shelves)) for (const row of shelf.rows) {
      const mark = this.marks.get(row.key) ?? '', badge = row.node.lastElementChild as HTMLElement;
      if (badge.textContent !== mark) badge.textContent = mark;
      row.node.classList.toggle('fs-held', !!mark);
      row.node.classList.toggle('fs-trying', row.key === this.trying);
      row.node.classList.toggle('fs-busy', row.key === this.busy);
    }
  }
  dispose() { this.pictures.dispose(); }
}
