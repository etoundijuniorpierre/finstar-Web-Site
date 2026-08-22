#!/usr/bin/env node
/**
 * Sauvegarde API Directus avant migration.
 *
 * - schéma complet ;
 * - contenu de toutes les collections métier lisibles ;
 * - métadonnées et binaires des médias ;
 * - manifeste SHA-256 vérifiable.
 *
 * Les collections PII legacy sont exclues du JSON en clair. Pour les inclure,
 * fournir DIRECTUS_PII_BACKUP_KEY : leur export est alors chiffré en AES-256-GCM.
 */
import { createCipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://84.247.169.140:8056').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const PII_KEY = process.env.DIRECTUS_PII_BACKUP_KEY || '';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dfzilcxk8';
// Collections porteuses de données personnelles : elles nommaient encore les
// tables v1 supprimées, si bien que les candidatures et messages v2 partaient
// en clair dans chaque sauvegarde.
const PII_COLLECTIONS = new Set(['job_applications', 'contact_messages']);
// Médias déjà cassés côté serveur (binaire perdu chez l'hébergeur de fichiers) et
// référencés nulle part. Sans cette liste explicite, la sauvegarde s'interromprait
// indéfiniment sur des fichiers qu'aucune restauration ne pourra jamais rendre.
// Toute autre défaillance reste bloquante.
const KNOWN_MISSING = new Set(
  (process.env.DIRECTUS_BACKUP_KNOWN_MISSING || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

if (!DIRECTUS_TOKEN) {
  throw new Error('DIRECTUS_TOKEN est requis pour une sauvegarde complète.');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(ROOT, 'reports', `directus-v2-backup-${stamp}`);
const contentDir = join(outDir, 'content');
const uploadsDir = join(outDir, 'uploads');

const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
};

async function request(path, init = {}) {
  return requestUrl(`${DIRECTUS_URL}${path}`, init, path, true);
}

async function requestUrl(url, init = {}, label = url, authenticated = false) {
  const response = await fetch(url, {
    ...init,
    headers: { ...(authenticated ? headers : { Accept: '*/*' }), ...(init.headers || {}) },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${init.method || 'GET'} ${label} → HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

function cloudinaryCandidates(file) {
  const extension = extname(file.filename_download || '').replace(/^\./, '').toLowerCase();
  const resourceTypes = file.type?.startsWith('video/') ? ['video'] : ['image', 'raw'];
  const extensions = [...new Set([
    extension,
    file.type === 'image/jpeg' ? 'jpg' : '',
    file.type === 'image/x-icon' ? 'ico' : '',
    file.type === 'application/pdf' ? 'pdf' : '',
    file.type === 'video/mp4' ? 'mp4' : '',
  ].filter(Boolean))];

  return resourceTypes.flatMap((resourceType) => extensions.map((format) => ({
    url: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/directus/${file.id}.${format}`,
    source: `cloudinary:${resourceType}`,
  })));
}

function assertExpectedSize(file, buffer, source) {
  const expected = Number(file.filesize || 0);
  if (expected && buffer.length !== expected) {
    throw new Error(`${source} a retourné ${buffer.length} octets au lieu de ${expected}`);
  }
}

async function downloadMedia(file) {
  try {
    const response = await request(`/assets/${file.id}?download`);
    const buffer = Buffer.from(await response.arrayBuffer());
    assertExpectedSize(file, buffer, 'Directus');
    return { buffer, source: 'directus-assets' };
  } catch (directusError) {
    const fallbackErrors = [];
    for (const candidate of cloudinaryCandidates(file)) {
      try {
        const response = await requestUrl(candidate.url, {}, candidate.url, false);
        const buffer = Buffer.from(await response.arrayBuffer());
        assertExpectedSize(file, buffer, candidate.source);
        return { buffer, source: candidate.source, directus_error: directusError.message };
      } catch (error) {
        fallbackErrors.push(error.message);
      }
    }
    throw new Error(`${directusError.message}; secours Cloudinary: ${fallbackErrors.join(' | ')}`);
  }
}

async function getJson(path) {
  return request(path).then((response) => response.json());
}

function safeName(value) {
  return String(value || 'file').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 140);
}

/**
 * Deux collections dont les noms ne diffèrent que par la casse (`Product_items`
 * legacy et `product_items` v2) visent le MÊME fichier sur un système insensible
 * à la casse (Windows, macOS) : la seconde écrase silencieusement la première et
 * la sauvegarde devient fausse sans lever d'erreur. On suffixe donc les doublons
 * et on publie la correspondance dans `content/_filemap.json`.
 */
function buildFileNames(collections) {
  const used = new Map();
  const names = new Map();
  for (const collection of collections) {
    const base = safeName(collection);
    const key = base.toLowerCase();
    const seen = used.get(key) || 0;
    used.set(key, seen + 1);
    names.set(collection, seen === 0 ? base : `${base}__${seen + 1}`);
  }
  return names;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function encryptJson(value, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    algorithm: 'aes-256-gcm+scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }), 'utf8');
}

async function writeTracked(relativePath, buffer, manifest) {
  const absolutePath = join(outDir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  manifest.files.push({ path: relativePath.replace(/\\/g, '/'), bytes: buffer.length, sha256: sha256(buffer) });
}

async function main() {
  await mkdir(contentDir, { recursive: true });
  await mkdir(uploadsDir, { recursive: true });

  const manifest = {
    generated_at: new Date().toISOString(),
    source: DIRECTUS_URL,
    format: 2,
    pii_exported: Boolean(PII_KEY),
    collections: {},
    uploads: { expected: 0, downloaded: 0, sources: {}, recovered: [], known_missing: [], failed: [] },
    files: [],
  };

  console.log(`Sauvegarde Directus → ${outDir}`);

  const [schema, collectionsBody, filesBody] = await Promise.all([
    getJson('/schema/snapshot'),
    getJson('/collections?limit=-1'),
    getJson('/files?fields=id,filename_download,filesize,type,storage,uploaded_on&limit=-1'),
  ]);

  await writeTracked('schema-snapshot.json', Buffer.from(JSON.stringify(schema, null, 2)), manifest);

  const collections = (collectionsBody.data || [])
    .filter((entry) => entry?.collection && entry?.schema && !entry.collection.startsWith('directus_'))
    .map((entry) => entry.collection)
    .sort();

  const fileNames = buildFileNames(collections);
  await writeTracked(
    'content/_filemap.json',
    Buffer.from(JSON.stringify(Object.fromEntries(fileNames), null, 2)),
    manifest,
  );

  for (const collection of collections) {
    const encoded = encodeURIComponent(collection);
    const body = await getJson(`/items/${encoded}?fields=*&limit=-1`);
    const data = body.data || [];
    manifest.collections[collection] = Array.isArray(data) ? data.length : (data ? 1 : 0);
    const fileName = fileNames.get(collection);

    if (PII_COLLECTIONS.has(collection)) {
      if (!PII_KEY) {
        manifest.collections[collection] = 'exclue: DIRECTUS_PII_BACKUP_KEY absent';
        continue;
      }
      const encrypted = encryptJson(body, PII_KEY);
      await writeTracked(`content/${fileName}.json.enc`, encrypted, manifest);
      continue;
    }

    await writeTracked(`content/${fileName}.json`, Buffer.from(JSON.stringify(body, null, 2)), manifest);
  }

  const media = filesBody.data || [];
  manifest.uploads.expected = media.length;
  await writeTracked('files-metadata.json', Buffer.from(JSON.stringify(filesBody, null, 2)), manifest);

  for (const file of media) {
    const relative = `uploads/${file.id}--${safeName(file.filename_download || file.id)}`;
    try {
      const { buffer, source, directus_error } = await downloadMedia(file);
      await writeTracked(relative, buffer, manifest);
      manifest.uploads.downloaded += 1;
      manifest.uploads.sources[source] = (manifest.uploads.sources[source] || 0) + 1;
      if (directus_error) {
        manifest.uploads.recovered.push({
          id: file.id,
          name: file.filename_download,
          recovered: true,
          source,
          directus_error,
        });
      }
    } catch (error) {
      const entry = { id: file.id, name: file.filename_download, error: error.message };
      if (KNOWN_MISSING.has(file.id)) manifest.uploads.known_missing.push(entry);
      else manifest.uploads.failed.push(entry);
    }
  }

  for (const locale of ['fr.json', 'en.json']) {
    const source = join(ROOT, 'public', 'assets', 'i18n', locale);
    await writeTracked(`frontend-i18n/${locale}`, await readFile(source), manifest);
  }

  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
  await writeFile(join(outDir, 'manifest.json'), manifestBuffer);

  if (manifest.uploads.failed.length) {
    throw new Error(`${manifest.uploads.failed.length} média(s) n'ont pas pu être sauvegardés. Aucune migration ne doit être appliquée.`);
  }

  if (manifest.uploads.known_missing.length) {
    console.warn(`Médias irrécupérables déclarés : ${manifest.uploads.known_missing.length} (voir manifest.uploads.known_missing).`);
  }

  console.log(`Collections sauvegardées : ${Object.keys(manifest.collections).length}`);
  console.log(`Médias sauvegardés : ${manifest.uploads.downloaded}/${manifest.uploads.expected}`);
  console.log(`Manifeste : ${join(outDir, 'manifest.json')}`);
}

main().catch((error) => {
  console.error(`Sauvegarde interrompue : ${error.message}`);
  process.exit(1);
});
