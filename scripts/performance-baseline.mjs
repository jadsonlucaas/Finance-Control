import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

function assetRows() {
  const html = readFileSync('dist/index.html', 'utf8');
  return readdirSync('dist/assets')
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
    .map((name) => {
      const path = `dist/assets/${name}`;
      const content = readFileSync(path);
      return {
        file: path,
        bytes: statSync(path).size,
        gzipBytes: gzipSync(content).length,
        brotliBytes: brotliCompressSync(content).length,
        bootstrap: html.includes(name)
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

function globalCount() {
  const text = readFileSync('docs/global-api-inventory.md', 'utf8');
  return [...text.matchAll(/^\| `/gm)].length;
}

const assets = assetRows();
const loader = analyzeLegacyLoader();
const report = {
  generatedAt: new Date().toISOString(),
  chunks: assets,
  estimatedRequests: assets.length + 1,
  bootstrapModules: assets.filter((asset) => asset.bootstrap).map((asset) => asset.file),
  lazyCandidates: assets.filter((asset) => /part-|dashboardRenderer|monthDetailEvents/.test(asset.file)).map((asset) => asset.file),
  largestChunk: assets[0],
  entryChunk: assets.find((asset) => /assets\/app-.*\.js$/.test(asset.file)),
  servicesFirebaseChunk: assets.find((asset) => /services-firebase-.*\.js$/.test(asset.file)),
  servicesFirebaseInBootstrap: assets.find((asset) => /services-firebase-.*\.js$/.test(asset.file))?.bootstrap === true,
  classicScripts: loader.classicScripts,
  evalExecutedScripts: loader.evalExecutedScripts,
  loaderEvalOccurrences: loader.loaderEvalOccurrences,
  globals: globalCount()
};

console.log(JSON.stringify(report, null, 2));
