import {GRUNTS} from '../../survival/horde/kinds';
import {RIFT_BODY_HEIGHT,type RiftUnit,type RiftStructure} from './model';
const find=(id:string)=>GRUNTS.findIndex(g=>g.id===id);
const DAWN={melee:find('rogue-ninja'),ranged:find('marine-rifle'),siege:find('pacifista'),super:find('marine-shield')};
const ECLIPSE={melee:find('hollow'),ranged:find('hollow-cero'),siege:find('menos'),super:find('gifter-brute')};
export const riftGruntKind=(unit:Pick<RiftUnit,'team'|'kind'>)=>unit.kind==='boss'?find('apostle-spawn'):unit.kind==='camp'?find('white-zetsu'):(unit.team==='heroes'?DAWN:ECLIPSE)[unit.kind];
export const RIFT_TROOP_HEIGHTS:Record<string,number>={'rogue-ninja':1.95,'marine-rifle':1.9,pacifista:3.2,'marine-shield':2.5,hollow:2.1,'hollow-cero':2.15,menos:3.6,'gifter-brute':2.8};
export const riftUnitHeight=(unit:Pick<RiftUnit,'team'|'kind'|'empowered'>)=>{const def=GRUNTS[riftGruntKind(unit)];return (RIFT_TROOP_HEIGHTS[def.id]??def.height)*(unit.empowered?1.15:1);};
export const riftUnitName=(unit:Pick<RiftUnit,'team'|'kind'>)=>unit.kind==='boss'?'Rift Guardian':unit.kind==='camp'?'Rift Stray':(unit.team==='heroes'?{melee:'Dawn Sentinel',ranged:'Seal Weaver',siege:'Temple Guardian',super:'Dawn Vindicator'}:{melee:'Eclipse Reaver',ranged:'Curse Hexer',siege:'Oni Siege Brute',super:'Eclipse Executioner'})[unit.kind];

export function riftCombatHeight(body:{team:RiftUnit['team'];kind:RiftUnit['kind']|RiftStructure['kind'];empowered?:boolean}){
  const kind=body.kind;
  return kind==='core'||kind==='tower'||kind==='guardian'||kind==='barracks'?RIFT_BODY_HEIGHT[kind]:riftUnitHeight({team:body.team,kind,empowered:body.empowered??false});
}
