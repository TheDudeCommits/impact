import {describe,expect,it,vi} from 'vitest';
import {StageAmbient} from './ambient';
describe('stage ambient resource ownership',()=>{
 it('releases point-field geometry and shaders exactly once when a stage leaves',()=>{
  const ambient=new StageAmbient('repeatable battlefield');
  const points=ambient.motes({min:[-2,0,-2],max:[2,4,2],count:12,velocity:[0,1,0],size:.1,color:0xffffff});
  const geometry=vi.fn(),material=vi.fn();points.geometry.addEventListener('dispose',geometry);points.material.addEventListener('dispose',material);
  ambient.update(2);ambient.dispose();ambient.dispose();expect(geometry).toHaveBeenCalledOnce();expect(material).toHaveBeenCalledOnce();
 });
});
