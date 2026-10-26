const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function crowdCoverage(x: number, y: number, z: number, tall: number, focusX: number, focusY: number, focusZ: number): number {
  const d = Math.max(-z, .05), f = Math.max(-focusZ, .05);
  const ahead = 1 - smooth(f - 1.4, f - .7, d);
  const over = Math.max(
    Math.abs(x / d - focusX / f) / (tall * .2 / d + .35 / f),
    Math.abs(y / d - focusY / f) / (tall * .5 / d + .8 / f),
  );
  return Math.max(ahead * (1 - smooth(.8, 1, over)), 1 - smooth(tall * 1.2, tall * 1.6, Math.hypot(x, y, z)));
}

export function riftCrowdCoverage(x:number,y:number,z:number,tall:number,focusX:number,focusY:number,focusZ:number){
 const line=Math.min(.45,crowdCoverage(x,y,z,tall,focusX,focusY,focusZ)*.45);
 return Math.max(line,1-smooth(.65,1.15,Math.hypot(x,y,z)));
}
