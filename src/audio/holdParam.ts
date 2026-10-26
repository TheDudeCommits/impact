export function holdAt(param: AudioParam, time: number): void {
  if (typeof (param as Partial<AudioParam>).cancelAndHoldAtTime === 'function') { param.cancelAndHoldAtTime(time); return; }
  const value = param.value; param.cancelScheduledValues(time); param.setValueAtTime(value, time);
}
