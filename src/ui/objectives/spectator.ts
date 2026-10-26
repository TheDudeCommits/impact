import type {PlayerState} from '../../game/types';

export function squadSubject(players:readonly PlayerState[],self:PlayerState,current:string|null,direction=0):string|null{
  if(self.alive)return null;
  const allies=players.filter(p=>p.id!==self.id&&p.alive&&p.team===self.team&&!p.enemy);
  if(!allies.length)return null;
  const index=allies.findIndex(p=>p.id===current);
  if(index<0)return allies[0].id;
  return allies[(index+(direction<0?-1:direction>0?1:0)+allies.length)%allies.length].id;
}
