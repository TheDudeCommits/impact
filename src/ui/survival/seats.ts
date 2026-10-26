export const SEAT_COLOURS = [0x3ad8ff, 0xff4ad8, 0x9dff3a, 0xffb02e] as const;
export const SELF_COLOUR = 0xfff0c8;
export const SELF_AURA = { colour: SELF_COLOUR };
export const DOWN_COLOUR = 0xff2a3a;

export const seatColour = (seat: number | undefined) => SEAT_COLOURS[((seat ?? 0) % SEAT_COLOURS.length + SEAT_COLOURS.length) % SEAT_COLOURS.length];
export const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
