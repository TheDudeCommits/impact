/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STRIPPED_JSON, runtimeAssetManifest } from './scripts/build/provenance';
import { bundledPackages, creditRecords, creditsPage, declaredPackages } from './scripts/build/credits';
import { handoverPlugin } from './scripts/build/handover';

const root = fileURLToPath(new URL('.', import.meta.url));
const heavy = (path: string) => (/[\\/]assets([\\/]|$)/.test(path) && !/[\\/]public[\\/]assets([\\/]|$)/.test(path)) || /[\\/]evidence([\\/]|$)/.test(path);

const sourceCommit=process.env.VITE_BUILD_SHA||execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const builtOn=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

export default defineConfig({
  plugins: [handoverPlugin(), {
    name: 'jump-style-after-app', apply: 'build',
    transformIndexHtml: { order: 'post', handler(html) {
      const links: string[] = [];
      const page = html.replace(/\s*<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/g, tag => { links.push(tag.trim()); return ''; });
      if (!links.length) return html;
      if (!page.includes('<div id="app"></div>')) throw new Error('index.html has no <div id="app"></div> for the stylesheet to follow (vite.config.ts jump-style-after-app)');
      return page.replace('<div id="app"></div>', `<div id="app"></div>${links.join('')}`);
    } },
  }, { name: 'jump-strip-provenance', apply: 'build', enforce: 'pre', transform(code, id) {
    if (id.includes('?') || !STRIPPED_JSON.test(id)) return null;
    return { code: JSON.stringify(runtimeAssetManifest(JSON.parse(code), id)), map: null };
  } }, {
    name: 'jump-credits-page',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/credits.html') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(creditsPage({ date: builtOn, commit: sourceCommit, software: declaredPackages(root) }, creditRecords(root)));
      });
    },
    generateBundle(_, bundle) {
      const modules = Object.values(bundle).flatMap(out => out.type === 'chunk' ? out.moduleIds : []);
      this.emitFile({ type: 'asset', fileName: 'credits.html', source: creditsPage({ date: builtOn, commit: sourceCommit, software: bundledPackages(modules) }, creditRecords(root)) });
    },
  }],
  define: { 'import.meta.env.VITE_BUILD_SHA': JSON.stringify(sourceCommit) },
  optimizeDeps: { entries: ['index.html'] },
  server: { port: 5173, strictPort: true, watch: { ignored: [heavy, `${root}.vercel/**`] }, proxy: {
    '/matchmake': { target: 'http://127.0.0.1:2567', changeOrigin: true },
    '/health': { target: 'http://127.0.0.1:2567', changeOrigin: true },
    '/ws': { target: 'ws://127.0.0.1:2567', ws: true, rewrite: p => p.replace(/^\/ws/, '') }
  } },
  test: { globalSetup: ['tests/setup/vitestTmp.ts'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, rolldownOptions: { output: { comments: { legal: true }, codeSplitting: { groups: [{ name: 'net', test: /[\\/]node_modules[\\/](@colyseus|msgpackr)[\\/]/ }] } } } },
});
