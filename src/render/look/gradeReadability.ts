import * as THREE from 'three';
import { frameUniforms, toonUniforms } from './toonShading';

const RIM_WHITE = .6, RIM_WIDEN = .2, AMBIENT_LIFT = .35;
const FLOOR = new THREE.Color(.06, .06, .07);

const WHITE = new THREE.Color(1, 1, 1);
const base = { ambient: 0, rimWidth: 0, floor: new THREE.Color() };
const wrote = { ambient: NaN, rimWidth: NaN, floor: new THREE.Color(-1, -1, -1) };
let lifted = false;

export function liftFightersUnderGrade(level: number, hue: THREE.Color) {
  const t = toonUniforms;
  if (t.uToonAmbient.value !== wrote.ambient) base.ambient = t.uToonAmbient.value;
  if (t.uRimWidth.value !== wrote.rimWidth) base.rimWidth = t.uRimWidth.value;
  if (!t.uToonFloor.value.equals(wrote.floor)) base.floor.copy(t.uToonFloor.value);
  frameUniforms.uLookTechColor.value.copy(hue).lerp(WHITE, RIM_WHITE);
  if (!(level > 0)) {
    if (lifted) { t.uToonAmbient.value = base.ambient; t.uRimWidth.value = base.rimWidth; t.uToonFloor.value.copy(base.floor); lifted = false; }
    wrote.ambient = t.uToonAmbient.value; wrote.rimWidth = t.uRimWidth.value; wrote.floor.copy(t.uToonFloor.value);
    return;
  }
  const k = Math.min(1, level);
  t.uToonAmbient.value = base.ambient * (1 + AMBIENT_LIFT * k);
  t.uRimWidth.value = base.rimWidth + RIM_WIDEN * k;
  t.uToonFloor.value.setRGB(Math.max(base.floor.r, FLOOR.r * k), Math.max(base.floor.g, FLOOR.g * k), Math.max(base.floor.b, FLOOR.b * k));
  wrote.ambient = t.uToonAmbient.value; wrote.rimWidth = t.uRimWidth.value; wrote.floor.copy(t.uToonFloor.value);
  lifted = true;
}
