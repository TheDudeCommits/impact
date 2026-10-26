import fs from 'node:fs';
import path from 'node:path';
import { CONTACT, FAN_MADE, PRIVACY_PAGE, SITE_TITLE } from '../../src/ui/legalLinks';

export type CreditKind = 'fighter' | 'stage' | 'place' | 'environment' | 'enemy' | 'boss' | 'outfit' | 'art' | 'tool' | 'music' | 'sound' | 'voice' | 'font' | 'code';
export interface CreditItem {
  readonly role: string;
  readonly title?: string;
  readonly author?: string;
  readonly url?: string;
  readonly licence?: string;
  readonly changes?: string;
  readonly note?: string;
}
export interface CreditGroup { readonly id: string; readonly heading: string; readonly kind?: CreditKind; readonly series?: string; readonly note?: string; readonly items: readonly CreditItem[] }
export interface CreditFile { readonly section: string; readonly groups: readonly CreditGroup[] }

export interface ArmoryCredits {
  readonly armoryCommit?: string;
  readonly components?: readonly { readonly id: string; readonly name?: string; readonly license?: string; readonly copyright?: string; readonly sourceUrl?: string; readonly noticeText?: string; readonly usedBy?: readonly string[] }[];
  readonly assets?: readonly { readonly path: string; readonly license?: string; readonly author?: string; readonly sourceUrl?: string; readonly attribution?: string; readonly usedBy?: readonly string[] }[];
  readonly sounds?: unknown;
  readonly effects?: Readonly<Record<string, string>>;
}

export interface Software { readonly name: string; readonly version: string; readonly license: string; readonly author?: string; readonly url?: string; readonly text?: string }

export const LICENCES: Readonly<Record<string, string | undefined>> = {
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC BY-NC-SA 4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  'Sketchfab Standard': 'https://sketchfab.com/licenses',
  'CGTrader Royalty Free': 'https://www.cgtrader.com/pages/terms-and-conditions',
  'Adobe Mixamo': 'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html',
  'MIT': 'https://opensource.org/license/mit',
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
  'BSD-3-Clause': 'https://opensource.org/license/bsd-3-clause',
  'BSD-2-Clause': 'https://opensource.org/license/bsd-2-clause',
  'ISC': 'https://opensource.org/license/isc-license-txt',
  '0BSD': 'https://opensource.org/license/0bsd',
  'Zlib': 'https://opensource.org/license/zlib',
  'SIL OFL 1.1': 'https://openfontlicense.org',
  'VFX Armory Licence': 'https://threejs-vfx-sandbox.vercel.app/armory/licence.html',
  'Public domain': undefined,
};
const SPDX: Readonly<Record<string, string>> = {
  'CC0-1.0': 'CC0 1.0', 'CC-BY-4.0': 'CC BY 4.0', 'CC-BY-3.0': 'CC BY 3.0', 'CC-BY-SA-3.0': 'CC BY-SA 3.0', 'CC-BY-SA-4.0': 'CC BY-SA 4.0',
  'CC-BY-NC-4.0': 'CC BY-NC 4.0', 'CC-BY-NC-SA-4.0': 'CC BY-NC-SA 4.0', 'OFL-1.1': 'SIL OFL 1.1', 'LicenseRef-Mixamo': 'Adobe Mixamo',
  'LicenseRef-VFX-Armory': 'VFX Armory Licence',
};
const licenceName = (id: string | undefined) => id === undefined || id === 'NOASSERTION' ? undefined : SPDX[id] ?? id;

const KINDS = new Set<CreditKind>(['fighter', 'stage', 'place', 'environment', 'enemy', 'boss', 'outfit', 'art', 'tool', 'music', 'sound', 'voice', 'font', 'code']);
const BANNED = /not cleared|not established|unverified|unclear|unknown origin|permission|clearance|cleared|caveat|takedown|\brip(s|ped|ping)?\b|extracted|youtube|youtu\.be|\bowner\b|authori[sz]ed|dmca|infring|\.glb\b|\.gltf\b|\.fbx\b|\.py\b|\.ts\b|\.mts\b|scripts\/|public\/|assets\/|sha256|\bcommit\b|\b[0-9a-f]{10,}\b|\brights?\b|\blicen[cs]e not\b/i;
const BAD_URL = /youtube|youtu\.be|\/download|api\.sketchfab|\.zip\b|\.glb\b|\.fbx\b|drive\.google|dropbox|mega\.nz|^file:/i;

export function creditsProblems(file: CreditFile, roster: readonly string[] = []): string[] {
  const problems: string[] = [], ids = new Set<string>();
  for (const group of file.groups) {
    const at = group.id || JSON.stringify(group).slice(0, 60);
    if (!group.id || !group.heading) problems.push(`${at}: a group needs an id and a heading`);
    if (ids.has(group.id)) problems.push(`${at}: listed twice`);
    ids.add(group.id);
    if (group.kind ? !KINDS.has(group.kind) : file.section === 'world') problems.push(`${at}: kind ${group.kind ?? '(none)'}`);
    for (const [key, text] of [['heading', group.heading], ['note', group.note]] as const) if (text && BANNED.test(text)) problems.push(`${at}.${key}: "${text.match(BANNED)![0]}"`);
    if (!group.items.length) problems.push(`${at}: credits nothing`);
    group.items.forEach((item, i) => {
      const where = `${at}[${i}]`;
      if (!item.role) problems.push(`${where}: no role`);
      if (!item.title && !item.author) problems.push(`${where}: neither a title nor an author`);
      if (item.licence !== undefined && !Object.hasOwn(LICENCES, item.licence)) problems.push(`${where}: licence "${item.licence}"`);
      if (item.url !== undefined && (!/^https?:\/\//.test(item.url) || BAD_URL.test(item.url))) problems.push(`${where}: link ${item.url}`);
      for (const key of ['role', 'changes', 'note'] as const) { const text = item[key]; if (text && BANNED.test(text)) problems.push(`${where}.${key}: "${text.match(BANNED)![0]}"`); }
      for (const key of ['title', 'author'] as const) { const text = item[key]; if (text && /youtube|youtu\.be|not cleared|not established/i.test(text)) problems.push(`${where}.${key}: ${text}`); }
    });
  }
  for (const id of roster) if (!ids.has(id)) problems.push(`${id}: a fighter with no credits`);
  return problems;
}

export function creditRecords(root = process.cwd()) {
  const read = <T>(file: string): T | undefined => {
    const full = path.join(root, 'docs/provenance', file);
    return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8')) as T : undefined;
  };
  return {
    fighters: read<CreditFile>('credits/fighters.json'),
    world: read<CreditFile>('credits/world.json'),
    code: read<CreditFile>('credits/code.json'),
    armory: read<ArmoryCredits>('armory.json'),
  };
}

function packageAt(dir: string): Software | undefined {
  let pkg: { name?: string; version?: string; license?: string | { type?: string }; licenses?: { type?: string }[]; author?: string | { name?: string }; homepage?: string; repository?: string | { url?: string } };
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return undefined; }
  if (!pkg.name || !pkg.version) return undefined;
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? pkg.licenses?.map(l => l.type).filter(Boolean).join(' OR ') ?? 'See its licence';
  const author = (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name)?.replace(/\s*[<(].*$/, '').trim() || undefined;
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const fromRepo = repo?.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/').replace(/\.git$/, '').replace(/^([\w-]+\/[\w.-]+)$/, 'https://github.com/$1');
  const url = [pkg.homepage, fromRepo].find(u => u && /^https?:\/\//.test(u)) ?? `https://www.npmjs.com/package/${pkg.name}`;
  const licenceFile = fs.readdirSync(dir).find(f => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(f));
  const text = licenceFile ? fs.readFileSync(path.join(dir, licenceFile), 'utf8').trim() : undefined;
  return { name: pkg.name, version: pkg.version, license, author, url, text };
}
const byName = (a: Software, b: Software) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
export function bundledPackages(moduleIds: Iterable<string>): Software[] {
  const dirs = new Set<string>();
  for (const id of moduleIds) {
    const match = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(id.replace(/^\0/, '').split('?')[0]);
    if (match) dirs.add(match[1]);
  }
  const seen = new Map<string, Software>();
  for (const dir of dirs) { const pkg = packageAt(dir); if (pkg) seen.set(`${pkg.name}@${pkg.version}`, pkg); }
  return [...seen.values()].sort(byName);
}
export function declaredPackages(root = process.cwd()): Software[] {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  return Object.keys(pkg.dependencies ?? {}).filter(name => name !== 'tsx').map(name => packageAt(path.join(root, 'node_modules', name))).filter((p): p is Software => !!p).sort(byName);
}

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const DEAD_SOURCES: ReadonlySet<string> = new Set(['https://github.com/TheDudeCommits/vfx-armory', 'https://github.com/itzmitto/Ability-ThreeJS-Project']);
const link = (url: string | undefined, html: string) => url && !DEAD_SOURCES.has(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${html}</a>` : html;
function source(url: string | undefined, html: string) {
  const [, address, note] = url?.match(/^(\S+)\s+\((.*)\)$/) ?? [undefined, url, undefined];
  return `${link(address, html)}${note ? ` (${esc(note)})` : ''}`;
}
const licenceTag = (name: string | undefined) => !name ? '' : LICENCES[name] ? `<a class="lic" href="${esc(LICENCES[name]!)}" target="_blank" rel="noopener">${esc(name)}</a>` : `<span class="lic">${esc(name)}</span>`;
const searchText = (...parts: (string | undefined)[]) => esc(parts.filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' '));

function creditLine(item: CreditItem) {
  const title = item.title ? `“${esc(item.title)}”` : '';
  const work = item.title ? `${link(item.url, title)}${item.author ? ` by ${esc(item.author)}` : ''}` : link(item.url, esc(item.author!));
  return `<li><span class="role">${esc(item.role)}</span>${work}${item.licence ? ` ${licenceTag(item.licence)}` : ''}${item.changes ? `<span class="changes">${esc(item.changes)}</span>` : ''}${item.note ? `<span class="note">${esc(item.note)}</span>` : ''}</li>`;
}
function card(group: CreditGroup) {
  const search = searchText(group.heading, group.series, group.note, ...group.items.flatMap(i => [i.role, i.title, i.author, i.licence]));
  return `<article class="card" id="${esc(`${group.kind ?? 'credit'}-${group.id}`)}" data-search="${search}"><h3>${esc(group.heading)}</h3>${group.series ? `<p class="series">${esc(group.series)}</p>` : ''}${group.note ? `<p class="gnote">${esc(group.note)}</p>` : ''}<ul>${group.items.map(creditLine).join('')}</ul></article>`;
}

const SECTIONS: readonly { id: string; title: string; kinds: readonly CreditKind[]; lede?: string; sort?: boolean }[] = [
  { id: 'fighters', title: 'Fighters', kinds: ['fighter'], sort: true, lede: 'Every fighter in the roster: the model each one is built on, its other forms, weapons and props, the animation it moves with and the voice it speaks with.' },
  { id: 'places', title: 'Stages & places', kinds: ['stage', 'place', 'environment'], lede: 'The arenas, the battle-royale places and the buildings, props, skies and textures they are dressed with.' },
  { id: 'enemies', title: 'Enemies & bosses', kinds: ['enemy', 'boss'] },
  { id: 'outfits', title: 'Outfits', kinds: ['outfit'] },
  { id: 'art', title: 'Art', kinds: ['art', 'tool'] },
  { id: 'music', title: 'Music', kinds: ['music'] },
  { id: 'sound', title: 'Sound & voices', kinds: ['sound', 'voice'] },
  { id: 'fonts', title: 'Fonts', kinds: ['font'] },
  { id: 'code', title: 'Adapted code', kinds: ['code'], lede: 'Code from these projects was adapted into the game’s own effects.' },
];

function armorySection(armory: ArmoryCredits | undefined, number: string) {
  if (!armory) return '';
  const names = armory.effects ?? {};
  const used = (ids: readonly string[] = []) => {
    const shown = [...new Set(ids.map(id => names[id] ?? id))].sort((a, b) => a.localeCompare(b));
    return shown.length ? `<span class="note">Used in ${esc(shown.slice(0, 12).join(', '))}${shown.length > 12 ? ` and ${shown.length - 12} more` : ''}</span>` : '';
  };
  const packs = (armory.components ?? []).map(c => {
    const licence = licenceName(c.license);
    const search = searchText(c.name, c.id, licence, c.copyright, ...(c.usedBy ?? []).map(id => names[id] ?? id));
    return `<article class="card" id="vfx-${esc(c.id)}" data-search="${search}"><h3>${esc(c.name ?? c.id)}</h3><ul><li><span class="role">Code</span>${source(c.sourceUrl, esc(c.copyright ?? c.name ?? c.id))}${licence ? ` ${licenceTag(licence)}` : ''}${used(c.usedBy)}${c.noticeText ? `<details><summary>Licence text</summary><pre>${esc(c.noticeText)}</pre></details>` : ''}</li></ul></article>`;
  });
  const makers = new Map<string, NonNullable<ArmoryCredits['assets']>[number][]>();
  for (const asset of armory.assets ?? []) {
    const maker = asset.author?.replace(/\s*\(https?:[^)]*\)\s*$/, '').trim();
    if (!maker) continue;
    makers.set(maker, [...(makers.get(maker) ?? []), asset]);
  }
  const assetName = (file: string) => file.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
  const assets = [...makers].sort(([a], [b]) => a.localeCompare(b)).map(([maker, list]) => {
    const rows = list.map(a => {
      const licence = licenceName(a.license);
      const what = a.attribution ? esc(a.attribution) : `“${esc(assetName(a.path))}”`;
      return `<li><span class="role">${esc(/\.(glb|gltf|fbx|obj)$/i.test(a.path) ? 'Model' : /\.(png|jpe?g|webp|ktx2|exr|hdr|svg)$/i.test(a.path) ? 'Texture' : /\.(mp3|ogg|wav|m4a)$/i.test(a.path) ? 'Sound' : 'Asset')}</span>${source(a.sourceUrl, what)}${licence && !a.attribution ? ` ${licenceTag(licence)}` : ''}${used(a.usedBy)}</li>`;
    });
    return `<article class="card" data-search="${searchText(maker, ...list.flatMap(a => [a.path, a.attribution, licenceName(a.license), ...(a.usedBy ?? []).map(id => names[id] ?? id)]))}"><h3>${esc(maker)}</h3><ul>${rows.join('')}</ul></article>`;
  });
  const soundList = Array.isArray(armory.sounds) ? armory.sounds : armory.sounds && typeof armory.sounds === 'object' ? Object.values(armory.sounds as Record<string, unknown>).flat() : [];
  const sounds = (soundList as { name?: string; title?: string; author?: string; url?: string; sourceUrl?: string; license?: string }[]).filter(s => s && typeof s === 'object' && (s.name || s.title || s.author)).map(s => {
    const licence = licenceName(s.license);
    return `<article class="card" data-search="${searchText(s.name, s.title, s.author, licence)}"><h3>${esc(s.name ?? s.title ?? s.author!)}</h3><ul><li><span class="role">Sound</span>${source(s.url ?? s.sourceUrl, esc(s.author ?? s.title ?? s.name!))}${licence ? ` ${licenceTag(licence)}` : ''}</li></ul></article>`;
  });
  const count = Object.keys(names).length;
  return `<section id="vfx" data-section><h2><small>${number}</small>Effects</h2><p class="lede">The game’s effects${count ? ` (${count} of them)` : ''} come from the VFX Armory, built on these open-source effect packs and the models, textures and sounds below.</p>
<h4 class="sub">Effect packs and libraries</h4><div class="cards">${packs.join('')}</div>
${assets.length ? `<h4 class="sub">Models, textures and images</h4><div class="cards">${assets.join('')}</div>` : ''}
${sounds.length ? `<h4 class="sub">Sounds</h4><div class="cards">${sounds.join('')}</div>` : ''}</section>`;
}

function softwareSection(software: readonly Software[], number: string) {
  if (!software.length) return '';
  const rows = software.map(pkg => `<li class="pkg" data-search="${searchText(pkg.name, pkg.author, pkg.license)}"><div><b>${link(pkg.url, esc(pkg.name))}</b> <span class="ver">${esc(pkg.version)}</span>${pkg.author ? ` <span class="by">by ${esc(pkg.author)}</span>` : ''} ${licenceTag(pkg.license)}</div>${pkg.text ? `<details><summary>Licence text</summary><pre>${esc(pkg.text)}</pre></details>` : ''}</li>`);
  return `<section id="software" data-section><h2><small>${number}</small>Software</h2><p class="lede">The open-source packages the game’s code is built with, each under its own licence.</p><ul class="pkgs">${rows.join('')}</ul></section>`;
}

const STYLE = `@font-face{font-family:Electroharmonix;src:url('/assets/home/fonts/electroharmonix.otf') format('opentype');font-display:swap}
:root{color-scheme:light;--ink:#111;--paper:#fff;--red:#cc202b;--grey:#55534e;--rule:#11111124;font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--paper)}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;border:8px solid var(--ink);min-height:100vh;background:radial-gradient(#11111112 .7px,transparent .9px) 0 0/5px 5px}
main{max-width:1180px;margin:auto;padding:40px 36px 72px}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}a:hover{color:var(--red)}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--red);outline-offset:3px}
.back{display:inline-block;font:12px Electroharmonix,Impact,sans-serif;letter-spacing:.1em;margin-bottom:34px}
.eyebrow{font:11px Electroharmonix,Impact,sans-serif;letter-spacing:.16em;color:var(--red);margin:0 0 10px}
h1{font:400 clamp(44px,9vw,84px)/.9 Electroharmonix,Impact,'Arial Narrow',sans-serif;margin:0 0 18px;letter-spacing:.01em}
.intro{font-size:18px;line-height:1.5;max-width:760px;margin:0 0 22px}
.short{border:3px solid var(--ink);box-shadow:6px 6px 0 var(--red);background:#fff;padding:16px 20px;margin:0 0 30px;max-width:860px}
.short p{margin:0 0 8px;font-size:14px;line-height:1.55}.short p:last-child{margin:0}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;padding:0;list-style:none}
.toc a{display:inline-block;font:12px Electroharmonix,Impact,sans-serif;letter-spacing:.08em;text-decoration:none;border:2px solid var(--ink);padding:7px 10px;background:#fff}
.toc a small{color:var(--red);margin-left:6px;font-size:11px}.toc a:hover{background:var(--ink);color:#fff}
.find{position:sticky;top:0;z-index:2;background:#fff;border-bottom:2px solid var(--ink);padding:10px 0;display:flex;gap:12px;align-items:center}
.find input{flex:1;min-width:0;font:16px Arial,Helvetica,sans-serif;padding:10px 12px;border:2px solid var(--ink);border-radius:0;background:#fff;color:var(--ink)}
.find output{font-size:12px;color:var(--grey);white-space:nowrap}
h2{font:400 26px/1.1 Electroharmonix,Impact,sans-serif;letter-spacing:.03em;margin:46px 0 6px;padding-bottom:8px;border-bottom:3px solid var(--ink)}
h2 small{color:var(--red);margin-right:10px;font-size:15px}
.sub{font:400 15px Electroharmonix,Impact,sans-serif;letter-spacing:.05em;margin:24px 0 10px}
.lede{font-size:14px;line-height:1.55;color:var(--grey);max-width:780px;margin:8px 0 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px;align-items:start}
.card{border:2px solid var(--ink);background:#fff;padding:14px 16px;min-width:0}
.card h3{font:400 18px/1.15 Electroharmonix,Impact,sans-serif;letter-spacing:.02em;margin:0 0 2px;overflow-wrap:anywhere}
.series{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--red);margin:0 0 8px}
.gnote{font-size:12.5px;color:var(--grey);margin:0 0 8px}
.card ul{list-style:none;margin:0;padding:0}
.card li{font-size:13.5px;line-height:1.45;padding:7px 0;border-top:1px solid var(--rule);overflow-wrap:anywhere}
.card li:first-child{border-top:0;padding-top:3px}
.role{display:block;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--grey);margin-bottom:1px}
.lic{display:inline-block;font-size:11px;font-weight:700;border:1px solid var(--ink);padding:0 5px;text-decoration:none;white-space:nowrap;line-height:1.5}
a.lic:hover{background:var(--ink);color:#fff}
.changes,.note{display:block;font-size:12.5px;line-height:1.45;color:var(--grey);margin-top:2px}
details{margin:6px 0 0}summary{cursor:pointer;font-size:12.5px;color:var(--grey)}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11.5px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#f6f5f2;border:1px solid var(--rule);padding:10px 12px;max-height:300px;overflow:auto;margin:6px 0 0}
.pkgs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:0 22px}
.pkg{padding:8px 0;border-top:1px solid var(--rule);font-size:13.5px;line-height:1.45;min-width:0;overflow-wrap:anywhere}
.ver,.by{color:var(--grey);font-size:12.5px}
footer{margin-top:52px;padding-top:16px;border-top:1px solid var(--rule);font-size:13px;line-height:1.6;color:var(--grey)}
@media(max-width:600px){body{border-width:5px}main{padding:24px 16px 56px}.intro{font-size:16px}.cards,.pkgs{grid-template-columns:1fr}.find{flex-wrap:wrap}.find output{width:100%}}`;

const SCRIPT = `const q=document.getElementById('q'),out=document.getElementById('found'),cards=[...document.querySelectorAll('[data-search]')],sections=[...document.querySelectorAll('section[data-section]')];
q.addEventListener('input',()=>{const words=q.value.toLowerCase().split(/\\s+/).filter(Boolean);let shown=0;for(const c of cards){const hit=words.every(w=>c.dataset.search.includes(w));c.hidden=!hit;if(hit)shown++;}for(const s of sections)s.hidden=words.length>0&&!s.querySelector('[data-search]:not([hidden])');out.textContent=words.length?shown+' of '+cards.length:cards.length+' credits';});`;

export interface CreditsBuild {
  readonly date: string;
  readonly commit?: string;
  readonly software: readonly Software[];
}

export function creditsPage(build: CreditsBuild, records = creditRecords()): string {
  const groups: CreditGroup[] = [
    ...(records.fighters?.groups ?? []).map(g => ({ ...g, kind: g.kind ?? 'fighter' as const })),
    ...(records.world?.groups ?? []).filter(g => g.kind),
    ...(records.code?.groups ?? []).map(g => ({ ...g, kind: g.kind ?? 'code' as const })),
  ];
  const parts: string[] = [], toc: string[] = [];
  let n = 0;
  const number = () => String(++n).padStart(2, '0');
  for (const section of SECTIONS) {
    const mine = groups.filter(g => section.kinds.includes(g.kind!));
    if (!mine.length) continue;
    if (section.sort) mine.sort((a, b) => a.heading.localeCompare(b.heading));
    parts.push(`<section id="${section.id}" data-section><h2><small>${number()}</small>${esc(section.title)}</h2>${section.lede ? `<p class="lede">${esc(section.lede)}</p>` : ''}<div class="cards">${mine.map(card).join('')}</div></section>`);
    toc.push(`<li><a href="#${section.id}">${esc(section.title)}<small>${mine.length}</small></a></li>`);
  }
  if (records.armory) { parts.push(armorySection(records.armory, number())); toc.push(`<li><a href="#vfx">Effects<small>${Object.keys(records.armory.effects ?? {}).length || ''}</small></a></li>`); }
  if (build.software.length) { parts.push(softwareSection(build.software, number())); toc.push(`<li><a href="#software">Software<small>${build.software.length}</small></a></li>`); }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#cc202b">
<title>Credits — ${SITE_TITLE}</title>
<meta name="description" content="The artists, musicians, voice actors, sound designers and programmers whose work Impact, an unofficial fan game, is built from.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${STYLE}</style>
</head>
<body>
<main>
<a class="back" href="/">← BACK TO THE GAME</a>
<p class="eyebrow">IMPACT</p>
<h1>CREDITS</h1>
<p class="intro">Impact is built from the work of the artists who made and shared its models and art, the musicians, voice actors and sound designers it plays, and the authors of its effects and code. Thank you, all of you.</p>
<div class="short"><p>${esc(FAN_MADE)}</p><p>Creators: to correct or add a credit, email <a href="mailto:${CONTACT}">${CONTACT}</a>. Rights holders: to request the removal of any material, email the same address and it will be taken down promptly.</p></div>
<ul class="toc">${toc.join('')}</ul>
<div class="find"><input id="q" type="search" placeholder="Find a fighter, an artist, a song or a licence" aria-label="Find a credit" autocomplete="off"><output id="found" for="q"></output></div>
${parts.join('\n')}
<footer>Updated ${esc(build.date)}${build.commit ? ` · build ${esc(build.commit.slice(0, 9))}` : ''} · <a href="${PRIVACY_PAGE}">Privacy</a> · <a href="mailto:${CONTACT}">${CONTACT}</a></footer>
</main>
<script>${SCRIPT}document.getElementById('found').textContent=document.querySelectorAll('[data-search]').length+' credits';</script>
</body>
</html>
`;
}

export function creditsGaps(roster: readonly string[], records = creditRecords()): string[] {
  const gaps: string[] = [];
  if (!records.fighters) gaps.push('docs/provenance/credits/fighters.json is missing');
  else gaps.push(...creditsProblems(records.fighters, roster).map(p => `fighters: ${p}`));
  if (!records.world) gaps.push('docs/provenance/credits/world.json is missing');
  else gaps.push(...creditsProblems(records.world).map(p => `world: ${p}`));
  if (records.code) gaps.push(...creditsProblems(records.code).map(p => `code: ${p}`));
  if (!records.armory) gaps.push('docs/provenance/armory.json is missing');
  return gaps;
}
