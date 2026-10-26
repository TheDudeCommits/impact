import {afterEach,describe,expect,it,vi} from 'vitest';
import {HomePreview,posePages,poseTiming,timedPoseFrame} from '../src/ui/HomePreview';
import {PoseSheetLoader} from '../src/ui/PoseSheetLoader';
import manifest from '../public/assets/home/sprites/manifest.json';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
function fixture(reduced=false,stallSecond=false,secondFailures=0,stalledPage=1){
  let now=0,nextRequest=0;const callbacks=new Map<number,FrameRequestCallback>();
  const drawing=vi.fn(),poster={style:{}},rect={width:384,height:512};
  const canvas={hidden:true,width:0,height:0,className:'',setAttribute(){},dataset:{} as Record<string,string>,getContext:()=>({clearRect(){},drawImage:drawing})};
  const media=Object.assign(new EventTarget(),{matches:reduced});
  const doc=Object.assign(new EventTarget(),{hidden:false,createElement:()=>canvas});
  const win=new EventTarget(),rectRead=vi.fn(()=>rect);
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  vi.stubGlobal('matchMedia',()=>media);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.stubGlobal('devicePixelRatio',1);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callbacks.set(++nextRequest,callback);return nextRequest;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>callbacks.delete(id));
  const entry=manifest.fighters.find(f=>f.id==='deku')!,pages=posePages(entry);
  const timing=poseTiming(entry)!;
  const pageMap=new Map(manifest.fighters.flatMap(fighter=>posePages(fighter).map(page=>[page.file,page] as const)));
  const signals=new Map<string,AbortSignal>();
  let resume!:()=>void;
  const fetchBlob=vi.fn((url:string,signal:AbortSignal)=>{
    const file=url.split('/').pop()!.split('?')[0];
    signals.set(file,signal);
    if(file===pages[1]?.file&&secondFailures>0){secondFailures--;return Promise.reject(new Error('temporary network failure'));}
    if(stallSecond&&file===pages[stalledPage]?.file)return new Promise<Blob>((resolve,reject)=>{
      resume=()=>resolve(new Blob([file]));signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));
    });
    return Promise.resolve(new Blob([file]));
  });
  const loader=new PoseSheetLoader({fetchBlob,decode:async blob=>{
    const page=pageMap.get(await blob.text())!;
    return {source:{} as CanvasImageSource,width:page.width,height:page.height,close:vi.fn()};
  }});
  const figure={append(){},dataset:{},classList:{remove(){},add(){}},querySelector:(selector:string)=>selector.includes(':not')?{dataset:{preview:'deku'}}:poster,querySelectorAll:()=>[],getBoundingClientRect:rectRead};
  const preview=new HomePreview(figure as unknown as HTMLElement,loader);
  const advance=(time:number)=>{now=time;const [id,callback]=callbacks.entries().next().value??[];if(callback&&id!==undefined){callbacks.delete(id);callback(time);}};
  return {preview,loader,canvas,drawing,media,doc,win,callbacks,fetchBlob,rectRead,pages,entry,timing,signals,advance,resume:()=>resume()};
}

describe('homepage runtime lifecycle',()=>{
  it('paints the first cel immediately and sequentially warms every current-fighter page without waiting for playback',async()=>{
    const f=fixture();await flush();
    expect(f.canvas.dataset.frame).toBe('0');expect(f.canvas.hidden).toBe(false);
    expect(f.fetchBlob.mock.calls.map(([url])=>url.split('/').pop()!.split('?')[0])).toEqual(f.pages.map(page=>page.file));
    expect(f.loader.stats.decodedBytes).toBe(f.pages.reduce((bytes,page)=>bytes+page.width*page.height*4,0));
    expect(f.loader.stats.decodedBytes).toBeLessThanOrEqual(48*1024*1024);
    const calls=f.fetchBlob.mock.calls.length;
    for(const time of [...f.timing.frameTimesMs,f.timing.loopMs,f.timing.loopMs+100])f.advance(time+1);
    expect(f.fetchBlob).toHaveBeenCalledTimes(calls);f.preview.dispose();
  });
  it('does not cancel a farther lookahead download when an earlier cached page redraws',async()=>{
    const f=fixture(false,true,0,2);await flush();
    expect(f.canvas.dataset.frame).toBe('0');expect(f.fetchBlob).toHaveBeenCalledTimes(3);
    f.advance(f.timing.frameTimesMs[3]+1);f.advance(f.timing.frameTimesMs[8]+1);
    expect(f.signals.get(f.pages[2].file)?.aborted).toBe(false);expect(f.fetchBlob).toHaveBeenCalledTimes(3);
    f.resume();await flush();expect(f.fetchBlob).toHaveBeenCalledTimes(4);
    expect(f.signals.get(f.pages[2].file)?.aborted).toBe(false);f.preview.dispose();
  });
  it('continues warming after a speculative failure without freezing playback before that page is needed',async()=>{
    vi.useFakeTimers();const f=fixture(false,false,1);await flush();
    expect(f.fetchBlob.mock.calls.map(([url])=>url.split('/').pop()!.split('?')[0])).toEqual(f.pages.map(page=>page.file));
    expect(f.canvas.dataset.frame).toBe('0');expect(f.callbacks.size).toBe(1);expect(vi.getTimerCount()).toBe(0);
    f.advance(f.timing.frameTimesMs[4]+1);expect(f.canvas.dataset.frame).toBe('4');
    f.advance(f.timing.frameTimesMs[8]+1);expect(f.callbacks.size).toBe(0);expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(350);await flush();expect(f.canvas.dataset.frame).toBe('8');
    expect(f.fetchBlob).toHaveBeenCalledTimes(f.pages.length+1);f.preview.dispose();
  });
  it('lets a required closer-page retry preempt a stalled farther speculative download',async()=>{
    vi.useFakeTimers();const f=fixture(false,true,1,2);await flush();
    const farther=f.signals.get(f.pages[2].file)!;expect(farther.aborted).toBe(false);
    f.advance(f.timing.frameTimesMs[7]+1);f.advance(f.timing.frameTimesMs[8]+1);
    await vi.advanceTimersByTimeAsync(350);await flush();
    expect(farther.aborted).toBe(true);expect(f.canvas.dataset.frame).toBe('8');
    expect(f.fetchBlob.mock.calls.filter(([url])=>url.includes(f.pages[1].file))).toHaveLength(2);
    f.resume();await flush();
    expect(f.fetchBlob.mock.calls.some(([url])=>url.includes(f.pages[3].file))).toBe(true);f.preview.dispose();
  });
  it('cancels speculative warming on visibility loss and cannot continue its old chain afterward',async()=>{
    const f=fixture(false,true,0,2);await flush();expect(f.fetchBlob).toHaveBeenCalledTimes(3);
    f.preview.setVisible(false);expect(f.signals.get(f.pages[2].file)?.aborted).toBe(true);
    f.resume();await flush();expect(f.fetchBlob).toHaveBeenCalledTimes(3);expect(f.loader.stats.decodedBytes).toBe(0);
    expect(f.callbacks.size).toBe(0);f.preview.dispose();
  });
  it('gives a newly selected fighter priority and never continues the discarded fighter warming chain',async()=>{
    const f=fixture(false,true,0,2);await flush();expect(f.fetchBlob).toHaveBeenCalledTimes(3);
    await f.preview.select('naruto');await flush();
    expect(f.signals.get(f.pages[2].file)?.aborted).toBe(true);expect(f.canvas.dataset.previewFighter).toBe('naruto');
    f.resume();await flush();
    expect(f.fetchBlob.mock.calls.filter(([url])=>url.includes('/deku-'))).toHaveLength(3);
    expect(f.fetchBlob.mock.calls.some(([url])=>url.includes(f.pages[3].file))).toBe(false);
    f.preview.dispose();
  });
  it('avoids atlas fetch/decode for reduced motion or disabled animation and releases decoded pages when leaving the homepage',async()=>{
    const f=fixture(true);await flush();expect(f.fetchBlob).not.toHaveBeenCalled();expect(f.callbacks.size).toBe(0);
    f.preview.setEnabled(false);f.media.matches=false;f.media.dispatchEvent(new Event('change'));await flush();expect(f.fetchBlob).not.toHaveBeenCalled();
    f.preview.setEnabled(true);await flush();expect(f.drawing).toHaveBeenCalled();expect(f.callbacks.size).toBe(1);
    f.preview.setPaused(true);expect(f.callbacks.size).toBe(0);
    const count=f.drawing.mock.calls.length;f.advance(1000);expect(f.drawing).toHaveBeenCalledTimes(count);
    f.preview.setPaused(false);expect(f.callbacks.size).toBe(1);
    f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));expect(f.callbacks.size).toBe(0);
    f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));expect(f.callbacks.size).toBe(1);
    f.preview.setVisible(false);expect(f.callbacks.size).toBe(0);expect(f.loader.stats.decodedBytes).toBe(0);expect(f.canvas.width).toBe(0);
    f.preview.dispose();expect(f.loader.stats.encodedBytes).toBe(0);
  });
  it('does not rewind the animation for a late or replayed voice, and does not reread layout every cel',async()=>{
    const f=fixture();await flush();const timing=f.timing;
    const time=timing.frameTimesMs[5]+1;f.advance(time);const before=f.canvas.dataset.frame;
    const reads=f.rectRead.mock.calls.length;
    const audio={currentTime:0,paused:false};
    f.win.dispatchEvent(new CustomEvent('home-voice-playing',{detail:{fighter:'deku',audio}}));
    expect(f.canvas.dataset.frame).toBe(before);
    audio.currentTime=.1;f.advance(time+100);
    expect(Number(f.canvas.dataset.frame)).toBeGreaterThanOrEqual(Number(before));
    audio.currentTime=0;f.win.dispatchEvent(new CustomEvent('home-voice-playing',{detail:{fighter:'deku',audio}}));
    expect(Number(f.canvas.dataset.frame)).toBeGreaterThanOrEqual(Number(before));
    expect(f.rectRead).toHaveBeenCalledTimes(reads);f.preview.dispose();
  });
  it('holds at a missing page and resumes its first waiting cel instead of skipping the missing movement',async()=>{
    const f=fixture(false,true);await flush();expect(f.pages.length).toBeGreaterThan(1);
    const timing=f.timing,boundary=f.pages[1].firstFrame;
    f.advance(timing.frameTimesMs[boundary-1]+1);expect(Number(f.canvas.dataset.frame)).toBe(boundary-1);
    const waiting=timing.frameTimesMs[boundary]+1;
    f.advance(waiting);expect(Number(f.canvas.dataset.frame)).toBe(boundary-1);
    f.advance(waiting+1500);expect(Number(f.canvas.dataset.frame)).toBe(boundary-1);
    f.resume();await flush();expect(Number(f.canvas.dataset.frame)).toBe(boundary);
    f.advance(waiting+1550);expect(Number(f.canvas.dataset.frame)).toBe(timedPoseFrame('deku',waiting+50));
    f.preview.dispose();
  });
  it('completes the first action once during a long line, holds through pause, then resumes at the loop start',async()=>{
    const f=fixture();await flush();const {timing}=f;
    const audio={currentTime:0,paused:false,ended:false};
    f.win.dispatchEvent(new CustomEvent('home-voice-playing',{detail:{fighter:'deku',audio}}));
    for(const start of timing.frameTimesMs){audio.currentTime=(start+1)/1000;f.advance(start+1);await flush();}
    audio.currentTime=(timing.loopMs+1)/1000;f.advance(timing.loopMs+1);
    expect(Number(f.canvas.dataset.frame)).toBe(timing.frameTimesMs.length-1);
    f.preview.setPaused(true);audio.currentTime=(timing.loopMs*2)/1000;f.advance(timing.loopMs*2);
    f.preview.setPaused(false);expect(Number(f.canvas.dataset.frame)).toBe(timing.frameTimesMs.length-1);
    audio.currentTime=(timing.loopMs*3+500)/1000;f.advance(timing.loopMs*3+500);
    expect(Number(f.canvas.dataset.frame)).toBe(timing.frameTimesMs.length-1);
    audio.paused=true;audio.ended=true;f.advance(timing.loopMs*3+516);
    expect(Number(f.canvas.dataset.frame)).toBe(timedPoseFrame('deku',timing.loopMs));
    f.advance(timing.loopMs*3+616);
    expect(Number(f.canvas.dataset.frame)).toBe(timedPoseFrame('deku',timing.loopMs+100));f.preview.dispose();
  });
  it('does not retroactively hold or rewind when a voice first starts after the initial action',async()=>{
    const f=fixture();await flush();const {timing}=f;
    for(const start of timing.frameTimesMs){f.advance(start+1);await flush();}
    const time=timing.loopMs+timing.frameTimesMs[2]+1;f.advance(time);
    const before=f.canvas.dataset.frame,audio={currentTime:0,paused:false,ended:false};
    f.win.dispatchEvent(new CustomEvent('home-voice-playing',{detail:{fighter:'deku',audio}}));
    expect(f.canvas.dataset.frame).toBe(before);
    const later=timing.loopMs*2+timing.frameTimesMs[2]+1;audio.currentTime=(later-time)/1000;f.advance(later);
    expect(Number(f.canvas.dataset.frame)).toBe(timedPoseFrame('deku',later));
    audio.paused=true;audio.ended=true;f.advance(later+100);
    expect(Number(f.canvas.dataset.frame)).toBe(timedPoseFrame('deku',later+100));f.preview.dispose();
  });
  it('bounds retries at a failed page boundary and permits same-fighter retry after the cap',async()=>{
    vi.useFakeTimers();const f=fixture(false,false,3);await flush();
    const boundary=f.pages[1].firstFrame,time=f.timing.frameTimesMs[boundary]+1;
    f.advance(f.timing.frameTimesMs[boundary-1]+1);f.advance(time);
    expect(Number(f.canvas.dataset.frame)).toBe(boundary-1);expect(f.callbacks.size).toBe(0);
    await vi.advanceTimersByTimeAsync(350);await flush();
    await vi.advanceTimersByTimeAsync(1000);await flush();
    const pageRequests=()=>f.fetchBlob.mock.calls.filter(([url])=>url.includes(f.pages[1].file));
    expect(pageRequests()).toHaveLength(3);expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10000);expect(pageRequests()).toHaveLength(3);
    await f.preview.select('deku');await flush();
    expect(pageRequests()).toHaveLength(4);expect(Number(f.canvas.dataset.frame)).toBe(boundary);expect(f.callbacks.size).toBe(1);
    f.preview.dispose();expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels a failed-page retry when the preview is disposed',async()=>{
    vi.useFakeTimers();const f=fixture(false,false,Infinity);await flush();
    f.advance(f.timing.frameTimesMs[f.pages[1].firstFrame]+1);expect(vi.getTimerCount()).toBe(1);
    const requests=f.fetchBlob.mock.calls.length;f.preview.dispose();expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);expect(f.fetchBlob).toHaveBeenCalledTimes(requests);
  });
});
