#!/usr/bin/env node
/**
 * Génère `src/environments/environment.build.ts` à partir des variables
 * d'environnement.
 *
 * Les réglages EmailJS — et surtout l'adresse qui reçoit les formulaires —
 * étaient écrits en dur dans `environment.ts` et `environment.prod.ts` :
 * changer le destinataire imposait une modification de code et un déploiement,
 * et les deux fichiers pouvaient diverger sans qu'on le voie. Ils vivent
 * désormais dans `.env` en local et dans les variables du site chez
 * l'hébergeur.
 *
 * Ces valeurs partent dans le bundle navigateur : EmailJS est appelé depuis la
 * page. Les sortir du code les rend configurables, pas secrètes. Aucun secret
 * serveur (jeton Directus, sel de hachage) ne doit être ajouté ici.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'src', 'environments', 'environment.build.ts');

/** Valeurs de repli : le dépôt reste constructible sans `.env`. */
const DEFAUTS = {
  EMAILJS_PUBLIC_KEY: 'JgxEJa4o02eYwDdM3',
  EMAILJS_SERVICE_ID: 'service_i29l54j',
  EMAILJS_TEMPLATE_ID_EMAIL: 'template_atag9do',
  EMAILJS_TEMPLATE_ID_REPLY: 'template_jlxqruc',
  EMAILJS_CONTACT_EMAIL: 'contact@finstar-cm.com',
  EMAILJS_CAREER_EMAIL: 'contact@finstar-cm.com',
};

const lire = (nom) => (process.env[nom] || '').trim() || DEFAUTS[nom];
const litteral = (valeur) => JSON.stringify(String(valeur));

const contenu = `/**
 * FICHIER GÉNÉRÉ — ne pas modifier à la main, ne pas versionner.
 * Source : scripts/generate-environment.mjs, exécuté avant chaque build.
 * Pour changer une valeur, éditez \`.env\` (local) ou les variables du site
 * chez l'hébergeur, puis relancez le build.
 */
export const buildConfig = {
  emailjs: {
    publicKey: ${litteral(lire('EMAILJS_PUBLIC_KEY'))},
    serviceId: ${litteral(lire('EMAILJS_SERVICE_ID'))},
    templateIdEmail: ${litteral(lire('EMAILJS_TEMPLATE_ID_EMAIL'))},
    templateIdReply: ${litteral(lire('EMAILJS_TEMPLATE_ID_REPLY'))},
    contactEmail: ${litteral(lire('EMAILJS_CONTACT_EMAIL'))},
    careerEmail: ${litteral(lire('EMAILJS_CAREER_EMAIL'))},
  },
} as const;
`;

// Réécrire à l'identique invaliderait le cache de compilation à chaque commande.
const existant = await readFile(TARGET, 'utf8').catch(() => null);
if (existant === contenu) {
  console.log('environment.build.ts déjà à jour.');
} else {
  await mkdir(dirname(TARGET), { recursive: true });
  await writeFile(TARGET, contenu, 'utf8');
  console.log(`environment.build.ts généré (destinataire des formulaires : ${lire('EMAILJS_CONTACT_EMAIL')}).`);
}
