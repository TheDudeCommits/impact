import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? (name === 'vendor' ? [] : files(path)) : /\.(ts|css|html)$/.test(name) ? [path] : []; });
const sources = [...files('src'), 'index.html', 'public/privacy.html', 'public/terms.html'].map(file => [file, readFileSync(file, 'utf8')] as const);

describe('the clip function is gone', () => {
  it('has no recorder, no dialog, no button and no stylesheet left', () => {
    expect(existsSync('src/ui/ClipRecorder.ts')).toBe(false);
    expect(existsSync('src/ui/clipRecorder.css')).toBe(false);
    const left = /ClipRecorder|clipRecorder|data-open-clip|data-record-clip|data-clip-|clip-dialog|clip-indicator|clip-status|pause-recording/;
    expect(sources.filter(([, text]) => left.test(text)).map(([file]) => file)).toEqual([]);
  });

  it('records nothing for a player: the only recorder left is the QA capture panel behind ?capture', () => {
    expect(sources.filter(([, text]) => /new MediaRecorder\(|\.captureStream\(/.test(text)).map(([file]) => file)).toEqual(['src/render/GameplayRecorder.ts']);
    expect(readFileSync('src/render/GameplayRecorder.ts', 'utf8')).toMatch(/if\(!new URLSearchParams\(location\.search\)\.has\('capture'\)\)return;/);
  });

  it('takes its row out of the in-game menu and its key off the results card', () => {
    const menu = readFileSync('src/ui/menu/GameMenu.ts', 'utf8');
    expect(menu).not.toMatch(/'clip'/);
    expect(readFileSync('src/ui/results/ResultsShell.ts', 'utf8')).toContain('/^Key([CT])$/');
    expect(readFileSync('src/ui/PauseMenu.ts', 'utf8')).not.toMatch(/RECORD CLIP|MY CLIP/);
  });

  it('is no longer spoken of on the legal and privacy page', () => {
    const page = readFileSync('public/privacy.html', 'utf8');
    expect(page).not.toMatch(/\bclips?\b/i);
    expect(page).toContain('<strong>Bug reports</strong> you make stay on your device');
  });
});
