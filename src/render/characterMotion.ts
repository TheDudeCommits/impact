import * as T from 'three';
import type { FighterId, AttackSlot } from '../game/types';
import { MOVES } from '../game/moves';

const cache=new WeakMap<T.AnimationClip[],Map<string,T.AnimationClip[]>>();
const authored=new WeakSet<T.AnimationClip>();
export const isCharacterMotion=(clip:T.AnimationClip)=>authored.has(clip);
type Point=[number,number,number];
type Finger='point'|'sign'|'claw'|'fist'|'two'|'cross';
type Pose={at:number;right:Point;left:Point;twist?:number;dip?:number;finger?:Finger;lean?:number;fingerL?:Finger;aim?:Point;aimL?:Point;palm?:Point;palmL?:Point};
type Plan={name:string;duration:number;keys:Pose[]};
const THREE_CLAMP=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const smooth=(u:number)=>{u=T.MathUtils.clamp(u,0,1);return u*u*u*(u*(u*6-15)+10);};
const readyR:Point=[.19,.17,.16],readyL:Point=[-.18,.23,.19];
const pose=(at:number,right:Point=readyR,left:Point=readyL,twist=0,dip=0,finger:Pose['finger']='fist'):Pose=>({at,right,left,twist,dip,finger});

const clocked=(keys:Pose[],contact:number,duration:number,move:{contacts:number[];duration:number}):Pose[]=>{
  const now=move.contacts[0],left=move.duration-now;
  const from=Math.max(0,...keys.filter(k=>k.at<contact).map(k=>k.at));
  const strike=from>0?Math.min(contact-from,now*.6):now,lead=now-strike;
  return keys.map(k=>({...k,at:k.at>contact?now+(k.at-contact)*left/(duration-contact)
    :from>0&&k.at<=from?k.at*lead/from:lead+(k.at-from)*strike/(contact-from)}));
};
function gatling():Pose[]{
  const m=MOVES.luffy.special,c=m.contacts,last=c[c.length-1];
  const lean=(p:Pose,amount:number):Pose=>({...p,lean:amount});
  const keys:Pose[]=[pose(0),lean(pose(c[0]*.6,[.17,.13,-.03],[-.17,.14,-.02],0,.05),.1)];
  for(const [i,time]of c.entries()){
    const right=i%2===0,final=time===last,far=final?.48:.43,high=final?.27:.25,turn=(final?.36:.26)*(right?1:-1);
    keys.push(lean(pose(time,right?[.05,high,far]:[.16,.16,.02],right?[-.16,.16,.02]:[-.05,high,far],turn,final?.07:.055),final?.2:.14));
  }
  keys.push(lean(pose(last+.2,c.length%2?[.05,.25,.44]:[.15,.17,.05],c.length%2?[-.15,.17,.05]:[-.05,.25,.44],c.length%2?.3:-.3,.05),.12),pose(m.duration));
  return keys;
}
function plans(id:FighterId):Plan[]{
  const move=(slot:AttackSlot,keys:Pose[]):Plan=>({name:`Authored ${id} ${slot}`,duration:MOVES[id][slot].duration,keys});
  if(id==='ace')return [{name:'Authored ace guard',duration:3,keys:[pose(0,[.13,.32,.17],[-.15,.28,.22],-.15,.018),pose(1.5,[.13,.325,.17],[-.15,.285,.22],-.13,.015),pose(3,[.13,.32,.17],[-.15,.28,.22],-.15,.018)]}];
  if(id==='dio')return [move('heavy',clocked([
    pose(0),pose(.2,[.24,.17,.1],[-.22,.2,.12],-.3,.018),
    pose(.38,[.12,.29,.4],[-.1,.26,.37],.3,.025,'point'),
    pose(.49,[.06,.23,.4],[-.08,.23,.35],.37,.02,'point'),pose(.95),
  ],.38,.95,MOVES.dio.heavy))];
  if(id==='gojo'){
    const g=(at:number,right:Point,left:Point,twist:number,dip:number,finger:Finger,lean=0,fingerL:Finger='fist',aim?:Point,more:Partial<Pose>={}):Pose=>({at,right,left,twist,dip,finger,lean,fingerL,aim,...more});
    const spread={aimL:[-.75,.2,.6] as Point,palm:[0,1,.1] as Point,palmL:[0,1,.1] as Point};
    const pocket:Point=[-.12,-.02,.06],sign:Point=[.1,.29,.18];
    return [
      move('heavy',clocked([pose(0),
        g(.22,[.13,.31,.12],pocket,-.18,.02,'two',-.03,'fist',[0,1,.15]),
        g(.55,[.07,.27,.42],pocket,.22,.045,'two',.08,'fist',[0,.12,1]),
        g(.74,[.07,.27,.41],pocket,.2,.04,'two',.07,'fist',[0,.12,1]),pose(1.15)],.55,1.15,MOVES.gojo.heavy)),
      move('special',clocked([pose(0),
        g(.5,[.36,.27,.1],[-.36,.27,.1],0,.03,'claw',-.05,'claw',[.75,.2,.6],spread),
        g(.8,[.38,.28,.13],[-.38,.28,.13],.02,.035,'claw',-.05,'claw',[.75,.2,.6],spread),
        g(1.18,[.05,.25,.3],[-.05,.24,.28],-.08,.03,'two',0,'claw',[0,.3,1],{aimL:[.2,.3,1],palmL:[1,0,0]}),
        g(1.45,[.08,.28,.44],[-.17,.17,.06],.22,.05,'two',.09,'fist',[0,.1,1],{aimL:[0,-.3,1]}),
        g(1.75,[.08,.275,.43],[-.17,.17,.06],.2,.045,'two',.08,'fist',[0,.1,1],{aimL:[0,-.3,1]}),pose(2.7)],1.45,2.7,MOVES.gojo.special)),
      move('ultimate',(()=>{const c=MOVES.gojo.ultimate.contacts,f=c[c.length-1],keys:Pose[]=[pose(0),g(c[0]*.6,sign,pocket,0,.015,'cross',-.02,'fist',[-.1,1,.05]),g(c[0],sign,pocket,0,.02,'cross',-.02,'fist',[-.1,1,.05])];
        for(let i=1;i<c.length-1;i++){const right=i%2===1;keys.push({...pose(c[i]-.2,right?[.2,.21,.04]:[.16,.24,.18],right?[-.16,.24,.18]:[-.2,.21,.04],right?-.22:.22,.035),lean:.02},{...pose(c[i],right?[.05,.26,.37]:[.2,.2,.12],right?[-.2,.2,.12]:[-.05,.26,.37],right?.3:-.3,.06),lean:.08});}
        keys.push({...pose(f-.26,[.23,.2,-.06],[-.13,.27,.18],-.36,.045),lean:.02},{...pose(f,[.04,.26,.43],[-.2,.2,.12],.32,.065),lean:.1},{...pose(f+.23,[.01,.23,.42],[-.2,.17,.1],.4,.04),lean:.08},pose(MOVES.gojo.ultimate.duration));return keys;})()),
    ];
  }
  if(id==='luffy')return [move('special',gatling())];
  if(id==='killua'){
    const c=MOVES.killua.ultimate.contacts,keys:Pose[]=[pose(0,[.19,.12,.12],[-.19,.14,.14],0,.04,'claw'),pose(c[0]*.6,[.2,.19,.03],[-.17,.23,.2],-.22,.07,'claw')];
    const toward=(a:Point,b:Point,k:number):Point=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
    for(const [i,time]of c.entries()){
      const right=i%2===0,finish=i===c.length-1,gap=finish?Infinity:c[i+1]-time;
      const strikeR:Point=right?[.04,finish?.23:.2,.42]:[.2,.21,.1],strikeL:Point=right?[-.19,.22,.1]:[-.04,.24,.41];
      keys.push(pose(time,strikeR,strikeL,right?.28:-.28,finish?.065:.045,'claw'));
      if(!finish&&gap<.19)continue;
      const back=finish?1:THREE_CLAMP(gap/.3,.45,1);
      keys.push(pose(time+(finish?.22:Math.min(.12,gap*.5)),toward(strikeR,readyR,back),toward(strikeL,readyL,back),right?-.14:.14,.05,'claw'));
    }
    keys.push(pose(4.4));
    return [move('light',clocked([pose(0,readyR,readyL,0,.02,'claw'),pose(.09,[.2,.16,.1],readyL,-.14,.025,'claw'),pose(.2,[.065,.24,.36],[-.2,.22,.13],.19,.025,'claw'),pose(.31,[.01,.2,.31],readyL,.24,.025,'claw'),pose(.5)],.2,.5,MOVES.killua.light)),move('ultimate',keys)];
  }
  return [];
}

function arm(upper:T.Bone,lower:T.Bone,hand:T.Bone,target:T.Vector3,pole:T.Vector3,reach=.98){
  const a=upper.getWorldPosition(new T.Vector3()),b=lower.getWorldPosition(new T.Vector3()),c=hand.getWorldPosition(new T.Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),axis=target.clone().sub(a);
  const d=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,(l1+l2)*reach);axis.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const bend=pole.clone().sub(a).addScaledVector(axis,-pole.clone().sub(a).dot(axis)).normalize();
  const elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,height);
  const turn=(bone:T.Bone,from:T.Vector3,to:T.Vector3)=>{
    const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
    const parent=bone.parent!.getWorldQuaternion(new T.Quaternion());
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));bone.updateMatrixWorld(true);
  };
  const handRotation=hand.getWorldQuaternion(new T.Quaternion());
  turn(upper,b.sub(a),elbow.clone().sub(a));
  lower.getWorldPosition(b);hand.getWorldPosition(c);
  turn(lower,c.sub(b),a.addScaledVector(axis,d).sub(b));
  hand.quaternion.copy(hand.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(handRotation));hand.updateMatrixWorld(true);
}

export const authoredClips=(id:FighterId)=>plans(id).map(plan=>({name:plan.name,duration:plan.duration}));

export function characterClips(model:T.Object3D,source:T.AnimationClip[],id:FighterId,joints:Map<string,T.Bone>,form=false){
  if(form&&id!=='luffy')return source;
  const specifications=plans(id);if(!specifications.length)return source;
  const prior=cache.get(source)?.get(id);if(prior)return prior;
  const hips=joints.get('Hips'),head=joints.get('Head'),foot=joints.get('LeftFoot');
  const right=['RightArm','RightForeArm','RightHand'].map(n=>joints.get(n));
  const left=['LeftArm','LeftForeArm','LeftHand'].map(n=>joints.get(n));
  const idle=source.find(c=>c.name==='_Idle');
  if(!hips||!head||!foot||!idle||[...right,...left].some(b=>!b))return source;
  const bones:T.Bone[]=[];model.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);});
  const saved=bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  const mixer=new T.AnimationMixer(model),action=mixer.clipAction(idle).play();action.time=0;mixer.update(0);model.updateMatrixWorld(true);
  const base=bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  const origin=hips.getWorldPosition(new T.Vector3());
  const height=(head.getWorldPosition(new T.Vector3()).y-foot.getWorldPosition(new T.Vector3()).y)/.86;
  const rightSign=Math.sign(right[0]!.getWorldPosition(new T.Vector3()).x-left[0]!.getWorldPosition(new T.Vector3()).x)||-1;
  const vector=(point:Point)=>origin.clone().add(new T.Vector3(point[0]*rightSign,point[1],point[2]).multiplyScalar(height));
  const coordinates=(bone:T.Bone):Point=>{
    const p=bone.getWorldPosition(new T.Vector3()).sub(origin).divideScalar(height);
    return [p.x/rightSign,p.y,p.z];
  };
  const restingR=coordinates(right[2]!),restingL=coordinates(left[2]!);
  const gojoLegs=id==='gojo'?(['Left','Right'] as const).map(s=>({bones:[joints.get(`${s}UpLeg`),joints.get(`${s}Leg`),joints.get(`${s}Foot`)] as T.Bone[],ankle:new T.Vector3()}))
    .filter(l=>l.bones.every(b=>b)).map(l=>({...l,ankle:l.bones[2].getWorldPosition(new T.Vector3())})):undefined;
  const fingers=base.flatMap((row,i)=>{
    const name=row.b.name.match(/(Left|Right)Hand(Index|Middle|Ring|Pinky|Thumb)([123])/i);
    return name?[{row,rest:saved[i].q,side:name[1].toLowerCase(),finger:name[2].toLowerCase()}]:[];
  });
  const rotateWorld=(bone:T.Bone,axis:T.Vector3,angle:number)=>{
    const parent=bone.parent!.getWorldQuaternion(new T.Quaternion());
    bone.quaternion.premultiply(parent.clone().invert().multiply(new T.Quaternion().setFromAxisAngle(axis,angle)).multiply(parent));bone.updateMatrixWorld(true);
  };
  const clips: T.AnimationClip[]=[];
  for(const plan of specifications){
    if(!plan.name.endsWith('guard')){
      plan.keys[0]={...pose(0,restingR,restingL)};
      plan.keys[plan.keys.length-1]={...pose(plan.duration,restingR,restingL)};
    }
    const frames=Math.ceil(plan.duration*60),times=Array.from({length:frames+1},(_,i)=>Math.min(plan.duration,i/60));
    times.push(...plan.keys.map(k=>k.at));const clock=[...new Set(times)].sort((a,b)=>a-b);
    const samples=base.map(()=>({p:[] as number[],q:[] as number[],s:[] as number[]}));
    for(const time of clock){
      for(const row of base){row.b.position.copy(row.p);row.b.quaternion.copy(row.q);row.b.scale.copy(row.s);}
      model.updateMatrixWorld(true);
      let next=plan.keys.findIndex(k=>k.at>time);if(next<0)next=plan.keys.length-1;
      const a=plan.keys[Math.max(0,next-1)],b=plan.keys[next],u=smooth((time-a.at)/Math.max(.001,b.at-a.at));
      const blend=(a:number,b:number)=>T.MathUtils.lerp(a,b,u);
      const twist=blend(a.twist??0,b.twist??0),dip=blend(a.dip??0,b.dip??0),lean=blend(a.lean??0,b.lean??0);
      const kind=(key:Pose,side:string)=>side==='left'&&key.fingerL?key.fingerL:key.finger;
      const open=(key:Pose,finger:string,side:string)=>{const k=kind(key,side);return k==='claw'?.65:k==='point'&&finger==='index'?1:k==='sign'&&['index','middle'].includes(finger)?1:0;};
      for(const finger of fingers){
        finger.row.b.quaternion.copy(finger.row.q).slerp(finger.rest,blend(open(a,finger.finger,finger.side),open(b,finger.finger,finger.side)));
      }
      const p=hips.getWorldPosition(new T.Vector3());p.y-=dip*height;hips.position.copy(hips.parent!.worldToLocal(p));hips.updateMatrixWorld(true);
      for(const [name,share]of [['Hips',.35],['Spine',.25],['Spine1',.2],['Spine2',.2]] as const){const bone=joints.get(name);if(bone)rotateWorld(bone,new T.Vector3(0,1,0),twist*share);}
      if(gojoLegs)for(const leg of gojoLegs){
        const hipAt=leg.bones[0].getWorldPosition(new T.Vector3()),knee=hipAt.clone().lerp(leg.ankle,.5).add(new T.Vector3(0,0,height*.5));
        arm(leg.bones[0],leg.bones[1],leg.bones[2],leg.ankle,knee,.9995);
      }
      if(lean)for(const [name,share]of [['Spine',.45],['Spine1',.35],['Spine2',.2]] as const){const bone=joints.get(name);if(bone)rotateWorld(bone,new T.Vector3(1,0,0),lean*share);}
      for(const [chain,side]of [[right,'right'],[left,'left']] as const){
        const goal=vector(a[side].map((v,i)=>blend(v,b[side][i])) as Point);
        const sign=side==='right'?1:-1;
        arm(chain[0]!,chain[1]!,chain[2]!,goal,vector([sign*.4,.06,.08]));
        if(id==='gojo'){
          const hand=chain[2]!,index=bones.find(b=>new RegExp(`^${side}HandIndex1`,'i').test(b.name)),pinky=bones.find(b=>new RegExp(`^${side}HandPinky1`,'i').test(b.name));
          if(index){
            const ka=kind(a,side),kb=kind(b,side),own=(key:Pose)=>side==='right'?key.aim:key.aimL,ownPalm=(key:Pose)=>side==='right'?key.palm:key.palmL;
            const gesture=(key:Pose,k?:Finger)=>own(key)||k==='sign'||k==='point'||k==='two'||k==='cross'?1:0;
            const weight=blend(gesture(a,ka),gesture(b,kb));
            const up=(k?:Finger)=>k==='sign'||k==='cross'?1:0,body=(v:Point)=>new T.Vector3(v[0]*rightSign,v[1],v[2]).normalize();
            const aimOf=(key:Pose,k?:Finger)=>{const v=own(key);return v?body(v):new T.Vector3(0,up(k),1-up(k)).normalize();};
            const aim=aimOf(a,ka).lerp(aimOf(b,kb),u).normalize();
            const direction=index.getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize();
            const turn=new T.Quaternion().setFromUnitVectors(direction,aim);
            const parent=hand.parent!.getWorldQuaternion(new T.Quaternion());
            const delta=new T.Quaternion().identity().slerp(turn,weight);
            hand.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));hand.updateMatrixWorld(true);
            if(pinky&&weight>1e-3){
              const f=index.getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize();
              const across=pinky.getWorldPosition(new T.Vector3()).sub(index.getWorldPosition(new T.Vector3()));
              const palm=side==='right'?f.clone().cross(across).normalize():across.clone().cross(f).normalize();
              const inward=new T.Vector3(side==='right'?-rightSign:rightSign,0,0);
              const palmOf=(key:Pose,k?:Finger)=>{const v=ownPalm(key);return v?body(v):inward.clone().lerp(new T.Vector3(0,0,-1),up(k)).normalize();};
              const want=palmOf(a,ka).lerp(palmOf(b,kb),u);
              const now=palm.addScaledVector(f,-palm.dot(f)),goal=want.addScaledVector(f,-want.dot(f));
              if(now.lengthSq()>1e-6&&goal.lengthSq()>1e-6){
                now.normalize();goal.normalize();
                const angle=Math.atan2(now.clone().cross(goal).dot(f),now.dot(goal))*weight;
                const roll=new T.Quaternion().setFromAxisAngle(f,angle),hp=hand.parent!.getWorldQuaternion(new T.Quaternion());
                hand.quaternion.premultiply(hp.clone().invert().multiply(roll).multiply(hp));hand.updateMatrixWorld(true);
              }
            }
            const named=(finger:string)=>[1,2,3,4].map(i=>bones.find(b=>new RegExp(`^${side}Hand${finger}${i}`,'i').test(b.name)));
            const shape=(k:Finger|undefined,finger:string)=>k==='two'||k==='cross'?(finger==='Index'||finger==='Middle'?1:-1):k==='fist'?-.75:0;
            if(pinky)for(const finger of ['Index','Middle','Ring','Pinky']){
              const chain=named(finger),w=blend(shape(ka,finger),shape(kb,finger));
              if(!chain[0]||Math.abs(w)<1e-3)continue;
              const across=pinky.getWorldPosition(new T.Vector3()).sub(index.getWorldPosition(new T.Vector3())).normalize();
              const along=chain[0].getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize();
              for(let j=0;j<3;j++){
                const joint=chain[j],next=chain[j+1];if(!joint)break;
                if(w>0&&next){const d=next.getWorldPosition(new T.Vector3()).sub(joint.getWorldPosition(new T.Vector3())).normalize();rotateWorld(joint,d.clone().cross(along).normalize(),Math.acos(T.MathUtils.clamp(d.dot(along),-1,1))*w);}
                else if(w<0)rotateWorld(joint,across,(side==='right'?-1:1)*[1.35,1.6,1.15][j]*-w);
              }
            }
            const middle=bones.find(b=>new RegExp(`^${side}HandMiddle1`,'i').test(b.name));
            const crossed=blend(ka==='cross'?1:ka==='sign'?.45:0,kb==='cross'?1:kb==='sign'?.45:0);
            if(crossed>0&&side==='right'&&middle){
              const f=index.getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize(),across=middle.getWorldPosition(new T.Vector3()).sub(index.getWorldPosition(new T.Vector3()));
              const axis=f.clone().cross(across).normalize();
              if(axis.lengthSq()>.5){rotateWorld(index,axis,.3*crossed);rotateWorld(middle,axis,-.2*crossed);}
            }
          }
        }
      }
      for(let i=0;i<base.length;i++){const bone=base[i].b;bone.position.toArray(samples[i].p,samples[i].p.length);bone.quaternion.toArray(samples[i].q,samples[i].q.length);bone.scale.toArray(samples[i].s,samples[i].s.length);}
    }
    const tracks:T.KeyframeTrack[]=[];
    base.forEach(({b},i)=>{tracks.push(new T.VectorKeyframeTrack(`${b.name}.position`,clock,samples[i].p),new T.QuaternionKeyframeTrack(`${b.name}.quaternion`,clock,samples[i].q),new T.VectorKeyframeTrack(`${b.name}.scale`,clock,samples[i].s));});
    const clip=new T.AnimationClip(plan.name,plan.duration,tracks).optimize();authored.add(clip);clips.push(clip);
  }
  mixer.stopAllAction();mixer.uncacheRoot(model);
  for(const row of saved){row.b.position.copy(row.p);row.b.quaternion.copy(row.q);row.b.scale.copy(row.s);}model.updateMatrixWorld(true);
  const result=[...source,...clips];let set=cache.get(source);if(!set){set=new Map();cache.set(source,set);}set.set(id,result);return result;
}

export function swapSide(name:string){
  const pairs:[RegExp,(m:string)=>string][]=[
    [/Left|Right/,m=>m==='Left'?'Right':'Left'],[/left|right/,m=>m==='left'?'right':'left'],[/LEFT|RIGHT/,m=>m==='LEFT'?'RIGHT':'LEFT'],
  ];
  for(const [pattern,swap]of pairs)if(pattern.test(name))return name.replace(pattern,swap);
  const token=name.match(/(^|[_.\-\s])([LRlr])(?=[_.\-\s]|$)/);
  if(token){const at=token.index!+token[1].length,side=token[2];return name.slice(0,at)+({L:'R',R:'L',l:'r',r:'l'} as Record<string,string>)[side]+name.slice(at+1);}
  const suffix=name.match(/^(.*[a-z])([LRlr])(\d*)$/);
  if(suffix)return suffix[1]+({L:'R',R:'L',l:'r',r:'l'} as Record<string,string>)[suffix[2]]+suffix[3];
  return undefined;
}
const stripIndex=(name:string)=>name.replace(/_\d+$/,'');
const mirrored=new WeakMap<T.AnimationClip,{source:T.AnimationClip}>();
export const mirrorSource=(clip:T.AnimationClip)=>mirrored.get(clip)?.source;
const mirrorCache=new WeakMap<T.AnimationClip,T.AnimationClip|null>();
export function mirrorClip(root:T.Object3D,clip:T.AnimationClip,joints:Map<string,T.Bone>):T.AnimationClip|undefined{
  const cached=mirrorCache.get(clip);
  if(cached!==undefined)return cached??undefined;
  const result=buildMirror(root,clip,joints);
  mirrorCache.set(clip,result??null);
  return result;
}
function buildMirror(root:T.Object3D,clip:T.AnimationClip,joints:Map<string,T.Bone>){
  const nodes:T.Object3D[]=[];root.traverse(o=>{if(o!==root)nodes.push(o);});
  const index=new Map<T.Object3D,number>();nodes.forEach((n,i)=>index.set(n,i));
  const byName=new Map<string,T.Object3D[]>();
  for(const n of nodes){const key=stripIndex(n.name);byName.set(key,[...(byName.get(key)??[]),n]);}
  const partner=nodes.map((n,i)=>{
    const swapped=swapSide(stripIndex(n.name));if(!swapped)return i;
    const found=byName.get(swapped);if(!found||found.length!==1)return i;
    const back=swapSide(stripIndex(found[0].name));
    return back===stripIndex(n.name)?index.get(found[0])!:i;
  });
  const limbs=[['LeftUpLeg','RightUpLeg'],['LeftLeg','RightLeg'],['LeftFoot','RightFoot'],['LeftArm','RightArm'],['LeftForeArm','RightForeArm'],['LeftHand','RightHand']];
  const rest=nodes.map(()=>new T.Matrix4()),restInverse=nodes.map(()=>new T.Matrix4());
  root.updateMatrixWorld(true);
  const rootInverse=new T.Matrix4().copy(root.matrixWorld).invert();
  nodes.forEach((n,i)=>{rest[i].multiplyMatrices(rootInverse,n.matrixWorld);restInverse[i].copy(rest[i]).invert();});
  const at=(bone?:T.Object3D)=>bone&&index.has(bone)?new T.Vector3().setFromMatrixPosition(rest[index.get(bone)!]):undefined;
  const lateral=new T.Vector3(),centre=new T.Vector3();let pairs=0;
  for(const [left,right]of limbs){
    const l=joints.get(left),r=joints.get(right);
    if(!l||!r||!index.has(l)||!index.has(r)||partner[index.get(l)!]!==index.get(r))return undefined;
    const pl=at(l)!,pr=at(r)!;lateral.add(pl.clone().sub(pr));centre.add(pl).add(pr);pairs+=2;
  }
  if(lateral.lengthSq()<1e-10)return undefined;
  lateral.normalize();centre.divideScalar(pairs);
  const reflect=new T.Matrix4().set(
    1-2*lateral.x*lateral.x,-2*lateral.x*lateral.y,-2*lateral.x*lateral.z,0,
    -2*lateral.y*lateral.x,1-2*lateral.y*lateral.y,-2*lateral.y*lateral.z,0,
    -2*lateral.z*lateral.x,-2*lateral.z*lateral.y,1-2*lateral.z*lateral.z,0,
    0,0,0,1);
  const S=new T.Matrix4().makeTranslation(centre.x,centre.y,centre.z).multiply(reflect).multiply(new T.Matrix4().makeTranslation(-centre.x,-centre.y,-centre.z));
  const height=Math.max(.1,...[...joints.values()].filter(b=>index.has(b)).map(b=>at(b)!.distanceTo(centre)));
  for(const [left,right]of limbs){
    const pl=at(joints.get(left)!)!.applyMatrix4(S),pr=at(joints.get(right)!)!;
    if(pl.distanceTo(pr)>.06*height)return undefined;
  }
  type Sampler={evaluate(t:number):ArrayLike<number>};
  const tracks=new Map<number,{position?:Sampler;quaternion?:Sampler;scale?:Sampler}>();
  for(const track of clip.tracks){
    const parsed=T.PropertyBinding.parseTrackName(track.name);
    const node=T.PropertyBinding.findNode(root,parsed.nodeName) as T.Object3D|undefined;
    if(!node||!index.has(node)||!['position','quaternion','scale'].includes(parsed.propertyName))continue;
    const i=index.get(node)!;const entry=tracks.get(i)??{};
    (entry as Record<string,Sampler>)[parsed.propertyName]=(track as unknown as {createInterpolant():Sampler}).createInterpolant();
    tracks.set(i,entry);
  }
  if(!tracks.size)return undefined;
  const frames=Math.max(2,Math.ceil(clip.duration*60)+1);
  const times:number[]=[];for(let f=0;f<frames;f++)times.push(Math.min(clip.duration,f/60));
  if(times[times.length-1]<clip.duration)times.push(clip.duration);
  const out=new Set<number>();for(const i of tracks.keys()){out.add(i);out.add(partner[i]);}
  const has=(i:number,property:'position'|'quaternion'|'scale')=>!!tracks.get(i)?.[property]||!!tracks.get(partner[i])?.[property];
  const values=new Map<number,{p:number[];q:number[];s:number[]}>();for(const i of out)values.set(i,{p:[],q:[],s:[]});
  const world=nodes.map(()=>new T.Matrix4()),mirroredWorld=nodes.map(()=>new T.Matrix4()),inverse=nodes.map(()=>new T.Matrix4());
  const local=new T.Matrix4(),delta=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
  const previous=new Map<number,T.Quaternion>();
  const parentOf=nodes.map(n=>n.parent&&index.has(n.parent)?index.get(n.parent)!:-1);
  for(const time of times){
    nodes.forEach((n,i)=>{
      const entry=tracks.get(i);
      position.copy(n.position);rotation.copy(n.quaternion);scale.copy(n.scale);
      if(entry?.position)position.fromArray(entry.position.evaluate(time) as number[]);
      if(entry?.quaternion)rotation.fromArray(entry.quaternion.evaluate(time) as number[]).normalize();
      if(entry?.scale)scale.fromArray(entry.scale.evaluate(time) as number[]);
      local.compose(position,rotation,scale);
      const parent=parentOf[i];
      world[i].copy(parent<0?local:delta.multiplyMatrices(world[parent],local));
    });
    nodes.forEach((_,i)=>{const j=partner[i];delta.multiplyMatrices(world[j],restInverse[j]);mirroredWorld[i].multiplyMatrices(S,delta).multiply(S).multiply(rest[i]);});
    nodes.forEach((_,i)=>{const parent=parentOf[i];if(parent>=0)inverse[parent].copy(mirroredWorld[parent]).invert();});
    for(const i of out){
      const parent=parentOf[i];
      local.copy(parent<0?mirroredWorld[i]:delta.multiplyMatrices(inverse[parent],mirroredWorld[i]));
      local.decompose(position,rotation,scale);
      const last=previous.get(i);
      if(last&&last.dot(rotation)<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);
      if(last)last.copy(rotation);else previous.set(i,rotation.clone());
      const v=values.get(i)!;position.toArray(v.p,v.p.length);rotation.toArray(v.q,v.q.length);scale.toArray(v.s,v.s.length);
    }
  }
  const result:T.KeyframeTrack[]=[];
  for(const i of out){
    const name=nodes[i].name,v=values.get(i)!;
    if(has(i,'position'))result.push(new T.VectorKeyframeTrack(`${name}.position`,times,v.p));
    if(has(i,'quaternion'))result.push(new T.QuaternionKeyframeTrack(`${name}.quaternion`,times,v.q));
    if(has(i,'scale'))result.push(new T.VectorKeyframeTrack(`${name}.scale`,times,v.s));
  }
  const clipOut=new T.AnimationClip(`${clip.name} (mirrored)`,clip.duration,result);
  mirrored.set(clipOut,{source:clip});
  return clipOut;
}

const strikeCache=new WeakMap<T.AnimationClip,number|null>();
export function strikeFraction(root:T.Object3D,clip:T.AnimationClip,joints:Map<string,T.Bone>):number|undefined{
  const cached=strikeCache.get(clip);
  if(cached!==undefined)return cached??undefined;
  const nodes:T.Object3D[]=[];root.traverse(o=>{if(o!==root)nodes.push(o);});
  const index=new Map<T.Object3D,number>();nodes.forEach((n,i)=>index.set(n,i));
  const parentOf=nodes.map(n=>n.parent&&index.has(n.parent)?index.get(n.parent)!:-1);
  type Sampler={evaluate(t:number):ArrayLike<number>};
  const tracks=new Map<number,{position?:Sampler;quaternion?:Sampler;scale?:Sampler}>();
  for(const track of clip.tracks){
    const parsed=T.PropertyBinding.parseTrackName(track.name);
    const node=T.PropertyBinding.findNode(root,parsed.nodeName) as T.Object3D|undefined;
    if(!node||!index.has(node)||!['position','quaternion','scale'].includes(parsed.propertyName))continue;
    const entry=tracks.get(index.get(node)!)??{};
    (entry as Record<string,Sampler>)[parsed.propertyName]=(track as unknown as {createInterpolant():Sampler}).createInterpolant();
    tracks.set(index.get(node)!,entry);
  }
  const hips=joints.get('Hips'),limbs=['LeftHand','RightHand','LeftFoot','RightFoot'].map(n=>joints.get(n));
  const upLeg=joints.get('RightUpLeg'),foot=joints.get('RightFoot');
  if(!hips||!index.has(hips)||limbs.some(l=>!l||!index.has(l))||!upLeg||!foot){strikeCache.set(clip,null);return undefined;}
  root.updateMatrixWorld(true);
  const leg=upLeg.getWorldPosition(new T.Vector3()).distanceTo(foot.getWorldPosition(new T.Vector3()));
  const needed=new Set<number>();
  for(const joint of [hips,...limbs])for(let i=index.get(joint!)!;i>=0;i=parentOf[i])needed.add(i);
  const order=[...needed].sort((a,b)=>a-b);
  const world=nodes.map(()=>new T.Matrix4()),local=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
  const samples=Math.max(32,Math.round(clip.duration*120));
  const reach=limbs.map(()=>[] as number[]);
  for(let f=0;f<=samples;f++){
    const time=clip.duration*f/samples;
    for(const i of order){
      const n=nodes[i],entry=tracks.get(i);
      p.copy(n.position);q.copy(n.quaternion);s.copy(n.scale);
      if(entry?.position)p.fromArray(entry.position.evaluate(time) as number[]);
      if(entry?.quaternion)q.fromArray(entry.quaternion.evaluate(time) as number[]).normalize();
      if(entry?.scale)s.fromArray(entry.scale.evaluate(time) as number[]);
      local.compose(p,q,s);
      if(parentOf[i]<0)world[i].copy(local);else world[i].multiplyMatrices(world[parentOf[i]],local);
    }
    const hz=world[index.get(hips)!].elements[14];
    limbs.forEach((limb,k)=>reach[k].push(world[index.get(limb!)!].elements[14]-hz));
  }
  const first=Math.ceil(.12*samples),last=Math.floor(.88*samples);
  let best:number|undefined,travel=0;
  reach.forEach(series=>{
    let at=first;for(let f=first;f<=last;f++)if(series[f]>series[at])at=f;
    const moved=series[at]-Math.min(...series);
    if(at>first&&at<last&&moved>travel){travel=moved;best=at/samples;}
  });
  const result=travel>=.2*leg?best:undefined;
  strikeCache.set(clip,result??null);
  return result;
}
export function sceneJoints(root:T.Object3D,resolve:(names:string[])=>Map<string,string>){
  const names:string[]=[];root.traverse(o=>{if((o as T.Bone).isBone)names.push(o.name);});
  const out=new Map<string,T.Bone>();
  for(const [canonical,actual]of resolve(names)){const bone=root.getObjectByName(actual) as T.Bone|undefined;if(bone)out.set(canonical,bone);}
  return out;
}
