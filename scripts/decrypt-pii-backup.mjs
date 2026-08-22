#!/usr/bin/env node
/**
 * Déchiffre les exports de données personnelles d'une sauvegarde Directus.
 *
 * `directus-backup.mjs` chiffre `job_applications` et `contact_messages` en
 * AES-256-GCM quand `DIRECTUS_PII_BACKUP_KEY` est fourni. Sans ce pendant,
 * l'archive était illisible : une sauvegarde qu'on ne sait pas relire n'est pas
 * une sauvegarde.
 *
 * Usage :
 *   node scripts/decrypt-pii-backup.mjs <dossier-ou-fichier.json.enc>
 *
 * La phrase secrète est lue dans DIRECTUS_PII_BACKUP_KEY. Le clair est écrit sur
 * la sortie standard — à rediriger vers un fichier seulement si l'on assume de
 * poser des données personnelles en clair sur le disque.
 */
import { createDecipheriv, scryptSync } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const cible = process.argv[2];
const phrase = process.env.DIRECTUS_PII_BACKUP_KEY || '';

if (!cible) {
  console.error('Usage : node scripts/decrypt-pii-backup.mjs <dossier-ou-fichier.json.enc>');
  process.exit(1);
}
if (!phrase) {
  console.error('DIRECTUS_PII_BACKUP_KEY est requis (la phrase utilisée à la sauvegarde).');
  process.exit(1);
}

function dechiffrer(buffer) {
  const enveloppe = JSON.parse(buffer.toString('utf8'));
  if (enveloppe.algorithm !== 'aes-256-gcm+scrypt') {
    throw new Error(`Algorithme inattendu : ${enveloppe.algorithm}`);
  }
  const salt = Buffer.from(enveloppe.salt, 'base64');
  const iv = Buffer.from(enveloppe.iv, 'base64');
  const tag = Buffer.from(enveloppe.tag, 'base64');
  const data = Buffer.from(enveloppe.data, 'base64');
  const key = scryptSync(phrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  // `final()` lève si le repère d'authentification ne colle pas : mauvaise
  // phrase secrète, ou archive altérée. On ne distingue pas les deux.
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

async function fichiersDe(chemin) {
  if (chemin.endsWith('.json.enc')) return [chemin];
  const dossier = chemin.endsWith('content') ? chemin : join(chemin, 'content');
  const noms = await readdir(dossier);
  return noms.filter((n) => n.endsWith('.json.enc')).map((n) => join(dossier, n));
}

const fichiers = await fichiersDe(cible);
if (!fichiers.length) {
  console.error(`Aucun fichier .json.enc dans ${cible} — la sauvegarde a-t-elle été prise avec DIRECTUS_PII_BACKUP_KEY ?`);
  process.exit(1);
}

for (const f of fichiers) {
  let clair;
  try {
    clair = dechiffrer(await readFile(f));
  } catch (error) {
    console.error(`Échec sur ${f} : ${error.message}`);
    console.error('Phrase secrète erronée ou archive altérée.');
    process.exit(1);
  }
  const lignes = (JSON.parse(clair).data || []).length;
  console.error(`— ${f} : ${lignes} ligne(s) déchiffrée(s)`);
  console.log(clair);
}
