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

export interface SubmissionsOptions {
  directusUrl: string;
  directusToken: string;
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

const allowContact = createRateLimiter(10);
const allowApplication = createRateLimiter(5);
const allowUpload = createRateLimiter(30);

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
  const upstream = await fetch(`${options.directusUrl}/items/${collection}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.directusToken}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
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
    const form = new FormData();
    form.append('title', `${folder} — ${fileName}`);
    form.append('file', new Blob([bytes], { type: contentType }), fileName);

    const upstream = await fetch(`${options.directusUrl}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.directusToken}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);

    const payload = await upstream.json() as { data?: { id?: string } };
    const id = payload.data?.id;
    if (!id) throw new Error('Identifiant de fichier absent.');
    return Response.json({ id }, { status: 201 });
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
    const upstream = await fetch(
      `${options.directusUrl}/items/${collection}?aggregate[count]=id`,
      {
        headers: { Accept: 'application/json', Authorization: `Bearer ${options.directusToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
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
