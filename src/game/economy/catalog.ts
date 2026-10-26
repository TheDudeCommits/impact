import { RARITY, type Rarity } from './rarity';
import { UNLOCKS } from './unlocks';
import type { FighterId } from '../types';

export const KINDS = {
  fighter: { name: 'Fighters', one: 'Fighter', blurb: 'Fighters of your own, to play in every mode. Any of them can be tried first in the Training Ground.' },
  outfit: { name: 'Outfits', one: 'Outfit', blurb: 'Another look for one fighter - a form or a costume of theirs - every move the same.' },
  skin: { name: 'Page skins', one: 'Page skin', blurb: 'How your fighter is drawn. Every skin fits every fighter.' },
  form: { name: 'Forms', one: 'Form', blurb: 'The look of an awakening: your fighter redrawn, and what burns round them, while they are awakened.' },
  aura: { name: 'Auras', one: 'Aura', blurb: 'What burns round your fighter all match.' },
  trail: { name: 'Afterimages', one: 'Afterimage', blurb: 'What a dash leaves behind.' },
  kill: { name: 'Kill effects', one: 'Kill effect', blurb: 'What the horde does as you cut it down. Your whole party sees it.' },
  banner: { name: 'Streak banners', one: 'Streak banner', blurb: 'What crosses the screen as your KO chain climbs: at 50, 100, 500 and 1,000.' },
  emote: { name: 'Emotes', one: 'Emote', blurb: 'Manga stickers and lettering over your fighter. Four on the wheel: keys 1-4 or the D-pad in a fight.' },
  entrance: { name: 'Entrance pages', one: 'Entrance page', blurb: 'Your own splash page as a match begins.' },
  stamp: { name: 'Finisher stamps', one: 'Finisher stamp', blurb: 'What a finisher is stamped with.' },
  ko: { name: 'Knockout effects', one: 'Knockout effect', blurb: 'What the fallen do.' },
  title: { name: 'Titles', one: 'Title', blurb: 'The line under your name.' },
  addon: { name: 'Add-ons', one: 'Add-on', blurb: 'Worn: a mask, horns, a familiar that follows.' },
  quip: { name: 'Quips', one: 'Quip pack', blurb: 'Lines lettered in a speech bubble.' },
  announcer: { name: 'Announcers', one: 'Announcer', blurb: 'A different voice calling the fight.' },
  music: { name: 'Music', one: 'Album', blurb: "The game's own score." },
  place: { name: 'Places', one: 'Place', blurb: 'Stages and variants to start a run in.' },
} as const;
export type ItemKind = keyof typeof KINDS;
export const EMOTE_SLOTS = 4;

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  blurb: string;
  stage: 'live' | 'road' | 'retired' | 'next' | 'ask';
  feat?: string;
  glyph?: string;
  fighter?: FighterId;
  price?: number;
  level?: number;
}

const item = (kind: ItemKind, id: string, name: string, rarity: Rarity, blurb: string, extra: Partial<Item> = {}): Item => ({ id: `${kind}-${id}`, name, kind, rarity, blurb, stage: 'live', ...extra });
const next = { stage: 'next' } as const, ask = { stage: 'ask' } as const;

const CATALOGUE: readonly Item[] = [
  item('skin', 'newsprint', 'Newsprint', 'common', 'Grey halftone dots, as a weekly prints it.', { glyph: '網' }),
  item('skin', 'blueline', 'Blueline', 'common', 'A pencil sketch in non-photo blue.', { glyph: '下' }),
  item('skin', 'sumi-e', 'Sumi-e', 'rare', 'Black ink and bare paper: your fighter joins the page.', { glyph: '墨' }),
  item('skin', 'sepia', 'Sepia Volume', 'rare', 'An old collected edition, browned.', { glyph: '古' }),
  item('skin', 'negative', 'Negative', 'epic', 'White ink on black, as a rank-S page.', { glyph: '反' }),
  item('skin', 'blood-moon', 'Blood Moon', 'epic', 'Black and one red.', { glyph: '月' }),
  item('skin', 'gold-leaf', 'Gold Leaf', 'legendary', 'Black lacquer and gold leaf, the gold alive in the light.', { glyph: '金', feat: 'seal' }),
  item('skin', 'spectral', 'Spectral', 'legendary', 'A spirit: pale blue, its edges burning off.', { glyph: '霊', feat: 'rank-a' }),
  item('skin', 'authors-hand', "The Author's Hand", 'mythic', 'An unfinished drawing: construction lines that redraw as it moves.', { glyph: '筆', feat: 'author' }),
  item('aura', 'embers', 'Ember Motes', 'common', 'Sparks rising off the shoulders.', { glyph: '火' }),
  item('aura', 'static', 'Static', 'common', 'Small arcs snapping round the body.', { glyph: '電' }),
  item('aura', 'sakura', 'Sakura Drift', 'rare', 'Petals falling round your fighter.', { glyph: '桜' }),
  item('aura', 'ink-wisps', 'Ink Wisps', 'rare', 'Threads of ink curling up.', { glyph: '煙' }),
  item('aura', 'azure-flame', 'Azure Flame', 'epic', 'A cold blue fire from the feet up.', { glyph: '蒼' }),
  item('aura', 'thunder-coil', 'Thunder Coil', 'epic', 'A coil of lightning turning round the body.', { glyph: '雷' }),
  item('aura', 'black-sun', 'Black Sun', 'legendary', "An eclipse's corona behind the head.", { glyph: '蝕', feat: 's-rank' }),
  item('aura', 'ink-dragon', 'Ink Dragon', 'legendary', 'A dragon of brush strokes winding round your fighter.', { glyph: '龍', ...next }),
  item('aura', 'hundred-seals', 'Hundred Seals', 'mythic', 'A ring of red seals turning slowly, each a kanji.', { glyph: '印', feat: 'bosses-100' }),
  item('trail', 'chalk', 'Chalk', 'common', 'A white smear behind a dash.', { glyph: '白' }),
  item('trail', 'afterimage', 'Afterimage', 'rare', 'Faded copies of your fighter left behind.', { glyph: '残' }),
  item('trail', 'crimson-edge', 'Crimson Edge', 'epic', 'Blows leave a red line in the air.', { glyph: '紅', ...next }),
  item('trail', 'ink-brush', 'Ink Brush', 'legendary', 'Every blow a wide black stroke.', { glyph: '刷', ...next }),
  item('trail', 'rift-tear', 'Rift Tear', 'mythic', 'Blows tear the page: a black crack with red at its edge.', { glyph: '裂', ...next }),
  item('emote', 'interrobang', '!?', 'common', 'The mark, popped over the head.', { glyph: '!?' }),
  item('emote', 'dots', '...', 'common', 'Three dots and a silence.', { glyph: '…' }),
  item('emote', 'sweat', 'Sweat Drop', 'common', 'One large drop.', { glyph: '汗' }),
  item('emote', 'anger', 'Anger Vein', 'rare', 'The vein, drawn in ink.', { glyph: '怒' }),
  item('emote', 'sparkle', 'Sparkle', 'rare', 'キラッ and four stars.', { glyph: 'キラ' }),
  item('emote', 'menacing', 'Menacing', 'epic', 'ゴゴゴゴ rising round your fighter.', { glyph: 'ゴゴ' }),
  item('emote', 'don', 'DON!!', 'epic', 'ドン!! slammed on in brush.', { glyph: 'ドン' }),
  item('emote', 'speed-lines', 'Speed Lines', 'legendary', "The screen's edge goes to focus lines round your fighter.", { glyph: '集', feat: 'style-sss' }),
  item('emote', 'cover-page', 'Cover Page', 'mythic', 'The moment is framed as a magazine cover, with a masthead.', { glyph: '表', feat: 'seal-3' }),
  item('entrance', 'paper', 'Paper', 'common', 'Your own splash page on plain paper.', { glyph: '紙' }),
  item('entrance', 'newsprint', 'Newsprint', 'rare', 'Coarse dots and a grey page.', { glyph: '網' }),
  item('entrance', 'night', 'Night Edition', 'epic', 'Black paper, white ink.', { glyph: '夜' }),
  item('entrance', 'gold-foil', 'Gold Foil', 'legendary', 'A foil stamp and a gilt edge.', { glyph: '箔', feat: 'finishers-25' }),
  item('entrance', 'double-spread', 'Double Spread', 'mythic', 'The page opens across the whole screen, your name in the gutter.', { glyph: '見', feat: 'level-40' }),
  item('stamp', 'the-end', '完 The End', 'rare', 'A finisher is stamped 完.', { glyph: '完' }),
  item('stamp', 'heavens-judgment', "天誅 Heaven's Judgment", 'epic', 'Stamped 天誅, in gold.', { glyph: '天誅' }),
  item('stamp', 'one-blow', '一撃必殺 One Blow', 'legendary', 'Stamped down the whole page.', { glyph: '必殺', feat: 'finishers-25' }),
  item('ko', 'petals', 'Petal Burst', 'rare', 'The bosses you fell go in petals.', { glyph: '散' }),
  item('ko', 'paper-shred', 'Paper Shred', 'epic', 'The fallen tear into strips of paper.', { glyph: '破', ...next }),
  item('ko', 'thunder', 'Thunder Judgment', 'legendary', 'A bolt takes each boss that falls.', { glyph: '雷', feat: 's-rank' }),
  item('ko', 'panel-break', 'Panel Break', 'mythic', "The panel's border breaks with the last blow.", { glyph: '砕', ...next }),
  ...(([['rookie', 'Rookie', 'common'], ['rift-tourist', 'Rift Tourist', 'common'], ['button-masher', 'Button Masher', 'common'], ['weekly-reader', 'Weekly Reader', 'common'],
    ['horde-breaker', 'Horde Breaker', 'rare'], ['page-turner', 'Page Turner', 'rare'], ['glass-cannon', 'Glass Cannon', 'rare'], ['second-wind', 'Second Wind', 'rare'],
    ['god-hand', 'God Hand', 'epic'], ['the-unfallen', 'The Unfallen', 'epic'], ['ink-drinker', 'Ink Drinker', 'epic'],
    ['seal-keeper', 'Seal Keeper', 'legendary', 'seal'], ['one-page-wonder', 'One-Page Wonder', 'legendary', 'fast-boss'], ['the-last-panel', 'The Last Panel', 'legendary', 'finishers-25'],
    ['author', 'Author', 'mythic', 'author'], ['editor-in-chief', 'Editor in Chief', 'mythic', 'level-40']] as const)
    .map(([id, name, rarity, feat]) => item('title', id, name, rarity, 'Worn under your name.', feat ? { feat } : {}))),
  item('addon', 'oni-mask', 'Oni Mask', 'rare', 'A mask on the brow.', { glyph: '鬼', ...next }),
  item('addon', 'kitsune-mask', 'Kitsune Mask', 'rare', 'A fox mask on the brow.', { glyph: '狐', ...next }),
  item('addon', 'horns', 'Horns', 'epic', 'A pair, swept back.', { glyph: '角', ...next }),
  item('addon', 'halo', 'Halo', 'epic', 'A broken ring of light.', { glyph: '輪', ...next }),
  item('addon', 'paper-crane', 'Paper Crane', 'epic', 'A familiar of folded paper that follows.', { glyph: '鶴', ...next }),
  item('addon', 'ink-koi', 'Ink Koi', 'legendary', 'A carp of ink swimming round the shoulders.', { glyph: '鯉', ...next }),
  item('form', 'oni', 'Oni Form', 'legendary', 'Awakened, your fighter is drawn in red lacquer and black, and a fire stands up round them.', { glyph: '鬼', feat: 's-rank' }),
  item('form', 'celestial', 'Celestial Form', 'legendary', 'Awakened, your fighter turns to white porcelain veined with gold, under a ring of light.', { glyph: '天', feat: 'seal' }),
  item('quip', 'stoic', 'Quips: Stoic', 'rare', 'Ten lettered lines for knockouts and finishers.', { glyph: '静', ...next }),
  item('quip', 'loud', 'Quips: Loud', 'rare', 'Ten lettered lines, all capitals.', { glyph: '叫', ...next }),
  item('quip', 'villain', 'Quips: Villain', 'rare', 'Ten lettered lines, none of them kind.', { glyph: '悪', ...next }),
  item('announcer', 'villain', 'The Villain', 'epic', "A designed voice, not anyone's.", { glyph: '声', ...ask }),
  item('announcer', 'deadpan', 'The Deadpan', 'epic', 'A designed voice, unimpressed.', { glyph: '声', ...ask }),
  item('music', 'rift-volume-1', 'The Rift, Volume I', 'epic', "The game's own score for the eight places.", { glyph: '音', ...ask }),
  item('music', 'victory-themes', 'Victory Themes', 'rare', 'A short theme of your own on the results.', { glyph: '勝', ...next }),
  item('place', 'harbor-night', 'Harbour at Night', 'epic', 'The Drowned Harbour under a moon, its light sweeping.', { glyph: '港', ...next }),
  item('place', 'eclipse-ascendant', 'The Eclipse Ascendant', 'epic', 'The Eclipse at its height.', { glyph: '蝕', ...next }),
  item('kill', 'soak', 'Soak', 'rare', 'Everything you cut down bursts into black ink that soaks into the page.', { glyph: '滲' }),
  item('kill', 'screentone', 'Screentone', 'epic', 'The fallen come apart as a printed page does: in dots, off register.', { glyph: '網' }),
  item('kill', 'cranes', 'Thousand Cranes', 'epic', 'The fallen fold into paper cranes and fly.', { glyph: '鶴' }),
  item('kill', 'kintsugi', 'Kintsugi', 'legendary', 'The ground breaks where they fall, and the cracks run with gold. A bell for the big ones.', { glyph: '金', feat: 'rank-a' }),
  item('kill', 'seal', 'Vermilion Seal', 'legendary', 'Every kill stamped with a red seal where it fell; an elite, with a great one, and a thud you feel.', { glyph: '印', feat: 'finishers-25' }),
  item('banner', 'brush', 'Brushstroke', 'epic', 'One stroke of a wide brush across the screen, and the count in white inside it.', { glyph: '筆' }),
  item('banner', 'taiko', 'Taiko', 'legendary', 'A war drum struck, its crest turning, the count in gold on red. Louder at every mark.', { glyph: '太鼓', feat: 'style-sss' }),
  item('skin', 'living-ink', 'Living Ink', 'legendary', 'Drawn as the run goes: a blue pencil sketch, inked at 100 kills, printed at 500, gilded at 2,000.', { glyph: '生', feat: 'rank-b' }),
  item('aura', 'rising', 'Rising Spirit', 'legendary', 'It rises with your style: a thread of ink at D, a black fire at A, a pillar of red and gold at SSS.', { glyph: '昇', feat: 'style-sss' }),
  item('form', 'negative', 'Negative Form', 'epic', 'Awakened, your fighter is printed in reverse: white ink on black, and the black runs off them.', { glyph: '反' }),
  item('outfit', 'goku-ssj', 'Goku · Super Saiyan', 'rare', 'Golden hair that stays up: the form that made the legend, worn from the first round.', { glyph: '超', fighter: 'goku' }),
  item('outfit', 'goku-god', 'Goku · Super Saiyan God', 'rare', 'Slimmer, crimson hair, and a red god-ki for the awakening.', { glyph: '神', fighter: 'goku' }),
  item('outfit', 'goku-blue', 'Goku · Super Saiyan Blue', 'epic', 'The god-ki made Super Saiyan: blue hair, and a blue aura that crackles.', { glyph: '蒼', fighter: 'goku' }),
  item('outfit', 'goku-ui', 'Goku · Ultra Instinct', 'epic', 'Silver hair and a silver-blue aura: the body moving on its own.', { glyph: '極', fighter: 'goku' }),
  item('outfit', 'vegeta-ssj', 'Vegeta · Super Saiyan', 'rare', 'Golden hair, all match: the prince at his first transformation.', { glyph: '超', fighter: 'vegeta' }),
  item('outfit', 'vegeta-god', 'Vegeta · Super Saiyan God', 'rare', 'Crimson hair, a red god-ki for the awakening.', { glyph: '神', fighter: 'vegeta' }),
  item('outfit', 'vegeta-blue', 'Vegeta · Super Saiyan Blue', 'epic', 'Blue hair and a blue aura: the god-ki made Super Saiyan.', { glyph: '蒼', fighter: 'vegeta' }),
  item('outfit', 'vegeta-ego', 'Vegeta · Ultra Ego', 'epic', 'Purple hair and a violet aura: the destroyer\'s pride.', { glyph: '我', fighter: 'vegeta' }),
  item('outfit', 'luffy-gear5', 'Luffy · Gear 5', 'legendary', 'The Sun God Nika: white hair, white clothes, and every move his own - he fights laughing.', { glyph: '陽', fighter: 'luffy', feat: 's-rank' }),
  item('outfit', 'luffy-onigashima', 'Luffy · Raid on Onigashima', 'epic', 'The black cape over his shoulders for the raid on Kaido, and the fight set he raided with.', { glyph: '鬼', fighter: 'luffy' }),
  item('outfit', 'luffy-filmred', 'Luffy · Film Red', 'legendary', 'The captain\'s coat and the skull hat from the concert on Elegia, and the fight set he wore them in.', { glyph: '赤', fighter: 'luffy', feat: 'rank-a' }),
  item('outfit', 'luffy-marineford', 'Luffy · Marineford', 'epic', 'Before the two years: the open vest and the shorts he broke into the war in, and how he fought then.', { glyph: '頂', fighter: 'luffy' }),
  item('outfit', 'zoro-onigashima', 'Zoro · Raid on Onigashima', 'epic', 'The dark kimono and the bandana tied on for Kaido\'s island, and the fight set he raided with.', { glyph: '閻', fighter: 'zoro' }),
  item('outfit', 'zoro-dressrosa', 'Zoro · Dressrosa', 'epic', 'The green suit and the shades from the kingdom of toys, and the cuts he made there.', { glyph: '緑', fighter: 'zoro' }),
  item('outfit', 'sanji-wholecake', 'Sanji · Whole Cake Island', 'epic', 'A white shirt and a red cloak, as on Big Mom\'s island, and the kicks he fought his way out with.', { glyph: '菓', fighter: 'sanji' }),
  item('outfit', 'ace-alabasta', 'Ace · Alabasta', 'epic', 'Hat, beads and bare back in the desert kingdom, and the fire he chased Blackbeard with.', { glyph: '砂', fighter: 'ace' }),
  item('outfit', 'law-onigashima', 'Law · Raid on Onigashima', 'epic', 'The long coat and the spotted hat of the raid, and the operations he cut through it with.', { glyph: '心', fighter: 'law' }),
  item('outfit', 'law-wano', 'Law · Wano', 'epic', 'The kimono he went undercover in, and the fight set he wore it in.', { glyph: '和', fighter: 'law' }),
  item('outfit', 'zoro-ronin', 'Zoro · Black Ronin', 'rare', 'His own kimono dyed black and lined in gold, the sash still red: a swordsman with no master.', { glyph: '浪', fighter: 'zoro' }),
  item('outfit', 'dio-heaven', 'DIO · Heaven', 'rare', 'All in white and gold, a heart at his belt: DIO as he would be in heaven.', { glyph: '天', fighter: 'dio' }),
  item('outfit', 'killua-godspeed', 'Killua · Godspeed', 'rare', 'Lightning running through his clothes and down his arms: Whirlwind, at the speed of thought.', { glyph: '迅', fighter: 'killua' }),
  item('outfit', 'ace-blueflame', 'Ace · Blue Flame', 'rare', 'His fire burning blue: up his arm, round his shorts, and in the beads at his neck.', { glyph: '蒼', fighter: 'ace' }),
  item('outfit', 'sanji-diable', 'Sanji · Diable Jambe', 'rare', 'A sharp black suit, and from the shoes up, his legs on fire.', { glyph: '焔', fighter: 'sanji' }),
  item('fighter', 'kaido', 'Kaido', 'legendary', 'The strongest creature in the world, three metres of him: the kanabo, a gourd of sake, Thunder Bagua - and the man-beast, horned and tailed, when he wakes.', { glyph: '龍', fighter: 'kaido', price: 15000, feat: 's-rank' }),
  item('fighter', 'whitebeard', 'Whitebeard', 'legendary', 'The strongest man in the world: the bisento, and the Quake-Quake Fruit cracking the air and tilting the island under them.', { glyph: '震', fighter: 'whitebeard', price: 15000, feat: 's-rank' }),
  item('fighter', 'shanks', 'Shanks', 'legendary', "Red-Hair: one arm, the Gryphon in it, and a Conqueror's Haki that drops a room to its knees.", { glyph: '覇', fighter: 'shanks', price: 12000, feat: 'rank-a' }),
  item('fighter', 'roger', 'Gol D. Roger', 'legendary', 'The King of the Pirates: Ace in his hand, a flintlock at his belt, and Kamusari - the cut that split the heavens when he crossed blades with Whitebeard.', { glyph: '王', fighter: 'roger', price: 18000, feat: 's-rank' }),
  item('fighter', 'sukuna', 'Ryōmen Sukuna', 'legendary', 'The King of Curses: Dismantle and Cleave from bare hands, Fūga drawn as a bow of fire - and Malevolent Shrine, his domain.', { glyph: '呪', fighter: 'sukuna', price: 18000, feat: 's-rank' }),
  item('fighter', 'aizen', 'Sōsuke Aizen', 'legendary', 'Beyond Bankai, fused with the Hōgyoku: an open palm, Kyōka Suigetsu, six wings of light - and Kurohitsugi, the coffin that closes round them.', { glyph: '崩', fighter: 'aizen', price: 16000, feat: 's-rank' }),
  item('fighter', 'griffith', 'Griffith', 'legendary', "The White Hawk: a fencer's sabre, Falcon Dive through them before they see him move - and the Eclipse, the God Hand's judgement, from Femto's dark.", { glyph: '鷹', fighter: 'griffith', price: 14000, feat: 's-rank' }),
  item('fighter', 'meruem', 'Meruem', 'legendary', "The King of the Chimera Ants: a claw quicker than the eye, a tail that whips and storms round him - and the King's Decree, both fists brought down.", { glyph: '蟻', fighter: 'meruem', price: 14000, feat: 's-rank' }),
  item('fighter', 'goku-black', 'Goku Black', 'legendary', 'Zamasu in Goku\'s body: Instant Transmission and a blade of ki, the Black Kamehameha - and Super Saiyan Rose\'s scythe.', { glyph: '黒', fighter: 'goku-black', price: 14000, feat: 's-rank' }),
  item('fighter', 'jiren', 'Jiren', 'legendary', 'The Pride Troopers\' strongest: a one-two heavier than it looks, a fist driven up to the sky, Power Impact - and the full-power punch he dives through them behind.', { glyph: '誇', fighter: 'jiren', price: 14000, feat: 's-rank' }),
  item('fighter', 'golden-frieza', 'Golden Frieza', 'legendary', 'The Emperor of the Universe in gold: a death beam off one finger, the tail swung round him, a barrage of beams - and the Death Ball.', { glyph: '帝', fighter: 'golden-frieza', price: 14000, feat: 's-rank' }),
  item('fighter', 'gohan-beast', 'Gohan Beast', 'legendary', "Piccolo's student with his power let loose at last: a fist with his ki behind it, a kick that lifts them, the Masenko - and the Special Beam Cannon, bored straight through them.", { glyph: '獣', fighter: 'gohan-beast', price: 12000, feat: 'rank-a' }),
  item('fighter', 'saitama', 'Saitama', 'legendary', 'A hero for fun: a normal punch, an uppercut, consecutive normal punches - and, for once, a serious one.', { glyph: '拳', fighter: 'saitama', price: 12000, feat: 'rank-a' }),
  item('fighter', 'akaza', 'Akaza', 'legendary', 'Upper Moon Three: Destructive Death in bare hands - Air Type, Disorder, the Compass Needle that reads every fighting spirit round him - and Annihilation Type.', { glyph: '鬼', fighter: 'akaza', price: 12000, feat: 'rank-a' }),
  item('fighter', 'itachi', 'Itachi Uchiha', 'legendary', "The Uchiha prodigy: a kunai, a clone that scatters into crows and comes at them from behind, Amaterasu's black flames - and Tsukuyomi, under a red moon.", { glyph: '鴉', fighter: 'itachi', price: 12000, feat: 'rank-a' }),
  item('fighter', 'madara', 'Madara Uchiha', 'legendary', 'The Uchiha who fought the five Kage at once: a war fan, a rising kick, the Majestic Destroyer Flame - and Heaven Concealed, a meteor called down out of the sky.', { glyph: '斑', fighter: 'madara', price: 18000, feat: 's-rank' }),
  item('fighter', 'tanjiro', 'Tanjiro Kamado', 'legendary', "A Demon Slayer of the Water Breathing: the Water Surface Slash, the Water Wheel, the Flowing Dance - and Hinokami Kagura, his father's dance of fire.", { glyph: '炭', fighter: 'tanjiro', price: 12000, feat: 'rank-a' }),
  item('fighter', 'levi', 'Levi Ackerman', 'legendary', "Humanity's strongest soldier: twin blades, the ODM gear's dash through them - and a spinning assault nothing walks away from.", { glyph: '兵', fighter: 'levi', price: 12000, feat: 'rank-a' }),
  item('fighter', 'sung-jinwoo', 'Sung Jinwoo', 'legendary', "The Shadow Monarch: twin daggers, Ruler's Authority - and Arise, the shadows of the fallen called up behind him.", { glyph: '影', fighter: 'sung-jinwoo', price: 12000, feat: 'rank-a' }),
  item('fighter', 'gon', 'Gon Freecss', 'legendary', "The boy from Whale Island who became a Hunter to find his father: Jajanken's Rock, Scissors and Paper - and the first Rock, everything he has in one fist.", { glyph: '狩', fighter: 'gon', price: 12000, feat: 'rank-a' }),
  item('outfit','blackbeard-original','Blackbeard · Original Era','epic','The red shirt, green bandana and captain’s coat from his original voyage. Keeps Blackbeard’s complete manual combat kit.',{glyph:'闇',fighter:'blackbeard'}),
];

function offer(item: Item): Item {
  const how = UNLOCKS[item.id];
  if (how?.price !== undefined) return { ...item, stage: 'live', price: how.price, level: how.level, feat: undefined };
  if (how?.level !== undefined) return { ...item, stage: 'road', level: how.level, price: undefined, feat: undefined };
  return item.stage === 'live' ? { ...item, stage: 'retired' } : item;
}
export const ITEMS: readonly Item[] = CATALOGUE.map(offer);

export const ITEM = new Map(ITEMS.map(each => [each.id, each] as const));
export const priceOf = (each: Item) => each.price ?? RARITY[each.rarity].price;
export const released = (item: Item | undefined) => !!item && (item.stage === 'live' || item.stage === 'road' || item.stage === 'retired');
export const onOffer = (item: Item | undefined) => !!item && (item.stage === 'live' || item.stage === 'road');
export type Worn = Partial<Record<Exclude<ItemKind, 'emote' | 'outfit' | 'fighter'>, string>> & { emotes?: string[]; outfits?: Partial<Record<FighterId, string>> };
export const STARTERS: readonly string[] = ['entrance-paper', 'title-rookie', 'emote-interrobang'];

const ON_THE_BODY = ['skin', 'aura', 'trail', 'kill', 'form'] as const;
export const lookOf = (worn: Worn | undefined, fighter?: FighterId): number[] => [...ON_THE_BODY.map(kind => ITEMS.findIndex(each => each.id === worn?.[kind])),
  ...(fighter ? [ITEMS.findIndex(each => each.id === worn?.outfits?.[fighter])] : [])];
export function wornOf(look: readonly number[] | undefined): Worn {
  const worn: Worn = {};
  ON_THE_BODY.forEach((kind, i) => { const item = ITEMS[look?.[i] ?? -1]; if (item?.kind === kind) worn[kind] = item.id; });
  const outfit = ITEMS[look?.[ON_THE_BODY.length] ?? -1];
  if (outfit?.kind === 'outfit' && outfit.fighter) worn.outfits = { [outfit.fighter]: outfit.id };
  return worn;
}

export interface Bundle { id: string; name: string; glyph: string; blurb: string; items: readonly string[] }
export const BUNDLE_OFF = .25;
export const BUNDLES: readonly Bundle[] = [];
export const BUNDLE = new Map(BUNDLES.map(each => [each.id, each] as const));
export const isBundle = (id: string) => BUNDLE.has(id);
export function bundlePrice(bundle: Bundle, owns: (id: string) => boolean = () => false) {
  const full = bundle.items.filter(id => !owns(id)).reduce((sum, id) => sum + priceOf(ITEM.get(id)!), 0);
  return { full, price: Math.round(full * (1 - BUNDLE_OFF) / 10) * 10 };
}
