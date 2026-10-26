import type {FighterId,GameSnapshot} from '../types';
import {assetSignature} from '../social/assets';
import {riftOf} from './model';

export class RiftAssets {
  private looks=new Map<string,string>();
  private round=0;
  ids(snapshot:GameSnapshot):FighterId[]{
    return [...new Set(riftOf(snapshot)?.seats.map(s=>s.fighter)??snapshot.players.filter(p=>!p.enemy).map(p=>p.fighter))];
  }
  key(snapshot:GameSnapshot):string {
    const war=riftOf(snapshot);if(!war)return assetSignature(snapshot);
    if(war.round!==this.round){this.clear();this.round=war.round;}
    for(const p of snapshot.players)this.looks.set(p.id,p.outfit??'');
    const present=new Set(war.seats.map(s=>s.id));for(const id of this.looks.keys())if(!present.has(id))this.looks.delete(id);
    return `${snapshot.stage}:${war.seats.map(s=>`${s.id}:${s.fighter}:${this.looks.get(s.id)??''}`).sort().join('|')}`;
  }
  clear(){this.looks.clear();this.round=0;}
}
