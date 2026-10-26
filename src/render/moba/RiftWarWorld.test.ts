import {describe,it,expect,vi} from 'vitest';
import {Texture} from 'three';
import {PaintedSky} from '../stages/PaintedSky';
import {RiftWarWorld} from './RiftWarWorld';

describe('Rift scenery lifecycle',()=>{
  it('releases the panorama hidden in a shader uniform exactly once',()=>{
    const world=new RiftWarWorld(),map=new Texture(),sky=new PaintedSky(map),disposed=vi.fn();
    map.addEventListener('dispose',disposed);
    Reflect.set(world,'sky',sky);world.root.add(sky.mesh);
    world.dispose();world.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    sky.mesh.geometry.dispose();sky.mesh.material.dispose();
  });
});
