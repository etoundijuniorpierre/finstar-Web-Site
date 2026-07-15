#!/usr/bin/env node
/**
 * Audit Directus — LECTURE SEULE.
 *
 * Ce script n'émet QUE des requêtes GET. Il ne crée, ne modifie et ne supprime
 * jamais rien. Il produit un rapport permettant de décider, en connaissance de
 * cause, ce qui peut être écarté lors de la migration vers le schéma v2.
 *
 * Il distingue deux natures d'orphelins, qui n'ont PAS le même traitement :
 *
 *   - orphelin BASE      : le fichier n'est référencé par aucun champ. Suppression sûre.
 *   - orphelin FRONTEND  : le fichier est bien référencé en base, mais le site ne
 *                          l'affiche jamais. => DÉCISION HUMAINE. Ne jamais purger
 *                          automatiquement (ex. Account_types : 11 fiches rédigées
 *                          dont le bloc d'affichage a simplement été commenté).
 *
 * Usage :
 *   node scripts/directus-audit.mjs
 *   DIRECTUS_URL=http://... DIRECTUS_TOKEN=xxx node scripts/directus-audit.mjs
 *
 * Le token est FACULTATIF : il ne sert qu'à lister `directus_files` (souvent non
 * public). Sans lui, on ne peut pas calculer les orphelins BASE — le script le dit
 * clairement plutôt que de produire un résultat faux.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://84.247.169.140:8056').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || null;

/* ------------------------------------------------------------------ *
 * Carte du frontend — dérivée de la lecture des services Angular.
 * Toute évolution du front doit être répercutée ici, sinon l'audit ment.
 * ------------------------------------------------------------------ */

/** Slugs de pages réellement lus par un service. */
const CONSUMED_PAGE_SLUGS = ['homepage', 'services', 'careers', 'contact', 'about'];

/** Sections retrouvées par `Type` (texte libre — fragile, cf. schéma v2). */
const CONSUMED_SECTION_TYPES = [
  'hero_banner',                 // home.service
  'differents accounts type',    // home.service (typo + espaces d'origine)
  'statistics informations',     // home.service
  'testimonials',                // home.service
  'text_block',                  // contact.service
  // join-us.service : bandeau « Rejoignez-nous », présent sur TOUTES les pages.
  // Seuls les TEXTES sont lus ; les étoiles affichées sont des assets statiques
  // (/assets/stars/), donc les fichiers rattachés à ces sections ne sont pas rendus.
  'call_to_action',
];

/** Sections retrouvées par ID codé en dur (services / careers / contact / about). */
const CONSUMED_SECTION_IDS = [8, 9, 10, 11, 12, 13, 15, 17, 18];

/** Sections chargées mais JAMAIS rendues dans un template. */
const FETCHED_BUT_NOT_RENDERED = {
  ids: [9, 10],                              // services : accounts + openAccount
  types: ['differents accounts type'],       // home : bloc comptes commenté
};

/** Sections dont le champ `image` est réellement affiché. */
const RENDERED_SECTION_IMAGE_IDS = [8, 12, 17];
const RENDERED_SECTION_IMAGE_TYPES = ['hero_banner'];

/** Sections dont la galerie `images` (junction) est réellement affichée. */
const RENDERED_SECTION_GALLERY_IDS = [15, 18]; // fonds contact, logos partenaires

/* ------------------------------------------------------------------ *
 * Règle retenue : « ne garder que ce que le site utilise aujourd'hui ».
 * Rien n'est SUPPRIMÉ : la v2 est une instance neuve qui ne reprend que
 * l'utile. L'instance actuelle + le backup restent la source de secours.
 * ------------------------------------------------------------------ */

/** Collections non reprises dans le schéma v2. */
const DROP_COLLECTIONS = [
  // 11 fiches rédigées mais jamais rendues (bloc HTML commenté).
  // Récupérables depuis le backup si on décide de les ré-afficher.
  'Account_types',
  'Account_types_translations',
  'Pages_sections_Account_types',
  // Formulaires : les soumissions vivent dans Supabase (cf. code actuel).
  // À exporter/archiver (PII) AVANT toute mise hors service de l'ancienne instance.
  'Contact_form_data',
  'JobDemandForm',
];

/** Champs référencés en base mais lus par aucun service. */
const DROP_FIELDS = [
  'Pages_sections.document',
  'Pages_sections.subheadline3',
  'Pages_sections.links-aj0yns', // artefact d'UI auto-nommé
  'Statistics.value1',
  'global_settings.Finsite_icon',
  'global_settings.Footer_logo', // le favicon servi est le statique /favicon.ico
];

/* ------------------------------------------------------------------ *
 * Client REST minimal (GET uniquement)
 * ------------------------------------------------------------------ */

async function get(path) {
  const url = `${DIRECTUS_URL}${path}`;
  const headers = { Accept: 'application/json' };
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const err = new Error(`GET ${path} → HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return body.data;
}

/** Récupère une collection entière (limit=-1), en tolérant l'absence de droits. */
async function getAll(collection, fields = '*') {
  try {
    return (await get(`/items/${collection}?fields=${fields}&limit=-1`)) ?? [];
  } catch (e) {
    console.warn(`  ⚠ ${collection} : illisible (${e.message})`);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v);

/** Enregistre une référence fichier : uuid -> [{ source, rendered }] */
function addRef(map, uuid, source, rendered) {
  if (!isUuid(uuid)) return;
  if (!map.has(uuid)) map.set(uuid, []);
  map.get(uuid).push({ source, rendered });
}

const bytes = (n) =>
  !Number.isFinite(n) ? '—' : n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.round(n / 1e3)} ko`;

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

async function main() {
  console.log(`\n🔍 Audit Directus (lecture seule) — ${DIRECTUS_URL}`);
  console.log(`   Token : ${DIRECTUS_TOKEN ? 'fourni' : 'absent (orphelins BASE non calculables)'}\n`);

  console.log('→ Lecture des collections…');
  const [
    pages, sections, sectionFiles, testimonials, products,
    items, visions, accountTypes, settings, pageSections,
  ] = await Promise.all([
    getAll('Pages', 'page_id,Slug,status,title'),
    getAll('Pages_sections', 'Pages_sections_id,Type,image,document'),
    getAll('Pages_sections_files', 'id,Pages_sections_Pages_sections_id,directus_files_id'),
    getAll('Testimonials', 'testimonials_id,author_name,author_image'),
    getAll('Product', 'id,Name,product_image'),
    getAll('items', 'id,name,image'),
    getAll('vision', 'id,image'),
    getAll('Account_types', 'account_id,account_name,Icon,Hover_image'),
    getAll('global_settings', '*'),
    getAll('Pages_Pages_sections', 'id,Pages_page_id,Pages_sections_Pages_sections_id'),
  ]);

  // Rattachement section → slug de page (pour un manifeste lisible).
  const pageBySlugId = new Map((pages ?? []).map((p) => [p.page_id, p.Slug]));
  const sectionPage = new Map();
  for (const r of pageSections ?? [])
    sectionPage.set(r.Pages_sections_Pages_sections_id, pageBySlugId.get(r.Pages_page_id) ?? null);

  const settingsRow = Array.isArray(settings) ? settings[0] : settings;

  /* ---------- 0. Ensemble des sections réellement rendues -------------- *
   * Source unique de vérité. Une section n'est retenue que si elle est :
   *   (a) rattachée à une page consommée,
   *   (b) sélectionnée par un service,
   *   (c) effectivement rendue dans un template.
   * Sans (a), un résidu non rattaché (ex. section #1) serait retenu à tort
   * du seul fait de son `Type`.
   * -------------------------------------------------------------------- */
  const notRendered = (s) =>
    FETCHED_BUT_NOT_RENDERED.ids.includes(s.Pages_sections_id) ||
    FETCHED_BUT_NOT_RENDERED.types.includes(s.Type);

  const selectedByService = (s) =>
    CONSUMED_SECTION_IDS.includes(s.Pages_sections_id) || CONSUMED_SECTION_TYPES.includes(s.Type);

  const attachedToConsumedPage = (s) =>
    CONSUMED_PAGE_SLUGS.includes(sectionPage.get(s.Pages_sections_id));

  const keptSections = (sections ?? []).filter(
    (s) => attachedToConsumedPage(s) && selectedByService(s) && !notRendered(s),
  );
  const keepSectionIds = new Set(keptSections.map((s) => s.Pages_sections_id));

  /** Sections rattachées à aucune page : résidus purs. */
  const unattachedSections = (sections ?? []).filter((s) => !sectionPage.get(s.Pages_sections_id));

  /* ---------- 1. Graphe de références fichiers ---------- */
  const refs = new Map();

  for (const s of sections ?? []) {
    const id = s.Pages_sections_id;
    // Une image n'est « affichée » que si SA section est retenue.
    const renderedImg =
      keepSectionIds.has(id) &&
      (RENDERED_SECTION_IMAGE_IDS.includes(id) || RENDERED_SECTION_IMAGE_TYPES.includes(s.Type));
    addRef(refs, s.image, `Pages_sections#${id}.image (Type="${s.Type}")`, renderedImg);
    // `document` n'est lu par aucun service.
    addRef(refs, s.document, `Pages_sections#${id}.document`, false);
  }

  for (const r of sectionFiles ?? []) {
    const sid = r.Pages_sections_Pages_sections_id;
    addRef(
      refs,
      r.directus_files_id,
      `Pages_sections_files → section#${sid}`,
      RENDERED_SECTION_GALLERY_IDS.includes(sid),
    );
  }

  for (const t of testimonials ?? []) addRef(refs, t.author_image, `Testimonials#${t.testimonials_id}.author_image`, true);
  for (const p of products ?? []) addRef(refs, p.product_image, `Product#${p.id}.product_image`, true);
  for (const i of items ?? []) addRef(refs, i.image, `items#${i.id}.image`, true);
  for (const v of visions ?? []) addRef(refs, v.image, `vision#${v.id}.image`, true);

  // Account_types : référencé en base, jamais rendu aujourd'hui.
  for (const a of accountTypes ?? []) {
    addRef(refs, a.Icon, `Account_types#${a.account_id}.Icon`, false);
    addRef(refs, a.Hover_image, `Account_types#${a.account_id}.Hover_image`, false);
  }

  if (settingsRow) {
    addRef(refs, settingsRow.site_logo, 'global_settings.site_logo', true);
    addRef(refs, settingsRow.Finsite_icon, 'global_settings.Finsite_icon', false);
    addRef(refs, settingsRow.Footer_logo, 'global_settings.Footer_logo', false);
  }

  /* ---------- 2. Fichiers du serveur (nécessite un token) ---------- */
  let allFiles = null;
  try {
    allFiles = await get('/files?fields=id,filename_download,filesize,type&limit=-1');
  } catch (e) {
    console.warn(`  ⚠ /files illisible (${e.message}) → orphelins BASE non calculables.`);
  }

  /* ---------- 3. Classement ---------- */
  const rendered = [];
  const frontendOrphans = [];
  for (const [uuid, sources] of refs) {
    (sources.some((s) => s.rendered) ? rendered : frontendOrphans).push({ uuid, sources });
  }

  const dbOrphans = allFiles
    ? allFiles.filter((f) => !refs.has(f.id))
    : null;

  /* ---------- 4. Audit du contenu ---------- */
  const unknownSlugPages = (pages ?? []).filter((p) => !CONSUMED_PAGE_SLUGS.includes(p.Slug));
  const unpublishedPages = (pages ?? []).filter((p) => p.status !== 'published');

  const orphanSections = (sections ?? []).filter((s) => !selectedByService(s));

  // Intégrité référentielle de la table de jonction : lignes pendantes.
  const sectionIds = new Set((sections ?? []).map((s) => s.Pages_sections_id));
  const fileIds = allFiles ? new Set(allFiles.map((f) => f.id)) : null;
  const danglingJunction = (sectionFiles ?? []).filter(
    (r) =>
      r.Pages_sections_Pages_sections_id == null ||
      !sectionIds.has(r.Pages_sections_Pages_sections_id) ||
      r.directus_files_id == null ||
      (fileIds && !fileIds.has(r.directus_files_id)),
  );
  const notRenderedSections = (sections ?? []).filter(notRendered);

  /* ---------- 5. Rapport ---------- */
  const stamp = new Date().toISOString().slice(0, 10);
  const L = [];
  L.push(`# Audit Directus — ${stamp}`);
  L.push(`\nSource : \`${DIRECTUS_URL}\` · **lecture seule** (aucune écriture émise).\n`);

  L.push(`## Synthèse\n`);
  L.push(`| Indicateur | Valeur |`);
  L.push(`|---|---|`);
  L.push(`| Fichiers référencés en base | ${refs.size} |`);
  L.push(`| — dont réellement affichés | ${rendered.length} |`);
  L.push(`| — **orphelins FRONTEND** (référencés, jamais affichés) | ${frontendOrphans.length} |`);
  L.push(`| **Orphelins BASE** (référencés par rien) | ${dbOrphans ? dbOrphans.length : '❓ token requis'} |`);
  L.push(`| Sections totales | ${sections?.length ?? '?'} |`);
  L.push(`| — jamais lues par le front | ${orphanSections.length} |`);
  L.push(`| — chargées mais non rendues | ${notRenderedSections.length} |`);
  L.push(`| Pages hors slugs connus | ${unknownSlugPages.length} |`);
  L.push(`| Pages non publiées | ${unpublishedPages.length} |`);
  L.push(`| **Jonctions pendantes** (\`Pages_sections_files\`) | ${danglingJunction.length} |`);

  L.push(`\n## 🧨 Intégrité — jonctions pendantes\n`);
  L.push(`Lignes de \`Pages_sections_files\` pointant vers une section ou un fichier inexistant/nul.`);
  L.push(`Ce sont des résidus : à nettoyer, et à empêcher par une vraie contrainte FK dans le schéma v2.\n`);
  if (danglingJunction.length === 0) L.push(`_Aucune._`);
  else {
    L.push(`| id | section | fichier |`);
    L.push(`|---|---|---|`);
    for (const r of danglingJunction)
      L.push(`| ${r.id} | ${r.Pages_sections_Pages_sections_id ?? '**null**'} | \`${r.directus_files_id ?? 'null'}\` |`);
  }

  L.push(`\n## ⚠️ Orphelins FRONTEND — décision humaine requise\n`);
  L.push(`Ces fichiers **existent et sont rattachés à du contenu**, mais le site ne les affiche jamais.`);
  L.push(`Ne pas purger sans arbitrage : il peut s'agir de contenu à ré-afficher.\n`);
  if (frontendOrphans.length === 0) L.push(`_Aucun._`);
  else {
    L.push(`| UUID | Référencé par |`);
    L.push(`|---|---|`);
    for (const o of frontendOrphans) L.push(`| \`${o.uuid}\` | ${o.sources.map((s) => s.source).join('<br>')} |`);
  }

  L.push(`\n## Orphelins BASE — suppression sûre\n`);
  if (!dbOrphans) {
    L.push(`❓ Non calculable : \`/files\` inaccessible. Relancer avec \`DIRECTUS_TOKEN\`.`);
  } else if (dbOrphans.length === 0) {
    L.push(`_Aucun._`);
  } else {
    L.push(`| UUID | Fichier | Taille |`);
    L.push(`|---|---|---|`);
    for (const f of dbOrphans) L.push(`| \`${f.id}\` | ${f.filename_download} | ${bytes(f.filesize)} |`);
  }

  L.push(`\n## Sections jamais lues par le frontend\n`);
  if (orphanSections.length === 0) L.push(`_Aucune._`);
  else {
    L.push(`| ID | Type |`);
    L.push(`|---|---|`);
    for (const s of orphanSections) L.push(`| ${s.Pages_sections_id} | \`${s.Type}\` |`);
  }

  L.push(`\n## Sections rattachées à aucune page (résidus)\n`);
  if (unattachedSections.length === 0) L.push(`_Aucune._`);
  else {
    L.push(`| ID | Type |`);
    L.push(`|---|---|`);
    for (const s of unattachedSections) L.push(`| ${s.Pages_sections_id} | \`${s.Type}\` |`);
  }

  L.push(`\n## Sections chargées mais non rendues\n`);
  if (notRenderedSections.length === 0) L.push(`_Aucune._`);
  else {
    L.push(`| ID | Type |`);
    L.push(`|---|---|`);
    for (const s of notRenderedSections) L.push(`| ${s.Pages_sections_id} | \`${s.Type}\` |`);
  }

  L.push(`\n## Pages\n`);
  L.push(`| Slug | Statut | Connu du front ? |`);
  L.push(`|---|---|---|`);
  for (const p of pages ?? [])
    L.push(`| \`${p.Slug}\` | ${p.status} | ${CONSUMED_PAGE_SLUGS.includes(p.Slug) ? '✅' : '❌'} |`);

  L.push(`\n## Décisions en attente\n`);
  L.push(`- [ ] \`Account_types\` (${accountTypes?.length ?? '?'} fiches, non affichées) → ré-afficher ou archiver ?`);
  L.push(`- [ ] Sections services **id 9 / id 10** (chargées, non rendues) → archiver ?`);
  L.push(`- [ ] Champs \`Pages_sections.document\`, \`global_settings.Finsite_icon\`, \`Footer_logo\` → supprimer ?`);
  L.push(`- [ ] Collections \`Contact_form_data\` / \`JobDemandForm\` (PII) → exporter puis retirer du schéma v2.`);

  const outDir = join(ROOT, 'reports');
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `directus-audit-${stamp}.md`);
  await writeFile(outFile, L.join('\n') + '\n', 'utf8');

  /* ---------- 6. Manifeste de migration (consommé par la reprise v2) ---------- */
  const describe = (s) => ({
    id: s.Pages_sections_id,
    type: s.Type,
    page: sectionPage.get(s.Pages_sections_id) ?? null,
  });

  const keepSections = keptSections.map(describe);

  // Tout ce qui n'est pas retenu, avec le motif — pour que la décision soit traçable.
  const droppedSections = (sections ?? [])
    .filter((s) => !keepSectionIds.has(s.Pages_sections_id))
    .map((s) => ({
      ...describe(s),
      reason: !sectionPage.get(s.Pages_sections_id)
        ? 'non rattachée à une page (résidu)'
        : notRendered(s)
          ? 'chargée mais jamais rendue'
          : !selectedByService(s)
            ? 'jamais sélectionnée par un service'
            : 'page hors périmètre',
    }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: DIRECTUS_URL,
    rule: 'keep-only-what-the-site-currently-renders (images incluses)',
    note:
      "Aucune suppression n'est effectuée. La v2 est une instance neuve qui ne reprend " +
      "que cet ensemble. L'instance actuelle et le backup restent la source de secours.",
    keep: {
      files: rendered.map((r) => r.uuid).sort(),
      sections: keepSections.sort((a, b) => a.id - b.id),
    },
    drop: {
      collections: DROP_COLLECTIONS,
      fields: DROP_FIELDS,
      sections: droppedSections,
      files: {
        frontendOrphans: frontendOrphans.map((o) => o.uuid).sort(),
        dbOrphans: dbOrphans ? dbOrphans.map((f) => f.id).sort() : null,
      },
    },
    integrity: {
      danglingJunctionIds: danglingJunction.map((r) => r.id).sort((a, b) => a - b),
    },
  };

  const manifestFile = join(outDir, 'migration-keep-manifest.json');
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\n🧾 Manifeste : ${manifestFile}`);
  console.log(`   garder : ${manifest.keep.files.length} fichiers · ${manifest.keep.sections.length} sections`);
  console.log(
    `   écarter : ${frontendOrphans.length + (dbOrphans?.length ?? 0)} fichiers · ` +
      `${manifest.drop.sections.length} sections · ${DROP_COLLECTIONS.length} collections`,
  );

  console.log(`\n📊 Fichiers référencés : ${refs.size}  (affichés : ${rendered.length})`);
  console.log(`⚠️  Orphelins FRONTEND : ${frontendOrphans.length}  → décision humaine`);
  console.log(`🗑️  Orphelins BASE     : ${dbOrphans ? dbOrphans.length : '❓ token requis'}`);
  console.log(`📄 Sections non lues   : ${orphanSections.length}`);
  console.log(`\n✅ Rapport écrit : ${outFile}\n`);
}

main().catch((e) => {
  console.error(`\n❌ Audit interrompu : ${e.message}\n`);
  process.exit(1);
});
