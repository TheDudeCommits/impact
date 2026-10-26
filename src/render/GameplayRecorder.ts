export function installGameplayRecorder(canvas:HTMLCanvasElement,exercise?:()=>Promise<void>,audioSource?:()=>{stream:MediaStream;dispose:()=>void},motionSource?:()=>unknown){
  if(!new URLSearchParams(location.search).has('capture'))return;
  const panel=document.createElement('div');panel.setAttribute('aria-label','Gameplay capture');
  Object.assign(panel.style,{position:'fixed',right:'16px',top:'135px',zIndex:'90',display:'flex',gap:'8px',padding:'8px',background:'#10212bee',color:'white',font:'12px sans-serif'});
  const button=document.createElement('button');button.textContent='Record gameplay';button.type='button';
  const exerciseButton=document.createElement('button');exerciseButton.textContent='Record combat exercise';exerciseButton.type='button';
  const status=document.createElement('span');status.textContent=audioSource?'Soundtrack + SFX + voices · no HUD':'Canvas only · no HUD or audio';
  panel.append(button);if(exercise)panel.append(exerciseButton);panel.append(status);document.body.append(panel);
  let recorder:MediaRecorder|undefined,stream:MediaStream|undefined,url:string|undefined;
  let motionUrl:string|undefined,motionFrame=0;
  let audioCapture:ReturnType<NonNullable<typeof audioSource>>|undefined;
  const releaseStreams=()=>{cancelAnimationFrame(motionFrame);stream?.getTracks().forEach(track=>track.stop());audioCapture?.dispose();audioCapture=undefined;};
  const stop=()=>{if(recorder?.state==='recording'){recorder.stop();button.disabled=true;}};
  const start=()=>{
    try{
      if(url){URL.revokeObjectURL(url);url=undefined;}if(motionUrl){URL.revokeObjectURL(motionUrl);motionUrl=undefined;}panel.querySelectorAll('a').forEach(a=>a.remove());
      stream=canvas.captureStream(60);audioCapture=audioSource?.();audioCapture?.stream.getAudioTracks().forEach(track=>stream!.addTrack(track));const chunks:BlobPart[]=[];
      const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10_000_000});
      const motion:unknown[]=[];const startTime=performance.now();const sample=()=>{if(recorder?.state!=='recording')return;motion.push({time:(performance.now()-startTime)/1000,pose:motionSource?.()});motionFrame=requestAnimationFrame(sample);};
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=()=>{
        releaseStreams();panel.style.display='flex';exerciseButton.disabled=false;
        const blob=new Blob(chunks,{type:recorder!.mimeType});url=URL.createObjectURL(blob);
        const link=document.createElement('a');link.href=url;link.download=`rift-motion-${Date.now()}.webm`;link.textContent='Save gameplay capture';link.style.color='#b7edff';panel.append(link);
        if(motionSource){motionUrl=URL.createObjectURL(new Blob([JSON.stringify(motion)],{type:'application/json'}));const metadata=document.createElement('a');metadata.href=motionUrl;metadata.download=link.download.replace('.webm','.json');metadata.textContent='Save motion data';metadata.style.color='#b7edff';panel.append(metadata);}
        status.textContent=`${(blob.size/1e6).toFixed(1)} MB · ${audioSource?'game audio · no HUD':'canvas only'}`;button.textContent='Record gameplay';button.disabled=false;
      };
      recorder.start(1000);motionFrame=requestAnimationFrame(sample);button.textContent='Stop recording';status.textContent='RECORDING';return true;
    }catch(error){status.textContent=error instanceof Error?error.message:String(error);releaseStreams();return false;}
  };
  button.onclick=()=>{if(recorder?.state==='recording')stop();else start();};
  exerciseButton.onclick=()=>{if(!exercise||!start())return;panel.style.display='none';exerciseButton.disabled=true;void exercise().catch(error=>console.error(error)).finally(stop);};
  window.addEventListener('keydown',e=>{if(e.code==='F8')stop();});
  window.addEventListener('pagehide',()=>{stop();releaseStreams();if(url)URL.revokeObjectURL(url);if(motionUrl)URL.revokeObjectURL(motionUrl);});
}
