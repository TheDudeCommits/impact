import * as THREE from 'three';
export const GAROU_CONTACT_SURFACES = {
  "base": {
    "light": [
      -0.020324474388614153,
      0.048091598384408366,
      -0.030689163804532245
    ],
    "heavy": [
      0.02116269589551445,
      0.047962964048241075,
      -0.03031043857741389
    ],
    "knife": [
      0.042663593190457316,
      0.06505834852358322,
      -0.026601391901106552
    ],
    "right-fist": [
      -0.009417755123082959,
      0.06801653513975424,
      -0.04755360262923801
    ],
    "left-fist": [
      0.02328867014656777,
      0.07686232925999703,
      -0.03624850753014608
    ],
    "ultimate-fist": [
      -0.000011867077880367564,
      0.08627079676839224,
      -0.005434400769657178
    ]
  },
  "cosmic": {
    "light": [
      0.02586354473560709,
      0.05192509177487792,
      0.036945940898513885
    ],
    "heavy": [
      -0.025733608968287802,
      0.058142701385370366,
      0.03527937147070248
    ],
    "knife": [
      -0.0463054115296151,
      0.12994985448669485,
      -0.002535001828588346
    ],
    "right-fist": [
      -0.025844726779761518,
      0.14803493306412752,
      0.016025387987262496
    ],
    "left-fist": [
      0.024425686355549092,
      0.14214328882334493,
      0.013205936108653726
    ],
    "ultimate-fist": [
      -0.0267837410539249,
      0.14959222906488925,
      0.012636823615332807
    ]
  }
} as const;
export type GarouSurface = keyof typeof GAROU_CONTACT_SURFACES.base;
export function garouSurfaceKind(action:string,clip?:string,index=0):GarouSurface {
 if(action==='ultimate'&&(!clip||clip==='Monster Calamity Rush'))return (['light','heavy','right-fist','left-fist','ultimate-fist'] as const)[Math.max(0,Math.min(4,index))];
 if(['Rock Smashing Palm','Rush 2','Flowing Redirection','Descending Palm'].includes(clip??''))return 'heavy';
 if(['Whirlwind Slash','Rush 3','Whirlwind Break','Monster Lunge','Cyclone Break'].includes(clip??''))return 'knife';
 if(!clip&&action==='heavy')return 'heavy';
 if(!clip&&action==='special')return 'knife';
 return 'light';
}
export function garouSurfacePoint(hand:THREE.Object3D,cosmic:boolean,action:string,clip:string|undefined,index:number,out:THREE.Vector3){
 const p=GAROU_CONTACT_SURFACES[cosmic?'cosmic':'base'][garouSurfaceKind(action,clip,index)];
 return hand.localToWorld(out.set(p[0],p[1],p[2]));
}
