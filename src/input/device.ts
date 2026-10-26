const media = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
const agent = () => typeof navigator === 'object' ? navigator.userAgent ?? '' : '';
const touchPoints = () => typeof navigator === 'object' ? navigator.maxTouchPoints ?? 0 : 0;
function shortSide() {
  const s = typeof screen === 'object' ? screen : undefined;
  const side = s && s.width > 0 && s.height > 0 ? Math.min(s.width, s.height) : typeof innerWidth === 'number' ? Math.min(innerWidth, innerHeight) : 0;
  return side;
}

export const iPadOS = () => /Macintosh/.test(agent()) && touchPoints() > 1;
export function handheld() {
  const nav = (typeof navigator === 'object' ? navigator : {}) as Navigator & { userAgentData?: { mobile?: boolean } };
  return !!nav.userAgentData?.mobile || iPadOS() || /Android|iPhone|iPad|iPod|Mobile/i.test(agent()) || media('(pointer: coarse)') && !media('(any-pointer: fine)');
}
export const phone = () => handheld() && shortSide() > 0 && shortSide() < 600;
export const tablet = () => handheld() && !phone();
export const touchFirst = () => touchPoints() > 0 && media('(pointer: coarse)') && !media('(any-pointer: fine)');
