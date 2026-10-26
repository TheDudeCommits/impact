import type { FighterId } from '../../game/types';
import { released, type Item, type Worn } from '../../game/economy/catalog';
import type { Account } from '../../game/economy/account';
import { FighterStage } from '../../render/cosmetics/stage';
import { BANNER_MARKS, playBanner } from '../survival/banners';
import type { ShopStage } from './Shop';

const ON_THE_BODY = new Set(['skin', 'aura', 'trail', 'kill', 'form', 'outfit', 'fighter']);
const REACTIVE = new Set(['skin-living-ink', 'aura-rising']);

export class ShopPreview implements ShopStage {
  private stage?: FighterStage;
  private banner = 0;
  show(host: HTMLElement, fighter: FighterId, item: Item | undefined, account: Account | undefined) {
    this.stopBanner();
    if (released(item) && item!.kind === 'banner') { this.hide(); this.playBanners(host, item!.id); return; }
    if (!item || !released(item) || !ON_THE_BODY.has(item.kind)) { this.hide(); return; }
    const who = (item.kind === 'outfit' || item.kind === 'fighter') && item.fighter ? item.fighter : fighter;
    const worn: Worn = { skin: account?.worn.skin, aura: account?.worn.aura, trail: account?.worn.trail, outfits: { ...account?.worn.outfits },
      ...(item.kind === 'outfit' ? { outfits: { [who]: item.id } } : item.kind === 'fighter' ? {} : { [item.kind]: item.id }) };
    this.put(host, who, worn, item.kind, REACTIVE.has(item.id));
  }
  private put(host: HTMLElement, fighter: FighterId, worn: Worn, kind: string, reactive: boolean) {
    try { this.stage ??= new FighterStage(host, { look: 'harbor', paper: 0xffffff }); }
    catch { return; }
    const stage = this.stage;
    stage.moveTo(host);
    host.classList.remove('drawn');
    const ground = kind === 'kill';
    stage.dash = kind === 'trail'; stage.dashReach = 2.6;
    stage.moves = kind === 'fighter' ? ['light', 'heavy', 'special', 'ultimate'] : [];
    stage.spin = kind === 'fighter' ? 0 : .35; if (kind === 'fighter') stage.yaw = .45;
    stage.span = kind === 'fighter' ? { across: 3, tall: 1.38 } : kind === 'trail' ? { across: 5.2, tall: 1.2 } : ground ? { across: 5.4, tall: 1.5 } : kind === 'aura' || kind === 'form' ? { across: 2.4, tall: 1.6 } : kind === 'outfit' ? { across: 1.7, tall: 1.18 } : { across: 1.5, tall: 1.12 };
    stage.level = kind === 'fighter' ? .5 : ground ? .38 : kind === 'aura' || kind === 'form' ? .62 : .53; stage.lift = ground ? .55 : 0; stage.zoom = 1; stage.aim();
    stage.show_ = { kills: ground, awake: false, awakeCycle: !!worn.form, cycle: reactive, count: 0, style: 0 };
    stage.show(fighter, worn).then(() => { if (stage.canvas.parentElement === host) window.setTimeout(() => host.classList.add('drawn'), 60); }, () => undefined);
  }
  private playBanners(host: HTMLElement, id: string) {
    let i = 0;
    const next = () => { if (!host.isConnected) { this.stopBanner(); return; } playBanner(host, id, BANNER_MARKS[i++ % BANNER_MARKS.length], true); };
    next();
    this.banner = window.setInterval(next, 2600);
  }
  private stopBanner() { window.clearInterval(this.banner); this.banner = 0; }
  hide() { this.stopBanner(); this.stage?.stop(); }
}
