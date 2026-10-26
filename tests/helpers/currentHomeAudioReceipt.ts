import assert from 'node:assert/strict';
import home from '../../public/assets/audio/home/manifest.json';

type HomeReceipt = {
  fighter: string; file: string; runtimeSha256: string; sourceUrl?: string;
  sourceSha256?: string; sourceTitle?: string; sourceType?: string;
  windows?: {start:number;duration:number}[]; durationSeconds?: number;
};

export function currentHomeAudioHash(file: string, historicalHash: string, rows: readonly HomeReceipt[] = home.assets): string {
  const match = /^\/assets\/audio\/home\/([a-z0-9]+(?:-[a-z0-9]+)*)\.m4a$/.exec(file);
  if (!match) return historicalHash;
  const matches = rows.filter(row => row.file === file && row.fighter === match[1]);
  assert.equal(matches.length, 1, `${file}: missing or ambiguous current home receipt`);
  const row = matches[0];
  assert.match(row.runtimeSha256, /^[a-f0-9]{64}$/, `${file}: invalid current hash`);
  assert.match(row.sourceUrl ?? '', /^https:\/\//, `${file}: missing source URL`);
  assert.match(row.sourceSha256 ?? '', /^[a-f0-9]{64}$/, `${file}: missing source hash`);
  assert.ok(row.sourceTitle && row.sourceType, `${file}: missing source identity`);
  assert.ok(row.windows?.length && row.windows.every(w => Number.isFinite(w.start) && w.start >= 0 && Number.isFinite(w.duration) && w.duration > 0), `${file}: invalid source windows`);
  assert.ok(Number.isFinite(row.durationSeconds) && row.durationSeconds! > 0, `${file}: invalid duration`);
  return row.runtimeSha256;
}
