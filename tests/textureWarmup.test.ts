import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {materialTextures,showCasters,warmTextures} from '../src/render/textureWarmup';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('chapter texture warm-up',()=>{
  it('retains PBR and shader maps for stages while excluding render targets and uninitialized textures',()=>{
    const colour=new THREE.Texture(),normal=new THREE.Texture(),uniform=new THREE.Texture();
    for(const t of [colour,normal,uniform]){t.image={width:1,height:1};t.needsUpdate=true;}
    const placeholder=new THREE.Texture();placeholder.needsUpdate=true;
    const render=new THREE.WebGLRenderTarget(1,1);render.texture.needsUpdate=true;
    const root=new THREE.Group();
    root.add(new THREE.Mesh(undefined,new THREE.MeshStandardMaterial({map:colour,normalMap:normal})),
      new THREE.Mesh(undefined,new THREE.ShaderMaterial({uniforms:{shared:{value:colour},extra:{value:uniform},target:{value:render.texture},empty:{value:new THREE.Texture()},waiting:{value:placeholder}}})));
    expect(materialTextures(root)).toEqual(new Set([colour,normal,uniform]));render.dispose();
  });
  it('yields after the budget and cancels before uploading resources from a departed match',async()=>{
    let time=0,current=true,resume:FrameRequestCallback|undefined;
    vi.spyOn(performance,'now').mockImplementation(()=>time);
    vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{resume=callback;return 1;});
    const maps=[new THREE.Texture(),new THREE.Texture(),new THREE.Texture()];
    const uploaded:THREE.Texture[]=[];
    const job=warmTextures(maps,t=>{uploaded.push(t);time+=3;},()=>current);
    expect(uploaded).toEqual([maps[0]]);expect(resume).toBeDefined();
    current=false;resume!(time);await job;
    expect(uploaded).toEqual([maps[0]]);
  });
  it('finishes resident textures in one batch without an unnecessary frame delay',async()=>{
    vi.spyOn(performance,'now').mockReturnValue(0);
    const wait=vi.fn();vi.stubGlobal('requestAnimationFrame',wait);
    const upload=vi.fn(),maps=[new THREE.Texture(),new THREE.Texture()];
    await warmTextures(maps,upload,()=>true);
    expect(upload.mock.calls.map(c=>c[0])).toEqual(maps);expect(wait).not.toHaveBeenCalled();
  });
});

describe('the shadow casters a warm draw shows',()=>{
  const space=()=>{
    const scene=new THREE.Scene(),armory=new THREE.Group(),root=new THREE.Group(),ability=new THREE.Group();
    scene.add(armory);armory.add(root);root.add(ability);
    return{scene,armory,root,ability};
  };
  it('shows a caster left visible under a hidden space, and everything hidden it hangs from, then hides them again',()=>{
    const{scene,armory,root,ability}=space();
    root.visible=false;ability.visible=false;
    const caster=new THREE.Mesh();caster.castShadow=true;ability.add(caster);
    const plain=new THREE.Mesh();plain.visible=false;ability.add(plain);
    const warm=showCasters([root],scene);
    expect(warm.shown).toEqual([ability,root]);
    expect([caster.visible,ability.visible,root.visible,armory.visible,scene.visible]).toEqual([true,true,true,true,true]);
    expect(plain.visible).toBe(false);expect(caster.frustumCulled).toBe(false);expect(warm.unculled).toEqual([caster]);
    warm.restore();
    expect([caster.visible,ability.visible,root.visible]).toEqual([true,false,false]);expect(caster.frustumCulled).toBe(true);
  });
  it('shows a hidden caster under a hidden group as before, and leaves one that is already drawn alone',()=>{
    const{scene,root,ability}=space();
    const hidden=new THREE.Mesh();hidden.castShadow=true;hidden.visible=false;ability.add(hidden);
    const drawn=new THREE.Mesh();drawn.castShadow=true;drawn.frustumCulled=false;root.add(drawn);
    ability.visible=false;
    const warm=showCasters([root],scene);
    expect(warm.shown).toEqual([hidden,ability]);expect(warm.unculled).toEqual([hidden]);
    warm.restore();
    expect([hidden.visible,ability.visible,drawn.visible,drawn.frustumCulled]).toEqual([false,false,true,false]);
  });
  it('names each skeleton under the roots that has no bone texture yet, once, whether its mesh casts or not',()=>{
    const{scene,root,ability}=space();
    const bones=[new THREE.Bone(),new THREE.Bone()],skeleton=new THREE.Skeleton(bones),made=new THREE.Skeleton([new THREE.Bone()]);
    made.computeBoneTexture();
    const a=new THREE.SkinnedMesh(),b=new THREE.SkinnedMesh(),c=new THREE.SkinnedMesh();
    a.bind(skeleton);b.bind(skeleton);c.bind(made);ability.add(a,b,c);root.visible=false;
    const warm=showCasters([root],scene);
    expect(warm.skeletons).toEqual([skeleton]);expect(warm.shown).toEqual([]);
    warm.restore();made.dispose();
  });
});
