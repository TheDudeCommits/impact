import {RiftCamera,type LookInput,type LookScene} from '../survival/riftCamera';
import {ACTIONS,boundTo,heldBinding} from './bindings';
const LOOK=new Set(['KeyI','KeyU','KeyO','BracketLeft']);
const MOVEMENT={forward:'KeyW',left:'KeyA',backward:'KeyS',right:'KeyD'} as const;
export class ObjectiveCamera extends RiftCamera {
  private cameraKeys=new Set<string>();
  private cameraInput:LookInput={keys:this.cameraKeys,yaw:0,pitch:0,sensitivity:1};
  override steer(dt:number,input:LookInput,scene:LookScene={},movementYaw=input.yaw){
    this.cameraKeys.clear();
    for(const key of input.keys)if(!Object.values(MOVEMENT).includes(key as 'KeyW')&&(!LOOK.has(key)||!ACTIONS.some(a=>boundTo(a,key))))this.cameraKeys.add(key);
    for(const [action,code] of Object.entries(MOVEMENT))if(heldBinding(action as keyof typeof MOVEMENT,input.keys))this.cameraKeys.add(code);
    Object.assign(this.cameraInput,{yaw:input.yaw,pitch:input.pitch,sensitivity:input.sensitivity});
    super.steer(dt,this.cameraInput,scene,movementYaw);input.yaw=this.cameraInput.yaw;input.pitch=this.cameraInput.pitch;
  }
}
