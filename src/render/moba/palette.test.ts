import {describe,it,expect} from 'vitest';
import {laneRibbon,pointNearPath} from './palette';
import {RIFT_PATHS} from '../../game/moba/map';
describe('Rift lane paving',()=>{
  it('faces upward for every lane and every turn',()=>{for(const points of Object.values(RIFT_PATHS)){const g=laneRibbon(points,9),normal=g.getAttribute('normal');for(let i=0;i<normal.count;i++)expect(normal.getY(i)).toBeCloseTo(1);g.dispose();}});
  it('keeps world scale through corners and excludes duplicate points',()=>{const g=laneRibbon([{x:0,z:0},{x:0,z:0},{x:10,z:0},{x:10,z:10}],10);expect(g.getAttribute('position').count).toBe(12);expect(g.getAttribute('uv').getY(11)).toBe(4);g.dispose();});
  it('keeps foliage clear of the full segment, including its ends',()=>{const p=[{x:0,z:0},{x:10,z:0}];expect(pointNearPath(5,2,p,3)).toBe(true);expect(pointNearPath(12,0,p,3)).toBe(true);expect(pointNearPath(5,4,p,3)).toBe(false);});
});
