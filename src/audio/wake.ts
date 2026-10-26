export const asleep = <T extends Pick<BaseAudioContext, 'state'>>(ctx: T | undefined): ctx is T => !!ctx && ctx.state !== 'running' && ctx.state !== 'closed';

export function wakeOnReturn(context: () => BaseAudioContext | undefined, live: () => boolean = () => true): void {
  if (typeof addEventListener !== 'function' || typeof document !== 'object') return;
  const wake = () => { const ctx = context(); if (live() && asleep(ctx) && !document.hidden) void (ctx as AudioContext).resume?.().catch(() => {}); };
  addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true); document.addEventListener('visibilitychange', wake);
}
