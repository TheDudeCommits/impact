import type { GameSnapshot } from '../../game/types';
import {riftOf} from '../../game/moba/model';
import { objectiveOf, RULES } from '../../game/objectives/model';
import { KO_HEAL, MAX_PLAYERS, MIN_MATCH_FIELD } from '../../game/moves';
import type { HomeMode } from '../MangaHome';
import { GUARD_HINT } from '../guardGuide';

export type ModeId = 'duel' | 'royale' | 'training' | 'arcade' | 'last-stand' | 'bad-blood' | 'rift-war';
export type VariantId = 'offline' | 'online' | 'friends';
export const VARIANT_ORDER: readonly VariantId[] = ['offline', 'online', 'friends'];
export const MODE_ORDER: readonly ModeId[] = ['duel', 'royale', 'training', 'arcade', 'last-stand', 'bad-blood', 'rift-war'];

export const WAY_WORDS: Readonly<Record<VariantId, string>> = { offline: 'BOTS', online: 'ONLINE', friends: 'FRIENDS' };
export interface ModeVariant {
  label: string;
  card: string;
  tag: string;
  onDevice?: boolean;
  note: string;
  go: string;
}
export interface ModeInfo {
  id: ModeId;
  name: string;
  goal: string;
  tagline: string;
  win: string;
  facts: { players: string; length: string; lives: string };
  howTo: readonly [string, string, string];
  variants: Partial<Record<VariantId, ModeVariant>>;
  art: string;
  cover?: string;
  kicker?: string;
  panels: readonly [Panel, Panel, Panel];
  rulesVersion: number;
}

export type Panel = { src: string; at?: string } | { move: 'ultimate' | 'special' | 'awakening' };
const art = (id: string, at?: string): Panel => ({ src: `/assets/home/modes/${id}.webp`, at });
const revive = RULES.heroReviveSeconds, villains = RULES.villainMultiplier;
export const MODES: Readonly<Record<ModeId, ModeInfo>> = {
  'rift-war': {
    id:'rift-war',name:'RIFT WAR',art:'rift-war',rulesVersion:1,kicker:'VALLEY OF THE END · THREE-LANE WAR',
    tagline:'Push the lanes. Break their core.',goal:'Heroes against Villains. Lead your army through three lanes and destroy the enemy core.',
    win:'Break a lane’s towers and barracks, defeat the core guardians, then destroy the core.',
    facts:{players:'5 V 5',length:'~15–25 MIN',lives:'RESPAWNS'},
    howTo:['Fight alongside your grunts. Land the finishing blow for gold and stay near defeated enemies to gain experience.','Spend gold on equipment at your fountain. Recall returns you there after a channel; damage or movement interrupts it.','Push towers with your wave. Break barracks to strengthen your army, or rally for the Rift Guardian’s team blessing.'],
    panels:[art('rift-war','20% 50%'),art('rift-war','50% 50%'),art('rift-war','80% 50%')],
    variants:{offline:{label:'BOTS',card:'BOTS',tag:'YOUR TEAM + BOT RIVALS',onDevice:true,note:'A full 5 v 5 on this device. Pick your faction and pause any time.',go:'DEPLOY'},online:{label:'ONLINE',card:'ONLINE',tag:'PUBLIC 5 V 5',note:'Find other fighters. Bots fill vacant seats when the queue countdown ends.',go:'FIND WAR'},friends:{label:'FRIENDS',card:'FRIENDS',tag:'PRIVATE 5 V 5',note:'Share a room code. Pick Heroes or Villains; bots fill the remaining positions.',go:'HOST WAR'}},
  },
  duel: {
    tagline: 'One rival. First to two.',
    id: 'duel', name: 'DUEL', art: 'duel', rulesVersion: 2, kicker: 'WORLD MARTIAL ARTS TOURNAMENT · 1 V 1',
    panels: [art('duel', '30% 30%'), { move: 'ultimate' }, art('duel', '75% 60%')],
    goal: 'One rival. Best of three. Win two rounds.',
    win: "Knock out your rival in two rounds to win the set.",
    facts: { players: '1 V 1', length: '~3–7 MIN', lives: 'FIRST TO TWO' },
    howTo: [
      '{target} locks the camera on your rival; press it again to let go.',
      'Strings ({light} ×4) and enders fill your meter. {ultimate} spends it.',
      `{guard} ${GUARD_HINT}.`,
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'ONE BOT RIVAL', onDevice: true, note: 'A bot rival on this device. Pause any time.', go: 'FIGHT' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS ONLY', note: 'Matched with a real player. Never a bot.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE 1 V 1', note: 'A private 1 v 1. Share the code; both of you pick a fighter.', go: 'HOST ROOM' },
    },
  },
  royale: {
    tagline: 'Last fighter standing wins.',
    id: 'royale', name: 'BATTLE ROYALE', art: 'players', rulesVersion: 3, kicker: 'EVERYONE AGAINST EVERYONE',
    panels: [art('players', '50% 35%'), { move: 'special' }, { move: 'ultimate' }],
    goal: 'Everyone against everyone. Last fighter standing wins.',
    win: 'Be the last one standing. One life each.',
    facts: { players: `4–${MAX_PLAYERS} FIGHTERS`, length: '~3–6 MIN', lives: 'ONE LIFE' },
    howTo: [
      `Pick your fights: finish fighters who are hurt. Every KO heals you ${Math.round(KO_HEAL * 100)}%.`,
      'Stay in the action. Fighters who hide get hunted.',
      'Your meter carries from fight to fight. Save {ultimate} for the one that matters.',
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'BOTS IN EVERY SEAT', note: 'Fight bots on this device. Choose how many fighters and pause any time.', go: 'FIGHT', onDevice: true },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS + BOTS', note: `Real players first; bots fill the field to ${MIN_MATCH_FIELD} when the countdown ends.`, go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'Your room, your rules. Seats your friends leave empty are filled with bots.', go: 'HOST ROOM' },
    },
  },
  training: {
    tagline: 'Learn your fighter.',
    id: 'training', name: 'TRAINING GROUND', art: 'training', rulesVersion: 2, kicker: 'NO STAKES',
    panels: [{ move: 'special' }, art('training', '50% 30%'), { move: 'awakening' }],
    goal: 'Learn your fighter. No stakes.',
    win: 'Nothing to win: practise until it is second nature.',
    facts: { players: 'YOU + A DUMMY', length: 'NO CLOCK', lives: 'NO KNOCKOUTS' },
    howTo: [
      'Work down the move list. Each move ticks off when it lands.',
      'Open LABORATORY to choose your opponent, record a dummy sequence, or practise a punishment drill.',
      '{quick2} resets positions; {quick3} fills meters. The laboratory can slow or freeze combat and advance one frame.',
    ],
    variants: { offline: { label: 'SOLO', card: 'SOLO', tag: 'YOU AND A DUMMY', onDevice: true, note: 'You and a sparring dummy, on this device.', go: 'TRAIN' } },
  },
  arcade: {
    tagline: 'Survive the endless horde.',
    id: 'arcade', name: 'ARCADE SURVIVAL', art: 'arcade', rulesVersion: 1, kicker: 'THE RIFT · ENDLESS HORDE',
    panels: [{ src: '/assets/survival/intro/2.webp', at: '50% 40%' }, art('arcade', '50% 30%'), { src: '/assets/survival/intro/4.webp', at: '50% 50%' }],
    goal: 'Hold the rift against an endless horde, round after round.',
    win: "Beat each round's guardian to go deeper. The run ends when you fall.",
    facts: { players: 'SOLO OR 2–4 CO-OP', length: '~10–30 MIN', lives: 'CO-OP REVIVES' },
    howTo: [
      'Clear the horde to fill the rift bar. When it is full, the guardian comes.',
      'Level up to choose a power. Spend skill points with {tree}.',
      'Chain knockouts and keep your style up to raise your score.',
    ],
    variants: {
      offline: { label: 'SOLO', card: 'SOLO', tag: 'YOUR OWN RUN', onDevice: true, note: 'Your run, on this device. Pause any time.', go: 'START RUN' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'JOIN A CO-OP PARTY', note: 'Join any open party; mid-run, you drop in between rounds.', go: 'FIND PARTY' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'CO-OP ROOM', note: 'Up to 4 fighters. Fall, and a friend can pick you back up.', go: 'HOST ROOM' },
    },
  },
  'last-stand': {
    tagline: 'Defend the gate, wave after wave.',
    id: 'last-stand', name: 'LAST STAND', art: 'last-stand', rulesVersion: 1,
    cover: '/assets/ui/objectives/last-stand-deployment.webp', kicker: 'THE HIDDEN LEAF · ENDLESS DEFENCE',
    panels: [art('last-stand', '50% 30%'), { src: '/assets/ui/objectives/last-stand-deployment.webp', at: '60% 70%' }, { src: '/assets/ui/objectives/defences.webp', at: '0% 50%' }],
    goal: 'Defend the Hidden Leaf gate, wave after wave.',
    win: 'Hold as many waves as you can. The stand ends if the village falls or every defender is down.',
    facts: { players: '1–4 DEFENDERS', length: 'ENDLESS', lives: 'ALLIES REVIVE YOU' },
    howTo: [
      'Stop raiders before they reach the gate. The village bar is your life.',
      `Stand beside a fallen ally for ${RULES.rescueSeconds} seconds to revive them.`,
      'Kills earn shared funds. Spend them with the Quartermaster inside the gate ({interact}).',
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'BOT DEFENDERS', onDevice: true, note: 'You and three bot defenders, on this device.', go: 'DEPLOY' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'FIND A SQUAD', note: 'Defend with other players; bots fill empty seats.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'A private room. Share the code; you choose whether bots fill empty seats.', go: 'HOST ROOM' },
    },
  },
  'bad-blood': {
    tagline: 'Heroes vs empowered Villains.',
    id: 'bad-blood', name: 'BAD BLOOD', art: 'bad-blood', rulesVersion: 1,
    cover: '/assets/ui/objectives/bad-blood-deployment.webp', kicker: 'THE FALLEN CITADEL · TEAM ELIMINATION',
    panels: [{ src: '/assets/ui/objectives/bad-blood-deployment.webp', at: '70% 40%' }, art('bad-blood', '50% 30%'), { move: 'ultimate' }],
    goal: 'Three Heroes against three empowered Villains.',
    win: 'Knock out the whole other team.',
    facts: { players: '3 V 3', length: '~2–5 MIN', lives: 'HEROES RETURN ONCE' },
    howTo: [
      `Villains have ${villains}× power and one life.`,
      `A fallen Hero returns after ${revive} seconds, once. If every Hero is down at once, the Heroes lose.`,
      'Stick together and focus one target.',
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'BOTS ON BOTH SIDES', onDevice: true, note: 'Both teams filled with bots, on this device.', go: 'FIGHT' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS + BOTS', note: 'Matched with other players; bots fill empty seats.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'A private room for up to six, three a side.', go: 'HOST ROOM' },
    },
  },
};

export const MODE_OF_HOME: Readonly<Record<HomeMode, { mode: ModeId; variant?: VariantId }>> = {
  duel: { mode: 'duel' }, players: { mode: 'royale', variant: 'online' }, bots: { mode: 'royale' },
  private: { mode: 'royale', variant: 'friends' }, training: { mode: 'training' }, arcade: { mode: 'arcade' },
  'last-stand': { mode: 'last-stand' }, 'bad-blood': { mode: 'bad-blood' }, 'rift-war': {mode:'rift-war'},
};

export function modeOfSnapshot(snapshot: GameSnapshot, survival: boolean): ModeId {
  if (survival) return 'arcade';
  if (riftOf(snapshot)) return 'rift-war';
  const objective = objectiveOf(snapshot);
  if (objective) return objective.kind;
  if (snapshot.roomMode === 'training') return 'training';
  if (snapshot.lobby?.duel) return 'duel';
  return 'royale';
}
