import {FIGHTERS} from '../../config';
import {riftOf,RIFT_LANE_NAMES} from '../../game/moba/model';
import type {ModeHud,ModeHudFrame,ModeHudMount} from './modeHud';
import {el,MiniPlate} from './kit';

export function createRiftWarHud():ModeHud {
  let root:HTMLElement|undefined;
  const plates=new Map<string,MiniPlate>();
  return {
    mount(m:ModeHudMount){root=el('div','rw-allies',m.zone('3'));},
    update({snapshot,self}:ModeHudFrame){
      const war=riftOf(snapshot);if(!root||!war)return;
      root.hidden=war.phase!=='active';
      const team=war.seats.find(s=>s.id===self.id)?.team,seen=new Set<string>();
      for(const seat of war.seats){if(seat.team!==team||seat.id===self.id)continue;seen.add(seat.id);
        let plate=plates.get(seat.id);if(!plate){plate=new MiniPlate(root);plates.set(seat.id,plate);}
        const player=snapshot.players.find(p=>p.id===seat.id);
        plate.face.set(seat.fighter);plate.name.set(FIGHTERS[seat.fighter].name.toUpperCase());
        plate.hp.set((player?.hp??0)/Math.max(1,player?.maxHp??1));plate.down.set(!player?.alive);plate.gone.set(!!seat.disconnected);
        const label=`${FIGHTERS[seat.fighter].name} · ${seat.disconnected?'Reconnecting':!player?.alive?'Down':`Level ${seat.level} · ${RIFT_LANE_NAMES[seat.lane]}`}`;
        if(plate.root.title!==label){plate.root.title=label;plate.root.setAttribute('aria-label',label);}
        plate.state.set(seat.respawnAt?`RETURNS · ${Math.max(0,Math.ceil(seat.respawnAt-snapshot.serverTime))}s`:seat.recallAt?'RECALLING':`LV ${seat.level} · ${RIFT_LANE_NAMES[seat.lane]}`);
      }
      for(const [id,plate] of plates)if(!seen.has(id)){plate.root.remove();plates.delete(id);}
    },
    unmount(){root?.remove();root=undefined;plates.clear();},
  };
}
