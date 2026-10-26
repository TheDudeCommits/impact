import type { GameSnapshot, PlayerInput } from '../types';
import type { RunResult } from '../../survival/SurvivalGame';
import { RANKS } from '../../survival/bosses';
import { objectiveOf } from '../objectives/model';
import type { MatchReport, Report, SurvivalReport } from './earn';

export const DEVICE_PREFIX = 'local-';
export const isDeviceId = (id: unknown): id is string => typeof id === 'string' && id.startsWith(DEVICE_PREFIX);
export const DEVICE_MODES: readonly Report['mode'][] = ['bots', 'duel', 'last-stand', 'bad-blood', 'survival'];

export function deviceId(): string {
  const bytes = new Uint8Array(16);
  try { globalThis.crypto.getRandomValues(bytes); } catch { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); }
  return DEVICE_PREFIX + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const deviceReports: { begin(): void; send(report: Report): void } = { begin: () => {}, send: () => {} };

const played = (input: PlayerInput) => Math.hypot(input.moveX, input.moveZ) > .1 || !!input.attack || !!input.guard || !!input.dash || !!input.jump;

export class DeviceMatch {
  private started: number | undefined;
  private fieldSize = 0;
  private places = new Map<string, number>();
  private active = false;
  private done = false;
  private set = 1;
  constructor(private readonly send: (report: MatchReport) => void = report => deviceReports.send(report)) {}
  reset(set = 1) { this.set = set; this.started = undefined; this.fieldSize = 0; this.places.clear(); this.active = false; this.done = false; }
  input(input: PlayerInput) { if (this.started !== undefined && played(input)) this.active = true; }
  observe(snapshot: GameSnapshot, self: string): MatchReport | undefined {
    const objective = objectiveOf(snapshot), set = snapshot.duel?.set ?? objective?.round ?? 1;
    if (set !== this.set) this.reset(set);
    if (snapshot.status === 'active' && this.started === undefined) { this.started = snapshot.serverTime; this.fieldSize = objective?.seats.length ?? snapshot.players.length; deviceReports.begin(); }
    if (!objective && !snapshot.duel && this.started !== undefined) for (const e of snapshot.events) {
      if (e.kind === 'eliminated' && e.targetId && !this.places.has(e.targetId)) this.places.set(e.targetId, Math.max(2, this.fieldSize - this.places.size));
    }
    if (this.done || this.started === undefined) return undefined;
    const over = snapshot.status === 'finished' && (objective ? objective.phase === 'over' : snapshot.roomMode === 'match' && (!snapshot.duel || snapshot.duel.phase === 'complete'));
    if (!over && !(this.places.has(self) && !objective && !snapshot.duel)) return undefined;
    this.done = true;
    const p = snapshot.players.find(q => q.id === self), seat = objective?.seats.find(s => s.id === self);
    const contributed = (p?.damageDealt ?? 0) > 0 || (seat?.revives ?? 0) > 0 || (seat?.repairs ?? 0) > 0 || (seat?.assists ?? 0) > 0 || (seat?.rescues ?? 0) > 0 || (seat?.supplies ?? 0) > 0;
    if (!p || !this.active && !contributed) return undefined;
    const won = objective ? objective.winner === seat?.team : snapshot.winnerId === self;
    const report: MatchReport = { id: deviceId(), fighter: p.fighter, seconds: Math.floor(Math.max(0, snapshot.serverTime - this.started)),
      mode: objective?.kind ?? (snapshot.duel ? 'duel' : 'bots'), practice: true,
      place: won ? 1 : objective || snapshot.duel ? 2 : this.places.get(self) ?? Math.max(2, this.fieldSize - this.places.size),
      players: this.fieldSize, kos: p.kills ?? 0,
      rounds: objective?.village ? Math.max(0, objective.village.wave - (objective.village.phase === 'assault' ? 1 : 0)) : snapshot.duel?.scores[self] ?? 0,
      revives: seat?.revives ?? 0, repairs: seat?.repairs ?? 0, bossDamage: seat?.bossDamage ?? 0,
      assists: seat?.assists ?? 0, rescues: seat?.rescues ?? 0, supplies: seat?.supplies ?? 0 };
    this.send(report);
    return report;
  }
}

const TEST_FLAGS = ['autopilot', 'allies', 'allydown', 'picks', 'points', 'kinds', 'spawn', 'quiet', 'fall', 'round', 'wave', 'god', 'bosshp', 'relics', 'path'];
const testRun = () => typeof location === 'object' && TEST_FLAGS.some(flag => new URLSearchParams(location.search).has(flag));

export function deviceRunReport(result: RunResult): SurvivalReport | undefined {
  if (result.probe) return undefined;
  const log = result.bossLog ?? [];
  return { id: deviceId(), mode: 'survival', coop: false, fighter: result.fighter, seconds: Math.floor(result.seconds), round: result.round,
    rank: Math.max(0, RANKS.indexOf(result.rank)), bosses: result.bosses, finishers: result.finishers ?? 0, sealed: !!result.sealed,
    score: Math.round(result.score), kills: result.ownKills ?? result.kills, style: result.bestRank, sBosses: log.filter(b => b.rank === 'S').length,
    fastBoss: log.length ? Math.min(...log.map(b => b.seconds)) : undefined };
}

export class DeviceRun {
  private started = false;
  private active = false;
  private done = false;
  constructor(private readonly send: (report: SurvivalReport) => void = report => deviceReports.send(report)) {}
  reset() { this.started = false; this.active = false; this.done = false; }
  input(input: PlayerInput) { if (this.started && played(input)) this.active = true; }
  observe(phase: string, result: () => RunResult | undefined): SurvivalReport | undefined {
    if (!this.started && phase !== 'lobby' && phase !== 'over') { this.started = true; deviceReports.begin(); }
    if (this.done || !this.started || phase !== 'over') return undefined;
    const run = result();
    if (!run) return undefined;
    this.done = true;
    const report = this.active && !testRun() ? deviceRunReport(run) : undefined;
    if (report) this.send(report);
    return report;
  }
}
