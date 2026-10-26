import type {EnemyDefinition,EnemyMove} from '../../survival/enemies';
export function specialistMove(def:EnemyDefinition,medic:boolean):EnemyMove {
  return {name:medic?'Mending seal':'Breach charge',slot:'special',duration:medic?1.95:2.65,contacts:[],damage:0,range:0,radius:0,stamina:0,cooldown:0,stun:0,knockback:0,style:'melee',clip:medic?(def.clips.taunt??def.clips.guard??def.clips.idle):(def.moves.find(m=>m.slot==='heavy')??def.moves[0]).clip};
}
