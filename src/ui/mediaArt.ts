import versions from './mediaArtVersions.json';

export function mediaArt(url: string): string {
  const hash = (versions as Record<string, string>)[url];
  return hash ? `${url}?v=${hash}` : url;
}
