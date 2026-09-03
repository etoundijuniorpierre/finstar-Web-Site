/**
 * Vérifie — et complète — le schéma Directus de la collection `job_applications`.
 *
 * Le serveur écrit une candidature champ par champ. Tout champ absent de la
 * collection n'est pas enregistré : c'est ainsi qu'une fiche de stage arrivait
 * avec ses deux fichiers « cv » et « fiche_recapitulative » pendant que les
 * quatre autres pièces, portées par le champ `documents`, disparaissaient.
 *
 * Usage :
 *   node --env-file-if-exists=.env scripts/directus-ensure-candidature-schema.mjs            (inspection seule)
 *   node --env-file-if-exists=.env scripts/directus-ensure-candidature-schema.mjs --apply    (création des champs manquants)
 *
 * Le jeton doit être celui du serveur (DIRECTUS_TOKEN) : la lecture du schéma
 * et la création de champs demandent un rôle administrateur.
 */

const DIRECTUS_URL = (process.env.DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const COLLECTION = 'job_applications';
const APPLY = process.argv.includes('--apply');

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('DIRECTUS_URL et DIRECTUS_TOKEN sont requis (fichier .env ou variables d\'environnement).');
  process.exit(1);
}

/**
 * Champs écrits par `handleApplication` (src/server-submissions.ts).
 * `file: true` marque une référence vers la médiathèque Directus.
 */
const CHAMPS_ATTENDUS = [
  { field: 'nom', type: 'string' },
  { field: 'prenom', type: 'string' },
  { field: 'poste_souhaite', type: 'string' },
  { field: 'age', type: 'integer' },
  { field: 'ville_residence', type: 'string' },
  { field: 'telephone', type: 'string' },
  { field: 'email', type: 'string' },
  { field: 'dernier_diplome', type: 'string' },
  { field: 'situation_matrimoniale', type: 'string' },
  { field: 'nombre_enfants', type: 'string' },
  { field: 'a_deja_travaille', type: 'string' },
  { field: 'dernier_emploi', type: 'text' },
  { field: 'disponibilites', type: 'json' },
  { field: 'travail_hors_ville', type: 'string' },
  { field: 'condition_hors_ville', type: 'text' },
  { field: 'salaire_souhaite', type: 'string' },
  { field: 'mode_remuneration', type: 'string' },
  { field: 'villes_preference', type: 'json' },
  { field: 'cv', type: 'uuid', file: true },
  { field: 'fiche_recapitulative', type: 'uuid', file: true },
  { field: 'documents', type: 'json' },
  { field: 'type_candidature', type: 'string' },
  { field: 'type_stage', type: 'string' },
  { field: 'duree_stage', type: 'string' },
  { field: 'theme_stage', type: 'text' },
  { field: 'etablissement', type: 'string' },
  { field: 'service_stage', type: 'string' },
  { field: 'avaliste', type: 'string' },
  { field: 'avaliste_nom', type: 'string' },
  { field: 'avaliste_prenom', type: 'string' },
  { field: 'avaliste_telephone', type: 'string' },
  { field: 'avaliste_adresse', type: 'string' },
  { field: 'avaliste_relation', type: 'string' },
  { field: 'caution_acceptee', type: 'boolean' },
];

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
};

async function appel(chemin, init = {}) {
  const reponse = await fetch(`${DIRECTUS_URL}${chemin}`, { headers, ...init });
  const corps = await reponse.text();
  if (!reponse.ok) {
    throw new Error(`${init.method || 'GET'} ${chemin} → HTTP ${reponse.status} : ${corps.slice(0, 300)}`);
  }
  return corps ? JSON.parse(corps) : {};
}

/** Réglages d'affichage du champ dans l'interface Directus. */
function meta(definition) {
  if (definition.file) return { interface: 'file', special: ['file'] };
  if (definition.type === 'json') return { interface: 'input-code', special: ['cast-json'], options: { language: 'json' } };
  if (definition.type === 'text') return { interface: 'input-multiline' };
  if (definition.type === 'boolean') return { interface: 'boolean', special: ['cast-boolean'] };
  return { interface: definition.type === 'integer' ? 'input' : 'input' };
}

async function main() {
  const existants = (await appel(`/fields/${COLLECTION}`)).data || [];
  const parNom = new Map(existants.map((f) => [f.field, f]));

  console.log(`Collection « ${COLLECTION} » — ${existants.length} champs présents.\n`);
  const manquants = [];
  for (const attendu of CHAMPS_ATTENDUS) {
    const present = parNom.get(attendu.field);
    if (present) {
      const type = present.type;
      const alerte = type !== attendu.type && !(attendu.file && type === 'uuid') ? `  ⚠ type ${type}, attendu ${attendu.type}` : '';
      console.log(`  ✓ ${attendu.field.padEnd(24)} ${type}${alerte}`);
    } else {
      manquants.push(attendu);
      console.log(`  ✗ ${attendu.field.padEnd(24)} ABSENT — les données de ce champ ne sont pas enregistrées`);
    }
  }

  const enTrop = existants
    .map((f) => f.field)
    .filter((nom) => !CHAMPS_ATTENDUS.some((a) => a.field === nom) && !['id', 'date_created', 'date_updated', 'user_created', 'user_updated', 'sort', 'status'].includes(nom));
  if (enTrop.length) console.log(`\nChamps présents mais jamais écrits par le site : ${enTrop.join(', ')}`);

  if (!manquants.length) {
    console.log('\nRien à créer : le schéma couvre tout ce que le site enregistre.');
    return;
  }

  if (!APPLY) {
    console.log(`\n${manquants.length} champ(s) à créer. Relancer avec --apply pour les ajouter.`);
    return;
  }

  for (const definition of manquants) {
    await appel(`/fields/${COLLECTION}`, {
      method: 'POST',
      body: JSON.stringify({
        field: definition.field,
        type: definition.type,
        meta: meta(definition),
        schema: {},
      }),
    });
    if (definition.file) {
      await appel('/relations', {
        method: 'POST',
        body: JSON.stringify({
          collection: COLLECTION,
          field: definition.field,
          related_collection: 'directus_files',
        }),
      });
    }
    console.log(`  + ${definition.field} créé`);
  }
  console.log(`\n${manquants.length} champ(s) créé(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
