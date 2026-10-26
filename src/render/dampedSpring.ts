import { Vector3 } from 'three';

export function dampedVector(position:Vector3,velocity:Vector3,target:Vector3,frequency:number,dt:number){
  if(dt<=0)return;
  const decay=Math.exp(-frequency*dt);
  for(const axis of ['x','y','z'] as const){
    const offset=position[axis]-target[axis],drive=velocity[axis]+frequency*offset;
    position[axis]=target[axis]+(offset+drive*dt)*decay;
    velocity[axis]=(velocity[axis]-frequency*drive*dt)*decay;
  }
}
