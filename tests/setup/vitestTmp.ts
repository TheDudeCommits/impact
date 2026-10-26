import { readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STALE_MS = 60 * 60 * 1000;

function pruneStale() {
  const root = tmpdir();
  let names: string[] = [];
  try { names = readdirSync(root); } catch { return; }
  for (const name of names) {
    if (!/^[A-Za-z0-9_-]{21}$/.test(name)) continue;
    const dir = join(root, name);
    try {
      const kids = readdirSync(dir);
      if (kids.length !== 1 || kids[0] !== 'ssr' || Date.now() - statSync(dir).mtimeMs < STALE_MS) continue;
      rmSync(dir, { recursive: true, force: true });
    } catch { }
  }
}

export default function setup(project: { vitest?: { _tmpDir?: string } }) {
  pruneStale();
  return () => {
    const own = project.vitest?._tmpDir;
    if (own && own.startsWith(tmpdir())) rmSync(own, { recursive: true, force: true });
  };
}
