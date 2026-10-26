const PROVENANCE_KEYS = new Set([
  'source', 'sourceUrl', 'sourceTitle', 'sourceType', 'sourceAsset', 'sourceArchiveSha256', 'sourceSha256', 'sourceFile', 'sourceFiles',
  'sourceUploader', 'sourceActor', 'sourceSpeakerEvidence', 'previousSourceFile', 'metadataFile', 'portraitSource', 'originalSource',
  'subtitleProvenance', 'uploader', 'rights', 'rightsNote', 'license', 'licence', 'licenseUrl', 'licenceUrl', 'author', 'authorUrl',
  'attribution', 'credit', 'credits', 'provenance', 'processing', 'verification', 'sourceZipSha256', 'sourceZipBytes',
  'sources', 'sourcePages', 'voiceSource', 'timingNotes', 'visualReview', 'audioPairing',
]);


export function stripProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripProvenance);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PROVENANCE_KEYS.has(key)).map(([key, item]) => [key, stripProvenance(item)]));
}

export function runtimeAssetManifest(value: unknown, id: string): unknown {
  const manifest = stripProvenance(value) as Record<string, unknown>;
  if (!manifest || typeof manifest !== 'object') return manifest;
  const normalized = id.replaceAll('\\', '/');
  const pick = (row: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
  if (normalized.endsWith('/public/assets/home/sprites/manifest.json') && Array.isArray(manifest.fighters)) {
    return { fighters: manifest.fighters.map(row => ({
      ...pick(row, ['id', 'sha256', 'posterSha256', 'columns', 'frameCount', 'heroFrame']),
      ...(row.timing ? { timing: pick(row.timing, ['frameTimesMs', 'loopMs', 'loopStartFrame']) } : {}),
      ...(row.motionTiming ? { motionTiming: pick(row.motionTiming, ['frameTimesMs', 'loopMs', 'loopStartFrame']) } : {}),
      ...(Array.isArray(row.runtimePages) ? { runtimePages: row.runtimePages.map((page: Record<string, unknown>) =>
        pick(page, ['file', 'sha256', 'firstFrame', 'frameCount', 'width', 'height', 'bytes'])) } : {}),
    })) };
  }
  if (normalized.endsWith('/public/assets/audio/home/manifest.json') && Array.isArray(manifest.assets)) {
    return { assets: manifest.assets.map(row => pick(row, ['fighter', 'file', 'runtimeSha256'])) };
  }
  return manifest;
}

export const STRIPPED_JSON = /[\\/](public[\\/]assets[\\/].+|src[\\/]audio[\\/]data[\\/]ambience)\.json$/;

const PROVENANCE_MANIFESTS = new Set([
  'assets/fighters/manifest.json', 'assets/audio/home/manifest.json', 'assets/music/manifest.json', 'assets/audio/v2/manifest.json',
  'assets/home/manifest.json', 'assets/home/sprites/manifest.json', 'assets/audio/survival/boss-voices.json', 'assets/environment/br/parts.json',
]);

export const CREDITS_FILE = 'credits.html';

export const isCreditFile = (file: string) => file !== CREDITS_FILE && file !== 'robots.txt' && (/\.(md|txt)$/i.test(file)
  || /(^|\/)(licen[cs]e|credits?|attribution|notice|ofl)[^/]*$/i.test(file)
  || PROVENANCE_MANIFESTS.has(file)
  || /^assets\/(environment|audio|objectives)\/.*manifest[^/]*\.json$/.test(file));

const MARKERS: readonly [string, RegExp][] = [
  ['a YouTube source', /youtube\.com\/watch|youtu\.be\//i],
  ['a rights note', /rights? not (cleared|established)|licen[cs]e not established|not cleared/i],
  ['a Creative Commons credit', /\bCC[- ]BY\b|Creative Commons|CC Attribution|Sketchfab/],
  ['a provenance field', /"(sourceUrl|sourceTitle|uploader|sourceUploader|rightsNote|attribution)"\s*:/],
];
export const creditMarkers = (text: string, file?: string) =>
  MARKERS.filter(([name, re]) => !(file === CREDITS_FILE && name === 'a Creative Commons credit') && re.test(text)).map(([name]) => name);
