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
const CONSEILLEES = [
  'GOATCOUNTER_TOKEN',
  // À défaut, les liens de pièce jointe sont signés avec DIRECTUS_TOKEN : une
  // rotation du jeton invaliderait les liens déjà partis par e-mail.
  'ATTACHMENT_LINK_SECRET',
  'RATING_HASH_SALT',
  // Absentes, les valeurs de repli de scripts/generate-environment.mjs
  // s'appliquent : le build passe, mais le destinataire des formulaires n'est
  // plus celui du site — d'où l'affichage systématique.
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID_EMAIL',
  'EMAILJS_TEMPLATE_ID_REPLY',
  'EMAILJS_CONTACT_EMAIL',
  'EMAILJS_CAREER_EMAIL',
  'GOATCOUNTER_MOCK_DATA',
];

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
