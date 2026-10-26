type Doc = Pick<Document, 'fullscreenEnabled' | 'documentElement'>;
const here = (): Doc | undefined => typeof document === 'undefined' ? undefined : document;

export function canFullScreen(doc: Doc | undefined = here()): boolean {
  return !!doc?.fullscreenEnabled && typeof doc.documentElement?.requestFullscreen === 'function';
}

export function enterFullScreen(doc: Doc | undefined = here()): Promise<void> {
  if (!doc || !canFullScreen(doc)) return Promise.reject(new Error('full screen is not available here'));
  return doc.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
    (navigator as { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard?.lock?.(['Escape']).catch(() => {});
  });
}
