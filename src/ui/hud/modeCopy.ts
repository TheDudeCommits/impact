import { RULES, type ObjectiveSeat } from '../../game/objectives/model';
import type { VillageView } from '../../game/objectives/lastStand';
import type { VillageStructure } from '../../game/objectives/villageStructures';
import { siegeBossTier } from '../../game/objectives/siegePacing';



export function nextBossWave(wave: number) { for (let w = Math.max(1, wave); w < wave + 12; w++) if (siegeBossTier(w)) return w; return 0; }

export function wavePlaque(city: Pick<VillageView, 'phase' | 'wave' | 'remaining' | 'nextWaveAt'>, now: number) {
  const preparing = city.phase === 'preparation';
  return preparing
    ? { lead: 'NEXT WAVE', accent: ` · ${Math.max(0, Math.ceil(city.nextWaveAt - now))}s` }
    : { lead: `WAVE ${city.wave}`, accent: ` · ${city.remaining} LEFT` };
}

export function waveLine(city: Pick<VillageView, 'phase' | 'wave' | 'plan' | 'bossPhase' | 'director'>, now: number, clearedAt: number, bossUp: boolean) {
  if (city.phase === 'preparation') {
    const next = city.wave + 1;
    if (city.wave > 0 && now - clearedAt < 4) return `WAVE ${city.wave} CLEARED · REGROUP & REPAIR`;
    if (siegeBossTier(next)) return `WAVE ${next} · BOSS WAVE`;
    return city.plan ? `WAVE ${next} · ${city.plan.total} RAIDERS` : '';
  }
  if (bossUp) return city.bossPhase === 2 ? 'DESPERATION · STAY TOGETHER' : city.bossPhase === 1 ? 'BOSS ENRAGED · WATCH THE WIND-UP' : 'BOSS AT THE GATES';
  if (city.director?.state === 'rally') return 'RALLY · RESCUE & REGROUP';
  const boss = nextBossWave(city.wave);
  return boss ? `NEXT BOSS · WAVE ${boss}` : '';
}

export function allyState(seat: Pick<ObjectiveSeat, 'disconnected' | 'reviveAt' | 'rescue'>, down: boolean, now: number) {
  if (seat.disconnected) return 'RECONNECTING';
  if (seat.reviveAt !== undefined) return `RETURNING · ${Math.max(1, Math.ceil(seat.reviveAt - now))}s`;
  if (down) return seat.rescue > 0 ? `✚ REVIVING ${Math.floor(seat.rescue * 100)}%` : '✚ DOWN';
  return '';
}

export const LANE_OF: Readonly<Record<string, number>> = { 'village-west': 0, 'village-keep': 1, 'village-east': 2 };
export function struckStructure(structures: readonly VillageStructure[], now: number, skip?: VillageStructure): VillageStructure | undefined {
  let pick: VillageStructure | undefined;
  for (const s of structures) if (s !== skip && s.hp > 0 && s.hitAt > now - 2.5 && (!pick || s.hitAt > pick.hitAt)) pick = s;
  return pick;
}
export function underAttack(raiders: number) { return raiders ? `UNDER ATTACK · ${raiders} RAIDER${raiders === 1 ? '' : 'S'}` : 'UNDER ATTACK'; }

export function levelNote(progress: { level: number; leveledAt: number; healedAt: number }, now: number) {
  if (progress.healedAt >= 0 && now - progress.healedAt < 4) return 'HEALTH RESTORED';
  if (progress.leveledAt >= 0 && now - progress.leveledAt < 3) return 'LEVEL UP · POWER UP';
  return `FULL HEAL AT LV ${Math.floor(progress.level / 5) * 5 + 5}`;
}


export const POWER = `${RULES.villainMultiplier}×`;
export type BadgeKind = 'power' | 'ready' | 'returning' | 'used';
export function badgeKind(seat: Pick<ObjectiveSeat, 'team' | 'revivesLeft' | 'reviveAt'>, alive: boolean): BadgeKind {
  if (seat.team === 'villains') return 'power';
  if (seat.reviveAt !== undefined && !alive) return 'returning';
  return seat.revivesLeft > 0 ? 'ready' : 'used';
}
export function badgeCopy(kind: BadgeKind, seat: Pick<ObjectiveSeat, 'reviveAt'>, now: number) {
  switch (kind) {
    case 'power': return `${POWER} POWER · ONE LIFE`;
    case 'returning': return `↻ RETURNING · ${Math.max(1, Math.ceil((seat.reviveAt ?? now) - now))}s`;
    case 'ready': return '↻ 1 RETURN READY';
    default: return 'RETURN USED · LAST LIFE';
  }
}
export function targetTag(seat: Pick<ObjectiveSeat, 'team' | 'revivesLeft'>) {
  return seat.team === 'villains' ? `VILLAIN · ${POWER} · ONE LIFE` : seat.revivesLeft > 0 ? 'HERO · ↻ RETURN READY' : 'HERO · LAST LIFE';
}
export type FaceState = 'ready' | 'up' | 'returning' | 'out';
export function faceState(seat: Pick<ObjectiveSeat, 'team' | 'revivesLeft' | 'reviveAt'>, alive: boolean): FaceState {
  if (alive) return seat.team === 'heroes' && seat.revivesLeft > 0 ? 'ready' : 'up';
  return seat.reviveAt !== undefined ? 'returning' : 'out';
}
export function faceMark(state: FaceState, seat: Pick<ObjectiveSeat, 'reviveAt'>, now: number) {
  return state === 'returning' ? `${Math.max(1, Math.ceil((seat.reviveAt ?? now) - now))}s` : state === 'ready' ? '↻' : state === 'out' ? '×' : '';
}
export function returnAsk(side: 'heroes' | 'villains', heroesStanding: number) {
  return side === 'heroes' ? 'KEEP ONE HERO STANDING' : heroesStanding === 1 ? 'KO THE LAST HERO TO STOP IT' : '';
}


export class KoChain {
  static readonly GAP = 3000; static readonly FADE = 2200; static readonly SHOWN = 10;
  n = 0; live = false; fading = false;
  private kills = -1; private at = -Infinity;
  update(kills: number, now: number) {
    if (this.kills < 0 || kills < this.kills) { this.kills = kills; this.n = 0; this.at = -Infinity; }
    if (kills > this.kills) { if (now - this.at > KoChain.GAP) this.n = 0; this.n += kills - this.kills; this.at = now; }
    this.kills = kills;
    this.live = now - this.at < KoChain.GAP && this.n >= KoChain.SHOWN;
    this.fading = this.live && now - this.at > KoChain.FADE;
    return this;
  }
}
export const pointsCopy = (points: number) => `${points} POINT${points === 1 ? '' : 'S'}`;
