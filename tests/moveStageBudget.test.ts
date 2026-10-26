import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { EndeavorFlashfire } from '../src/render/signature/EndeavorFlashfire';
import { BlackbeardEmperor } from '../src/render/signature/BlackbeardEmperor';
import { UsoppPopGreen } from '../src/render/signature/UsoppPopGreen';
import { KenpachiReiatsu } from '../src/render/signature/KenpachiReiatsu';
import { ByakuyaSenbonzakura } from '../src/render/signature/ByakuyaSenbonzakura';
import { GrimmjowPantera } from '../src/render/signature/GrimmjowPantera';
import { RukiaShirayuki } from '../src/render/signature/RukiaShirayuki';
import { YamamotoJakka } from '../src/render/signature/YamamotoJakka';
import { YoruichiShunko } from '../src/render/signature/YoruichiShunko';
import { BrolyBerserker } from '../src/render/signature/BrolyBerserker';
import { GarouWaterStream } from '../src/render/signature/GarouWaterStream';
import { TatsumakiPsychic } from '../src/render/signature/TatsumakiPsychic';
import { ErenTitan } from '../src/render/signature/ErenTitan';
import { MikasaODM } from '../src/render/signature/MikasaODM';
import { MihawkBlackBlade } from '../src/render/signature/MihawkBlackBlade';
import { DoflamingoStrings } from '../src/render/signature/DoflamingoStrings';
import { CrocodileDesert } from '../src/render/signature/CrocodileDesert';
import { KizaruGlint } from '../src/render/signature/KizaruGlint';
import { AkainuMagma } from '../src/render/signature/AkainuMagma';
import { AokijiIce } from '../src/render/signature/AokijiIce';
import { EnelThunder } from '../src/render/signature/EnelThunder';
import { YamatoOni } from '../src/render/signature/YamatoOni';
import { BoaEmpress } from '../src/render/signature/BoaEmpress';
import { NamiWeather } from '../src/render/signature/NamiWeather';
import { NicoRobinFleur } from '../src/render/signature/NicoRobinFleur';
import { JinbeKarate } from '../src/render/signature/JinbeKarate';
import { VfxKit } from '../src/render/vfx/VfxKit';
import { TojiHeavenlyRestriction } from '../src/render/signature/TojiHeavenlyRestriction';
import { YujiBlackFlash } from '../src/render/signature/YujiBlackFlash';
import { YutaRika } from '../src/render/signature/YutaRika';
import { NanamiRatio } from '../src/render/signature/NanamiRatio';
import { DekuCowling } from '../src/render/signature/DekuCowling';
import { BakugoExplosions } from '../src/render/signature/BakugoExplosions';
import { TodorokiPhosphor } from '../src/render/signature/TodorokiPhosphor';
import { AllMightPressure } from '../src/render/signature/AllMightPressure';
import { RengokuFlameBreathing } from '../src/render/signature/RengokuFlameBreathing';
import { DenjiChainsaw } from '../src/render/signature/DenjiChainsaw';
import { KanekiRinkaku } from '../src/render/signature/KanekiRinkaku';
import { HieiDarknessFlame } from '../src/render/signature/HieiDarknessFlame';
import { AkameMurasame } from '../src/render/signature/AkameMurasame';
import { EsdeathMahapadma } from '../src/render/signature/EsdeathMahapadma';
import { AsukaField } from '../src/render/signature/AsukaField';
import { ShinjiATField } from '../src/render/signature/ShinjiATField';
import { EdwardAlchemy } from '../src/render/signature/EdwardAlchemy';
import { MinatoRaijin } from '../src/render/signature/MinatoRaijin';
import { MightGuyGates } from '../src/render/signature/MightGuyGates';
import { PainGravity } from '../src/render/signature/PainGravity';
import { JiraiyaToadSage } from '../src/render/signature/JiraiyaToadSage';
import { TsunadeStrength } from '../src/render/signature/TsunadeStrength';
import { MakimaControl } from '../src/render/signature/MakimaControl';
import { HinataTwinLions } from '../src/render/signature/HinataTwinLions';
import { SakuraBlossom } from '../src/render/signature/SakuraBlossom';
import { NeteroBodhisattva } from '../src/render/signature/NeteroBodhisattva';
import { HisokaBungeeGum } from '../src/render/signature/HisokaBungeeGum';
import { MeliodasHellblaze } from '../src/render/signature/MeliodasHellblaze';
import { EscanorSun } from '../src/render/signature/EscanorSun';
import { AlphonseBastion } from '../src/render/signature/AlphonseBastion';
import { JolyneStoneThread } from '../src/render/signature/JolyneStoneThread';
import { JosukeRestoration } from '../src/render/signature/JosukeRestoration';
import { GintokiSilverSoul } from '../src/render/signature/GintokiSilverSoul';
import { KaijuFortitude } from '../src/render/signature/KaijuFortitude';

type Pool = 'flames' | 'glows' | 'bolts' | 'lights' | 'discs' | 'shells' | 'shots';
const POOLS: readonly Pool[] = ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells', 'shots'];
function body(id: string, fighter: FighterId, z = 0): Fighter {
  const group = new THREE.Group(); group.position.z = z;
  const head = new THREE.Object3D(); head.position.set(0, 1.7, z);
  return { group, handR: new THREE.Vector3(.3, 1.3, z + .2), handL: new THREE.Vector3(-.3, 1.3, z + .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.3, z + .6), drawnJoint: () => head,
    state: { id, fighter, alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 1, yaw: 0 } as PlayerState } as unknown as Fighter;
}
function ultimate(fighter: FighterId, make: (scene: THREE.Scene) => { handle(e: CombatEvent, f?: ReadonlyMap<string, Fighter>): void; update(t: number, f: ReadonlyMap<string, Fighter>, fl: ReadonlyMap<string, Flight>): void; dispose(): void }) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = make(scene), move = MOVES[fighter].ultimate;
  const actor = body('a', fighter), foe = body('v', 'goku', 2.2), fighters = new Map([['a', actor], ['v', foe]]), flights = new Map<string, Flight>();
  const peak: Record<Pool, number> = { flames: 0, glows: 0, bolts: 0, lights: 0, discs: 0, shells: 0, shots: 0 };
  const event = (kind: CombatEvent['kind'], contactIndex: number, at: number, id: number): CombatEvent => ({ id, kind, fighter, actorId: 'a', targetId: 'v', actionSeq: 2, slot: 'ultimate', contactIndex, serverTime: 10 + at, endpoint: { x: 0, y: 1.2, z: 2.2 } });
  let landed = 0;
  try {
    for (let frame = 0; frame <= (move.duration + 3.5) * 60; frame++) {
      const t = frame / 60;
      if (t <= move.duration) Object.assign(actor.state, { action: 'ultimate', actionDuration: move.duration, actionTime: t / move.duration, ...(landed ? { confirmedAt: 10 + move.contacts[0] } : {}) });
      else Object.assign(actor.state, { action: 'idle', actionTime: 0 });
      while (landed < move.contacts.length && t >= move.contacts[landed]) {
        if (landed === 0) fx.handle(event('confirm', 0, move.contacts[0], 1), fighters);
        fx.handle(event('hit', landed, move.contacts[landed], 10 + landed), fighters); landed++;
      }
      fx.update(10 + t, fighters, flights);
      for (const pool of POOLS) peak[pool] = Math.max(peak[pool], stage.counts[pool]);
    }
    expect(stage.counts.shots, 'everything spent after the move').toBe(0);
  } finally { fx.dispose(); stage.release(); }
  return peak;
}

describe('what a pilot\'s ultimate asks of the shared stage at its busiest frame', () => {
  it.each([
    ['endeavor', (scene: THREE.Scene) => new EndeavorFlashfire(scene, { budget: 1 })],
    ['blackbeard', (scene: THREE.Scene) => new BlackbeardEmperor(scene, { budget: 1 })],
    ['usopp', (scene: THREE.Scene) => new UsoppPopGreen(scene, { budget: 1 })],
    ['kenpachi', (scene: THREE.Scene) => new KenpachiReiatsu(scene, { budget: 1 })],
    ['byakuya', (scene: THREE.Scene) => new ByakuyaSenbonzakura(scene, { budget: 1 })],
    ['grimmjow', (scene: THREE.Scene) => new GrimmjowPantera(scene, { budget: 1 })],
    ['rukia', (scene: THREE.Scene) => new RukiaShirayuki(scene, { budget: 1 })],
    ['yamamoto', (scene: THREE.Scene) => new YamamotoJakka(scene, { budget: 1 })],
    ['yoruichi', (scene: THREE.Scene) => new YoruichiShunko(scene, { budget: 1 })],
    ['broly', (scene: THREE.Scene) => new BrolyBerserker(scene, { budget: 1 })],
    ['garou', (scene: THREE.Scene) => new GarouWaterStream(scene, { budget: 1 })],
    ['tatsumaki', (scene: THREE.Scene) => new TatsumakiPsychic(scene, { budget: 1 })],
    ['eren', (scene: THREE.Scene) => new ErenTitan(scene, { budget: 1 })],
    ['mikasa', (scene: THREE.Scene) => new MikasaODM(scene, { budget: 1 })],
    ['mihawk', (scene: THREE.Scene) => new MihawkBlackBlade(scene, { budget: 1 })],
    ['doflamingo', (scene: THREE.Scene) => new DoflamingoStrings(scene, { budget: 1 })],
    ['crocodile', (scene: THREE.Scene) => new CrocodileDesert(scene, { budget: 1 })],
    ['kizaru', (scene: THREE.Scene) => new KizaruGlint(scene, { budget: 1 })],
    ['akainu', (scene: THREE.Scene) => new AkainuMagma(scene, { budget: 1 })],
    ['aokiji', (scene: THREE.Scene) => new AokijiIce(scene, { budget: 1 })],
    ['enel', (scene: THREE.Scene) => new EnelThunder(scene, { budget: 1 })],
    ['yamato', (scene: THREE.Scene) => new YamatoOni(scene, { budget: 1 })],
    ['boa-hancock', (scene: THREE.Scene) => new BoaEmpress(scene, { budget: 1 })],
    ['nami', (scene: THREE.Scene) => new NamiWeather(scene, VfxKit.for(scene))],
    ['nico-robin', (scene: THREE.Scene) => new NicoRobinFleur(scene, { budget: 1 })],
    ['jinbe', (scene: THREE.Scene) => new JinbeKarate(scene, { budget: 1 })],
    ['toji', (scene: THREE.Scene) => new TojiHeavenlyRestriction(scene, { budget: 1 })],
    ['yuji', (scene: THREE.Scene) => new YujiBlackFlash(scene, { budget: 1 })],
    ['yuta', (scene: THREE.Scene) => new YutaRika(scene, { budget: 1 })],
    ['nanami', (scene: THREE.Scene) => new NanamiRatio(scene, { budget: 1 })],
    ['deku', (scene: THREE.Scene) => new DekuCowling(scene, { budget: 1 })],
    ['bakugo', (scene: THREE.Scene) => new BakugoExplosions(scene, { budget: 1 })],
    ['todoroki', (scene: THREE.Scene) => new TodorokiPhosphor(scene, { budget: 1 })],
    ['all-might', (scene: THREE.Scene) => new AllMightPressure(scene, { budget: 1 })],
    ['rengoku', (scene: THREE.Scene) => new RengokuFlameBreathing(scene, { budget: 1 })],
    ['denji', (scene: THREE.Scene) => new DenjiChainsaw(scene, { budget: 1 })],
    ['ken-kaneki', (scene: THREE.Scene) => new KanekiRinkaku(scene, { budget: 1 })],
    ['hiei', (scene: THREE.Scene) => new HieiDarknessFlame(scene, { budget: 1 })],
    ['akame', (scene: THREE.Scene) => new AkameMurasame(scene, { budget: 1 })],
    ['esdeath', (scene: THREE.Scene) => new EsdeathMahapadma(scene, { budget: 1 })],
    ['asuka', (scene: THREE.Scene) => new AsukaField(scene, { budget: 1 })],
    ['shinji', (scene: THREE.Scene) => new ShinjiATField(scene, { budget: 1 })],
    ['edward-elric', (scene: THREE.Scene) => new EdwardAlchemy(scene, { budget: 1 })],
    ['minato', (scene: THREE.Scene) => new MinatoRaijin(scene, { budget: 1 })],
    ['might-guy', (scene: THREE.Scene) => new MightGuyGates(scene, { budget: 1 })],
    ['pain', (scene: THREE.Scene) => new PainGravity(scene, { budget: 1 })],
    ['jiraiya', (scene: THREE.Scene) => new JiraiyaToadSage(scene, { budget: 1 })],
    ['tsunade', (scene: THREE.Scene) => new TsunadeStrength(scene, { budget: 1 })],
    ['makima', (scene: THREE.Scene) => new MakimaControl(scene, { budget: 1 })],
    ['hinata', (scene: THREE.Scene) => new HinataTwinLions(scene, { budget: 1 })],
    ['sakura', (scene: THREE.Scene) => new SakuraBlossom(scene, { budget: 1 })],
    ['netero', (scene: THREE.Scene) => new NeteroBodhisattva(scene, { budget: 1 })],
    ['hisoka', (scene: THREE.Scene) => new HisokaBungeeGum(scene, { budget: 1 })],
    ['meliodas', (scene: THREE.Scene) => new MeliodasHellblaze(scene, { budget: 1 })],
    ['escanor', (scene: THREE.Scene) => new EscanorSun(scene, { budget: 1 })],
    ['alphonse-elric', (scene: THREE.Scene) => new AlphonseBastion(scene, { budget: 1 })],
    ['jolyne', (scene: THREE.Scene) => new JolyneStoneThread(scene, { budget: 1 })],
    ['josuke', (scene: THREE.Scene) => new JosukeRestoration(scene, { budget: 1 })],
    ['gintoki', (scene: THREE.Scene) => new GintokiSilverSoul(scene, { budget: 1 })],
    ['kaiju-no-8', (scene: THREE.Scene) => new KaijuFortitude(scene, { budget: 1 })],
  ] as const)('%s stays under half of every pool', (fighter, make) => {
    const peak = ultimate(fighter as FighterId, make);
    if (process.env.STAGE_BUDGET_PRINT) console.info(`${fighter} ultimate, busiest frame: ${JSON.stringify(peak)}`);
    expect(peak.glows).toBeGreaterThan(4); expect(peak.lights).toBeGreaterThan(2); expect(peak.shots).toBeGreaterThan(2);
    for (const pool of POOLS) expect(peak[pool], `${fighter} ${pool} ${JSON.stringify(peak)}`).toBeLessThanOrEqual(STAGE_LIMITS[pool] / 2);
  });
});
