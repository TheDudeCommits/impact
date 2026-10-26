import * as THREE from 'three';

const FRONT_GAP=.35,FRONT_SOFT=.9,FRONT_RATE=8,BOX_GAP=.12,BOX_SOFT=.35,FIGHT_NEAR=9,FIGHT_FAR=15,TARGET_IN=10,TARGET_OUT=4,ROOM_WALL=.9;
const WINDOW_ROUND=1.1,WINDOW_FEATHER=.35;
export interface StageRoom{x0:number;x1:number;z0:number;z1:number}

export const stageFadeUniforms={
  uStageOn:{value:0},
  uStageFloor:{value:0},
  uStageFront:{value:new THREE.Vector2(0,0)},
  uStageBoxA:{value:new THREE.Vector4(2,2,2,2)},uStageDepthA:{value:new THREE.Vector3(0,0,0)},
  uStageBoxB:{value:new THREE.Vector4(2,2,2,2)},uStageDepthB:{value:new THREE.Vector3(0,0,0)},
  uStageRoom:{value:new THREE.Vector4(1,1,-1,-1)},uStageEye:{value:new THREE.Vector3()},
};

export const STAGE_FADE_VERTEX='\n   vStageClip=gl_Position.xyw;';
export const STAGE_FADE_FRAGMENT= `
uniform float uStageOn,uStageFloor;
uniform vec2 uStageFront;
uniform vec4 uStageBoxA,uStageBoxB;
uniform vec3 uStageDepthA,uStageDepthB;
uniform vec4 uStageRoom;
uniform vec3 uStageEye;
varying vec3 vStageClip;
float stageBox(vec4 box,vec3 depth,vec2 ndc,float d){
 if(depth.z<=0.)return 0.;
 // An ellipse round the box, WINDOW_ROUND of it out to the box's own edge
 // midpoints and feathered past them: a window, not a slot cut in the wall.
 vec2 centre=(box.xy+box.zw)*.5,extent=max((box.zw-box.xy)*.5,vec2(.02));
 float r=length((ndc-centre)/extent);
 return depth.z*(1.-smoothstep(${WINDOW_ROUND.toFixed(2)},${(WINDOW_ROUND+WINDOW_FEATHER).toFixed(2)},r))*(1.-smoothstep(depth.x,depth.y,d));
}
float stageDrop(vec3 world){
 if(uStageOn<.5||world.y<=uStageFloor+.035||vStageClip.z<=.05)return 0.;
 float d=vStageClip.z;vec2 ndc=vStageClip.xy/d;
 float drop=1.-smoothstep(uStageFront.x,uStageFront.y,d);
 if(drop>0.&&uStageRoom.x<uStageRoom.z){
  const float W=${ROOM_WALL.toFixed(2)};
  if((world.x<uStageRoom.x+W&&uStageEye.x>uStageRoom.x)||(world.x>uStageRoom.z-W&&uStageEye.x<uStageRoom.z)
   ||(world.z<uStageRoom.y+W&&uStageEye.z>uStageRoom.y)||(world.z>uStageRoom.w-W&&uStageEye.z<uStageRoom.w))drop=0.;
 }
 drop=max(drop,stageBox(uStageBoxA,uStageDepthA,ndc,d));
 return max(drop,stageBox(uStageBoxB,uStageDepthB,ndc,d));
}
`;

export interface StageSubject{x0:number;y0:number;x1:number;y1:number;near:number;mid:number;seen:boolean}

export class StageFade{
  readonly state={front:0,target:0};
  room?:StageRoom;
  private front=NaN;private floor=NaN;private target=0;private targetOf:unknown=undefined;
  update(dt:number,eye:THREE.Vector3,self:StageSubject|undefined,target:StageSubject|undefined,targetKey:unknown,nearest:number,y:number,grounded:boolean,apart:number){
    const u=stageFadeUniforms;
    dt=Math.min(Math.max(Number.isFinite(dt)?dt:0,0),.1);
    if(!self||!self.seen){this.off();return;}
    u.uStageOn.value=1;u.uStageEye.value.copy(eye);
    const room=this.room;
    if(room)u.uStageRoom.value.set(room.x0,room.z0,room.x1,room.z1);else u.uStageRoom.value.set(1,1,-1,-1);
    this.floor=grounded||!Number.isFinite(this.floor)?y:Math.min(this.floor,y);
    u.uStageFloor.value=this.floor;
    const goal=Number.isFinite(nearest)?nearest-FRONT_GAP:0;
    this.front=Number.isFinite(this.front)?this.front+(goal-this.front)*(1-Math.exp(-FRONT_RATE*dt)):goal;
    u.uStageFront.value.set(this.front-FRONT_SOFT,this.front);
    u.uStageBoxA.value.set(self.x0,self.y0,self.x1,self.y1);
    u.uStageDepthA.value.set(self.mid-BOX_GAP-BOX_SOFT,self.mid-BOX_GAP,1);
    if(targetKey!==this.targetOf){this.targetOf=targetKey;this.target=0;}
    const want=target&&target.seen?1-THREE.MathUtils.smoothstep(apart,FIGHT_NEAR,FIGHT_FAR):0;
    this.target+=(want-this.target)*(1-Math.exp(-(want>this.target?TARGET_IN:TARGET_OUT)*dt));
    if(want===0&&this.target<1e-3)this.target=0;
    if(target&&target.seen&&this.target>1e-3){
      u.uStageBoxB.value.set(target.x0,target.y0,target.x1,target.y1);
      u.uStageDepthB.value.set(target.mid-BOX_GAP-BOX_SOFT,target.mid-BOX_GAP,this.target);
    }else u.uStageDepthB.value.set(0,0,0);
    this.state.front=this.front;this.state.target=this.target;
  }
  off(){
    const u=stageFadeUniforms;
    u.uStageOn.value=0;u.uStageDepthA.value.set(0,0,0);u.uStageDepthB.value.set(0,0,0);
    this.front=NaN;this.floor=NaN;this.target=0;this.targetOf=undefined;this.state.front=0;this.state.target=0;
  }
}
