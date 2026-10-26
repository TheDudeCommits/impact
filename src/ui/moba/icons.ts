const paths:Record<string,string>={
  blade:'M7 27 27 5 23 20 14 27M6 21l7 7M5 28l4-4',
  ward:'M16 3 27 8v9c0 6-6 10-11 13C11 27 5 23 5 17V8ZM16 9v14M11 16h10',
  spirit:'M16 3c2 8 9 9 9 16a9 9 0 0 1-18 0c0-6 5-9 6-12-1 8 3 9 3 12 4-5 3-9 0-16Z',
  wind:'M4 11h16c8 0 8-9 2-8M4 17h21c8 0 6 12 0 9M4 23h10',
  tower:'M7 29V12h18v17M5 12V4h5v4h4V4h4v4h4V4h5v8ZM13 29v-8h6v8',
  core:'m16 3 11 12-11 14L5 15ZM5 15h22M16 3v26',
  recall:'M8 11a11 11 0 1 1-2 13M3 5v9h9M12 20l4-9 4 9M13 18h6',
  shop:'M5 13h22v16H5ZM3 13 7 4h18l4 9M3 13c0 5 6 5 7 0 0 5 6 5 6 0 0 5 6 5 6 0 1 5 7 5 7 0M13 29v-9h7v9',
  ping:'M16 5v13M16 24h.01M16 2 31 29H1Z',
  coin:'M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26ZM16 8v16M21 11h-7c-5 0-5 5 0 5h4c5 0 5 5 0 5h-7',
  skull:'M10 25v4h12v-4c6-3 8-7 7-12C28 1 4 1 3 13c-1 5 1 9 7 12ZM9 13v4h4v-4ZM19 13v4h4v-4ZM15 22h2',
};
export function riftIcon(name:string){return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]??paths.core}"/></svg>`;}
export const escapeRift=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const riftClock=(seconds:number)=>{const n=Math.floor(Math.max(0,seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
