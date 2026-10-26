import type { FighterId } from '../types';

export interface OutfitVariant {
  hair?: number;
  always?: boolean;
  ssjHair?: boolean;
  aura?: readonly [number, number];
}
export interface OutfitDef {
  fighter: FighterId;
  laboratory?: boolean;
  model?: string;
  rush?: string;
  height?: number;
  normalization?: { scale: number; position: [number, number, number] };
  variant?: OutfitVariant;
}

export const OUTFITS: Readonly<Record<string, OutfitDef>> = {
  'outfit-blackbeard-original':{"fighter":"blackbeard","model":"/assets/economy/outfits/blackbeard-original.glb","height":2.3},
  'outfit-goku-ssj': { fighter: 'goku', variant: { hair: 0xffd23d, always: true, ssjHair: true } },
  'outfit-goku-god': { fighter: 'goku', variant: { hair: 0xff2852, always: true, aura: [0xffb08a, 0xff1f3a] } },
  'outfit-goku-blue': { fighter: 'goku', variant: { hair: 0x22c4ff, always: true, ssjHair: true, aura: [0x9ff2ff, 0x1d63ff] } },
  'outfit-goku-ui': { fighter: 'goku', variant: { hair: 0xdfe7f4, always: true, aura: [0xf4f8ff, 0x7f9cff] } },
  'outfit-vegeta-ssj': { fighter: 'vegeta', variant: { hair: 0xffcf3a, always: true, ssjHair: true } },
  'outfit-vegeta-god': { fighter: 'vegeta', variant: { hair: 0xff2852, always: true, aura: [0xffb08a, 0xff1f3a] } },
  'outfit-vegeta-blue': { fighter: 'vegeta', variant: { hair: 0x22c4ff, always: true, ssjHair: true, aura: [0x9ff2ff, 0x1d63ff] } },
  'outfit-vegeta-ego': { fighter: 'vegeta', variant: { hair: 0x9a4bff, always: true, aura: [0xdcb0ff, 0x6a14d8] } },
  'outfit-luffy-gear5': { fighter: 'luffy', model: '/assets/economy/outfits/luffy-gear5.glb' },
  'outfit-luffy-onigashima': { fighter: 'luffy', model: '/assets/economy/outfits/luffy-onigashima.glb' },
  'outfit-luffy-filmred': { fighter: 'luffy', model: '/assets/economy/outfits/luffy-filmred.glb' },
  'outfit-luffy-marineford': { fighter: 'luffy', model: '/assets/economy/outfits/luffy-marineford.glb' },
  'outfit-zoro-onigashima': { fighter: 'zoro', model: '/assets/economy/outfits/zoro-onigashima.glb' },
  'outfit-zoro-dressrosa': { fighter: 'zoro', model: '/assets/economy/outfits/zoro-dressrosa.glb' },
  'outfit-sanji-wholecake': { fighter: 'sanji', model: '/assets/economy/outfits/sanji-wholecake.glb' },
  'outfit-ace-alabasta': { fighter: 'ace', model: '/assets/economy/outfits/ace-alabasta.glb' },
  'outfit-law-onigashima': { fighter: 'law', model: '/assets/economy/outfits/law-onigashima.glb' },
  'outfit-law-wano': { fighter: 'law', model: '/assets/economy/outfits/law-wano.glb' },
  'outfit-zoro-ronin': { fighter: 'zoro', model: '/assets/economy/outfits/zoro-ronin.glb' },
  'outfit-dio-heaven': { fighter: 'dio', model: '/assets/economy/outfits/dio-heaven.glb' },
  'outfit-killua-godspeed': { fighter: 'killua', model: '/assets/economy/outfits/killua-godspeed.glb' },
  'outfit-ace-blueflame': { fighter: 'ace', model: '/assets/economy/outfits/ace-blueflame.glb' },
  'outfit-sanji-diable': { fighter: 'sanji', model: '/assets/economy/outfits/sanji-diable.glb' },
};

export const outfitFor = (id: string | undefined, fighter: FighterId): OutfitDef | undefined => {
  const outfit = id ? OUTFITS[id] : undefined;
  return outfit?.fighter === fighter ? outfit : undefined;
};
