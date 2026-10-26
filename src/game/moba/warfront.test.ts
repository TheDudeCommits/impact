import {expect,it} from 'vitest';
import {warfrontAt,waveComposition} from './warfront';
it('escalates composition at exact match-time boundaries and preserves lane breach advantage',()=>{
 expect(warfrontAt(119.99).tier).toBe(0);expect(warfrontAt(120).tier).toBe(1);
 expect(waveComposition(0,1,false)).toEqual(['melee','melee','melee','ranged']);
 expect(waveComposition(0,3,false)).toContain('siege');
 expect(waveComposition(300,11,false)).toHaveLength(8);
 const late=waveComposition(480,17,false);expect(late).toHaveLength(9);expect(late.filter(k=>k==='siege')).toHaveLength(2);expect(late[0]).toBe('super');
 expect(waveComposition(480,17,true).filter(k=>k==='super')).toHaveLength(5);
});
