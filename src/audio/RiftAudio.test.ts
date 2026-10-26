import {describe,it,expect,vi} from 'vitest';
import {RiftAudio} from './RiftAudio';
import type {RiftEvent,RiftSnapshot} from '../game/moba/model';
const event=(id:number,kind:RiftEvent['kind'],over:Partial<RiftEvent>={}):RiftEvent=>({id,kind,at:10,x:0,z:0,actorId:'me',...over});
const snapshot=(events:RiftEvent[],time=10,round=1)=>({serverTime:time,players:[{id:'me',team:'heroes',x:2,y:0,z:3}],rift:{structures:[{id:'ward',kind:'tower'}],phase:'active',code:'123456',round,events}} as RiftSnapshot);
describe('Rift objective sound feedback',()=>{
  it('plays earned progress once and keeps other players purchases silent',()=>{
    const cue=vi.fn(),audio=new RiftAudio({cue}),s=snapshot([event(1,'purchase'),event(2,'purchase',{actorId:'other'})]);
    audio.update(s,'me');audio.update(s,'me');expect(cue).toHaveBeenCalledTimes(1);expect(cue.mock.calls[0].slice(0,2)).toEqual(['energy-tail',{x:2,y:1,z:3}]);
  });
  it('ignores stale/hidden events and bounds a burst to two accents',()=>{
    const cue=vi.fn(),audio=new RiftAudio({cue});audio.update(snapshot([event(1,'tower',{hidden:true}),event(2,'boss',{at:5}),event(3,'level'),event(4,'purchase'),event(5,'core')]),'me');expect(cue).toHaveBeenCalledTimes(2);
    audio.update(snapshot([event(5,'core')]),'me');expect(cue).toHaveBeenCalledTimes(2);
  });
  it('rate limits tower danger and never sounds an unrelated target',()=>{
    const cue=vi.fn(),audio=new RiftAudio({cue});audio.update(snapshot([event(1,'bolt',{targetId:'other',actorId:'ward'}),event(2,'bolt',{targetId:'me',actorId:'ward'}),event(3,'bolt',{targetId:'me',actorId:'ward'})]),'me');
    audio.update(snapshot([event(4,'bolt',{targetId:'me',actorId:'ward',at:10.5})],10.5),'me');expect(cue).toHaveBeenCalledTimes(1);
    audio.update(snapshot([event(5,'bolt',{targetId:'me',actorId:'ward',at:11.1})],11.1),'me');expect(cue).toHaveBeenCalledTimes(2);
  });
  it('resets event identity for the next war and explicit Home cleanup',()=>{
    const cue=vi.fn(),audio=new RiftAudio({cue});audio.update(snapshot([event(9,'level')]),'me');audio.update(snapshot([event(1,'level')],10,2),'me');audio.reset();audio.update(snapshot([event(1,'recall')],10,2),'me');expect(cue).toHaveBeenCalledTimes(3);
  });
});

it('accents an escalation once, without replaying it on late join or repeated snapshots',()=>{
 const cue=vi.fn(),audio=new RiftAudio({cue}),s=snapshot([],100);s.rift.startedAt=0;audio.update(s,'me');expect(cue).not.toHaveBeenCalled();s.serverTime=121;audio.update(s,'me');audio.update(s,'me');expect(cue).toHaveBeenCalledTimes(1);audio.reset();s.serverTime=500;audio.update(s,'me');expect(cue).toHaveBeenCalledTimes(1);
});
