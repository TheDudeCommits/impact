import { TojiHeavenlyRestriction } from './TojiHeavenlyRestriction';
import { RengokuFlameBreathing } from './RengokuFlameBreathing';
import { AsukaField } from './AsukaField';
import { NeteroBodhisattva } from './NeteroBodhisattva';
import { JolyneStoneThread } from './JolyneStoneThread';
import { MightGuyGates } from './MightGuyGates';
import { AkameMurasame } from './AkameMurasame';
import { PikachuVolt } from './PikachuVolt';
import { GarouWaterStream } from './GarouWaterStream';
import { AlphonseBastion } from './AlphonseBastion';
import { KanekiRinkaku } from './KanekiRinkaku';
import { ByakuyaSenbonzakura } from './ByakuyaSenbonzakura';
import { PainGravity } from './PainGravity';
import { EdwardAlchemy } from './EdwardAlchemy';
import { MakimaControl } from './MakimaControl';
import { TatsumakiPsychic } from './TatsumakiPsychic';
import { MeliodasHellblaze } from './MeliodasHellblaze';
import { DoflamingoStrings } from './DoflamingoStrings';
import { HisokaBungeeGum } from './HisokaBungeeGum';
import { BlackbeardEmperor } from './BlackbeardEmperor';
import { GintokiSilverSoul } from './GintokiSilverSoul';
import { KizaruGlint } from './KizaruGlint';
import { YamatoOni } from './YamatoOni';
import { YujiBlackFlash } from './YujiBlackFlash';
import type * as THREE from 'three';
import type { CombatEvent, FighterId } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { packQuiets } from '../../engine/packs/active';
import { wireArmory } from '../vfx/armory/castingSignature';
import { fxDraws, signatureCovers } from '../vfx/armory/drawn';
import { ForgeFxDirector } from '../vfx/armory/forgeFx';
import { StagedMoves, stagedBaseline } from './StagedMoves';

interface Signature {
  load(ids: readonly FighterId[]): Promise<unknown>;
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void;
  prepareContact?(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  reset(): void;
  dispose(): void;
}
type Factory = (scene: THREE.Scene, kit: VfxKit) => Signature;
const lazy = (module: () => Promise<Factory>): Factory => (scene, kit) => new LazySignature(module, scene, kit);
class LazySignature implements Signature {
  private real?: Signature;
  private building?: Promise<Signature>;
  private disposed = false;
  constructor(private readonly module: () => Promise<Factory>, private readonly scene: THREE.Scene, private readonly kit: VfxKit) {}
  load(ids: readonly FighterId[]): Promise<unknown> {
    this.building ??= this.module().then(factory => { const real = factory(this.scene, this.kit); if (this.disposed) real.dispose(); else this.real = real; return real; });
    return this.building.then(real => this.disposed ? undefined : real.load(ids));
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) { this.real?.handle(event, fighters); }
  prepareContact(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) { this.real?.prepareContact?.(event, fighters, flights); }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) { this.real?.update(time, fighters, flights); }
  reset() { this.real?.reset(); }
  dispose() { this.disposed = true; this.real?.dispose(); this.real = undefined; }
}
const factories: Partial<Record<FighterId, Factory>> = {
  toji: (scene, kit) => new TojiHeavenlyRestriction(scene, kit),
  usopp: lazy(() => import('./UsoppPopGreen').then(m => (scene, kit) => new m.UsoppPopGreen(scene, kit))),
  crocodile: lazy(() => import('./CrocodileDesert').then(m => (scene, kit) => new m.CrocodileDesert(scene, kit))),
  rengoku: (scene, kit) => new RengokuFlameBreathing(scene, kit),
  sakura: lazy(() => import('./SakuraBlossom').then(m => (scene, kit) => new m.SakuraBlossom(scene, kit))),
  meliodas:(scene,kit)=>new MeliodasHellblaze(scene,kit),
  escanor: lazy(() => import('./EscanorSun').then(m => (scene, kit) => new m.EscanorSun(scene, kit))),
  tatsumaki:(scene,kit)=>new TatsumakiPsychic(scene,kit),
  makima:(scene,kit)=>new MakimaControl(scene,kit),
  kenpachi: lazy(() => import('./KenpachiReiatsu').then(m => (scene, kit) => new m.KenpachiReiatsu(scene, kit))),
  minato: lazy(() => import('./MinatoRaijin').then(m => (scene, kit) => new m.MinatoRaijin(scene, kit))),
  'nico-robin': lazy(() => import('./NicoRobinFleur').then(m => (scene, kit) => new m.NicoRobinFleur(scene, kit))),
  'kaiju-no-8': lazy(() => import('./KaijuFortitude').then(m => (scene, kit) => new m.KaijuFortitude(scene, kit))),
  eren: lazy(() => import('./ErenTitan').then(m => (scene, kit) => new m.ErenTitan(scene, kit))),
  asuka:(scene,kit)=>new AsukaField(scene,kit),
  netero:(scene,kit)=>new NeteroBodhisattva(scene,kit),
  shinji: lazy(() => import('./ShinjiATField').then(m => (scene, kit) => new m.ShinjiATField(scene, kit))),
  jolyne:(scene,kit)=>new JolyneStoneThread(scene,kit),
  'might-guy':(scene,kit)=>new MightGuyGates(scene,kit),
  akame:(scene,kit)=>new AkameMurasame(scene,kit),
  pikachu:(scene,kit)=>new PikachuVolt(scene,kit),
  garou:(scene,kit)=>new GarouWaterStream(scene,kit),
  esdeath: lazy(() => import('./EsdeathMahapadma').then(m => (scene, kit) => new m.EsdeathMahapadma(scene, kit))),
  mikasa: lazy(() => import('./MikasaODM').then(m => (scene, kit) => new m.MikasaODM(scene, kit))),
  'alphonse-elric':(scene,kit)=>new AlphonseBastion(scene,kit),
  'ken-kaneki':(scene,kit)=>new KanekiRinkaku(scene,kit),
  grimmjow: lazy(() => import('./GrimmjowPantera').then(m => (scene, kit) => new m.GrimmjowPantera(scene, kit))),
  byakuya:(scene,kit)=>new ByakuyaSenbonzakura(scene,kit),
  yamamoto: lazy(() => import('./YamamotoJakka').then(m => (scene, kit) => new m.YamamotoJakka(scene, kit))),
  pain:(scene,kit)=>new PainGravity(scene,kit),
  'edward-elric':(scene,kit)=>new EdwardAlchemy(scene,kit),
  hiei: lazy(() => import('./HieiDarknessFlame').then(m => (scene, kit) => new m.HieiDarknessFlame(scene, kit))),
  aokiji: lazy(() => import('../vfx/engine/pilots/aokiji').then(m => (scene, kit) => m.aokijiSignature(scene, kit))),
  doflamingo:(scene,kit)=>new DoflamingoStrings(scene,kit),
  hisoka:(scene,kit)=>new HisokaBungeeGum(scene,kit),
  blackbeard:(scene,kit)=>new BlackbeardEmperor(scene,kit),
  nanami: lazy(() => import('./NanamiRatio').then(m => (scene, kit) => new m.NanamiRatio(scene, kit))),
  josuke: lazy(() => import('./JosukeRestoration').then(m => (scene, kit) => new m.JosukeRestoration(scene, kit))),
  tsunade: lazy(() => import('./TsunadeStrength').then(m => (scene, kit) => new m.TsunadeStrength(scene, kit))),
  jiraiya: lazy(() => import('./JiraiyaToadSage').then(m => (scene, kit) => new m.JiraiyaToadSage(scene, kit))),
  hinata: lazy(() => import('./HinataTwinLions').then(m => (scene, kit) => new m.HinataTwinLions(scene, kit))),
  gintoki:(scene,kit)=>new GintokiSilverSoul(scene,kit),
  kizaru:(scene,kit)=>new KizaruGlint(scene,kit),
  yamato:(scene,kit)=>new YamatoOni(scene,kit),
  jinbe: lazy(() => import('./JinbeKarate').then(m => (scene, kit) => new m.JinbeKarate(scene, kit))),
  enel: lazy(() => import('./EnelThunder').then(m => (scene, kit) => new m.EnelThunder(scene, kit))),
  rukia: lazy(() => import('./RukiaShirayuki').then(m => (scene, kit) => new m.RukiaShirayuki(scene, kit))),
  yuta: lazy(() => import('./YutaRika').then(m => (scene, kit) => new m.YutaRika(scene, kit))),
  yuji:(scene,kit)=>new YujiBlackFlash(scene,kit),
  yoruichi: lazy(() => import('./YoruichiShunko').then(m => (scene, kit) => new m.YoruichiShunko(scene, kit))),
  todoroki: lazy(() => import('./TodorokiPhosphor').then(m => (scene, kit) => new m.TodorokiPhosphor(scene, kit))),
  endeavor: lazy(() => import('./EndeavorFlashfire').then(m => (scene, kit) => new m.EndeavorFlashfire(scene, kit))),
  mihawk: lazy(() => import('./MihawkBlackBlade').then(m => (scene, kit) => new m.MihawkBlackBlade(scene, kit))),
};
wireArmory(factories);

export const hasRosterSignature = (id: string | undefined, slot?: string, branch?: string, player?: string): boolean =>
  id !== undefined && ((Object.hasOwn(factories, id) && !packQuiets(id) && signatureCovers(id, slot, branch)) || fxDraws(id, slot, branch, player));

export class RosterSignatureSet {
  private readonly active = new Map<FighterId, Signature>();
  private readonly staged = new Map<FighterId, StagedMoves>();
  private readonly fx: ForgeFxDirector;
  constructor(private readonly scene: THREE.Scene, private readonly kit: VfxKit) { this.fx = new ForgeFxDirector(scene, kit); }

  async load(ids: readonly FighterId[]): Promise<void> {
    const wanted = new Set(ids);
    for (const [id, effect] of this.active) {
      if (wanted.has(id)) continue;
      effect.dispose();
      this.active.delete(id);
    }
    for (const id of wanted) if (stagedBaseline(id) && !this.staged.has(id)) this.staged.set(id, new StagedMoves(id, this.scene, this.kit));
    for (const [id, staging] of this.staged) if (!wanted.has(id)) { staging.dispose(); this.staged.delete(id); }
    const loads: Promise<unknown>[] = [];
    for (const id of wanted) {
      const factory = hasRosterSignature(id) ? factories[id] : undefined;
      if (!factory) continue;
      let effect = this.active.get(id);
      if (!effect) {
        effect = factory(this.scene, this.kit);
        this.active.set(id, effect);
      }
      loads.push(effect.load(ids));
    }
    await Promise.all(loads);
  }

  castingEffects(): Set<string> {
    const out = new Set<string>();
    for (const signature of this.active.values()) for (const id of (signature as { armoryIds?: readonly string[] }).armoryIds ?? []) out.add(id);
    return out;
  }
  retainEffects(keep: ReadonlySet<string>): string[] { return this.fx.retain(new Set([...keep, ...this.castingEffects()])); }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void {
    const drawnByKit = this.fx.covers(event, fighters) ? event.fighter : undefined;
    for (const [id, effect] of this.active) if (id !== drawnByKit) effect.handle(event, fighters);
    if (event.fighter && event.fighter !== drawnByKit) this.staged.get(event.fighter)?.handle(event, fighters);
    this.fx.handle(event, fighters);
  }
  handleOwn(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void {
    if (event.fighter) this.active.get(event.fighter)?.handle(event, fighters);
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void {
    for (const effect of this.active.values()) effect.update(time, fighters, flights);
    for (const staging of this.staged.values()) staging.update(time, fighters, flights);
    this.fx.update(time, fighters, flights);
  }
  prepareContact(event:CombatEvent,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>):void {if(this.fx.covers(event,fighters))return;this.active.get(event.fighter as FighterId)?.prepareContact?.(event,fighters,flights);}
  reset(): void { for (const effect of this.active.values()) effect.reset(); for (const staging of this.staged.values()) staging.reset(); this.fx.reset(); }
  dispose(): void {
    for (const effect of this.active.values()) effect.dispose();
    this.active.clear();
    for (const staging of this.staged.values()) staging.dispose();
    this.staged.clear();
    this.fx.dispose();
  }
}
