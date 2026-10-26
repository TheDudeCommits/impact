import {afterEach,describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {preloadRiftAssets} from '../src/render/rift/RiftStage';
import {loadPropModels} from '../src/render/rift/propModels';

vi.mock('../src/render/rift/propModels',()=>({loadPropModels:vi.fn()}));
afterEach(()=>vi.restoreAllMocks());
describe('Rift stage asset readiness',()=>{
  it('waits for paint and props and returns the injected terrain texture for GPU warm-up',async()=>{
    let finishPaint!:(t:THREE.Texture<HTMLImageElement>)=>void,finishProps!:()=>void;
    const texture=new THREE.Texture<HTMLImageElement>();
    const loader=vi.spyOn(THREE.TextureLoader.prototype,'loadAsync').mockImplementation(()=>new Promise(resolve=>{finishPaint=resolve;}));
    vi.mocked(loadPropModels).mockImplementation(()=>new Promise(resolve=>{finishProps=resolve;}));
    let ready=false;const job=preloadRiftAssets('rift-harbor').then(maps=>{ready=true;return maps;});
    expect(loader).toHaveBeenCalledWith('/assets/survival/motion/ground-harbor.jpg');
    finishPaint(texture);await Promise.resolve();await Promise.resolve();expect(ready).toBe(false);
    finishProps();expect(await job).toEqual([texture]);expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    vi.mocked(loadPropModels).mockResolvedValue();
    await preloadRiftAssets('rift-harbor');expect(loader).toHaveBeenCalledOnce();
  });
  it('keeps procedural terrain available when its paint fails',async()=>{
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    vi.spyOn(THREE.TextureLoader.prototype,'loadAsync').mockRejectedValue(new Error('unavailable'));
    vi.mocked(loadPropModels).mockResolvedValue();
    expect(await preloadRiftAssets('rift-frost')).toEqual([]);
  });
});
