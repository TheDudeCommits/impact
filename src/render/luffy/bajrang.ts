export const BAJRANG_TAKE = {
  swap: .05,
  laugh: .5,
  open: { clip: 'Bajrang Open', at: .32 },
  cine: { from: .0447, at: .773 },
} as const;

export function bajrangOut(state: { actionStarted: number; actionDuration: number; whiffedAt?: number }, recovery: number) {
  const end = state.whiffedAt !== undefined ? Math.min(state.actionDuration, state.whiffedAt - state.actionStarted + recovery) : state.actionDuration;
  return end - .23;
}

export const BAJRANG_GRAB = { out: .12, release: .3, wait: .5, aim: 75 * Math.PI / 180, grip: .12, min: .35, ahead: 6 } as const;

export interface GrabPhase {
  reach?: number;
  back?: number;
  open: boolean;
  follow: boolean;
}

export function bajrangGrab(state: { actionStarted: number; actionDuration: number; actionTime: number; confirmedAt?: number; whiffedAt?: number },
  contact: number): GrabPhase {
  const t = state.actionTime * state.actionDuration, leaves = contact - BAJRANG_GRAB.out;
  if (t < leaves) return { open: false, follow: true };
  const confirmed = state.confirmedAt !== undefined;
  const letGo = confirmed ? contact + BAJRANG_GRAB.release
    : state.whiffedAt !== undefined ? Math.max(contact, state.whiffedAt - state.actionStarted) : contact + BAJRANG_GRAB.wait;
  if (t >= letGo) return { back: t - letGo, open: !confirmed && t - letGo < .3, follow: confirmed };
  if (t < contact) { const v = (t - leaves) / BAJRANG_GRAB.out; return { reach: 1 - (1 - v) ** 3, open: true, follow: true }; }
  return { reach: 1, open: !confirmed, follow: confirmed };
}
