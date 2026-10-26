export const GOKU_MELEE_CONTACTS = [
  { clip: 'goku-grounded-rock', peak: .2725, tip: [-.035, 1.4, .68] },
  { clip: 'goku-grounded-cross', peak: .38, tip: [.035, 1.37, .66] },
  { clip: 'goku-grounded-meteor', peak: .459375, tip: [-.030230, 1.050073, .770181] },
  { clip: 'goku-instant-transmission', peak: .64 / 1.2, tip: [.04, 1.05, .95] },
] as const;
export const GOKU_TRANSMISSION = GOKU_MELEE_CONTACTS.length - 1;
