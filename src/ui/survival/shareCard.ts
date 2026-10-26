import { bossPortrait } from './bossArt';
import type { FighterId } from '../../game/types';
import { FIGHTERS } from '../../config';
import type { RunResult } from '../../survival/SurvivalGame';
import { RANKS as STYLE_RANKS } from '../../survival/style';
import { resultFighterArt } from './resultArt';

export interface ShareCardInput {
  result: RunResult; fighter: FighterId;
  title: string; sub: string; epitaph: string;
  art: string; fallen: boolean;
  mastery?: string;
}

export const CARD_W = 1200, CARD_H = 630;
const INK = '#141414', PAPER = '#f7f4ed', RED = '#d91e36';
const GROUPED = new Intl.NumberFormat('en-US');
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const IMPACT = 'Impact, "Anton", "Arial Black", sans-serif', CONDENSED = '"Barlow Condensed", "Arial Narrow", sans-serif';

function image(src: string) {
  return new Promise<HTMLImageElement | undefined>(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img); img.onerror = () => resolve(undefined);
    img.src = src;
  });
}
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = .4) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, Math.max(0, (img.naturalHeight - sh) * focusY), sw, sh, x, y, w, h);
}
function ink(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, contrast = 1.15, bright = 1) {
  const data = ctx.getImageData(x, y, w, h), px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = ((px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114) - 128) * contrast + 128;
    px[i] = px[i + 1] = px[i + 2] = Math.max(0, Math.min(255, g * bright));
  }
  ctx.putImageData(data, x, y);
}
function skewText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -.12, 1, 0, 0);
  ctx.fillText(text, 0, 0, maxW); ctx.restore();
}

export async function drawShareCard(input: ShareCardInput): Promise<HTMLCanvasElement> {
  const {result,fighter}=input,canvas=document.createElement('canvas');canvas.width=CARD_W;canvas.height=CARD_H;
  const ctx=canvas.getContext('2d')!;
  try{await Promise.all([document.fonts.load(`800 24px ${CONDENSED}`),document.fonts.load(`900 24px ${IMPACT}`)]);}catch{ }
  const log=result.bossLog??[],shown=log.slice(0,7);
  const [art,portrait,...faces]=await Promise.all([image(input.art),image(resultFighterArt(fighter)),...shown.map(b=>image(bossPortrait(b.id)))]);
  const accent=result.victory?'#ad7410':RED,left=350;
  ctx.fillStyle=PAPER;ctx.fillRect(0,0,CARD_W,CARD_H);ctx.fillStyle=INK;ctx.fillRect(0,0,left,CARD_H);
  if(art){cover(ctx,art,0,0,left,CARD_H);ink(ctx,0,0,left,CARD_H,1.2,.42);}
  if(portrait){
    ctx.save();ctx.beginPath();ctx.rect(0,64,left,440);ctx.clip();
    cover(ctx,portrait,-70,64,left+140,520,0);
    ink(ctx,0,64,left,440,1.15);ctx.restore();
  }
  const fade=ctx.createLinearGradient(0,300,0,570);fade.addColorStop(0,'#14141400');fade.addColorStop(.7,'#141414ee');fade.addColorStop(1,INK);ctx.fillStyle=fade;ctx.fillRect(0,260,left,CARD_H-260);
  ctx.fillStyle='#fff';ctx.font=`800 16px ${CONDENSED}`;ctx.fillText('ARCADE SURVIVAL',24,35);ctx.textAlign='right';ctx.fillText(`CH. ${String(result.round).padStart(2,'0')} / ${result.rank}`,left-24,35);ctx.textAlign='left';
  ctx.strokeStyle='#ffffff55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(24,49);ctx.lineTo(left-24,49);ctx.stroke();
  ctx.fillStyle='#ddd';ctx.font=`800 17px ${CONDENSED}`;ctx.fillText('FINAL SCORE',26,493);ctx.fillStyle='#fff';ctx.font=`italic 900 73px ${IMPACT}`;ctx.fillText(GROUPED.format(Math.round(result.score)),24,571,left-48);
  ctx.fillStyle=accent;ctx.fillRect(left,0,5,CARD_H);
  const x=390,right=CARD_W-38,width=right-x;
  ctx.fillStyle=accent;ctx.font=`800 17px ${CONDENSED}`;ctx.fillText(`${FIGHTERS[fighter].name.toUpperCase()}  /  ${result.party?'CO-OP':'SOLO'} SURVIVAL`,x,49,width);
  const words=input.title.split(' '),lines:string[]=[];let line='';ctx.font=`italic 900 59px ${IMPACT}`;
  for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  const titleLines=lines.length<=2?lines:[lines[0],lines.slice(1).join(' ')];titleLines.forEach((value,i)=>{ctx.fillStyle=INK;skewText(ctx,value,x+3,116+i*59,width-10);});
  const after=titleLines.length>1?204:164;
  ctx.fillStyle=INK;ctx.font=`800 18px ${CONDENSED}`;ctx.fillText(input.sub,x,after,width);
  ctx.fillStyle='#67635f';ctx.font=`600 14px ${CONDENSED}`;ctx.fillText(input.epitaph,x,after+24,width);
  ctx.strokeStyle='#141414';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,after+44);ctx.lineTo(right,after+44);ctx.stroke();
  const style=STYLE_RANKS[Math.max(0,Math.min(STYLE_RANKS.length-1,result.bestRank))]?.letter??'D';
  const stats=[[GROUPED.format(result.ownKills??result.kills),result.party?'YOUR KOs':'KNOCKOUTS'],[style,'BEST STYLE'],[clock(result.seconds),'SURVIVED'],[String(result.bosses),'BOSSES']];
  const y=after+94;stats.forEach(([value,label],i)=>{const sx=x+i*(width/4);ctx.fillStyle=INK;ctx.font=`italic 900 43px ${IMPACT}`;ctx.fillText(value,sx,y,width/4-14);ctx.fillStyle='#62615d';ctx.font=`800 14px ${CONDENSED}`;ctx.fillText(label,sx,y+25);});
  const by=after+156;ctx.fillStyle='#666';ctx.font=`800 14px ${CONDENSED}`;ctx.fillText(log.length?'BOSSES DEFEATED':'THE NEXT CHAPTER AWAITS',x,by);
  const size=72;shown.forEach((boss,i)=>{const bx=x+i*105,top=by+14;ctx.fillStyle='#e3dfd7';ctx.fillRect(bx,top,size,size);if(faces[i]){cover(ctx,faces[i]!,bx,top,size,size,.3);ink(ctx,bx,top,size,size,1.1);}ctx.strokeStyle=boss.finished?accent:INK;ctx.lineWidth=2;ctx.strokeRect(bx,top,size,size);ctx.fillStyle=boss.finished?accent:INK;ctx.font=`800 12px ${CONDENSED}`;ctx.fillText(boss.name.toUpperCase(),bx,top+88,99);});
  if(!log.length&&art){const top=by+18,height=550-top;ctx.save();ctx.globalAlpha=.55;cover(ctx,art,x,top,width,height,.55);ctx.restore();ink(ctx,x,top,width,height,1.05);}
  if(log.length>shown.length){ctx.textAlign='right';ctx.fillStyle='#555';ctx.font=`800 14px ${CONDENSED}`;ctx.fillText(`+ ${log.length-shown.length} MORE`,right,by);ctx.textAlign='left';}
  ctx.strokeStyle='#14141433';ctx.beginPath();ctx.moveTo(x,575);ctx.lineTo(right,575);ctx.stroke();ctx.fillStyle='#555';ctx.font=`800 16px ${CONDENSED}`;ctx.fillText(input.mastery??`MAX COMBO ${result.bestCombo}  /  DAMAGE ${GROUPED.format(Math.round(result.damageDealt))}`,x,604,width-160);ctx.fillStyle=accent;ctx.textAlign='right';ctx.font=`italic 900 23px ${IMPACT}`;ctx.fillText('IMPACT',right,605,140);ctx.textAlign='left';
  ctx.lineWidth=6;ctx.strokeStyle=INK;ctx.strokeRect(3,3,CARD_W-6,CARD_H-6);return canvas;
}

export const cardBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

export async function shareFile(blob: Blob, name: string) {
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try { await nav.share({ files: [file], title: 'Arcade Survival' }); return true; } catch { return false; }
}
export function canShareFiles() {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  try { return !!nav.share && !!nav.canShare?.({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] }); } catch { return false; }
}
