import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { Plugin } from 'vite';
import type { Sites } from '../../src/boot/handover';

export const HANDOVER_SITES: Sites = { from: 'https://jump.dude.work', to: 'https://impact.dude.work' };
const origin = (value: string | undefined, fallback: string) => { const named = value?.trim(); return named ? new URL(named).origin : fallback; };
export function oneSite(sites: Sites): boolean {
  const from = new URL(sites.from), to = new URL(sites.to), tail = (host: string) => host.split('.').slice(-2).join('.');
  const named = (host: string) => host.split('.').length >= 3 && !/^[\d.]+$/.test(host) && !host.includes(':');
  return from.protocol === to.protocol && named(from.hostname) && named(to.hostname) && tail(from.hostname) === tail(to.hostname);
}
export function handoverSites(env: Record<string, string | undefined> = process.env): Sites {
  const sites = { from: origin(env.VITE_HANDOVER_FROM, HANDOVER_SITES.from), to: origin(env.VITE_HANDOVER_TO, HANDOVER_SITES.to) };
  if (!oneSite(sites)) throw new Error(`The address hand-over needs two origins of one site (as http://jump.dude.localhost:5480 and http://impact.dude.localhost:5480 are): ${sites.from} and ${sites.to} are not.`);
  return sites;
}

const source = fileURLToPath(new URL('../../src/boot/handover.ts', import.meta.url));
export async function handoverScript(sites: Sites = handoverSites()): Promise<string> {
  const bundle = await rolldown({ input: source, platform: 'browser', logLevel: 'silent' });
  try {
    const { output } = await bundle.generate({ format: 'iife', name: 'handover', minify: true });
    return `(function(){${output[0].code.trim().replace(/;+$/, "")};handover.run(window,${JSON.stringify(sites)})})()`.replace(/<\/(script)/gi, '<\\/$1');
  } finally { await bundle.close(); }
}

export function withHandover(html: string, script: string): string {
  const tag = `<script>${script}</script>`;
  if (/<meta\s+charset=[^>]*>/i.test(html)) return html.replace(/<meta\s+charset=[^>]*>/i, charset => `${charset}${tag}`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, head => `${head}${tag}`);
  throw new Error('index.html has no <head>: the address hand-over (scripts/build/handover.ts) has nowhere to go.');
}

export function handoverPlugin(): Plugin {
  let script: Promise<string> | undefined;
  return {
    name: 'jump-handover',
    transformIndexHtml: { order: 'post', async handler(html, context) { return context.filename.endsWith('index.html') ? withHandover(html, await (script ??= handoverScript())) : html; } },
  };
}
