export interface SignatureScreen {
  impactFrame?(strength: number, at?: unknown): void;
  chromaticPulse?(amount: number): void;
  speedLines?(amount: number): void;
  techniqueGrade?(color: number, strength: number, seconds: number, at?: { x: number; y: number; z: number }, reach?: number): void;
  timeStop?(amount: number): void;
  powerDim?(amount: number): void;
}
export const SIGNATURE: { screen?: SignatureScreen; localId?: string;
  floor?: (x: number, y: number, z: number) => number | undefined } = {};

export function involvesLocal(...ids: (string | undefined)[]) {
  const me = SIGNATURE.localId;
  return me === undefined || ids.includes(me);
}

const graded = new Map<string, number>();
export function gradeOnce(owner: string, key: number, color: number, strength: number, seconds: number, ...ids: (string | undefined)[]) {
  if (graded.get(owner) === key) return;
  graded.set(owner, key); if (graded.size > 64) graded.delete(graded.keys().next().value!);
  if (involvesLocal(...ids)) SIGNATURE.screen?.techniqueGrade?.(color, strength, seconds);
}
export function gradeLocal(owner: string, key: number, color: number, strength: number, seconds: number, at: { x: number; y: number; z: number } | undefined, ...ids: (string | undefined)[]) {
  if (graded.get(owner) === key) return;
  graded.set(owner, key); if (graded.size > 64) graded.delete(graded.keys().next().value!);
  if (involvesLocal(...ids)) SIGNATURE.screen?.techniqueGrade?.(color, strength * SPECIAL_GRADE.strength, Math.min(seconds, SPECIAL_GRADE.hold), at, SPECIAL_GRADE.reach);
}
export const SPECIAL_GRADE = { strength: .8, hold: 1.4, reach: 2.6 } as const;
export const GRADE = { ki: 0x3a8cff, void: 0x8a4dff, getsuga: 0xd0203a, fire: 0xff7a1a, wind: 0x3ad070 } as const;
