import type { FighterId } from '../game/types';
import { AURAS, auraOf, buy, emptyProgress, masteryOf, settle, startPointsAt, type AuraId, type RiftProgress, type Settled } from './progress';
import type { RunResult } from './SurvivalGame';

const KEY = 'rift-survival-progress';
let cached: RiftProgress | undefined;

function storage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }

function revive(raw: unknown): RiftProgress {
  const fresh = emptyProgress();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<RiftProgress>;
  const num = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback;
  const list = (l: unknown) => Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [];
  const record = <T>(o: unknown, each: (v: unknown) => T | undefined) => {
    const out: Record<string, T> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { const t = each(v); if (t !== undefined) out[k] = t; }
    return out;
  };
  return {
    version: 1,
    shards: num(r.shards), earned: num(r.earned),
    mastery: record(r.mastery, v => typeof v === 'number' && v >= 0 ? v : undefined),
    aura: record(r.aura, v => typeof v === 'string' && v in AURAS ? v as AuraId : undefined),
    codex: record(r.codex, v => {
      if (!v || typeof v !== 'object') return undefined;
      const c = v as { beaten?: unknown; finished?: unknown; fastest?: unknown };
      return { beaten: num(c.beaten), finished: num(c.finished), ...(typeof c.fastest === 'number' ? { fastest: c.fastest } : {}) };
    }),
    places: list(r.places), challenges: list(r.challenges), unlocked: list(r.unlocked),
    runs: num(r.runs), best: { round: num(r.best?.round), score: num(r.best?.score) },
  };
}

export function loadProgress(): RiftProgress {
  if (cached) return cached;
  try { cached = revive(JSON.parse(storage()?.getItem(KEY) || 'null')); } catch { cached = emptyProgress(); }
  return cached;
}
function save(progress: RiftProgress) {
  cached = progress;
  try { storage()?.setItem(KEY, JSON.stringify(progress)); } catch { }
}

export function settleRun(result: RunResult): Settled {
  const settled = settle(loadProgress(), result);
  save(settled.progress);
  return settled;
}
export function buyNode(node: string) {
  const after = buy(loadProgress(), node);
  if (after) save(after);
  return after;
}
export function wearAura(fighter: FighterId, aura: AuraId) {
  const p = loadProgress(), level = masteryOf(p.mastery[fighter]).level;
  if (AURAS[aura].level > level) return p;
  const after = { ...p, aura: { ...p.aura, [fighter]: aura } };
  save(after);
  return after;
}

export function carried(fighter: FighterId) {
  const p = loadProgress();
  return { unlocked: [...p.unlocked], bonus: startPointsAt(masteryOf(p.mastery[fighter]).level), aura: AURAS[auraOf(p, fighter)].color };
}

export function forgetProgress() { cached = undefined; }
