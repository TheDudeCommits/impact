import { afterEach, describe, expect, it, vi } from 'vitest';
import { poseTiming, posePages, poseFrameAt, poseCell, poseLayout, poseLayoutFor, timedPoseFrame } from '../src/ui/HomePreview';

afterEach(()=>vi.unstubAllGlobals());
const expanded=poseLayout({columns:4,frameCount:32,heroFrame:15});
const timing={frameTimesMs:Array.from({length:32},(_,i)=>i*100),loopMs:4000,loopStartFrame:31};
describe('homepage drawn cel playback',()=>{
  it('prefers independently paced motion metadata over old voice-stretched timings',()=>{
    const motion={...timing,loopMs:3200};
    expect(poseTiming({timing,motionTiming:motion})).toBe(motion);
    expect(poseTiming({timing})).toBe(timing);expect(poseTiming({})).toBeUndefined();
  });
  it('keeps old16 geometry while supporting32 explicit cels',()=>{
    expect(poseLayoutFor('goku')).toEqual({columns:4,rows:4,frameCount:16,heroFrame:7});
    expect(expanded).toEqual({columns:4,rows:8,frameCount:32,heroFrame:15});
    expect(timedPoseFrame('not-in-manifest',1450)).toBe(7);
    for(let i=0;i<32;i++)expect(poseFrameAt(timing,i*100,expanded)).toBe(i);
  });
  it('crops all32cells with no row overlap and clamps malformed frame indices',()=>{
    const crops=Array.from({length:32},(_,i)=>poseCell(expanded,1536,4096,i));
    expect(new Set(crops.map(c=>`${c.x},${c.y}`)).size).toBe(32);
    expect(crops[31]).toEqual({index:31,x:1152,y:3584,width:384,height:512});
    expect(poseCell(expanded,1536,4096,99)).toEqual(crops[31]);
    expect(poseCell(expanded,1536,4096,-1)).toEqual(crops[0]);
    expect(poseCell(expanded,1536,4096,NaN)).toEqual(crops[15]);
  });
  it('plays the intro once then holds a silent signature cel without replaying speech',()=>{
    expect(poseFrameAt(timing,0,expanded)).toBe(0);
    for(const ms of [3100,3999,4000,4500,100000])expect(poseFrameAt(timing,ms,expanded)).toBe(31);
    const tail={...timing,loopStartFrame:24};
    expect(poseFrameAt(tail,4000,expanded)).toBe(24);
    expect(poseFrameAt(tail,4700,expanded)).toBe(31);
  });
  it('rejects malformed timings and out-of-grid hero metadata without out-of-bounds crops',()=>{
    expect(poseLayout({columns:3,frameCount:32,heroFrame:99})).toEqual({...expanded,heroFrame:7});
    for(const malformed of [{...timing,loopMs:0},{...timing,frameTimesMs:[0,1]},{...timing,frameTimesMs:timing.frameTimesMs.map(()=>0)}])expect(poseFrameAt(malformed,1e6,expanded)).toBe(15);
    expect(poseFrameAt(timing,NaN,expanded)).toBe(0);
  });
  it('accepts complete progressive pages and rejects broken page coverage',()=>{
    const entry={file:'hero.webp',columns:4,frameCount:32,heroFrame:15,runtimePages:Array.from({length:4},(_,i)=>({file:`hero-p${i+1}.webp`,firstFrame:i*8,frameCount:8,width:1536,height:1024}))};
    expect(posePages(entry)).toHaveLength(4);
    expect(posePages({...entry,runtimePages:[entry.runtimePages[1]]})).toEqual([{file:'hero.webp',firstFrame:0,frameCount:32,width:1536,height:4096}]);
  });
});
