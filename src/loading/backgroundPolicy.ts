import { phone } from '../input/device';

export const defaultRoyaleFighters = () => phone() ? 6 : 8;

export interface DeviceSignals {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
  downlink?: number;
  measured?: number;
  deviceMemory?: number;
  handheld: boolean;
  strongMachine: boolean;
}

export function readSignals(strongMachine: boolean): DeviceSignals {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string; type?: string; downlink?: number };
    deviceMemory?: number; userAgentData?: { mobile?: boolean };
  };
  const media = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
  const iPad = /Macintosh/.test(nav.userAgent ?? '') && (nav.maxTouchPoints ?? 0) > 1;
  const handheld = !!nav.userAgentData?.mobile || iPad || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent ?? '')
    || media('(pointer: coarse)') && !media('(any-pointer: fine)');
  const c = nav.connection;
  return { saveData: c?.saveData, effectiveType: c?.effectiveType, type: c?.type, downlink: c?.downlink, measured: measuredMbps(), deviceMemory: nav.deviceMemory, handheld, strongMachine };
}

export function measuredMbps(): number | undefined {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return undefined;
  let best: number | undefined;
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    const bytes = e.encodedBodySize, seconds = (e.responseEnd - e.responseStart) / 1000;
    if (e.transferSize > 0 && bytes > 300_000 && seconds > .02) best = Math.max(best ?? 0, bytes * 8 / 1e6 / seconds);
  }
  return best;
}

export function backgroundRoster(s: DeviceSignals): { allowed: boolean; reason: string } {
  const no = (reason: string) => ({ allowed: false, reason });
  if (s.saveData) return no('data saver is on');
  if (s.type === 'cellular') return no('a cellular connection');
  if (s.measured !== undefined) { if (s.measured < 5) return no(`a slow connection (${s.measured.toFixed(1)} Mbit/s)`); }
  else {
    if (s.effectiveType && s.effectiveType !== '4g') return no(`a slow connection (${s.effectiveType})`);
    if (s.downlink !== undefined && s.downlink > 0 && s.downlink < 5) return no(`a slow connection (${s.downlink} Mbit/s)`);
  }
  if (s.handheld) return no('a phone or tablet');
  if (!s.strongMachine) return no('not a strong machine (or on battery)');
  if (s.deviceMemory !== undefined && s.deviceMemory < 8) return no(`${s.deviceMemory} GB of memory`);
  return { allowed: true, reason: 'a strong machine on a fast connection' };
}

export const THIN_LINE_MBPS = 150;
export function thinLine(): boolean {
  const c = (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection);
  if (c?.saveData || c?.type === 'cellular') return true;
  const measured = measuredMbps();
  return measured !== undefined && measured < THIN_LINE_MBPS;
}
