import { FIGHTERS } from '../../config';
import type { GameSnapshot } from '../../game/types';
import { RULES, TEAM_NAMES, type ObjectiveSeat, type ObjectiveView } from '../../game/objectives/model';
import { mangaPortrait } from '../MangaHome';
import { clock, resultsFrame } from './ResultsFrame';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (value = 0) => Math.round(value).toLocaleString('en-US');
const WAYS: Record<ObjectiveView['access'], string> = { bots: 'WITH BOTS', solo: 'LONE DEFENDER', quick: 'ONLINE', host: 'HOST FRIENDS', join: 'FRIENDS' };
const display = (s: { name: string; fighter: ObjectiveSeat['fighter'] }) => s.name === 'Fighter' ? FIGHTERS[s.fighter].name : s.name;
const named = (s?: { name: string }) => s && s.name !== 'Fighter' ? `${s.name} · ` : '';

export function objectiveResults(v: ObjectiveView, snapshot: GameSnapshot, id: string): string {
  const own = v.seats.find(s => s.id === id), me = snapshot.players.find(p => p.id === id), stand = v.kind === 'last-stand';
  const fighter = own?.fighter ?? me?.fighter ?? 'naruto', host = v.hostId === id;
  const rows = v.seats.map(s => ({ s, p: snapshot.players.find(p => p.id === s.id) })).sort((a, b) => (b.p?.damageDealt ?? 0) - (a.p?.damageDealt ?? 0));
  const seatCell = (s: ObjectiveSeat) => `<td class="who"><span class="standings-portrait">${mangaPortrait(s.fighter)}</span><div><strong>${escape(display(s))}${s.id === id ? ' · YOU' : ''}</strong><small>${escape(FIGHTERS[s.fighter].name)}${s.bot ? ' · BOT' : ''}</small></div></td>`;
  const again = host ? { label: 'PLAY AGAIN', sub: stand ? 'THE SAME SQUAD, WAVE 1' : 'THE SAME TEAMS', attrs: 'data-command="rematch" data-focus="rematch"' }
    : { label: 'PLAY AGAIN', sub: 'WAITING FOR THE HOST', attrs: 'data-focus="rematch"', disabled: true };
  const time = clock(v.endsAt - v.startedAt);
  if (stand) {
    const city = v.village, fell = (city?.hp ?? 1) <= 0;
    const table = `<div class="results-table-scroll"><table class="results-table"><thead><tr><th>#</th><th>FIGHTER</th><th>KOs</th><th>DAMAGE</th><th>LEVEL</th><th>REVIVES</th><th>BOSSES</th><th>EARNED</th><th>SPENT</th><th>REPAIRED</th></tr></thead><tbody>${rows.map(({ s, p }, i) => `<tr class="${s.id === id ? 'you' : ''}"><td class="place">${i + 1}</td>${seatCell(s)}<td class="num">${n(p?.kills)}</td><td class="num">${n(p?.damageDealt)}</td><td class="num">${s.progress?.level ?? 1}</td><td class="num">${s.revives}</td><td class="num">${s.bosses}</td><td class="num">${n(s.points)}</td><td class="num">${n(s.spent)}</td><td class="num">${n(s.repairs)}</td></tr>`).join('')}</tbody></table></div>
      <p class="results-line">THE SQUAD: ${n(city?.kills)} enemies defeated · ${n(city?.bosses)} bosses broken · ${n(city?.damageBlocked)} damage blocked by wards.</p>`;
    return resultsFrame({
      mast: `LAST STAND · ${WAYS[v.access]}`, where: `THE HIDDEN LEAF · ${time}`, fighter, fighterName: FIGHTERS[fighter].name,
      kicker: `${named(own)}${FIGHTERS[fighter].name.toUpperCase()}`,
      outcome: fell ? 'THE GATE FELL' : 'THE SQUAD FELL', line: v.reason, kanji: '終',
      key: { value: `WAVE ${city?.wave ?? 0}`, label: 'REACHED' },
      stats: [[n(me?.kills), 'KOs'], [String(own?.revives ?? 0), 'ALLIES REVIVED'], [String(own?.progress?.level ?? 1), 'FIGHTER LEVEL']],
      details: { summary: "THE SQUAD'S CONTRIBUTION", html: table }, again, home: 'data-leave', training: 'data-results="training"',
    });
  }
  const won = !!own && v.winner === own.team, draw = v.winner === 'draw';
  const team = (t: 'heroes' | 'villains') => `<tr class="team-row"><th colspan="4">${TEAM_NAMES[t]}${v.winner === t ? ' · VICTORIOUS' : ''}</th></tr>${rows.filter(r => r.s.team === t).map(({ s, p }) => `<tr class="${s.id === id ? 'you' : ''}">${seatCell(s)}<td class="num">${n(p?.kills)}</td><td class="num">${n(p?.damageDealt)}</td><td class="num">${p?.alive ? 'STANDING' : 'DOWN'}</td></tr>`).join('')}`;
  const table = `<div class="results-table-scroll"><table class="results-table"><thead><tr><th>FIGHTER</th><th>KOs</th><th>DAMAGE</th><th>AT THE END</th></tr></thead><tbody>${team('heroes')}${team('villains')}</tbody></table></div>`;
  const spirit = own?.team === 'heroes' ? (own.revivesLeft > 0 ? 'UNSPENT' : 'USED') : `${RULES.villainMultiplier}×`;
  return resultsFrame({
    mast: `BAD BLOOD · ${WAYS[v.access]}`, where: `THE FALLEN CITADEL · ${time}`, fighter, fighterName: FIGHTERS[fighter].name,
    kicker: `${named(own)}${FIGHTERS[fighter].name.toUpperCase()}${own ? ` · ${TEAM_NAMES[own.team]}` : ''}`,
    outcome: draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT', won, tone: draw ? 'draw' : won ? 'win' : 'loss',
    line: draw ? 'Both teams fell at the same time.' : `${TEAM_NAMES[v.winner === 'heroes' ? 'villains' : 'heroes']} eliminated. ${TEAM_NAMES[v.winner === 'villains' ? 'villains' : 'heroes']} win.`,
    key: { value: draw ? '—' : TEAM_NAMES[v.winner === 'villains' ? 'villains' : 'heroes'], label: draw ? 'NO VICTOR' : 'WIN' },
    stats: [[n(me?.kills), 'KOs'], [n(me?.damageDealt), 'DAMAGE'], [spirit, own?.team === 'heroes' ? 'YOUR RETURN' : 'YOUR POWER']],
    details: { summary: 'BOTH TEAMS', html: table }, again, home: 'data-leave', training: 'data-results="training"',
  });
}
