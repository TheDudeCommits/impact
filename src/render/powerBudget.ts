import type {Settings} from '../config';
import {handheld} from '../input/device';

export function powerBudget(settings:Pick<Settings,'quality'|'powerMode'>,strong:boolean,horde:boolean,small=handheld()){
  const cool=settings.powerMode==='cool';
  const economical=cool||(settings.powerMode!=='full'&&horde&&!strong);
  const q=settings.quality;
  return {fps:cool?30:60,pixelCap:economical?1:q==='high'?1.5:q==='medium'?1.15:1,
    samples:q==='low'||economical?0:q==='high'?4:2,bloom:q!=='low'&&!economical,
    shadowSize:q==='low'&&small?512:q==='low'||economical?1024:2048,gpuBudget:cool?10:economical?8.5:undefined};
}
