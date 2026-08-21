import type { Express, Request } from 'express';
import express from 'express';

/**
 * Réception des formulaires publics (contact, candidature) et de leurs pièces
 * jointes, écrites dans Directus.
 *
 * Ces traitements passent obligatoirement par le serveur : le jeton Directus
 * autorise l'écriture et ne doit jamais atteindre le navigateur. Le rôle public
 * de Directus reste donc en lecture seule sur le contenu, et sans aucun accès
 * aux collections de soumissions, qui contiennent des données personnelles.
 */

interface SubmissionsOptions {
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

const clientIp = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';
const text = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export function registerSubmissionRoutes(app: Express, options: SubmissionsOptions): void {
  const { directusUrl, directusToken } = options;
  const allowContact = createRateLimiter(10);
  const allowApplication = createRateLimiter(5);
  const allowUpload = createRateLimiter(30);

  async function createItem(collection: string, payload: Record<string, unknown>): Promise<void> {
    const upstream = await fetch(`${directusUrl}/items/${collection}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directusToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      throw new Error(`Directus HTTP ${upstream.status}: ${(await upstream.text()).slice(0, 300)}`);
    }
  }

  /** Dépôt d'une pièce jointe : renvoie l'identifiant du fichier Directus. */
  app.post('/api/uploads', express.raw({ type: '*/*', limit: '12mb' }), async (req, res) => {
    if (!directusToken) return res.status(503).json({ error: 'uploads_unavailable' });
    if (!allowUpload(clientIp(req))) return res.status(429).json({ error: 'rate_limited' });

    const body = req.body as Buffer | undefined;
    if (!body?.length) return res.status(400).json({ error: 'empty_file' });

    const fileName = text(req.get('X-File-Name'), 180) || 'document';
    const contentType = req.get('Content-Type') || 'application/octet-stream';
    const folder = text(req.get('X-File-Scope'), 40) === 'candidatures' ? 'candidatures' : 'contacts';

    try {
      const form = new FormData();
      form.append('title', `${folder} — ${fileName}`);
      form.append('file', new Blob([new Uint8Array(body)], { type: contentType }), fileName);

      const upstream = await fetch(`${directusUrl}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${directusToken}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);

      const payload = await upstream.json() as { data?: { id?: string } };
      const id = payload.data?.id;
      if (!id) throw new Error('Identifiant de fichier absent.');
      return res.status(201).json({ id });
    } catch (error) {
      console.warn('[uploads] Dépôt Directus impossible.', error);
      return res.status(503).json({ error: 'uploads_unavailable' });
    }
  });

  app.post('/api/contact', express.json({ limit: '64kb' }), async (req, res) => {
    if (!directusToken) return res.status(503).json({ accepted: false, error: 'unavailable' });
    if (text(req.body?.company)) return res.status(202).json({ accepted: true }); // pot de miel
    if (!allowContact(clientIp(req))) return res.status(429).json({ accepted: false, error: 'rate_limited' });

    const nom = text(req.body?.nom, 120);
    const prenom = text(req.body?.prenom, 120);
    const message = text(req.body?.message, 5000);
    if (!nom || !prenom || !message) {
      return res.status(400).json({ accepted: false, error: 'missing_fields' });
    }

    try {
      await createItem('contact_messages', {
        nom,
        prenom,
        email: text(req.body?.email, 180) || null,
        telephone: text(req.body?.telephone, 40) || null,
        sujet: text(req.body?.sujet, 200) || null,
        message,
        fichier: text(req.body?.fichier, 64) || null,
      });
      return res.status(201).json({ accepted: true });
    } catch (error) {
      console.warn('[contact] Écriture Directus impossible.', error);
      return res.status(503).json({ accepted: false, error: 'unavailable' });
    }
  });

  app.post('/api/candidature', express.json({ limit: '128kb' }), async (req, res) => {
    if (!directusToken) return res.status(503).json({ accepted: false, error: 'unavailable' });
    if (text(req.body?.company)) return res.status(202).json({ accepted: true }); // pot de miel
    if (!allowApplication(clientIp(req))) return res.status(429).json({ accepted: false, error: 'rate_limited' });

    const nom = text(req.body?.nom, 120);
    const prenom = text(req.body?.prenom, 120);
    if (!nom || !prenom) return res.status(400).json({ accepted: false, error: 'missing_fields' });

    const age = Number(req.body?.age);

    try {
      await createItem('job_applications', {
        nom,
        prenom,
        poste_souhaite: text(req.body?.poste_souhaite, 200) || null,
        age: Number.isFinite(age) ? Math.trunc(age) : null,
        ville_residence: text(req.body?.ville_residence, 120) || null,
        telephone: text(req.body?.telephone, 40) || null,
        email: text(req.body?.email, 180)?.toLowerCase() || null,
        dernier_diplome: text(req.body?.dernier_diplome, 200) || null,
        situation_matrimoniale: text(req.body?.situation_matrimoniale, 60) || null,
        nombre_enfants: text(req.body?.nombre_enfants, 20) || null,
        a_deja_travaille: text(req.body?.a_deja_travaille, 20) || null,
        dernier_emploi: text(req.body?.dernier_emploi, 2000) || null,
        disponibilites: list(req.body?.disponibilites),
        travail_hors_ville: text(req.body?.travail_hors_ville, 20) || null,
        condition_hors_ville: text(req.body?.condition_hors_ville, 2000) || null,
        salaire_souhaite: text(req.body?.salaire_souhaite, 60) || null,
        mode_remuneration: text(req.body?.mode_remuneration, 120) || null,
        villes_preference: list(req.body?.villes_preference),
        cv: text(req.body?.cv, 64) || null,
        fiche_recapitulative: text(req.body?.fiche_recapitulative, 64) || null,
        documents: req.body?.documents && typeof req.body.documents === 'object' ? req.body.documents : {},
        type_candidature: text(req.body?.type_candidature, 40) || 'emploi',
        type_stage: text(req.body?.type_stage, 40) || null,
        duree_stage: text(req.body?.duree_stage, 40) || null,
        theme_stage: text(req.body?.theme_stage, 500) || null,
        etablissement: text(req.body?.etablissement, 200) || null,
        service_stage: text(req.body?.service_stage, 120) || null,
        avaliste: text(req.body?.avaliste, 120) || null,
        avaliste_nom: text(req.body?.avaliste_nom, 120) || null,
        avaliste_prenom: text(req.body?.avaliste_prenom, 120) || null,
        avaliste_telephone: text(req.body?.avaliste_telephone, 40) || null,
        avaliste_adresse: text(req.body?.avaliste_adresse, 300) || null,
        avaliste_relation: text(req.body?.avaliste_relation, 120) || null,
        caution_acceptee: typeof req.body?.caution_acceptee === 'boolean' ? req.body.caution_acceptee : null,
      });
      return res.status(201).json({ accepted: true });
    } catch (error) {
      console.warn('[candidature] Écriture Directus impossible.', error);
      return res.status(503).json({ accepted: false, error: 'unavailable' });
    }
  });
}

/** Compteurs de la page admin, lus directement dans Directus. */
export async function readOperationalCounts(
  options: SubmissionsOptions,
): Promise<{ contacts: number; candidatures: number }> {
  const { directusUrl, directusToken } = options;

  const count = async (collection: string): Promise<number> => {
    const upstream = await fetch(
      `${directusUrl}/items/${collection}?aggregate[count]=id`,
      {
        headers: { Accept: 'application/json', Authorization: `Bearer ${directusToken}` },
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
