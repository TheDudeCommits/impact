import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { DEKU_MOVES } from '../../game/fighters/deku';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { MARK } from '../vfx/GroundMarks';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { RING } from './GlowBatch';
import { MoveStage, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isDekuCowling = (id: string | undefined) => id === 'deku';
export const DEKU_FX_LIMITS = Object.freeze({ lightning: 256, rings: 96, pressure: 24, impacts: 24, confirms: 16 });
export const DEKU_FX_BEATS = Object.freeze({ swap: .504, charge: 2.04, final: 2.528 });
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1);
const GREEN = new THREE.Color(0x28d99c), WHITE = new THREE.Color(0xe9fff7), INK = new THREE.Color(0x08795c);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const OFA = stageLook(0xf0fff2, 0x3cf07a, 0x0c7a3d, { heart: .5 }), WIND = stageLook(0xffffff, 0xd4ffe4, 0x6fae8c);
const HEAVY = DEKU_MOVES.heavy, SPECIAL = DEKU_MOVES.special, ULT = DEKU_MOVES.ultimate, TAU = Math.PI * 2;
const socketCache = new WeakMap<Fighter, Map<string, THREE.Object3D>>();
export function dekuSocket(fighter: Fighter, name: string, out: THREE.Vector3) {
  const body = fighter.shownBody ?? fighter;
  let cache = socketCache.get(body);
  if (!cache) { cache = new Map(); body.model?.traverse(node => { if ((node as THREE.Bone).isBone) cache!.set(node.name, node); }); socketCache.set(body, cache); }
  const node = cache.get(name) ?? body.joints?.get(name);
  if (node) return node.getWorldPosition(out);
  return out.copy(name.startsWith('Left') ? body.handL : body.handR);
}
const KICKS = new Set(['St Louis Smash', 'Rush 3', 'Manchester Smash', 'Shoot Style Aerial']);
const FLICKS = new Set(['Delaware Smash', 'Air Force Burst', 'Delaware Landing']);
export function dekuContact(f: Fighter, index: number, out: THREE.Vector3, clip = '') {
  if (!isDekuCowling(f.state.fighter)) return false;
  const bone = KICKS.has(clip) ? 'RightToeBase' : FLICKS.has(clip) ? 'RightHandIndex3' :
    f.state.action === 'ultimate' && !f.state.branch && index === 0 || clip === 'Rush 1' || clip === 'Cowling Cross' ? 'LeftHand' : 'RightHand';
  dekuSocket(f, bone, out); return true;
}
class CowlingBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D(); private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, capacity: number, pressure = false) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('cowlingTint', this.tint);
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { pressure: { value: pressure ? 1 : 0 } },
      vertexShader: 'attribute vec4 cowlingTint;varying vec4 vTint;varying vec3 vP;void main(){vTint=cowlingTint;vP=position;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float pressure;varying vec4 vTint;varying vec3 vP;void main(){float a=vTint.a;if(pressure>.5){float rays=step(.38,sin(atan(vP.z,vP.x)*9.+vP.y*18.));a*=mix(.05,.5,rays)*(1.-abs(vP.y)*1.65);}if(a<.004)discard;gl_FragColor=vec4(vTint.rgb,a);}' });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `deku-cowling-${name}`;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, color: THREE.Color, alpha: number) {
    if (this.count >= this.mesh.instanceMatrix.count || alpha < .004 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, color.r, color.g, color.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Impact = { actor: string; born: number; grade: number; seed: number; point: THREE.Vector3; heading: THREE.Vector3 };
type Confirm = { actor: string; target: string; seq: number; final?: boolean };
type Discharge = { p: THREE.Vector3; born: number; life: number; reach: number; count: number; seed: number; live: boolean };
const LIMBS = [['RightArm','RightHand'],['LeftArm','LeftHand'],['RightUpLeg','RightFoot'],['LeftUpLeg','LeftFoot']] as const;
export class DekuCowling {
  private stage?: MoveStage; private full?: VfxKit;
  private discharges: Discharge[] = Array.from({ length: 8 }, () => ({ p: new THREE.Vector3(), born: -1e9, life: 0, reach: 0, count: 0, seed: 0, live: false }));
  private dischargeCursor = 0;
  private heading = new THREE.Vector3(); private ground = new THREE.Vector3(); private side = new THREE.Vector3(); private e = new THREE.Vector3(); private f = new THREE.Vector3();
  private lightning: CowlingBatch; private rings: CowlingBatch; private pressure: CowlingBatch;
  private batches: CowlingBatch[];
  private impacts: Impact[] = Array.from({ length: DEKU_FX_LIMITS.impacts }, () => ({ actor: '', born: 0, grade: 0, seed: 0, point: new THREE.Vector3(), heading: new THREE.Vector3() }));
  private confirms: Confirm[] = Array.from({ length: DEKU_FX_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1 }));
  private seen = new Float64Array(128).fill(-1); private seenAt = new Float64Array(128).fill(-1);
  private seenCursor = 0; private impactCursor = 0; private confirmCursor = 0; private disposed = false;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private p = new THREE.Vector3(); private direction = new THREE.Vector3(); private q = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(private scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.full = kit.sparks && kit.dust && kit.marks && kit.debris ? kit as VfxKit : undefined;
    this.lightning = new CowlingBatch(scene, 'lightning', new THREE.BoxGeometry(1,1,1), DEKU_FX_LIMITS.lightning);
    this.rings = new CowlingBatch(scene, 'air-rings', new THREE.RingGeometry(.92,1,36), DEKU_FX_LIMITS.rings);
    this.pressure = new CowlingBatch(scene, 'pressure', new THREE.CylinderGeometry(1,.24,1,18,1,true), DEKU_FX_LIMITS.pressure, true);
    this.batches = [this.lightning, this.rings, this.pressure];
  }
  load(ids: readonly string[]) {
    const wanted = !this.disposed && ids.some(isDekuCowling);
    if (wanted && !this.stage) this.stage = MoveStage.for(this.scene, this.kit);
    else if (!wanted && this.stage) { this.stage.release(); this.stage = undefined; }
    return Promise.resolve();
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isDekuCowling(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i=0;i<this.seen.length;i++) if (this.seen[i]===event.id && this.seenAt[i]===event.serverTime) return;
    const n=this.seenCursor++%this.seen.length;this.seen[n]=event.id;this.seenAt[n]=event.serverTime;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.confirms[this.confirmCursor++%this.confirms.length], { actor:event.actorId,target:event.targetId,seq:event.actionSeq??fighters?.get(event.actorId)?.state.actionSeq??-1,final:false });
      return;
    }
    const target=event.targetId?fighters?.get(event.targetId):undefined,actor=fighters?.get(event.actorId);
    if (!target&&!event.endpoint) return;
    const hit=this.impacts[this.impactCursor++%this.impacts.length];
    Object.assign(hit,{actor:event.actorId,born:event.serverTime,seed:event.id,grade:event.slot==='ultimate'&&!event.branch&&event.contactIndex===2?3:event.slot==='light'?1:2});
    if(target)bodyCentre(target,hit.point);else hit.point.set(event.endpoint!.x,event.endpoint!.y,event.endpoint!.z);
    hit.heading.set(Math.sin(actor?.group.rotation.y??0),0,Math.cos(actor?.group.rotation.y??0));
    if(hit.grade===3&&involvesLocal(event.actorId,event.targetId))SIGNATURE.screen?.impactFrame?.(.44,hit.point);
    if(this.stage&&!armoryDraws(event.fighter,event.slot,event.branch,event.actorId))this.land(this.stage,event,hit.point,actor,target);
  }
  private land(st: MoveStage, e: CombatEvent, point: THREE.Vector3, actor: Fighter | undefined, target: Fighter | undefined) {
    const kit = this.full, t = e.serverTime, dir = this.heading, yaw = actor?.state.yaw ?? actor?.group.rotation.y ?? 0;
    const floor = blowFloor(actor, target, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    if (actor) dir.subVectors(point, actor.group.position).setY(0);
    if (!actor || dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    dir.normalize();
    if (e.slot === 'light') { st.burst(point, OFA, .42, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, OFA, .88 * big, t, { dir, floor, clean: true });
      st.dome(this.e.copy(point).addScaledVector(dir, .8), WIND, 1.3 * big, t, .3);
      this.discharge(point, t, .4, 1.9 * big, 6, e.id);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, OFA, 2, t, { floor }); st.shock(ground, WIND, 4.6, t, .45); this.discharge(point, t, .4, 2.4, 7, e.id); return; }
      const big = e.branch ? .7 : 1;
      st.burst(point, WIND, 1.8 * big, t, { dir, floor });
      st.dome(point, WIND, 3.2 * big, t, .5);
      st.shock(ground, WIND, 6 * big, t, .5);
      st.shatter(this.e.copy(ground).setY(floor + .06), UP, OFA, 3.6 * big, t, 1.2);
      this.discharge(point, t, .45, 2.6 * big, 7, e.id);
      if (kit && kit.quality !== 'low') for (let i = 0; i < 2; i++) kit.marks.mark(MARK.crack, ground.x + dir.x * (1 + i * 1.6), floor, ground.z + dir.z * (1 + i * 1.6), 0, 1, 0, 2 - i * .4, t + .05, 2.6);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (e.contactIndex !== 2) {
      st.burst(point, OFA, e.contactIndex ? 1.25 : 1, t, { dir, floor, clean: true });
      if (e.contactIndex) st.shock(ground, WIND, 4.6, t, .42);
      this.discharge(point, t, .32, e.contactIndex ? 2 : 1.6, 5, e.id);
      return;
    }
    for (const c of this.confirms) if (c.actor === e.actorId && c.target === e.targetId) c.final = true;
    st.dome(point, WIND, 5, t, .5);
    st.erupt(this.e.copy(point).addScaledVector(dir, .5), this.f.copy(dir).setY(.1).normalize(), WIND, .85, 11, t, .5);
    st.burst(point, OFA, 2.1, t, { dir, floor });
    st.shock(ground, WIND, 10, t, .6);
    st.shock(ground, WIND, 6, t + .12, .5);
    st.shatter(this.e.copy(ground).setY(floor + .06), UP, OFA, 7, t + .04, 1.4);
    this.discharge(point, t, .6, 5, 10, e.id);
    if (!kit) return;
    for (let i = 0; i < 4; i++) {
      const ang = i * 1.571 + yaw + .6, r = 2.4 + hash(i + e.id); this.e.set(ground.x + Math.cos(ang) * r, floor, ground.z + Math.sin(ang) * r);
      kit.debris.burst(kit.n(6, 2), this.e.x, floor, this.e.z, 0, 1, 0, 8, .8, .14, floor, 2.1);
      if (kit.quality !== 'low') kit.marks.mark(MARK.crack, this.e.x, floor, this.e.z, 0, 1, 0, 2.4, t + .05, 3);
    }
  }
  private discharge(p: THREE.Vector3, born: number, life: number, reach: number, count: number, seed: number) {
    const d = this.discharges[this.dischargeCursor++ % this.discharges.length];
    d.p.copy(p); d.born = born; d.life = life; d.reach = reach; d.count = count; d.seed = seed; d.live = true;
  }
  private zap(st: MoveStage, a: THREE.Vector3, b: THREE.Vector3, seed: number, width: number, intensity: number) {
    const span = a.distanceTo(b); if (span < .05 || intensity <= .02) return;
    let px = a.x, py = a.y, pz = a.z;
    for (let i = 1; i <= 4; i++) {
      const u = i / 4, jag = i < 4 ? span * .13 : 0;
      const x = a.x + (b.x - a.x) * u + (hash(seed + i * 5.1) - .5) * jag, y = a.y + (b.y - a.y) * u + (hash(seed + i * 2.3) - .5) * jag, z = a.z + (b.z - a.z) * u + (hash(seed + i * 3.7) - .5) * jag;
      st.streak(this.e.set(px, py, pz), this.f.set(x, y, z), width, OFA.main, intensity, OFA.heart);
      px = x; py = y; pz = z;
    }
  }
  private cancel(id: string, targetToo=false) { for(const c of this.confirms)if(c.actor===id||targetToo&&c.target===id)c.actor=''; }
  private segment(a: THREE.Vector3,b: THREE.Vector3,width: number,alpha: number) {
    this.direction.subVectors(b,a);const length=this.direction.length();if(length<.001)return;
    this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/length));this.p.copy(a).lerp(b,.5);
    this.lightning.add(this.p,this.q,width,length,width,GREEN,alpha);
    this.lightning.add(this.p,this.q,width*.32,length*1.01,width*.32,WHITE,alpha);
  }
  private bolt(a: THREE.Vector3,b: THREE.Vector3,seed: number,width: number,alpha: number) {
    this.c.copy(a);
    for(let i=1;i<=4;i++) {
      this.b.copy(a).lerp(b,i/4);
      if(i<4){this.b.x+=Math.sin(seed+i*5.1)*.07;this.b.z+=Math.cos(seed+i*3.7)*.07;}
      this.segment(this.c,this.b,width,alpha);this.c.copy(this.b);
    }
  }
  update(time: number, fighters: ReadonlyMap<string,Fighter>, flights: ReadonlyMap<string,Flight>) {
    if(this.disposed)return;
    for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65;
    if(!this.stage)for(const f of fighters.values())if(isDekuCowling(f.state.fighter)){this.stage=MoveStage.for(this.scene,this.kit);break;}
    const st=this.stage?.open(time);
    for(const f of fighters.values()) {
      const s=f.state;if(!isDekuCowling(s.fighter)||!s.alive)continue;
      const elapsed=s.actionTime*s.actionDuration,entry=s.action==='awaken',manual=['light','heavy','special','ultimate'].includes(s.action);
      if(!entry&&!manual)continue;
      const amplitude=entry?Math.sin(clamp(elapsed/.9)*Math.PI):Math.sin(clamp(s.actionTime)*Math.PI)*.75;
      for(let i=0;i<(detail?4:2);i++) {
        dekuSocket(f,LIMBS[i][0],this.a);dekuSocket(f,LIMBS[i][1],this.direction);
        const end=this.endpoint.copy(this.direction);this.bolt(this.a,end,Math.floor(time*18)+i*11,.025,amplitude);
      }
      if(entry&&elapsed>=DEKU_FX_BEATS.swap) {
        const k=(elapsed-DEKU_FX_BEATS.swap)/(.9-DEKU_FX_BEATS.swap);
        this.p.copy(f.group.position);this.p.y+=.035;const r=.4+k*1.8;
        this.rings.add(this.p,this.flat,r,r,1,GREEN,(1-k)*.8);
      }
      if(s.action==='special'&&!s.branch&&elapsed<.616) {
        dekuSocket(f,'RightHandIndex3',this.p);this.q.setFromAxisAngle(FRONT,time*4);
        const r=.035+.10*clamp(elapsed/.616);this.rings.add(this.p,this.q,r,r,1,WHITE,.85);
      }
      if(st&&manual&&s.whiffedAt===undefined&&!armoryDraws('deku',s.action,s.branch,s.id))this.windup(st,f,elapsed,time);
    }
    for(const flight of flights.values())if(isDekuCowling(flight.fighter)&&flight.slot==='special'&&!flight.branch&&flight.released) {
      this.q.setFromUnitVectors(FRONT,flight.heading);
      for(let i=0;i<(detail?4:2);i++){this.p.copy(flight.position).addScaledVector(flight.heading,-i*.27);const r=.28+i*.09;this.rings.add(this.p,this.q,r,r,1,i%2?GREEN:WHITE,1-i*.17);}
      this.q.setFromUnitVectors(UP,flight.heading);this.p.copy(flight.position).addScaledVector(flight.heading,-.36);this.pressure.add(this.p,this.q,.48,.9,.48,WHITE,.7);
      if(!st||armoryDraws('deku','special',undefined,flight.actorId))continue;
      st.glow(flight.position,1.1,WIND.main,.7);st.glow(flight.position,.4,WIND.core,1);
      for(let i=0;i<4;i++){this.p.copy(flight.position).addScaledVector(flight.heading,-i*.85);st.glow(this.p,.7+i*.35,i%2?OFA.main:WIND.core,.95-i*.18,RING,.05,0,.86);}
      for(let i=0;i<2;i++){this.a.copy(flight.position);this.c.copy(flight.position).addScaledVector(flight.heading,-1.6-i*.9);this.c.y+=(i?-.5:.5);this.zap(st,this.a,this.c,Math.floor(time*18)+i*7,.035,.9);}
      st.light(this.p.copy(flight.position).setY(flight.position.y+.2),7.5,OFA,.7);
    }
    for(const c of this.confirms) {
      if(!c.actor)continue;const f=fighters.get(c.actor),s=f?.state,target=fighters.get(c.target);
      if(!f||!s?.alive||!target?.state.alive||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}
      const elapsed=s.actionTime*s.actionDuration;
      if(st&&!c.final&&elapsed<DEKU_FX_BEATS.final&&!armoryDraws('deku','ultimate',undefined,c.actor))this.overdrive(st,f,c,elapsed,time);
      if(elapsed>=DEKU_FX_BEATS.charge&&elapsed<DEKU_FX_BEATS.final){
        dekuSocket(f,'RightHand',this.p);const k=(elapsed-DEKU_FX_BEATS.charge)/(DEKU_FX_BEATS.final-DEKU_FX_BEATS.charge),r=.12+.24*k;
        this.q.setFromAxisAngle(FRONT,time*9);this.rings.add(this.p,this.q,r,r,1,WHITE,.9);this.rings.add(this.p,this.q,r*1.15,r*1.15,1,GREEN,.8);
      }
    }
    for(const hit of this.impacts) {
      if(!hit.actor)continue;const t=(time-hit.born)/(.22+hit.grade*.07);if(t<0)continue;if(t>=1){hit.actor='';continue;}
      this.q.setFromUnitVectors(FRONT,hit.heading);const r=.13+t*(hit.grade===3?2.2:hit.grade===2?1.05:.45),alpha=(1-t)*.95;
      this.rings.add(hit.point,this.q,r,r,1,WHITE,alpha);this.rings.add(hit.point,this.q,r*1.09,r*1.09,1,GREEN,alpha*.8);
      if(hit.grade===3){this.q.setFromUnitVectors(UP,hit.heading);this.p.copy(hit.point).addScaledVector(hit.heading,t*.65);this.pressure.add(this.p,this.q,1.1+t*1.6,1.5+t*2,1.1+t*1.6,WHITE,alpha);}
      if(detail)for(let i=0;i<6;i++){const angle=i*Math.PI/3+hit.seed;this.a.copy(hit.point);this.endpoint.copy(hit.point).add(this.radial.set(Math.cos(angle),Math.sin(angle),0).multiplyScalar(r*.75));this.segment(this.a,this.endpoint,.018,alpha);}
    }
    if(st)for(const d of this.discharges){
      if(!d.live)continue;const age=time-d.born;if(age>=d.life){d.live=false;continue;}if(age<0)continue;
      const fade=1-age/d.life,flick=Math.floor(age*18);
      for(let i=0,n=st.n(d.count,3);i<n;i++){
        const seed=d.seed+i*7.7+flick*3.1,phi=hash(seed)*TAU,y=hash(seed+1.3)*1.4-.4,h=Math.sqrt(Math.max(.05,1-Math.min(1,y*y))),reach=d.reach*(.5+.5*hash(seed+2.9))*(.6+.4*Math.min(1,age/.06));
        this.c.set(d.p.x+Math.cos(phi)*h*reach,d.p.y+y*reach*.7,d.p.z+Math.sin(phi)*h*reach);
        this.zap(st,d.p,this.c,seed,.03+d.reach*.012,1.2*fade);
      }
      st.light(d.p,2+d.reach,OFA,.3*fade);
    }
    for(const b of this.batches)b.end();st?.close();
  }
  private windup(st: MoveStage, f: Fighter, elapsed: number, time: number) {
    const s = f.state, seed = (s.actionSeq ?? 0) * 7.3, flick = Math.floor(time * 18), yaw = s.yaw ?? f.group.rotation.y;
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI); dekuSocket(f, 'RightHand', this.p);
      st.glow(this.p, .22, OFA.main, .55 * k); st.glow(this.p, .09, OFA.core, .7 * k); st.light(this.p, 1.8, OFA, .2 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .53 : HEAVY.contacts[0];
      dekuSocket(f, 'RightToeBase', this.p); dekuSocket(f, 'RightUpLeg', this.a);
      if (elapsed < contact) {
        const k = clamp(elapsed / contact);
        this.zap(st, this.a, this.p, flick + 3, .03 + .03 * k, .5 + .7 * k); st.charge(this.p, OFA, .22, k, seed);
      } else if (elapsed < contact + .2) {
        const flare = 1 - (elapsed - contact) / .2;
        this.side.set(Math.cos(yaw), 0, -Math.sin(yaw)); this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
        for (let i = 0; i < 6; i++) {
          const u0 = i / 6 * 2 - 1, u1 = (i + 1) / 6 * 2 - 1;
          this.a.copy(this.p).addScaledVector(this.side, u0 * 1.2).addScaledVector(this.heading, .3 + (1 - u0 * u0) * .5); this.c.copy(this.p).addScaledVector(this.side, u1 * 1.2).addScaledVector(this.heading, .3 + (1 - u1 * u1) * .5);
          st.streak(this.a, this.c, .05 + .08 * (1 - Math.abs(u0 + u1) * .5), WIND.main, .9 * flare);
        }
        st.light(this.p, 2.6, OFA, .3 * flare);
      }
    } else if (s.action === 'special' && !s.branch) {
      if (elapsed < SPECIAL.contacts[0]) {
        const k = clamp(elapsed / SPECIAL.contacts[0]); dekuSocket(f, 'RightHandIndex3', this.p); dekuSocket(f, 'RightArm', this.a);
        st.charge(this.p, OFA, .3, k, seed); this.zap(st, this.a, this.p, flick + 5, .03, .5 + .6 * k);
      }
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) {
      const k = clamp(elapsed / ULT.contacts[0]); dekuSocket(f, 'LeftHand', this.p); dekuSocket(f, 'LeftArm', this.a);
      st.charge(this.p, OFA, .26, k, seed); this.zap(st, this.a, this.p, flick + 9, .03, .5 + .6 * k);
    }
  }
  private overdrive(st: MoveStage, f: Fighter, c: Confirm, elapsed: number, time: number) {
    const g = clamp((elapsed - ULT.contacts[0]) / (DEKU_FX_BEATS.final - ULT.contacts[0])), charge = clamp((elapsed - DEKU_FX_BEATS.charge) / (DEKU_FX_BEATS.final - DEKU_FX_BEATS.charge));
    const feet = f.group.position, seed = c.seq * 3.3, flick = Math.floor(time * 18);
    st.dim(.3 + .45 * g, c.actor, c.target);
    st.cracks(this.p.copy(feet).setY(feet.y + .06), UP, 2.4 + 2.2 * g, OFA, 1, seed, .45 + .4 * g);
    dekuSocket(f, 'RightHand', this.a);
    for (let i = 0, n = st.n(g > .5 ? 6 : 4, 3); i < n; i++) {
      const ang = hash(i * 7.1 + flick * 3.3 + seed) * TAU, r = 1.4 + 1.8 * hash(i * 2.3 + flick);
      this.c.set(feet.x + Math.cos(ang) * r, feet.y + .04, feet.z + Math.sin(ang) * r); this.p.copy(feet); this.p.y += .7 + .9 * hash(i * 5.9 + flick);
      this.zap(st, this.p, this.c, i * 3.1 + flick, .03 + .025 * g, .8 + .4 * g);
    }
    st.light(this.p.copy(feet).setY(feet.y + .7), 3.8 + 1.6 * g, OFA, .25 + .2 * g);
    if (charge > 0) { st.charge(this.a, OFA, .34 + .3 * charge, charge, seed); st.speed(.55 * charge, c.actor, c.target); }
  }
  private endpoint=new THREE.Vector3();private radial=new THREE.Vector3();
  reset(){for(const x of this.impacts)x.actor='';for(const x of this.confirms)x.actor='';for(const d of this.discharges)d.live=false;this.seen.fill(-1);this.seenAt.fill(-1);for(const b of this.batches){b.begin();b.end();}this.stage?.reset();}
  dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.batches)b.dispose();this.stage?.release();this.stage=undefined;}
}
