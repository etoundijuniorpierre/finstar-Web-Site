#!/usr/bin/env node
/**
 * Vérifie que le build dispose des variables dont dépend le contenu.
 *
 * Les pages publiques sont pré-rendues : leur contenu est figé au moment du
 * build. Sans `DIRECTUS_TOKEN`, la construction réussit malgré tout et publie
 * des pages vides — l'incident ne se voit qu'en production. On échoue donc ici,
 * bruyamment, plutôt que de livrer un site muet.
 */
const REQUISES = ['DIRECTUS_URL', 'DIRECTUS_TOKEN'];
const CONSEILLEES = ['GOATCOUNTER_TOKEN', 'RATING_HASH_SALT'];

const masque = (v) => (v.length <= 8 ? '***' : `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} car.)`);

let manquantes = 0;
console.log('Variables disponibles pour le build :');
for (const nom of REQUISES) {
  const v = process.env[nom];
  console.log(`  ${v ? '✔' : '✘'} ${nom.padEnd(20)} ${v ? masque(v) : 'ABSENTE'}`);
  if (!v) manquantes += 1;
}
for (const nom of CONSEILLEES) {
  const v = process.env[nom];
  console.log(`  ${v ? '✔' : '–'} ${nom.padEnd(20)} ${v ? masque(v) : 'absente (facultative)'}`);
}

if (manquantes) {
  console.error(
    `\n${manquantes} variable(s) requise(s) absente(s).\n` +
    "Sur Netlify, vérifiez que la variable est bien portée par le scope « Builds »\n" +
    "et par le contexte de déploiement utilisé (production, preview ou branche).\n",
  );
  process.exit(1);
}
console.log('\nEnvironnement complet : le contenu sera intégré aux pages pré-rendues.');
