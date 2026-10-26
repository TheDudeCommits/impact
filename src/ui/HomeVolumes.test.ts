import { PINNED_RELEASED } from '../../tests/rosterPin';
import { describe, expect, it, vi } from 'vitest';
import { HOME_FIGHTERS, HOME_ROSTER, HOME_PAGES, HOME_VOLUMES, homeVolumeOf, mangaHome } from './MangaHome';
import { rosterVolumes, rosterVolume, volumeWindow } from './HomeVolumes';
import { homeAnimeOptions, homeWipStamp, HOME_EXPANSION_FIGHTERS } from './HomeRosterOrder';

describe('curated roster volumes', () => {
  it('renders every released fighter once, original sixteen in Vol.1 and balanced two-row pages', () => {
    expect(HOME_VOLUMES.map(ids=>ids.length)).toEqual(Array.from({length:Math.ceil(PINNED_RELEASED/16)},(_,i)=>Math.min(16,PINNED_RELEASED-i*16)));
    expect(new Set(HOME_VOLUMES[0])).toEqual(new Set(HOME_FIGHTERS));
    expect(new Set(HOME_VOLUMES.flat())).toEqual(new Set(HOME_ROSTER));
    expect(HOME_VOLUMES.flat()).toHaveLength(HOME_ROSTER.length);
    for(const page of HOME_PAGES){
      expect(page.left.length).toBeLessThanOrEqual(8);
      expect(page.right.length).toBeLessThanOrEqual(8);
      expect(Math.abs(page.left.length-page.right.length)).toBeLessThanOrEqual(1);
    }
  });
  it('keeps the generic volume utility bounded at16',()=>{
    const roster=Array.from({length:100},(_,i)=>`fighter-${i}`);
    expect(rosterVolumes(roster).map(page=>page.length)).toEqual([16,16,16,16,16,16,4]);
    expect(rosterVolume(roster,'fighter-16')).toBe(2);
    expect(rosterVolume(roster,'fighter-99')).toBe(7);
  });
  it('shows a bounded three-tab window at both ends and the middle',()=>{
    expect(volumeWindow(1,4)).toEqual([1,2,3]);
    expect(volumeWindow(4,4)).toEqual([2,3,4]);
    expect(volumeWindow(1,2)).toEqual([1,2]);
    expect(volumeWindow(1,0)).toEqual([]);
  });
  it('starts on the selected page and defers every other preview poster',()=>{
    for(const fighter of ['naruto','madara','shinji','garou','kaiju-no-8','rengoku'] as const){
      const html=mangaHome(fighter,8);
      const pages=[...html.matchAll(/class="home-volume" id="home-volume-(\d+)"[^>]+>/g)];
      expect(pages.filter(m=>!m[0].includes(' hidden')).map(m=>Number(m[1]))).toEqual([homeVolumeOf(fighter)]);
      const posters=[...html.matchAll(/<img data-preview="([^"]+)" ([^>]+)>/g)];
      expect(posters.filter(m=>m[2].startsWith('src=')).map(m=>m[1])).toEqual([fighter]);
      expect(posters.filter(m=>m[2].startsWith('data-preview-src=')).length).toBe(HOME_ROSTER.length-1);
      for(const m of html.matchAll(/class="home-volume" id="home-volume-(\d+)"[^>]*>([\s\S]*?)(?=<div class="home-volume" |<div class="home-filtered-fighters")/g)){
        const shown=Number(m[1])===homeVolumeOf(fighter),images=[...m[2].matchAll(/<image (data-href|href)=/g)].map(x=>x[1]);
        expect(images.length,`volume ${m[1]}`).toBe(HOME_VOLUMES[Number(m[1])-1].length);
        expect(new Set(images),`volume ${m[1]}`).toEqual(new Set([shown?'href':'data-href']));
      }
    }
  });
  it('stamps precisely the released expansion ids that have not graduated and exposes the counted anime filter',()=>{
    const html=mangaHome('goku',8);
    const cards=[...html.matchAll(/<button[^>]*data-fighter="([^"]+)"[\s\S]*?<\/button>/g)];
    expect(cards.filter(m=>m[0].includes('home-wip')).map(m=>m[1]).sort()).toEqual(HOME_EXPANSION_FIGHTERS.filter(id=>HOME_ROSTER.includes(id)&&homeWipStamp(id)).sort());
    expect(cards.filter(m=>m[0].includes('home-wip')).length).toBeLessThan(HOME_EXPANSION_FIGHTERS.length);
    expect(html).toContain('data-home-anime label="Filter anime"');
    expect(html).toContain(`All anime (${PINNED_RELEASED})`);
    for(const anime of homeAnimeOptions(HOME_ROSTER))expect(html).toContain(`<option value="${anime.id}">${anime.label}</option>`);
    expect(html).toContain('class="home-filtered-fighters" hidden');
    for(const id of ['garou','kaiju-no-8','rengoku'])expect(html).toContain(`data-fighter="${id}"`);
  });
  it('keeps laboratory additions isolated and promoted cards without PREVIEW badges',async()=>{
    vi.stubEnv('MODE','fighter-lab');vi.resetModules();
    try{
      const lab=await import('./MangaHome');
      expect(lab.HOME_VOLUMES.every(page=>page.length<=16)).toBe(true);
      expect(new Set(lab.HOME_VOLUMES.flat()).size).toBe(lab.HOME_ROSTER.length);
      const stamped=HOME_EXPANSION_FIGHTERS.find(id=>homeWipStamp(id)&&lab.HOME_ROSTER.includes(id))!;expect(stamped).toBeDefined();
      const html=lab.mangaHome(stamped,8);
      const card=html.match(new RegExp(`<button[^>]*data-fighter="${stamped}"[\\s\\S]*?<\\/button>`))?.[0];
      expect(card).toContain('home-wip');expect(card).not.toContain('home-lab-badge');
      expect(lab.HOME_ROSTER.filter(id=>id===stamped)).toHaveLength(1);
    }finally{vi.unstubAllEnvs();vi.resetModules();}
  });
});
