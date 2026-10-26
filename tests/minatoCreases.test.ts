import {describe,it,expect} from 'vitest';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {preserveMinatoPaintedFolds} from '../src/render/look/minatoCreases';
const body=()=>{const g=new BufferGeometry();g.setAttribute('lookHead',new Float32BufferAttribute([.8,1,1,0,1,.6],3));g.setAttribute('normal',new Float32BufferAttribute([0,0,1,1,0,0],3));return g;};
describe('Minato source-painted garment folds',()=>{
 it('clears only inferred ink while preserving face weights, cel colour and normals',()=>{const g=body();preserveMinatoPaintedFolds('minato','body_minato',g);expect(Array.from(g.getAttribute('lookHead').array)).toEqual([expect.closeTo(.8),1,0,0,1,0]);expect(Array.from(g.getAttribute('normal').array)).toEqual([0,0,1,1,0,0]);});
 it.each([['minato','minato_marked_kunai'],['minato','minato_sage_eyes'],['naruto','body_minato'],['yuta','body_yuta']])('leaves %s/%s intact',(fighter,mesh)=>{const g=body(),before=Array.from(g.getAttribute('lookHead').array);preserveMinatoPaintedFolds(fighter,mesh,g);expect(Array.from(g.getAttribute('lookHead').array)).toEqual(before);});
 it('accepts geometry with no optional crease channel',()=>{const g=new BufferGeometry();expect(()=>preserveMinatoPaintedFolds('minato','body_minato',g)).not.toThrow();g.setAttribute('lookHead',new Float32BufferAttribute([.4],1));preserveMinatoPaintedFolds('minato','body_minato',g);expect(g.getAttribute('lookHead').getX(0)).toBeCloseTo(.4);});
});
