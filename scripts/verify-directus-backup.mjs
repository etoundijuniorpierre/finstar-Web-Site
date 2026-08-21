#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const backupDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (!backupDir) throw new Error('Usage: node scripts/verify-directus-backup.mjs <dossier-backup>');
const migrationManifestArg = process.argv.find((value) => value.startsWith('--migration-manifest='))?.slice(21);

const manifest = JSON.parse(await readFile(join(backupDir, 'manifest.json'), 'utf8'));
const failures = [];
let unrecoveredUploads = manifest.uploads?.failed || [];
let missingRequiredUploads = [];
if (migrationManifestArg) {
  const migrationManifest = JSON.parse(await readFile(resolve(migrationManifestArg), 'utf8'));
  const required = migrationManifest.keep?.files || [];
  const trackedUploads = new Set((manifest.files || [])
    .filter((entry) => entry.path.startsWith('uploads/'))
    .map((entry) => entry.path.slice('uploads/'.length, 'uploads/'.length + 36)));
  missingRequiredUploads = required.filter((id) => !trackedUploads.has(id));
  const requiredSet = new Set(required);
  unrecoveredUploads = unrecoveredUploads.filter((entry) => requiredSet.has(entry.id));
}
for (const entry of manifest.files || []) {
  try {
    const buffer = await readFile(join(backupDir, entry.path));
    const digest = createHash('sha256').update(buffer).digest('hex');
    if (buffer.length !== entry.bytes || digest !== entry.sha256) failures.push(entry.path);
  } catch {
    failures.push(entry.path);
  }
}

if (failures.length || unrecoveredUploads.length || missingRequiredUploads.length) {
  console.error(`Sauvegarde invalide : ${failures.length} fichier(s) absent(s) ou altéré(s), ${unrecoveredUploads.length} média(s) requis non récupéré(s), ${missingRequiredUploads.length} média(s) requis absents.`);
  for (const file of failures.slice(0, 20)) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Sauvegarde vérifiée : ${manifest.files.length} fichiers, ${manifest.uploads.downloaded}/${manifest.uploads.expected} médias.`);
if (migrationManifestArg && manifest.uploads.failed?.length) {
  console.log(`${manifest.uploads.failed.length} média(s) orphelin(s) déjà indisponible(s) en amont, hors périmètre de migration.`);
}
