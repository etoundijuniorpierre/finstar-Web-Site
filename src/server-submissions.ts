/**
 * Réception des formulaires publics (contact, candidature) et de leurs pièces
 * jointes, écrites dans Directus.
 *
 * Les gestionnaires suivent l'interface Web standard (`Request`/`Response`) :
 * c'est la forme qu'attend l'hébergeur pour exécuter le rendu serveur, et elle
 * fonctionne à l'identique derrière le serveur Node local.
 *
 * Ces traitements passent obligatoirement par le serveur : le jeton Directus
 * autorise l'écriture et ne doit jamais atteindre le navigateur. Les collections
 * de soumissions restent donc sans permission publique.
 */

import crypto from 'node:crypto';

export interface SubmissionsOptions {
  directusUrl: string;
  directusToken: string;
}

/* -------------------------------------------------- liens de pièce jointe */

/**
 * Les pièces jointes (CV, CNI, diplômes) ne sont pas publiques dans Directus, et
 * elles ne doivent pas l'être : une adresse devinable exposerait les dossiers de
 * tous les candidats. Le destinataire de la notification doit pourtant pouvoir
 * les télécharger sans compte.
 *
 * Le serveur signe donc un lien par fichier — identifiant + échéance, scellés
 * par un HMAC. Lui seul peut en produire un, lui seul peut le vérifier, et c'est
 * lui qui va chercher le fichier dans Directus avec son jeton. Le lien voyage
 * dans l'e-mail ; le jeton, jamais.
 */
const ID_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Clé de signature. `ATTACHMENT_LINK_SECRET` est le réglage propre ; à défaut on
 * dérive du jeton Directus, déjà requis et strictement serveur, pour que les
 * liens restent valides d'un déploiement à l'autre sans variable supplémentaire.
 * Une rotation du jeton invalide les anciens liens : c'est documenté.
 */
function attachmentSecret(options: SubmissionsOptions): string {
  return process.env['ATTACHMENT_LINK_SECRET'] || options.directusToken;
}

function attachmentTtlMs(): number {
  const jours = Number(process.env['ATTACHMENT_LINK_TTL_DAYS']);
  return (Number.isFinite(jours) && jours > 0 ? jours : 365) * 24 * 60 * 60 * 1000;
}

function signAttachment(id: string, expires: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${id}|${expires}`).digest('hex');
}

/** Lien absolu de téléchargement, tel qu'il part dans l'e-mail. */
export function buildAttachmentUrl(id: string, origin: string, options: SubmissionsOptions): string {
  const expires = Date.now() + attachmentTtlMs();
  const signature = signAttachment(id, expires, attachmentSecret(options));
  return `${origin}/api/attachment/${id}?exp=${expires}&sig=${signature}`;
}

function attachmentSignatureValid(id: string, exp: string, sig: string, options: SubmissionsOptions): boolean {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const attendue = signAttachment(id, expires, attachmentSecret(options));
  // Comparaison à durée constante : une comparaison `===` laisserait deviner la
  // signature octet par octet.
  if (sig.length !== attendue.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(attendue, 'utf8'));
}

const CODES_REJOUABLES = new Set([429, 502, 503, 504]);

async function fetchDirectus(
  construire: () => { url: string; init: RequestInit },
  options: { essais?: number; rejouerErreursReseau?: boolean } = {},
): Promise<Response> {
  const essais = options.essais ?? 3;
  let derniere: unknown;
  for (let tentative = 1; tentative <= essais; tentative += 1) {
    const { url, init } = construire();
    try {
      const reponse = await fetch(url, init);
      if (!CODES_REJOUABLES.has(reponse.status) || tentative === essais) return reponse;
      derniere = `HTTP ${reponse.status}`;
    } catch (error) {
      if (!options.rejouerErreursReseau || tentative === essais) throw error;
      derniere = error;
    }
    await new Promise((resoudre) => setTimeout(resoudre, 400 * 2 ** (tentative - 1)));
    console.warn(`[directus] Tentative ${tentative}/${essais} rejouée (${derniere}).`);
  }
  throw new Error('Directus indisponible après plusieurs tentatives.');
}

/** Fenêtre glissante par IP, pour absorber les envois automatisés. */
function createRateLimiter(maxPerHour: number) {
  const attempts = new Map<string, number[]>();
  return (ip: string): boolean => {
    const now = Date.now();
    const recent = (attempts.get(ip) || []).filter((stamp) => now - stamp < 60 * 60 * 1000);
    if (recent.length >= maxPerHour) return false;
    recent.push(now);
    attempts.set(ip, recent);
    return true;
  };
}

/**
 * Dossier Directus où ranger une pièce jointe, résolu par son nom.
 *
 * Le rangement n'est pas cosmétique : la lecture publique de `directus_files`
 * est filtrée sur le dossier. Un fichier déposé hors dossier resterait lisible
 * par n'importe qui. En cache, car l'identifiant ne change pas.
 */
const folderIds = new Map<string, string>();

async function resolveFolderId(name: string, options: SubmissionsOptions): Promise<string | null> {
  const connu = folderIds.get(name);
  if (connu) return connu;
  try {
    const query = new URLSearchParams({ 'filter[name][_eq]': name, fields: 'id', limit: '1' });
    const upstream = await fetch(`${options.directusUrl}/folders?${query}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${options.directusToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);
    const payload = await upstream.json() as { data?: Array<{ id?: string }> };
    const id = payload.data?.[0]?.id;
    // On ne mémorise QUE les succès : mettre un échec en cache condamnerait le
    // processus à déposer toutes les pièces jointes à la racine — donc en accès
    // public — après une seule indisponibilité passagère.
    if (id) { folderIds.set(name, id); return id; }
    console.warn(`[uploads] Dossier Directus « ${name} » introuvable.`);
    return null;
  } catch (error) {
    console.warn(`[uploads] Résolution du dossier « ${name} » impossible.`, error);
    return null;
  }
}

const allowContact = createRateLimiter(10);
const allowApplication = createRateLimiter(5);
const allowUpload = createRateLimiter(30);
const allowDownload = createRateLimiter(120);

const text = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Adresse de l'appelant, telle que la transmet l'hébergeur ou le proxy amont. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (
    request.headers.get('x-nf-client-connection-ip')
    || (forwarded ? forwarded.split(',')[0].trim() : '')
    || 'unknown'
  );
}

async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) return null;
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function createItem(
  options: SubmissionsOptions,
  collection: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const upstream = await fetchDirectus(() => ({
    url: `${options.directusUrl}/items/${collection}`,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.directusToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    },
  }));
  if (!upstream.ok) {
    throw new Error(`Directus HTTP ${upstream.status}: ${(await upstream.text()).slice(0, 300)}`);
  }
}

/** Dépôt d'une pièce jointe : renvoie l'identifiant du fichier Directus. */
async function handleUpload(request: Request, options: SubmissionsOptions): Promise<Response> {
  if (!options.directusToken) return Response.json({ error: 'uploads_unavailable' }, { status: 503 });
  if (!allowUpload(clientIp(request))) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return Response.json({ error: 'empty_file' }, { status: 400 });
  if (bytes.length > 12 * 1024 * 1024) return Response.json({ error: 'file_too_large' }, { status: 413 });

  const fileName = text(request.headers.get('X-File-Name'), 180) || 'document';
  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  const folder = text(request.headers.get('X-File-Scope'), 40) === 'candidatures' ? 'candidatures' : 'contacts';

  try {
    const folderId = await resolveFolderId(folder, options);

    const upstream = await fetchDirectus(() => {
      const form = new FormData();
      form.append('title', `${folder} — ${fileName}`);
      if (folderId) form.append('folder', folderId);
      form.append('file', new Blob([bytes], { type: contentType }), fileName);
      return {
        url: `${options.directusUrl}/files`,
        init: {
          method: 'POST',
          headers: { Authorization: `Bearer ${options.directusToken}` },
          body: form,
          signal: AbortSignal.timeout(30_000),
        },
      };
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);

    const payload = await upstream.json() as { data?: { id?: string } };
    const id = payload.data?.id;
    if (!id) throw new Error('Identifiant de fichier absent.');
    // Le navigateur ne peut pas signer lui-même : le lien de téléchargement est
    // produit ici, en même temps que le dépôt, et repart tel quel dans l'e-mail.
    const url = buildAttachmentUrl(id, new URL(request.url).origin, options);
    return Response.json({ id, url }, { status: 201 });
  } catch (error) {
    console.warn('[uploads] Dépôt Directus impossible.', error);
    return Response.json({ error: 'uploads_unavailable' }, { status: 503 });
  }
}

async function handleContact(request: Request, options: SubmissionsOptions): Promise<Response> {
  if (!options.directusToken) return Response.json({ accepted: false, error: 'unavailable' }, { status: 503 });

  const body = await readJson(request, 64 * 1024);
  if (!body) return Response.json({ accepted: false, error: 'invalid_body' }, { status: 400 });
  if (text(body['company'])) return Response.json({ accepted: true }, { status: 202 }); // pot de miel
  if (!allowContact(clientIp(request))) {
    return Response.json({ accepted: false, error: 'rate_limited' }, { status: 429 });
  }

  const nom = text(body['nom'], 120);
  const prenom = text(body['prenom'], 120);
  const message = text(body['message'], 5000);
  if (!nom || !prenom || !message) {
    return Response.json({ accepted: false, error: 'missing_fields' }, { status: 400 });
  }

  try {
    await createItem(options, 'contact_messages', {
      nom,
      prenom,
      email: text(body['email'], 180) || null,
      telephone: text(body['telephone'], 40) || null,
      sujet: text(body['sujet'], 200) || null,
      message,
      fichier: text(body['fichier'], 64) || null,
    });
    return Response.json({ accepted: true }, { status: 201 });
  } catch (error) {
    console.warn('[contact] Écriture Directus impossible.', error);
    return Response.json({ accepted: false, error: 'unavailable' }, { status: 503 });
  }
}

async function handleApplication(request: Request, options: SubmissionsOptions): Promise<Response> {
  if (!options.directusToken) return Response.json({ accepted: false, error: 'unavailable' }, { status: 503 });

  const body = await readJson(request, 128 * 1024);
  if (!body) return Response.json({ accepted: false, error: 'invalid_body' }, { status: 400 });
  if (text(body['company'])) return Response.json({ accepted: true }, { status: 202 }); // pot de miel
  if (!allowApplication(clientIp(request))) {
    return Response.json({ accepted: false, error: 'rate_limited' }, { status: 429 });
  }

  const nom = text(body['nom'], 120);
  const prenom = text(body['prenom'], 120);
  if (!nom || !prenom) return Response.json({ accepted: false, error: 'missing_fields' }, { status: 400 });

  const age = Number(body['age']);
  const documents = body['documents'];

  try {
    await createItem(options, 'job_applications', {
      nom,
      prenom,
      poste_souhaite: text(body['poste_souhaite'], 200) || null,
      age: Number.isFinite(age) ? Math.trunc(age) : null,
      ville_residence: text(body['ville_residence'], 120) || null,
      telephone: text(body['telephone'], 40) || null,
      email: text(body['email'], 180).toLowerCase() || null,
      dernier_diplome: text(body['dernier_diplome'], 200) || null,
      situation_matrimoniale: text(body['situation_matrimoniale'], 60) || null,
      nombre_enfants: text(body['nombre_enfants'], 20) || null,
      a_deja_travaille: text(body['a_deja_travaille'], 20) || null,
      dernier_emploi: text(body['dernier_emploi'], 2000) || null,
      disponibilites: list(body['disponibilites']),
      travail_hors_ville: text(body['travail_hors_ville'], 20) || null,
      condition_hors_ville: text(body['condition_hors_ville'], 2000) || null,
      salaire_souhaite: text(body['salaire_souhaite'], 60) || null,
      mode_remuneration: text(body['mode_remuneration'], 120) || null,
      villes_preference: list(body['villes_preference']),
      cv: text(body['cv'], 64) || null,
      fiche_recapitulative: text(body['fiche_recapitulative'], 64) || null,
      documents: documents && typeof documents === 'object' ? documents : {},
      type_candidature: text(body['type_candidature'], 40) || 'emploi',
      type_stage: text(body['type_stage'], 40) || null,
      duree_stage: text(body['duree_stage'], 40) || null,
      theme_stage: text(body['theme_stage'], 500) || null,
      etablissement: text(body['etablissement'], 200) || null,
      service_stage: text(body['service_stage'], 120) || null,
      avaliste: text(body['avaliste'], 120) || null,
      avaliste_nom: text(body['avaliste_nom'], 120) || null,
      avaliste_prenom: text(body['avaliste_prenom'], 120) || null,
      avaliste_telephone: text(body['avaliste_telephone'], 40) || null,
      avaliste_adresse: text(body['avaliste_adresse'], 300) || null,
      avaliste_relation: text(body['avaliste_relation'], 120) || null,
      caution_acceptee: typeof body['caution_acceptee'] === 'boolean' ? body['caution_acceptee'] : null,
    });
    return Response.json({ accepted: true }, { status: 201 });
  } catch (error) {
    console.warn('[candidature] Écriture Directus impossible.', error);
    return Response.json({ accepted: false, error: 'unavailable' }, { status: 503 });
  }
}

/**
 * Sert une pièce jointe à qui présente un lien signé valide.
 *
 * Le fichier reste privé dans Directus : c'est ce relais qui l'ouvre, avec le
 * jeton serveur, et force le téléchargement.
 */
async function handleAttachment(request: Request, url: URL, options: SubmissionsOptions): Promise<Response> {
  if (!options.directusToken) return new Response('Service indisponible', { status: 503 });
  if (!allowDownload(clientIp(request))) return new Response('Trop de requêtes', { status: 429 });

  const id = decodeURIComponent(url.pathname.slice('/api/attachment/'.length));
  const exp = url.searchParams.get('exp') || '';
  const sig = url.searchParams.get('sig') || '';

  if (!ID_FICHIER.test(id) || !attachmentSignatureValid(id, exp, sig, options)) {
    // Même réponse pour un lien inconnu, mal signé ou périmé : rien à apprendre
    // en tâtonnant.
    return new Response('Lien de téléchargement invalide ou expiré.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const upstream = await fetchDirectus(() => ({
      url: `${options.directusUrl}/assets/${id}?download`,
      init: {
        headers: { Accept: '*/*', Authorization: `Bearer ${options.directusToken}` },
        signal: AbortSignal.timeout(30_000),
      },
    }), { rejouerErreursReseau: true });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);

    const headers = new Headers();
    for (const nom of ['content-type', 'content-length', 'content-disposition']) {
      const valeur = upstream.headers.get(nom);
      if (valeur) headers.set(nom, valeur);
    }
    // Directus pose déjà l'en-tête avec `?download`; on garantit le repli.
    if (!headers.has('content-disposition')) {
      headers.set('content-disposition', `attachment; filename="${id}"`);
    }
    // Le lien est signé et nominatif : aucun cache partagé ne doit le retenir.
    headers.set('cache-control', 'private, no-store');
    return new Response(await upstream.arrayBuffer(), { status: 200, headers });
  } catch (error) {
    console.warn('[attachment] Lecture Directus impossible.', error);
    return new Response('Pièce jointe momentanément indisponible.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

export { fetchDirectus };

/** Téléchargement d'une pièce jointe ; `null` si la requête ne le concerne pas. */
export function handleAttachmentRequest(
  request: Request,
  url: URL,
  options: SubmissionsOptions,
): Promise<Response> | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (!url.pathname.startsWith('/api/attachment/')) return null;
  return handleAttachment(request, url, options);
}

/** Aiguille les envois de formulaires ; `null` si la requête ne les concerne pas. */
export function handleSubmissionRequest(
  request: Request,
  pathname: string,
  options: SubmissionsOptions,
): Promise<Response> | null {
  if (request.method !== 'POST') return null;
  if (pathname === '/api/uploads') return handleUpload(request, options);
  if (pathname === '/api/contact') return handleContact(request, options);
  if (pathname === '/api/candidature') return handleApplication(request, options);
  return null;
}

/** Compteurs de la page admin, lus directement dans Directus. */
export async function readOperationalCounts(
  options: SubmissionsOptions,
): Promise<{ contacts: number; candidatures: number }> {
  const count = async (collection: string): Promise<number> => {
    const upstream = await fetchDirectus(() => ({
      url: `${options.directusUrl}/items/${collection}?aggregate[count]=id`,
      init: {
        headers: { Accept: 'application/json', Authorization: `Bearer ${options.directusToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    }), { rejouerErreursReseau: true });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);
    const body = await upstream.json() as { data?: Array<{ count?: { id?: number | string } | number | string }> };
    const raw = body.data?.[0]?.count;
    const value = typeof raw === 'object' && raw !== null ? raw.id : raw;
    return Number(value) || 0;
  };

  const [contacts, candidatures] = await Promise.all([
    count('contact_messages'),
    count('job_applications'),
  ]);
  return { contacts, candidatures };
}
