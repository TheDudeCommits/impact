import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMBO_KEYS } from '../src/game/combos';
import type { FighterId } from '../src/game/types';
import { run } from './enderHarness';
import { DREAM_IMPACT } from '../src/render/dreamFlag';

afterEach(() => vi.restoreAllMocks());

const SHOP_FINGERPRINTS: Record<string, number> = {
  'kaido:lh': 666645483, 'kaido:llh': 833984120, 'kaido:lllh': 104588603, 'kaido:llls': 633874058, 'kaido:airHeavy': 1325305097, 'kaido:airSpecial': 1781769661,
  'shanks:lh': 2322749981, 'shanks:llh': 3169901355, 'shanks:lllh': 1618877397, 'shanks:llls': 1369168212, 'shanks:airHeavy': 2571218421, 'shanks:airSpecial': 417320909,
  'aizen:lh': 1291663944, 'aizen:llh': 345344262, 'aizen:lllh': 1699308154, 'aizen:llls': 1017355943, 'aizen:airHeavy': 1599368499, 'aizen:airSpecial': 3697509193,
  'sukuna:lh': 2715725970, 'sukuna:llh': 4291273579, 'sukuna:lllh': 1152418356, 'sukuna:llls': 648457851, 'sukuna:airHeavy': 3294400855, 'sukuna:airSpecial': 2656105469,
  'meruem:lh': 224579406, 'meruem:llh': 3553842728, 'meruem:lllh': 2732326432, 'meruem:llls': 2212811572, 'meruem:airHeavy': 2038438913, 'meruem:airSpecial': 1897101437,
  'akaza:lh': 79441463, 'akaza:llh': 740983357, 'akaza:lllh': 4114056109, 'akaza:llls': 4229983267, 'akaza:airHeavy': 1860237411, 'akaza:airSpecial': 3987408527,
  'itachi:lh': 442790050, 'itachi:llh': 2870398467, 'itachi:lllh': 895836054, 'itachi:llls': 309555648, 'itachi:airHeavy': 40658269, 'itachi:airSpecial': 593805971,
  'tanjiro:lh': 4153947357, 'tanjiro:llh': 4224632616, 'tanjiro:lllh': 2312713019, 'tanjiro:llls': 1767979991, 'tanjiro:airHeavy': 1380956929, 'tanjiro:airSpecial': 2169182989,
  'gohan-beast:lh': 68450077, 'gohan-beast:llh': 2154322192, 'gohan-beast:lllh': 1796918978, 'gohan-beast:llls': 415260495, 'gohan-beast:airHeavy': 2910828551, 'gohan-beast:airSpecial': 3826761968,
  'saitama:lh': 3603339472, 'saitama:llh': 3896020327, 'saitama:lllh': 4152497233, 'saitama:llls': 1511697407, 'saitama:airHeavy': 181328949, 'saitama:airSpecial': 1498813270,
  'kaido:llls:awakened': 2535095166,
};
const SHOP_FINGERPRINTS_DREAM: Record<string, number> = {
  'kaido:lh': 4105925028, 'kaido:llh': 2704474, 'kaido:lllh': 3828071518, 'kaido:llls': 3907061695, 'kaido:airHeavy': 1056562415, 'kaido:airSpecial': 1050968146, 'kaido:llls:awakened': 537302708,
  'shanks:lh': 3045306802, 'shanks:llh': 1727203015, 'shanks:lllh': 1740581828, 'shanks:llls': 3347221859, 'shanks:airHeavy': 82176243, 'shanks:airSpecial': 1898128609,
  'aizen:lh': 511384239, 'aizen:llh': 3147440078, 'aizen:lllh': 2779055539, 'aizen:llls': 2151315170, 'aizen:airHeavy': 671234156, 'aizen:airSpecial': 2451326837,
  'sukuna:lh': 2860169879, 'sukuna:llh': 13609757, 'sukuna:lllh': 1737112411, 'sukuna:llls': 1965589754, 'sukuna:airHeavy': 3674178595, 'sukuna:airSpecial': 3997318963,
  'meruem:lh': 3348599077, 'meruem:llh': 1314517602, 'meruem:lllh': 3891928583, 'meruem:llls': 2558376476, 'meruem:airHeavy': 625295583, 'meruem:airSpecial': 2379474971,
  'akaza:lh': 2427885754, 'akaza:llh': 1308853376, 'akaza:lllh': 532749319, 'akaza:llls': 2247770910, 'akaza:airHeavy': 918541694, 'akaza:airSpecial': 286536627,
  'itachi:lh': 342204187, 'itachi:llh': 1613238733, 'itachi:lllh': 443213495, 'itachi:llls': 3638192848, 'itachi:airHeavy': 2895642265, 'itachi:airSpecial': 3574108561,
  'tanjiro:lh': 465140532, 'tanjiro:llh': 16347232, 'tanjiro:lllh': 1583995542, 'tanjiro:llls': 3667952822, 'tanjiro:airHeavy': 3882728964, 'tanjiro:airSpecial': 173294681,
  'gohan-beast:lh': 3721633569, 'gohan-beast:llh': 3978560608, 'gohan-beast:lllh': 1362149298, 'gohan-beast:llls': 3089343844, 'gohan-beast:airHeavy': 1845290759, 'gohan-beast:airSpecial': 3502471588,
  'saitama:lh': 3583578644, 'saitama:llh': 4214642575, 'saitama:lllh': 3570917642, 'saitama:llls': 1029093584, 'saitama:airHeavy': 119934957, 'saitama:airSpecial': 3989723164,
};
const SHOP: readonly FighterId[] = ['kaido', 'shanks', 'aizen', 'sukuna', 'meruem', 'akaza', 'itachi', 'tanjiro', 'gohan-beast', 'saitama'];

describe('the shop\'s enders are drawn exactly as they were', () => {
  it('leaves the same scene, frame for frame, through every ender of ten of the twenty', async () => {
    const seen: Record<string, number> = {};
    for (const f of SHOP) for (const key of COMBO_KEYS) seen[`${f}:${key}`] = run(f, key).folded;
    seen['kaido:llls:awakened'] = run('kaido', 'llls', true).folded;
    if (process.env.RECORD_ENDER_LOOKS) { console.log(JSON.stringify(seen)); if (process.env.RECORD_ENDER_LOOKS.endsWith('.json')) (await import('node:fs')).writeFileSync(process.env.RECORD_ENDER_LOOKS, JSON.stringify(seen)); return; }
    expect(seen).toEqual(DREAM_IMPACT ? SHOP_FINGERPRINTS_DREAM : SHOP_FINGERPRINTS);
  }, 60000);
});
