import type { MoveDefinition, Outcome } from '../../game/moves';
import { ATTACK_SLOTS, SPEC_VERSION, type SimFighterSpec } from './spec';
import { BODY_TYPES, ELEMENT_KITS } from './archetypes';
import { AREA_DAMAGE_CEILING, areaTotal } from './areaDamage';

export const AREA_CARD_MAX = 16;

export interface Problems { errors: string[]; warnings: string[] }

const STYLES: ReadonlySet<MoveDefinition['style']> = new Set(['melee', 'beam', 'projectile', 'bomb', 'field']);
const OUTCOMES: ReadonlySet<Outcome> = new Set(['launch', 'hop', 'crumple', 'stagger', 'spin', 'wallBounce', 'groundBounce', 'knockdown', 'dizzy']);
const KNOCKS: ReadonlySet<NonNullable<MoveDefinition['knock']>> = new Set(['slam', 'spike', 'slide', 'splat']);
const RUSH_SHAPES = new Set(['launch', 'juggle', 'spike', 'carry', 'stagger', 'spin']);
const AWAKENING_KINDS = new Set(['form', 'summon', 'stand', 'aura']);

export const MOVE_LIMITS = {
  duration: [0.1, 6],
  damage: [0, 400],
  finisherDamage: [0, 400],
  scheduleEntry: [0, 700],
  range: [0, 50],
  radius: [0.1, 8],
  stamina: [0, 100],
  cooldown: [0, 40],
  stun: [0, 4], finisherStun: [0, 4],
  knockback: [-30, 30], finisherKnockback: [-30, 30],
  speed: [1, 150],
  lunge: [0, 20], lungeDelay: [0, 2], close: [0, 15],
  chargeIn: [0, 6], spacing: [0, 5], track: [0, Math.PI], active: [0, 1], hitstop: [0, 1], lift: [0, 20],
  plunge: [0, 60], down: [0, 4], daze: [0, 4],
  contacts: [1, 24],
  teleportReach: [0, 20], timeStopDuration: [0, 5], timeStopRadius: [0, 12], confirmRecovery: [0, 3],
  areaTelegraph: [0.3, 3], areaHits: [1, 8], areaInterval: [0.05, 1.5], areaHeight: [1, 12], areaRange: [3, 30], areaRadius: [1.5, 8],
} as const satisfies Record<string, readonly [number, number]>;
const AREA_LOOKS = new Set(['burst', 'zone', 'rain', 'pillar']), AREA_ANIMS = new Set(['light', 'heavy', 'special', 'ultimate']);

const ID = /^[a-z0-9][a-z0-9-]{0,40}$/;

export function moveProblems(move: MoveDefinition | undefined, at: string, out: Problems = { errors: [], warnings: [] }): Problems {
  const error = (text: string) => out.errors.push(`${at}: ${text}`), warn = (text: string) => out.warnings.push(`${at}: ${text}`);
  if (!move || typeof move !== 'object') { error('missing'); return out; }
  const within = (key: keyof typeof MOVE_LIMITS, value: unknown, label: string = key) => {
    if (value === undefined) return;
    const [lo, hi] = MOVE_LIMITS[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) error(`${label} is not a number`);
    else if (value < lo || value > hi) error(`${label} ${value} is outside ${lo}..${hi}`);
  };
  if (typeof move.name !== 'string' || !move.name.trim()) error('has no name');
  else if (move.name.length > 60) error(`name is ${move.name.length} characters (60 at most)`);
  if (!STYLES.has(move.style)) error(`style "${String(move.style)}" is not one of ${[...STYLES].join(', ')}`);
  for (const key of ['duration', 'damage', 'range', 'radius', 'stamina', 'cooldown', 'stun', 'knockback'] as const) {
    if (move[key] === undefined) error(`has no ${key}`); else within(key, move[key]);
  }
  for (const key of ['finisherDamage', 'finisherStun', 'finisherKnockback', 'speed', 'lunge', 'lungeDelay', 'close', 'chargeIn',
    'spacing', 'track', 'active', 'hitstop', 'lift', 'plunge', 'down', 'daze'] as const) within(key, move[key]);
  const contacts = move.contacts;
  if (!Array.isArray(contacts) || !contacts.length) error('has no contacts');
  else {
    const [lo, hi] = MOVE_LIMITS.contacts;
    if (contacts.length < lo || contacts.length > hi) error(`has ${contacts.length} contacts (${lo}..${hi})`);
    contacts.forEach((at, i) => {
      if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) error(`contact ${i} (${at}) is not a time in seconds`);
      else if (i && at < contacts[i - 1]) error(`contact ${i} (${at}) lands before contact ${i - 1} (${contacts[i - 1]})`);
      else if (typeof move.duration === 'number' && at > move.duration) error(`contact ${i} (${at}) lands after the move ends (${move.duration})`);
    });
    if (move.schedule !== undefined) {
      if (!Array.isArray(move.schedule) || move.schedule.length !== contacts.length) error(`schedule has ${move.schedule?.length} entries for ${contacts.length} contacts`);
      else move.schedule.forEach((each, i) => within('scheduleEntry', each, `schedule[${i}]`));
    }
  }
  if (move.area !== undefined) {
    const area = move.area;
    if (!area || typeof area !== 'object') error('area is not an area spec');
    else {
      if (area.telegraph === undefined) error('area has no telegraph');
      else if (!(move.range === 0 && area.telegraph === 0)) within('areaTelegraph', area.telegraph, 'area.telegraph');
      within('areaHits', area.hits, 'area.hits');
      if (area.hits !== undefined && !Number.isInteger(area.hits)) error(`area.hits ${area.hits} is not a whole number`);
      within('areaInterval', area.interval, 'area.interval');
      within('areaHeight', area.height, 'area.height');
      if (move.range !== 0) within('areaRange', move.range, 'an area move\'s range');
      within('areaRadius', move.radius, 'an area move\'s radius');
      const anim = area.anim;
      if (typeof anim === 'string') { if (!AREA_ANIMS.has(anim)) error(`area.anim "${anim}" is not light, heavy, special or ultimate`); }
      else if (anim !== undefined) {
        if (!anim || typeof anim !== 'object' || Array.isArray(anim)) error('area.anim is not a slot or { slot, clip, from, full }');
        else {
          if (anim.slot !== undefined && !AREA_ANIMS.has(anim.slot)) error(`area.anim.slot "${anim.slot}" is not light, heavy, special or ultimate`);
          if (anim.clip !== undefined && (typeof anim.clip !== 'string' || !anim.clip.trim() || anim.clip.length > 64)) error('area.anim.clip is not a clip name');
          if (anim.from !== undefined && (typeof anim.from !== 'string' || !ID.test(anim.from))) error(`area.anim.from "${String(anim.from)}" is not a fighter id`);
          if (anim.clip !== undefined && anim.from !== undefined) error('area.anim borrows another fighter by slot ({ from, slot }), not by clip');
          if (anim.full !== undefined && typeof anim.full !== 'boolean') error('area.anim.full is not true or false');
          for (const key of Object.keys(anim)) if (!['slot', 'clip', 'from', 'full'].includes(key)) error(`area.anim.${key} is not slot, clip, from or full`);
        }
      }
      if (area.voice !== undefined && (typeof area.voice !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(area.voice))) error(`area.voice "${String(area.voice)}" is not a voice cue id`);
      if (area.ja !== undefined && (typeof area.ja !== 'string' || !area.ja.trim() || [...area.ja].length > 16)) error('area.ja is not a name of 1-16 characters');
      if (area.card !== undefined && (typeof area.card !== 'string' || !area.card.trim() || [...area.card].length > AREA_CARD_MAX)) error(`area.card is not a name of 1-${AREA_CARD_MAX} characters`);
      if (area.look !== undefined && !AREA_LOOKS.has(area.look)) error(`area.look "${area.look}" is not burst, zone, rain or pillar`);
      if (area.fx !== undefined && (typeof area.fx !== 'string' || !/^[a-z0-9][a-z0-9_./-]{0,79}$/i.test(area.fx))) error(`area.fx "${String(area.fx)}" is not an effect id`);
      if (area.strikes !== undefined) {
        const at = area.strikes;
        if (!Array.isArray(at) || at.length < 2 || at.length > MOVE_LIMITS.areaHits[1] || at[0] !== 0
          || at.some((t, k) => typeof t !== 'number' || !Number.isFinite(t) || t > 4 || (k > 0 && t <= at[k - 1]))) error('area.strikes is not 2-8 rising times from 0, within 4 s');
        if (area.hits !== undefined || area.interval !== undefined) error('area.strikes and a pinned area.hits or area.interval: one schedule, not two');
      }
      if (areaTotal(move) > AREA_DAMAGE_CEILING) error(`an area move deals ${areaTotal(move)} in all, over the area ceiling (${AREA_DAMAGE_CEILING})`);
      if (move.style !== 'field') error(`an area move's style is "field", not "${move.style}"`);
      if (Array.isArray(contacts) && contacts.length !== 1) error('an area move has one contact: its release (area.hits counts its strikes)');
    }
  }
  if ((move.style === 'projectile' || move.style === 'bomb') && move.speed === undefined && !move.timeStop) warn(`a ${move.style} with no speed flies at the default`);
  if (move.outcome !== undefined && !OUTCOMES.has(move.outcome)) error(`outcome "${move.outcome}" is not one of ${[...OUTCOMES].join(', ')}`);
  if (move.knock !== undefined && !KNOCKS.has(move.knock)) error(`knock "${move.knock}" is not one of ${[...KNOCKS].join(', ')}`);
  if (move.teleport) {
    const t = move.teleport;
    within('teleportReach', t.reach, 'teleport.reach');
    if (!(t.vanish >= 0 && t.appear >= t.vanish)) error(`teleport appears (${t.appear}) before it vanishes (${t.vanish})`);
    if (typeof move.duration === 'number' && t.appear > move.duration) error(`teleport appears (${t.appear}) after the move ends`);
  }
  if (move.timeStop) {
    within('timeStopDuration', move.timeStop.duration, 'timeStop.duration'); within('timeStopRadius', move.timeStop.radius, 'timeStop.radius');
    if (!Array.isArray(contacts) || !Number.isInteger(move.timeStop.contact) || move.timeStop.contact < 0 || move.timeStop.contact >= contacts.length) error(`timeStop.contact ${move.timeStop.contact} is not one of its contacts`);
  }
  if (move.confirm) within('confirmRecovery', move.confirm.recovery, 'confirm.recovery');
  if (move.status) {
    const { kind, seconds, dps, factor } = move.status;
    if (kind === 'burn') { if (!(seconds > 0 && seconds <= 6)) error(`a burn lasts ${seconds} s (up to 6)`); if (!(typeof dps === 'number' && dps > 0 && dps <= 25)) error(`a burn deals ${dps} a second (up to 25)`); }
    else if (kind === 'slow') { if (!(seconds > 0 && seconds <= 4)) error(`a slow lasts ${seconds} s (up to 4)`); if (!(typeof factor === 'number' && factor >= .4 && factor < 1)) error(`a slow runs at ${factor} of speed (0.4 to under 1)`); }
    else if (kind === 'freeze') { if (!(seconds > 0 && seconds <= 1)) error(`a freeze lasts ${seconds} s (up to 1)`); }
    else error(`status "${String(kind)}" is not burn, slow or freeze`);
  }
  if (move.origin) {
    const { right, forward, up } = move.origin;
    if (![right, forward, up].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(right) > 4 || Math.abs(forward) > 4 || up < 0 || up > 8)
      error(`origin {right ${right}, forward ${forward}, up ${up}} is outside 4 m to a side or ahead and 0..8 m up`);
  }
  return out;
}

export function specProblems(spec: SimFighterSpec): Problems {
  const out: Problems = { errors: [], warnings: [] };
  const error = (text: string) => out.errors.push(text);
  if (spec?.spec !== SPEC_VERSION) error(`spec version ${spec?.spec} is not ${SPEC_VERSION}`);
  if (typeof spec?.id !== 'string' || !ID.test(spec.id)) error(`id "${spec?.id}" must be lower-case letters, digits and dashes`);
  if (!spec?.kit) { error('has no kit'); return out; }
  if (!spec.series?.trim()) error('has no series');
  if (spec.faction !== 'heroes' && spec.faction !== 'villains') error(`faction "${spec.faction}" is not heroes or villains`);
  if (!spec.archetype || !(spec.archetype.body in BODY_TYPES)) error(`body type "${spec.archetype?.body}" is not one of ${Object.keys(BODY_TYPES).join(', ')}`);
  if (!spec.archetype?.elements?.length) error('has no element kit');
  for (const kit of spec.archetype?.elements ?? []) if (!(kit in ELEMENT_KITS)) error(`element kit "${kit}" is not one of ${Object.keys(ELEMENT_KITS).join(', ')}`);
  const body = spec.body;
  if (!body || !(body.contactGap > 0 && body.contactGap < 6)) error(`body.contactGap ${body?.contactGap} is outside 0..6`);
  if (!body || !(body.bodySize > 0.3 && body.bodySize < 4)) error(`body.bodySize ${body?.bodySize} is outside 0.3..4`);
  if (!body || !(body.jumpScale > 0.2 && body.jumpScale < 4)) error(`body.jumpScale ${body?.jumpScale} is outside 0.2..4`);
  for (const slot of ATTACK_SLOTS) moveProblems(spec.kit.slots?.[slot], `kit.slots.${slot}`, out);
  if (!Array.isArray(spec.kit.rush) || !spec.kit.rush.length || spec.kit.rush.length > 8) error(`kit.rush has ${spec.kit.rush?.length} stages (1..8)`);
  else spec.kit.rush.forEach((move, i) => moveProblems(move, `kit.rush[${i}]`, out));
  if (!RUSH_SHAPES.has(spec.kit.rushShape)) error(`kit.rushShape "${spec.kit.rushShape}" is not one of ${[...RUSH_SHAPES].join(', ')}`);
  for (const [key, move] of Object.entries(spec.kit.combos ?? {})) moveProblems(move, `kit.combos.${key}`, out);
  for (const [slot, move] of Object.entries(spec.kit.awakened?.slots ?? {})) moveProblems(move, `kit.awakened.slots.${slot}`, out);
  (spec.kit.awakened?.rush ?? []).forEach((move, i) => { if (move) moveProblems(move, `kit.awakened.rush[${i}]`, out); });
  for (const [key, move] of Object.entries(spec.kit.awakened?.combos ?? {})) moveProblems(move, `kit.awakened.combos.${key}`, out);
  const awakening = spec.kit.awakening;
  if (!awakening?.name?.trim()) error('kit.awakening has no name');
  if (!AWAKENING_KINDS.has(awakening?.kind)) error(`kit.awakening.kind "${awakening?.kind}" is not one of ${[...AWAKENING_KINDS].join(', ')}`);
  if (spec.kit.slots?.ultimate && spec.kit.slots.ultimate.stamina > 0) out.warnings.push('kit.slots.ultimate costs stamina (ultimates are paid by the bar)');
  return out;
}
