import { CharacterMusic } from '../audio/CharacterMusic';

export const NOW_PLAYING_MS = 10000;

export class MusicPanel {
  readonly music: CharacterMusic;
  onClose = () => {};
  private shell = document.createElement('section');
  private shownFor = '';
  private playing = false;
  private hideTimer = 0;
  constructor(parent: HTMLElement) {
    this.shell.className = 'music-caption hidden';
    this.shell.setAttribute('aria-label', 'Soundtrack');
    this.shell.innerHTML = '<div data-player hidden></div><i class="mc-flash" aria-hidden="true"></i><span class="mc-kanji" aria-hidden="true">音</span><span class="mc-disc" aria-hidden="true"><i></i></span><span class="mc-text"><small><b>NOW PLAYING</b><span class="mc-eq"><i></i><i></i><i></i><i></i></span></small><span data-title>Soundtrack</span></span><span class="music-caption-controls"><button type="button" data-play aria-label="Play soundtrack">▷</button><button type="button" data-next aria-label="Next soundtrack">›</button><button type="button" data-close aria-label="Turn music off">×</button></span><span class="sr-only" data-status role="status"></span>';
    parent.append(this.shell);
    this.music = new CharacterMusic(this.shell.querySelector<HTMLElement>('[data-player]')!);
    this.shell.querySelector<HTMLButtonElement>('[data-next]')!.onclick = () => this.music.next();
    this.shell.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => { if(this.music.getStatus().state==='playing')this.music.pause(true);else void this.music.setEnabled(true); };
    this.shell.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.onClose();
    this.music.onStatus = status => {
      this.shell.querySelector('[data-title]')!.textContent = status.track?.title ?? 'Soundtrack';
      const play=this.shell.querySelector<HTMLButtonElement>('[data-play]')!;
      play.textContent=status.state==='playing'?'♫':'▷';play.setAttribute('aria-label',status.state==='playing'?'Pause soundtrack':'Play soundtrack');
      this.shell.title=status.track?`${status.track.artist} — ${status.track.title}`:status.message;
      this.shell.classList.toggle('needs-play',['paused','ready','unavailable'].includes(status.state));
      this.shell.querySelector('[data-status]')!.textContent=status.message;
      const song=status.track?`${status.track.artist}|${status.track.title}`:'',now=status.state==='playing';
      if(now&&(!this.playing||song!==this.shownFor))this.flash();
      this.playing=now;if(now)this.shownFor=song;
    };
  }
  setEnabled(enabled: boolean) { this.shell.classList.toggle('hidden', !enabled); void this.music.setEnabled(enabled); }
  private flash() {
    window.clearTimeout(this.hideTimer);
    this.shell.classList.remove('mc-on'); void this.shell.offsetWidth; this.shell.classList.add('mc-on');
    this.hideTimer = window.setTimeout(() => this.shell.classList.remove('mc-on'), NOW_PLAYING_MS);
  }
  dispose() { window.clearTimeout(this.hideTimer); this.music.dispose(); this.shell.remove(); }
}
