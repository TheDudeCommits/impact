const LIST = '/asset-versions.json';
const native = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined;
let versions: Record<string, string> | null = null;
let reading: Promise<void> | null = null;
let readAt = -Infinity;

function read() {
  if (!native) return Promise.resolve();
  readAt = performance.now();
  return reading ??= native(LIST)
    .then(r => r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : null)
    .then((list: { files?: Record<string, string> } | null) => { if (list?.files) versions = list.files; })
    .catch(() => {})
    .finally(() => { reading = null; });
}

export function refreshAssetVersions() {
  if (performance.now() - readAt > 60_000) void read();
}

export function versioned(url: string): string {
  if (!versions || typeof location === 'undefined') return url;
  let u: URL; try { u = new URL(url, location.href); } catch { return url; }
  if (u.origin !== location.origin || u.search || !u.pathname.startsWith('/assets/')) return url;
  let file: string; try { file = decodeURIComponent(u.pathname.slice(1)); } catch { return url; }
  const v = versions[file]; if (!v) return url;
  return `${/^[a-z][a-z0-9+.-]*:/i.test(url) ? u.origin : ''}${u.pathname}?v=${v}${u.hash}`;
}

function isAsset(url: string) {
  try { const u = new URL(url, location.href); return u.origin === location.origin && !u.search && u.pathname.startsWith('/assets/'); } catch { return false; }
}

if (native && typeof location !== 'undefined') {
  void read();
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET' || !isAsset(url)) return native(input, init);
    const go = () => {
      const next = versioned(url); if (next === url) return native(input, init);
      return native(input instanceof Request ? new Request(next, input) : next, init);
    };
    const waiting = reading;
    return waiting ? Promise.race([waiting, new Promise(done => setTimeout(done, 1500))]).then(go) : go();
  };
}
