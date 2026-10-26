const tops = new Map<string, number>();

export function setLoomTop(id: string, top: number) { if (top > 0) tops.set(id, top); else tops.delete(id); }
export function loomTop(id: string) { return tops.get(id) ?? 0; }
export function clearLoomTops() { tops.clear(); }
