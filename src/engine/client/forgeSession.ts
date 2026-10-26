import { MOVES, type MoveDefinition } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';
import { ATTACK_SLOTS, forgeMoves, forgeProblems, type ForgeKit } from '../sim';
import { setActiveKit } from './forgeLive';

export class ForgeSession {
  private readonly saved = new Map<FighterId, Record<AttackSlot, MoveDefinition>>();
  private current?: ForgeKit;

  apply(kit: ForgeKit): { ok: true } | { ok: false; errors: string[] } {
    const { errors } = forgeProblems(kit, { sandbox: true, availability: import.meta.env?.MODE === 'fighter-lab' ? 'laboratory' : 'released' });
    if (errors.length) return { ok: false, errors };
    const moves = forgeMoves(kit);
    if (this.current && this.current.body !== kit.body) this.restore();
    if (!this.saved.has(kit.body)) this.saved.set(kit.body, { ...MOVES[kit.body] });
    for (const slot of ATTACK_SLOTS) MOVES[kit.body][slot] = moves[slot];
    this.current = kit;
    setActiveKit(kit);
    return { ok: true };
  }
  restore() {
    for (const [body, own] of this.saved) { for (const slot of ATTACK_SLOTS) MOVES[body][slot] = own[slot]; setActiveKit(undefined, body); }
    this.saved.clear(); this.current = undefined;
  }
  get kit() { return this.current; }
}
