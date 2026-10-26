import type { FighterId } from '../../game/types';

export type SwapSide = 'self' | 'opponent';
export const SWAP_SIDES: readonly SwapSide[] = ['self', 'opponent'];
export const SWAP_LAB = { self: 'swap-self', opponent: 'swap-opponent' } as const;
export interface SwapRequest { lab: typeof SWAP_LAB[SwapSide]; value: FighterId; random?: boolean }
export function swapSideOf(command: unknown): SwapSide | undefined {
  const lab = command && typeof command === 'object' ? (command as { lab?: unknown }).lab : undefined;
  return lab === 'swap-self' ? 'self' : lab === 'swap-opponent' || lab === 'opponent' ? 'opponent' : undefined;
}

export function swapRoster(side: SwapSide, roster: readonly FighterId[], held: ReadonlySet<FighterId>): FighterId[] {
  return side === 'self' ? [...roster] : roster.filter(id => !held.has(id));
}
export function stepFighter(roster: readonly FighterId[], current: FighterId | undefined, direction: 1 | -1): FighterId | undefined {
  if (!roster.length) return undefined;
  const at = current === undefined ? -1 : roster.indexOf(current);
  if (at < 0) return direction > 0 ? roster[0] : roster[roster.length - 1];
  return roster[(at + direction + roster.length) % roster.length];
}
export function randomFighter(roster: readonly FighterId[], avoid: readonly (FighterId | undefined)[], random: () => number = Math.random): FighterId | undefined {
  const deal = (pool: readonly FighterId[]) => pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : undefined;
  return deal(roster.filter(id => !avoid.includes(id))) ?? deal(roster.filter(id => id !== avoid[0]));
}

export function swapMemory(side: SwapSide, fighter: FighterId, random: boolean): { rival: FighterId | undefined } | undefined {
  return side === 'opponent' ? { rival: random ? undefined : fighter } : undefined;
}

export interface SwapAsk {
  side: SwapSide; fighter: FighterId; token: number;
  askedAt: number; sentAt?: number;
}
export const SWAP_LAPSE_MS = 4000;

export class SwapLedger {
  private tokens = 0;
  private readonly asks: Partial<Record<SwapSide, SwapAsk>> = {};
  private seen: Partial<Record<SwapSide, FighterId>> = {};
  ask(side: SwapSide, fighter: FighterId, now: number): SwapAsk {
    const ask: SwapAsk = { side, fighter, token: ++this.tokens, askedAt: now };
    this.asks[side] = ask;
    return ask;
  }
  current(ask: SwapAsk) { return this.asks[ask.side]?.token === ask.token; }
  pending(side: SwapSide): FighterId | undefined { return this.asks[side]?.fighter; }
  waiting(): FighterId[] { return SWAP_SIDES.flatMap(side => this.asks[side] ? [this.asks[side]!.fighter] : []); }
  shown(side: SwapSide): FighterId | undefined { return this.seen[side]; }
  sent(ask: SwapAsk, now: number) { if (this.current(ask)) ask.sentAt = now; }
  drop(side: SwapSide, ask?: SwapAsk) { if (!ask || this.current(ask)) delete this.asks[side]; }
  observe(pair: Partial<Record<SwapSide, FighterId>>, now: number): { changed: SwapSide[]; settled: SwapAsk[]; lapsed: SwapAsk[] } {
    const changed: SwapSide[] = [], settled: SwapAsk[] = [], lapsed: SwapAsk[] = [];
    for (const side of SWAP_SIDES) {
      const fighter = pair[side], before = this.seen[side], ask = this.asks[side];
      if (fighter && before && fighter !== before) changed.push(side);
      if (fighter) this.seen[side] = fighter;
      if (!ask || ask.sentAt === undefined) continue;
      if (fighter === ask.fighter) { settled.push(ask); delete this.asks[side]; }
      else if (now - ask.sentAt > SWAP_LAPSE_MS) { lapsed.push(ask); delete this.asks[side]; }
    }
    return { changed, settled, lapsed };
  }
  reset() { for (const side of SWAP_SIDES) delete this.asks[side]; this.seen = {}; }
}
