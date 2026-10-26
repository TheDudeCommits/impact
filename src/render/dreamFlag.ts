const offInNode = () => { try { return !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DREAM_OFF; } catch { return false; } };
export const DREAM_IMPACT = typeof location === 'undefined' ? !offInNode() : !/[?&]dreamoff\b/.test(location.search);
