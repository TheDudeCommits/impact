import {afterEach,describe,expect,it,vi} from 'vitest';
import {ObservedSize} from '../src/ui/ObservedSize';

afterEach(()=>vi.unstubAllGlobals());

describe('HUD layout measurements',()=>{
  it('tracks resize, hide and re-entry without reading layout during a frame',()=>{
    let deliver:ResizeObserverCallback;
    const observe=vi.fn(),disconnect=vi.fn();
    vi.stubGlobal('ResizeObserver',class {
      constructor(callback:ResizeObserverCallback){deliver=callback;}
      observe=observe;disconnect=disconnect;
    });
    const element={get clientWidth(){throw new Error('forced layout');},get clientHeight(){throw new Error('forced layout');}} as unknown as Element;
    const size=new ObservedSize(element);
    expect(observe).toHaveBeenCalledWith(element);
    expect([size.width,size.height]).toEqual([0,0]);
    const resize=(width:number,height:number,target=element)=>deliver!([{target,contentRect:{width,height}} as ResizeObserverEntry],{} as ResizeObserver);
    resize(1470,956);expect([size.width,size.height]).toEqual([1470,956]);
    resize(20,30,{} as Element);expect([size.width,size.height]).toEqual([1470,956]);
    resize(0,0);expect([size.width,size.height]).toEqual([0,0]);
    resize(390,844);expect([size.width,size.height]).toEqual([390,844]);
    size.dispose();expect(disconnect).toHaveBeenCalledOnce();
  });
});
