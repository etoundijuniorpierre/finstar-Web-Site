#!/usr/bin/env node
/**
 * Sert le build de production en local.
 *
 * Le rendu serveur est désormais un gestionnaire Web standard, exécuté par
 * l'hébergeur : il n'ouvre plus de port lui-même. Ce pont rebranche un serveur
 * Node devant lui pour pouvoir vérifier un build comme en production, sans
 * réintroduire de serveur applicatif dans le code livré.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const BROWSER_DIR = join(ROOT, 'dist/finstar-cm/browser');
const SERVER_ENTRY = join(ROOT, 'dist/finstar-cm/server/server.mjs');
const PORT = Number(process.env['PORT'] || 4000);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

if (!existsSync(SERVER_ENTRY)) {
  console.error('Build absent. Lancez `npm run build` avant de servir.');
  process.exit(1);
}

const { netlifyAppEngineHandler } = await import(pathToFileURL(SERVER_ENTRY).href);

/** Fichier statique correspondant à l'URL, ou `null` si la requête n'en vise aucun. */
function staticFileFor(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('\0')) return null;
  const candidate = normalize(join(BROWSER_DIR, decoded));
  if (!candidate.startsWith(BROWSER_DIR)) return null; // hors du dossier publié
  for (const file of [candidate, join(candidate, 'index.html')]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Les routes serveur et le rendu priment sur les fichiers : sinon le relais
    // Directus et les API seraient masqués par une éventuelle correspondance.
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/directus')) {
      const file = staticFileFor(url.pathname);
      if (file) {
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        createReadStream(file).pipe(res);
        return;
      }
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const response = await netlifyAppEngineHandler(new Request(url, {
      method: req.method,
      headers: req.headers,
      body,
      duplex: body ? 'half' : undefined,
    }));

    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('[serve-local]', error);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal Server Error');
  }
}).listen(PORT, () => console.log(`Site servi sur http://localhost:${PORT}`));
