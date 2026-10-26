import type { ModeId, VariantId } from './catalogue';
import { MODES } from './catalogue';
import { namedPlace, placeForStart, type StageChoice } from '../../game/stageChoice';
import type { StageId } from '../../game/stages';

const read = <T>(key: string, fallback: T): T => { try { const raw = globalThis.localStorage?.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { } };

export const SEEN_KEY = 'rift-modes-seen', PREFS_KEY = 'rift-mode-prefs', COACH_KEY = 'rift-coach', DUMMY_KEY = 'rift-training-dummy';

export function explainerSeen(mode: ModeId) { return (read<Record<string, number>>(SEEN_KEY, {})[mode] ?? 0) >= MODES[mode].rulesVersion; }
export function markExplainerSeen(mode: ModeId) { const seen = read<Record<string, number>>(SEEN_KEY, {}); seen[mode] = MODES[mode].rulesVersion; write(SEEN_KEY, seen); }

export interface ModePrefs { variant?: VariantId; fighters?: number; roomSize?: number; lone?: boolean; rival?: import('../../game/types').FighterId; stage?: StageChoice }
export function modePrefs(mode: ModeId): ModePrefs { return read<Record<string, ModePrefs>>(PREFS_KEY, {})[mode] ?? {}; }
export function saveModePrefs(mode: ModeId, prefs: ModePrefs) { const all = read<Record<string, ModePrefs>>(PREFS_KEY, {}); all[mode] = { ...all[mode], ...prefs }; write(PREFS_KEY, all); }
export function namedPlaceFor(mode: ModeId, way: VariantId, field?: number): StageId | undefined { return namedPlace(modePrefs(mode).stage, mode, way, field); }
export function trainingPlace(): StageId | undefined { return placeForStart(namedPlaceFor('training', 'offline'), 'training', 'offline'); }
export function trainingRival(): string | undefined { const rival = modePrefs('training').rival; return typeof rival === 'string' && rival ? rival : undefined; }

type CoachStore = Record<string, string[]> & { off?: boolean };
export function coachOn() { return !read<CoachStore>(COACH_KEY, {}).off; }
export function setCoachOn(on: boolean) { const store = read<CoachStore>(COACH_KEY, {}); if (on) delete store.off; else store.off = true; write(COACH_KEY, store); }
export function coachShown(mode: ModeId): readonly string[] { const list = read<CoachStore>(COACH_KEY, {})[mode]; return Array.isArray(list) ? list : []; }
export function markCoachShown(mode: ModeId, tip: string) { const store = read<CoachStore>(COACH_KEY, {}); const list = Array.isArray(store[mode]) ? store[mode] as string[] : []; if (!list.includes(tip)) store[mode] = [...list, tip]; write(COACH_KEY, store); }

export type DummyMode = 'passive' | 'combat';
export function trainingDummy(): DummyMode { return read<string>(DUMMY_KEY, 'passive') === 'combat' ? 'combat' : 'passive'; }
export function setTrainingDummy(mode: DummyMode) { write(DUMMY_KEY, mode); }
