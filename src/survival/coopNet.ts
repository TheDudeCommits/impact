import { Packr, Unpackr } from 'msgpackr';
import type { GameSnapshot, PlayerState } from '../game/types';
import type { Orb, SurvivalView } from './SurvivalGame';

export const COOP_ROOM = 'survival_arena';
export const SURVIVAL_PROTOCOL = 2;
export const DRAFT_SECONDS = 25;
export const TRAVEL_SECONDS = 25;

export interface CoopView extends Omit<SurvivalView, 'orbs'> {
  run: number;
  host: boolean;
  marked: { bosses: string[]; champions: string[]; rivals: string[] };
  orbs: CoopOrb[];
  draftLeft?: number;
  treeLeft?: number;
  loading?: number;
}
export type CoopOrb = Pick<Orb, 'id' | 'kind' | 'value' | 'x' | 'y' | 'z' | 'pulled'>;
export interface CoopFrame extends GameSnapshot { survival: CoopView;
  horde?: Uint8Array }

const ROSTER_ONLY = ['stamina', 'ultimate', 'awakening', 'isBot', 'kills', 'damageDealt', 'damageTaken', 'cooldowns', 'actionSeq', 'ackSeq', 'combo', 'fighter'] as const;
const NEUTRAL: Partial<PlayerState> = { stamina: 100, ultimate: 0, awakening: 0, isBot: false, kills: 0, damageDealt: 0, damageTaken: 0,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } as PlayerState['cooldowns'], combo: 0, fighter: 'goku' };

const FEED_WINDOW = 24;

export function slimView(view: SurvivalView): Omit<CoopView, 'run' | 'host' | 'marked'> {
  return { ...view,
    orbs: view.orbs.map(orb => ({ id: orb.id, kind: orb.kind, value: Math.round(orb.value * 100) / 100, x: round(orb.x), y: round(orb.y), z: round(orb.z), pulled: orb.pulled })),
    feed: view.feed.slice(-FEED_WINDOW) };
}
const round = (value: number) => Math.round(value * 100) / 100;

const packr = new Packr({ useRecords: true });
const unpackr = new Unpackr({ useRecords: true });

export function encode(frame: CoopFrame): Uint8Array {
  const players = frame.players.map(body => {
    if (!body.enemy) return body;
    const slim: Record<string, unknown> = { ...body };
    for (const key of ROSTER_ONLY) delete slim[key];
    return slim;
  });
  return packr.pack({ ...frame, players });
}

export function decode(bytes: Uint8Array): CoopFrame {
  const frame = unpackr.unpack(bytes) as CoopFrame;
  frame.players = frame.players.map(body => body.enemy ? { ...NEUTRAL, ...body, cooldowns: { ...NEUTRAL.cooldowns!, ...body.cooldowns } } as PlayerState : body);
  return frame;
}

export const COOP_LINK: { room?: { send(type: string, message?: unknown): void; connection: { isOpen: boolean } };
  match?: { send(type: string, message?: unknown): void; connection: { isOpen: boolean } };
  token?: string } = {};
