import {describe,expect,it,vi} from 'vitest';
import {PoseSheetLoader,type PoseImage,type PoseLoaderIO} from '../src/ui/PoseSheetLoader';

const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const image=():PoseImage=>({source:{} as CanvasImageSource,width:4,height:4,close:vi.fn()});

describe('selected homepage page loading',()=>{
  it('aborts a slow discarded download and starts the new fighter without waiting for it',async()=>{
    const slow=deferred<Blob>(),signals=new Map<string,AbortSignal>();
    const io:PoseLoaderIO={fetchBlob:vi.fn((url,signal)=>{signals.set(url,signal);return url==='slow'?slow.promise:Promise.resolve(new Blob(['fast']));}),decode:vi.fn(async()=>image())};
    const loader=new PoseSheetLoader(io);
    const discarded=loader.load('slow',64),latest=loader.load('latest',64);
    expect(signals.get('slow')?.aborted).toBe(true);
    expect(await latest).toBeDefined();expect(io.decode).toHaveBeenCalledTimes(1);
    slow.resolve(new Blob(['obsolete']));expect(await discarded).toBeUndefined();
    expect(io.decode).toHaveBeenCalledTimes(1);loader.dispose();
  });
  it('deduplicates an in-flight page, serves cached pages immediately, and cancels obsolete work on cache hits',async()=>{
    const body=deferred<Blob>(),signals:AbortSignal[]=[];
    const io:PoseLoaderIO={fetchBlob:vi.fn((_url,signal)=>{signals.push(signal);return body.promise;}),decode:vi.fn(async()=>image())};
    const loader=new PoseSheetLoader(io),first=loader.load('a',64);
    expect(loader.load('a',64)).toBe(first);body.resolve(new Blob(['a']));const result=await first;
    const obsolete=loader.load('b',64);expect(await loader.load('a',64)).toBe(result);
    expect(signals[1].aborted).toBe(true);await obsolete;
    expect(io.decode).toHaveBeenCalledTimes(1);loader.dispose();
  });
  it('counts retained plus pending decoded bytes and closes abandoned decodes before starting their replacement',async()=>{
    const decodes:{result:ReturnType<typeof deferred<PoseImage>>;image:PoseImage}[]=[];
    const io:PoseLoaderIO={fetchBlob:async()=>new Blob(['x']),decode:()=>{const next={result:deferred<PoseImage>(),image:image()};decodes.push(next);return next.result.promise;}};
    const loader=new PoseSheetLoader(io,{decodedBytes:128,encodedBytes:16,decodedEntries:2});
    const a=loader.load('a',64);await flush();decodes[0].result.resolve(decodes[0].image);await a;
    const b=loader.load('b',64);await flush();expect(loader.stats.decodedBytes+loader.stats.reservedBytes).toBe(128);
    const c=loader.load('c',64);await flush();expect(decodes).toHaveLength(2);
    decodes[1].result.resolve(decodes[1].image);expect(await b).toBeUndefined();await flush();
    expect(decodes[1].image.close).toHaveBeenCalledTimes(1);expect(decodes).toHaveLength(3);
    expect(loader.stats.decodedBytes+loader.stats.reservedBytes).toBe(128);
    decodes[2].result.resolve(decodes[2].image);await c;
    expect(loader.stats.decodedBytes).toBe(128);loader.dispose();
    expect(decodes[0].image.close).toHaveBeenCalledTimes(1);expect(decodes[2].image.close).toHaveBeenCalledTimes(1);
  });
  it('reuses bounded encoded bytes after decoded eviction and releases all resources on dispose',async()=>{
    const io:PoseLoaderIO={fetchBlob:vi.fn(async()=>new Blob(['1234'])),decode:vi.fn(async()=>image())};
    const loader=new PoseSheetLoader(io,{decodedBytes:64,encodedBytes:8,decodedEntries:1});
    const a=await loader.load('a',64);await loader.load('b',64);expect(a!.close).toHaveBeenCalledTimes(1);
    await loader.load('a',64);expect(io.fetchBlob).toHaveBeenCalledTimes(2);expect(io.decode).toHaveBeenCalledTimes(3);
    await loader.load('c',64);expect(loader.stats.encodedBytes).toBe(8);expect(loader.stats.decodedBytes).toBe(64);
    loader.releaseDecoded();expect(loader.stats.decodedBytes).toBe(0);expect(loader.stats.encodedBytes).toBe(8);
    loader.dispose();expect(loader.stats.encodedBytes).toBe(0);expect(await loader.load('d',64)).toBeUndefined();
  });
  it('recovers after download/decode failures and rejects oversized allocations before decoding',async()=>{
    let calls=0;
    const io:PoseLoaderIO={fetchBlob:async()=>{if(++calls===1)throw new Error('offline');return new Blob(['x']);},decode:vi.fn(async()=>image())};
    const loader=new PoseSheetLoader(io,{decodedBytes:64,encodedBytes:8,decodedEntries:1});
    await expect(loader.load('offline',64)).rejects.toThrow('offline');
    await expect(loader.load('too-large',65)).rejects.toThrow('budget');expect(io.decode).not.toHaveBeenCalled();
    expect(await loader.load('valid',64)).toBeDefined();loader.dispose();
  });
  it('closes an uninterruptible decode if the homepage is disposed before it completes',async()=>{
    const pending=deferred<PoseImage>(),decoded=image();
    const loader=new PoseSheetLoader({fetchBlob:async()=>new Blob(['x']),decode:()=>pending.promise});
    const loading=loader.load('a',64);await flush();loader.dispose();pending.resolve(decoded);
    expect(await loading).toBeUndefined();expect(decoded.close).toHaveBeenCalledTimes(1);expect(loader.stats.decodedBytes).toBe(0);
  });
});
