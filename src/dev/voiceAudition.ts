import { FIGHTERS } from '../config';
import type { FighterId } from '../game/types';
import { AUDIO_CUES, type AudioCue } from '../audio/cueTypes';
import { SITUATION_RULES, VOICE_SITUATIONS, auditionRows, isRift, riftUrl, type LineOrigin, type SituationLine, type VoiceSituation } from '../audio/voiceSituations';
import { HOME_BASELINE_FIGHTERS, HOME_EXPANSION_FIGHTERS, HOME_ORIGINAL_FIGHTERS } from '../ui/HomeRosterOrder';

const WHEN: Record<VoiceSituation, [title: string, when: string]> = {
  hurt: ['Hit', 'a hit taken'], 'hurt-heavy': ['Thrown', 'a launch, knockdown or wall splat'], ko: ['Knocked out', 'the victim\'s cry'],
  kill: ['Scored a knockout', 'the killer\'s line'], bell: ['The bell', 'at FIGHT!'], parry: ['Blow read', 'a perfect guard or dodge'],
  low: ['Low health', 'once a life, at 30%'], taunt: ['Taunt', 'the emote wheel'], win: ['Win', 'the result, in place of the home line'], loss: ['Loss', 'the result, after the winner'],
};
interface Heard { line?: string; meaning?: string; uncertain?: boolean; free?: string; flags?: string[] }
interface Row { fighter: FighterId; kind: VoiceSituation; line: SituationLine; from: LineOrigin; seconds: number; rejected: boolean }
type Verdict = { reject: boolean; note: string };

const STORE = 'jump.voiceAudition.v1';
const order: FighterId[] = [...HOME_ORIGINAL_FIGHTERS, ...HOME_BASELINE_FIGHTERS.filter(id => !(HOME_ORIGINAL_FIGHTERS as readonly string[]).includes(id)), ...HOME_EXPANSION_FIGHTERS,
  ...(Object.keys(FIGHTERS) as FighterId[])].filter((id, index, all) => all.indexOf(id) === index);
const key = (row: Pick<Row, 'fighter' | 'kind' | 'line'>) => `${row.fighter}|${row.kind}|${row.line}`;
const json = async (url: string) => { try { const response = await fetch(url); return response.ok ? await response.json() : undefined; } catch { return undefined; } };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props); node.append(...children);
  return node;
}

async function main() {
  const [voice, base, boss, readings] = await Promise.all([json('/assets/audio/v2/voice/manifest.json'), json('/assets/audio/v2/manifest.json'),
    json('/assets/audio/survival/boss-voices.json'), json('/docs/audio/voice-situation-readings.json')]);
  const heard = new Map<string, Heard>();
  for (const row of [...(base?.assets ?? []), ...(voice?.assets ?? [])] as Record<string, unknown>[]) {
    const whisper = row.whisper as { free?: string } | undefined;
    heard.set(row.id as string, { line: row.line as string | undefined, meaning: (row.meaning ?? row.editorialMeaning) as string | undefined, uncertain: !!row.transcriptionUncertain, free: whisper?.free });
  }
  for (const row of (boss?.assets ?? []) as Record<string, string>[]) heard.set(`rift:${row.id.replace(/^boss-/, '')}`, { line: row.text || undefined });
  for (const [line, row] of Object.entries((readings?.lines ?? {}) as Record<string, Heard>)) heard.set(line, { ...heard.get(line), ...Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined && value !== '')) });

  const rows = auditionRows() as Row[];
  let saved: Record<string, Verdict> = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) ?? '{}'); } catch { }
  const verdict = (row: Row): Verdict => saved[key(row)] ?? { reject: row.rejected, note: '' };
  const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { } };
  const listened = new Set<string>();

  const list = document.querySelector<HTMLElement>('#list')!, show = document.querySelector<HTMLSelectElement>('#show')!, kindPick = document.querySelector<HTMLSelectElement>('#kind')!;
  const find = document.querySelector<HTMLInputElement>('#find')!, count = document.querySelector<HTMLElement>('#count')!;
  for (const kind of VOICE_SITUATIONS) kindPick.append(el('option', { value: kind, textContent: `${WHEN[kind][0]} (${kind})` }));

  let playing: { audio: HTMLAudioElement; tr: HTMLElement } | undefined;
  const play = (row: Row, tr: HTMLElement) => {
    if (playing) { playing.audio.pause(); playing.tr.classList.remove('playing'); }
    const audio = new Audio(isRift(row.line) ? riftUrl(row.line) : `/assets/audio/v2/${AUDIO_CUES[row.line as AudioCue]}`);
    playing = { audio, tr }; tr.classList.add('playing');
    audio.onended = () => { tr.classList.remove('playing'); tr.classList.add('heard-once'); listened.add(key(row)); tally(); };
    audio.onerror = () => { tr.classList.remove('playing'); tr.querySelector('td.notes')?.append(el('span', { className: 'flag warn', textContent: 'the file did not load' })); };
    void audio.play();
  };
  const shown = (): Row[] => rows.filter(row => (show.value === 'all' || (show.value === 'new' ? row.from !== 'quip' && row.from !== 'cry' : verdict(row).reject))
    && (!kindPick.value || row.kind === kindPick.value) && (!find.value || FIGHTERS[row.fighter].name.toLowerCase().includes(find.value.toLowerCase()) || row.fighter.includes(find.value.toLowerCase())));
  const tally = () => {
    const visible = shown(), rejected = rows.filter(row => verdict(row).reject).length;
    count.textContent = `${visible.length} lines shown · ${visible.filter(row => listened.has(key(row))).length} heard this visit · ${rejected} rejected`;
  };

  const render = () => {
    list.replaceChildren();
    const visible = shown();
    for (const fighter of order) {
      const mine = visible.filter(row => row.fighter === fighter);
      if (!mine.length) continue;
      const table = el('table');
      for (const row of mine) {
        const h = heard.get(row.line) ?? {}, v = verdict(row), rule = SITUATION_RULES[row.kind];
        const tr = el('tr', { className: v.reject ? 'rejected' : '' });
        if (listened.has(key(row))) tr.classList.add('heard-once');
        const notes = el('td', { className: 'notes' });
        const flag = (text: string, warn = false) => notes.append(el('span', { className: warn ? 'flag warn' : 'flag', textContent: text }));
        flag(isRift(row.line) ? 'his Rift-boss line' : 'roster cue');
        if (row.from === 'quip') flag('the quip the local player had');
        if (row.from === 'cry') flag('borrowed from a lighter cry');
        if (h.uncertain) flag('reading uncertain', true);
        if (!h.line && !h.free) flag('no reading on record', true);
        if (row.seconds > rule.longest) flag(`longer than ${rule.longest} s`, true);
        for (const text of h.flags ?? []) flag(text, true);
        notes.append(el('div', { textContent: row.line }));
        const tick = el('input', { type: 'checkbox', checked: v.reject }), note = el('input', { type: 'text', placeholder: 'why (optional)', value: v.note });
        const change = () => { saved[key(row)] = { reject: tick.checked, note: note.value }; keep(); tr.classList.toggle('rejected', tick.checked); tally(); };
        tick.onchange = change; note.oninput = change;
        const button = el('button', { textContent: '▶ Play', onclick: () => play(row, tr) });
        const said: (Node | string)[] = [h.free ?? h.line ?? '—'];
        if (h.free && h.line && h.free !== h.line) said.push(el('small', { textContent: `on record: ${h.line}` }));
        tr.append(el('td', { className: 'kind' }, el('b', { textContent: WHEN[row.kind][0] }), el('span', { textContent: WHEN[row.kind][1] })),
          el('td', { className: 'play' }, button, el('small', { textContent: `${row.seconds.toFixed(2)} s` })),
          el('td', { className: 'heard' }, ...said),
          el('td', { className: 'means', textContent: h.meaning ?? '' }), notes,
          el('td', { className: 'verdict' }, el('label', {}, tick, 'Reject'), note));
        tr.dataset.key = key(row);
        table.append(tr);
      }
      const original = (HOME_ORIGINAL_FIGHTERS as readonly string[]).includes(fighter), wip = (HOME_EXPANSION_FIGHTERS as readonly string[]).includes(fighter);
      const heading: (Node | string)[] = [FIGHTERS[fighter].name, el('small', { textContent: `${fighter} · ${mine.length} line${mine.length === 1 ? '' : 's'}` })];
      if (original) heading.push(el('span', { className: 'tag', textContent: 'original 16' })); else if (wip) heading.push(el('small', { textContent: 'one of the 60' }));
      list.append(el('section', { className: 'fighter' }, el('h2', {}, ...heading), table));
    }
    if (!list.children.length) list.append(el('p', { className: 'lead', textContent: 'Nothing to show for this filter.' }));
    tally();
  };
  show.onchange = kindPick.onchange = render; find.oninput = render;

  document.querySelector<HTMLButtonElement>('#next')!.onclick = () => {
    const tr = [...list.querySelectorAll<HTMLElement>('tr')].find(each => !listened.has(each.dataset.key ?? ''));
    const row = tr && rows.find(each => key(each) === tr.dataset.key);
    if (tr && row) { tr.scrollIntoView({ block: 'center', behavior: 'smooth' }); play(row, tr); }
  };
  document.querySelector<HTMLButtonElement>('#save')!.onclick = () => {
    const rejected = rows.filter(row => verdict(row).reject).map(row => ({ fighter: row.fighter, kind: row.kind, line: row.line, note: verdict(row).note }));
    const text = JSON.stringify({ saved: new Date().toISOString(), listened: listened.size, of: rows.length, rejected }, null, 1);
    document.querySelector<HTMLTextAreaElement>('#json')!.value = text;
    document.querySelector<HTMLElement>('#out')!.classList.add('open');
    const link = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'voice-rejects.json' });
    document.body.append(link); link.click(); link.remove();
  };
  document.querySelector<HTMLButtonElement>('#close')!.onclick = () => document.querySelector<HTMLElement>('#out')!.classList.remove('open');
  render();
  (window as unknown as { voiceAudition: unknown }).voiceAudition = { rows, heard: Object.fromEntries(heard) };
}
void main();
