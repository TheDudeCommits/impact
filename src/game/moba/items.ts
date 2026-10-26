import type {CombatMods} from '../simulation';
import type {RiftItemId,RiftSeat} from './model';
export interface RiftItem {id:RiftItemId;name:string;cost:number;path:'power'|'guard'|'tempo';description:string;component?:RiftItemId;level?:number;trigger?:string;hp?:number;mods:Partial<CombatMods>}
export const RIFT_ITEMS:readonly RiftItem[]=[
 {id:'spirit-blade',name:'Spirit Blade',cost:450,path:'power',description:'+12% manual attack damage.',mods:{damageOut:1.12}},
 {id:'vital-seal',name:'Vital Seal',cost:400,path:'guard',description:'+250 maximum health.',hp:250,mods:{}},
 {id:'swift-sandals',name:'Swift Sandals',cost:400,path:'tempo',description:'+8% movement speed.',mods:{speed:1.08}},
 {id:'focus-charm',name:'Focus Charm',cost:450,path:'tempo',description:'10% shorter cooldowns. +12% stamina recovery.',mods:{cooldown:.9,staminaRecovery:1.12}},
 {id:'iron-ward',name:'Iron Ward',cost:500,path:'guard',description:'Take 10% less damage.',mods:{damageIn:.9}},
 {id:'soul-fang',name:'Soul Fang',cost:550,path:'power',description:'Your manual attacks heal for 5% of damage dealt.',mods:{lifesteal:.05}},
 {id:'void-edge',name:'Void Edge',cost:1650,path:'power',component:'spirit-blade',description:'+32% manual attack damage. +15% ultimate gain.',mods:{damageOut:1.32,meterGain:1.15}},
 {id:'titan-heart',name:'Titan Heart',cost:1500,path:'guard',component:'vital-seal',description:'+650 health. Take 5% less damage.',hp:650,mods:{damageIn:.95}},
 {id:'storm-step',name:'Storm Step',cost:1400,path:'tempo',component:'swift-sandals',description:'+16% speed. 12% shorter cooldowns.',mods:{speed:1.16,cooldown:.88}},
 {id:'sage-scroll',name:'Sage Scroll',cost:1600,path:'tempo',component:'focus-charm',description:'22% shorter cooldowns. +30% stamina recovery.',mods:{cooldown:.78,staminaRecovery:1.3}},
 {id:'guardian-oath',name:'Guardian Oath',cost:1700,path:'guard',component:'iron-ward',description:'Take 22% less damage and 15% less knockback.',mods:{damageIn:.78,knockbackIn:.85}},
 {id:'dawn-oath',name:'Dawn Oath',cost:1550,path:'guard',component:'vital-seal',description:'+450 health. +8% damage. Awakenings last 6 seconds longer.',hp:450,mods:{damageOut:1.08,awakenSeconds:6}},
 {id:'rift-compass',name:'Rift Compass',cost:1650,path:'tempo',component:'focus-charm',description:'+45% ultimate gain from your attacks. Recover 5 extra stamina per second.',mods:{meterGain:1.45,staminaRegen:5}},
 {id:'shadow-tread',name:'Shadow Tread',cost:1450,path:'tempo',component:'swift-sandals',description:'+10% speed. Take 25% less stun and knockback.',mods:{speed:1.1,stunIn:.75,knockbackIn:.75}},
 {id:'blood-moon',name:'Blood Moon',cost:1850,path:'power',component:'soul-fang',description:'Manual attacks heal 12% of damage. +15% damage.',mods:{lifesteal:.12,damageOut:1.15}},
 {id:'sunbreaker',name:'Sunbreaker',cost:3250,path:'power',component:'void-edge',level:8,description:'+42% attack damage. +15% ultimate gain.',trigger:'Land a heavy or special: gain 8 ultimate. Once every 4s.',mods:{damageOut:1.42,meterGain:1.15}},
 {id:'eclipse-fang',name:'Eclipse Fang',cost:3400,path:'power',component:'blood-moon',level:8,description:'Manual attacks heal 14% of damage. +25% damage.',trigger:'Reach a 4-hit combo: restore 100 health. Once every 6s.',mods:{lifesteal:.14,damageOut:1.25}},
 {id:'aegis-of-dawn',name:'Aegis of Dawn',cost:3200,path:'guard',component:'guardian-oath',level:8,description:'Take 28% less damage and 30% less knockback.',trigger:'Perfect parry: restore 150 health and 18 stamina. Once every 4s.',mods:{damageIn:.72,knockbackIn:.7}},
 {id:'worldheart',name:'Worldheart',cost:3000,path:'guard',component:'titan-heart',level:8,description:'+1,000 health. Take 8% less damage.',trigger:'Land an attack below 35% health: heal 120. Once every 6s.',hp:1000,mods:{damageIn:.92}},
 {id:'storm-crown',name:'Storm Crown',cost:3100,path:'tempo',component:'storm-step',level:8,description:'+16% speed. 15% shorter cooldowns.',trigger:'Land a heavy or special: +18% speed for 3s. Once every 5s.',mods:{speed:1.16,cooldown:.85}},
 {id:'infinite-script',name:'Infinite Script',cost:3300,path:'tempo',component:'sage-scroll',level:8,description:'28% shorter cooldowns. +40% stamina recovery.',trigger:'Land a special: restore 22 stamina and gain 8 awakening. Once every 5s.',mods:{cooldown:.72,staminaRecovery:1.4}},
];
export const riftItem=(id:unknown):RiftItem|undefined=>RIFT_ITEMS.find(item=>item.id===id);
export function itemAncestors(item:RiftItem):RiftItemId[]{const ids:RiftItemId[]=[];let at=item;while(at.component){ids.push(at.component);at=riftItem(at.component)!;}return ids;}
export const ownedComponent=(seat:Pick<RiftSeat,'inventory'>,item:RiftItem)=>itemAncestors(item).find(id=>seat.inventory.includes(id));
export const alreadyEvolved=(seat:Pick<RiftSeat,'inventory'>,item:RiftItem)=>seat.inventory.some(id=>itemAncestors(riftItem(id)!).includes(item.id));
export function itemPrice(seat:Pick<RiftSeat,'inventory'>,item:RiftItem):number {const component=ownedComponent(seat,item);return item.cost-(component?riftItem(component)!.cost:0);}
export function levelThreshold(level:number):number {return level<=1?0:Math.round(110*(level-1)+30*(level-1)**2);}
export function buildStats(seat:Pick<RiftSeat,'level'|'inventory'>):{hp:number;mods:Partial<CombatMods>} {
 const mods:Partial<CombatMods>={damageOut:1+(seat.level-1)*.035,damageIn:1,speed:1,cooldown:1,lifesteal:0,knockbackIn:1,staminaRecovery:1,meterGain:1};let hp=1500+(seat.level-1)*70;
 for(const id of seat.inventory){const item=riftItem(id);if(!item)continue;hp+=item.hp??0;for(const [key,value] of Object.entries(item.mods)){const k=key as keyof CombatMods;mods[k]=['lifesteal','staminaRegen','awakenSeconds','crit'].includes(k)?(mods[k]??0)+value:(mods[k]??1)*value;}}
 return {hp,mods};
}

export function botBuildPlan(role:RiftSeat['role']):RiftItemId[]{
 const upgrades:RiftItemId[]=role==='support'?['rift-compass','guardian-oath','shadow-tread','dawn-oath','blood-moon','void-edge']:role==='vanguard'?['titan-heart','guardian-oath','void-edge','shadow-tread','sage-scroll','blood-moon']:['void-edge','storm-step','blood-moon','dawn-oath','sage-scroll','guardian-oath'];
 const bases=upgrades.map(id=>riftItem(id)!.component!),mythics=upgrades.flatMap(id=>RIFT_ITEMS.filter(item=>item.level&&item.component===id).map(item=>item.id));
 return [bases[0],bases[1],upgrades[0],upgrades[1],...mythics.slice(0,1),...upgrades.slice(2).flatMap((id,i)=>[bases[i+2],id]),...mythics.slice(1)];
}
