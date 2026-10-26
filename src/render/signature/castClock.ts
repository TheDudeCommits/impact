import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';

export interface HeldCast { event: CombatEvent; hold?: number; releasedAt?: number; drawn?: number }

export function castAge(cast: HeldCast, time: number, actor: Fighter | undefined, release: number, wait = false) {
  const e = cast.event, nominal = time - e.serverTime, s = actor?.state;
  if (s && s.action === e.slot && s.actionDuration > 0 && s.actionTime < .999 && Math.abs(s.actionStarted - e.serverTime) < .25) {
    const held = nominal - s.actionTime * s.actionDuration;
    if (held > (cast.hold ?? 0) && held < 1) cast.hold = held;
  }
  if (cast.releasedAt !== undefined) cast.hold = Math.max(cast.hold ?? 0, cast.releasedAt - e.serverTime - release);
  let age = nominal - (cast.hold ?? 0);
  if (wait && cast.releasedAt === undefined && age > release && age < release + 1) age = release;
  if (cast.drawn !== undefined && age < cast.drawn && age > cast.drawn - 1) age = cast.drawn;
  cast.drawn = age;
  return age;
}

export function noteRelease(casts: readonly HeldCast[], event: CombatEvent) {
  if (event.kind !== 'release') return;
  for (let i = casts.length - 1; i >= 0; i--) {
    const cast = casts[i], e = cast.event;
    if (e.actorId !== event.actorId || e.slot !== event.slot || event.serverTime < e.serverTime) continue;
    if (cast.releasedAt === undefined) cast.releasedAt = event.serverTime;
    return;
  }
}
