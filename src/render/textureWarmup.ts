import type * as THREE from 'three';

export function materialTextures(root:THREE.Object3D){
  const found=new Set<THREE.Texture>();
  const take=(value:unknown)=>{const t=value as THREE.Texture|null;if(t?.isTexture&&!t.isRenderTargetTexture&&!(t as THREE.VideoTexture).isVideoTexture&&t.version>0&&t.image!=null)found.add(t);};
  root.traverse(object=>{
    const material=(object as THREE.Mesh).material;if(!material)return;
    for(const each of Array.isArray(material)?material:[material]){
      for(const value of Object.values(each))take(value);
      const uniforms=(each as THREE.ShaderMaterial).uniforms;
      if(uniforms)for(const uniform of Object.values(uniforms))take(uniform?.value);
    }
  });
  return found;
}

export function showCasters(roots:readonly THREE.Object3D[],scene:THREE.Object3D,whole:readonly THREE.Object3D[]=[]){
  const shown:THREE.Object3D[]=[],unculled:THREE.Object3D[]=[],skeletons=new Set<THREE.Skeleton>();let casters=0;
  for(const root of [...roots,...whole])root.traverse(o=>{
    const skeleton=(o as THREE.SkinnedMesh).isSkinnedMesh?(o as THREE.SkinnedMesh).skeleton:undefined;
    if(skeleton&&!skeleton.boneTexture)skeletons.add(skeleton);
    if(!(o as THREE.Mesh).isMesh||!o.castShadow)return;
    casters++;
    for(let p:THREE.Object3D|null=o;p&&p!==scene;p=p.parent)if(!p.visible){p.visible=true;shown.push(p);}
    if(o.frustumCulled){o.frustumCulled=false;unculled.push(o);}
  });
  for(const root of whole)root.traverse(o=>{if((o as THREE.Mesh).isMesh&&o.frustumCulled){o.frustumCulled=false;unculled.push(o);}});
  return{shown,unculled,casters,skeletons:[...skeletons],restore(){for(const o of shown)o.visible=false;for(const o of unculled)o.frustumCulled=true;}};
}

export async function warmTextures(textures:Iterable<THREE.Texture>,upload:(texture:THREE.Texture)=>void,current:()=>boolean){
  let until=performance.now()+2;
  for(const texture of textures){
    if(!current())return;
    if(performance.now()>=until){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(!current())return;
      until=performance.now()+2;
    }
    upload(texture);
  }
}
