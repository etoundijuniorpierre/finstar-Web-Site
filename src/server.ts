import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { environment } from './environments/environment';
import { registerSubmissionRoutes, readOperationalCounts } from './server-submissions';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Statistiques de trafic GoatCounter, récupérées CÔTÉ SERVEUR pour que le token
 * API ne soit jamais exposé dans le bundle navigateur. Le navigateur appelle
 * uniquement cet endpoint (même origine). Réponse mise en cache pour respecter
 * les limites de l'API GoatCounter.
 */
const GOATCOUNTER_TOKEN = process.env['GOATCOUNTER_TOKEN'] || '';
const GOATCOUNTER_CODE = environment.goatCounterCode || '';
const DIRECTUS_TOKEN = process.env['DIRECTUS_TOKEN'] || '';
const DIRECTUS_URL = (process.env['DIRECTUS_URL'] || environment.apiUrl).replace(/\/$/, '');
const RATING_HASH_SALT = process.env['RATING_HASH_SALT'] || crypto.randomBytes(32).toString('hex');
const MOCK_ANALYTICS = environment.goatCounterMockData === true;
const TRAFFIC_TTL_MS = 5 * 60 * 1000;
// Presets alignés sur le tableau de bord GoatCounter : jour, semaine, mois,
// trimestre, semestre, année. Les plages personnalisées passent par ?start&end.
const ALLOWED_DAYS = [1, 7, 30, 90, 180, 365];
const trafficCache = new Map<string, { at: number; data: unknown }>();
const activeSessions = new Set<string>();
const ratingAttempts = new Map<string, number[]>();

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

app.post('/api/admin/login', express.json({ limit: '8kb' }), async (req, res) => {
  const userName = typeof req.body?.userName === 'string' ? req.body.userName.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!userName || !password) {
    return res.status(400).json({ authenticated: false });
  }

  try {
    const directusBase = DIRECTUS_URL;
    const query = new URLSearchParams({
      'filter[UserName][_eq]': userName,
      fields: 'id,PassWord',
      limit: '1',
    });

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (DIRECTUS_TOKEN) headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;

    const upstream = await fetch(`${directusBase}/items/AdminConnexion?${query}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      console.warn(`[admin-login] Directus AdminConnexion inaccessible: HTTP ${upstream.status}`);
      return res.status(401).json({ authenticated: false });
    }

    const body = await upstream.json() as { data?: Array<{ PassWord?: string }> };
    const authenticated = Array.isArray(body.data) && body.data.some((entry) => entry.PassWord === password);

    if (authenticated) {
      const token = crypto.randomUUID();
      activeSessions.add(token);
      return res.status(200).json({ authenticated: true, token });
    }

    return res.status(401).json({ authenticated: false });
  } catch (error) {
    console.warn('[admin-login] Verification AdminConnexion impossible.', error);
    return res.status(401).json({ authenticated: false });
  }
});

app.post('/api/admin/verify', express.json({ limit: '8kb' }), (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (token && activeSessions.has(token)) {
    return res.status(200).json({ valid: true });
  }
  return res.status(401).json({ valid: false });
});

app.post('/api/ratings', express.json({ limit: '16kb' }), async (req, res) => {
  const score = Number(req.body?.score);
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : '';
  const requestedPage = typeof req.body?.page === 'string' ? req.body.page.trim().slice(0, 180) : '/';
  const page = requestedPage.startsWith('/') ? requestedPage : '/';
  const lang = req.body?.lang === 'en-US' ? 'en-US' : 'fr-FR';
  const honeypot = typeof req.body?.company === 'string' ? req.body.company : '';

  if (honeypot) return res.status(202).json({ accepted: true });
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ accepted: false, error: 'invalid_score' });
  }
  if (!DIRECTUS_TOKEN) return res.status(503).json({ accepted: false, error: 'ratings_unavailable' });

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (ratingAttempts.get(ip) || []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ accepted: false, error: 'rate_limited' });
  recent.push(now);
  ratingAttempts.set(ip, recent);

  try {
    const upstream = await fetch(`${DIRECTUS_URL}/items/site_ratings`, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
      body: JSON.stringify({
        score,
        emoji: ['', '😞', '🙁', '😐', '🙂', '⭐'][score],
        comment: comment || null,
        page,
        lang,
        user_agent: req.get('User-Agent')?.slice(0, 500) || null,
        ip_hash: crypto.createHash('sha256').update(`${ip}|${RATING_HASH_SALT}`).digest('hex'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);
    return res.status(201).json({ accepted: true });
  } catch (error) {
    console.warn('[ratings] Écriture Directus impossible.', error);
    return res.status(503).json({ accepted: false, error: 'ratings_unavailable' });
  }
});

app.get('/api/admin/ratings', async (req, res) => {
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!activeSessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  if (!DIRECTUS_TOKEN) return res.status(503).json({ error: 'ratings_unavailable' });

  try {
    const query = new URLSearchParams({
      fields: 'score,emoji,comment,page,lang,date_created', sort: '-date_created', limit: '-1',
    });

    // Même découpage temporel que le trafic, pour que les deux sections de la
    // page admin décrivent toujours la même période.
    const start = typeof req.query['start'] === 'string' ? req.query['start'] : '';
    const end = typeof req.query['end'] === 'string' ? req.query['end'] : '';
    if (start && end) {
      query.set('filter[date_created][_gte]', `${start}T00:00:00Z`);
      query.set('filter[date_created][_lte]', `${end}T23:59:59Z`);
    } else {
      const days = Math.min(3650, Math.max(1, Number(req.query['days']) || 30));
      const from = new Date(Date.now() - (days - 1) * 86_400_000);
      query.set('filter[date_created][_gte]', `${from.toISOString().slice(0, 10)}T00:00:00Z`);
    }
    const upstream = await fetch(`${DIRECTUS_URL}/items/site_ratings?${query}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);
    const body = await upstream.json() as { data?: Array<{ score: number; emoji?: string; comment?: string; page?: string; lang?: string; date_created?: string }> };
    const rows = body.data || [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    for (const row of rows) if (distribution[row.score] !== undefined) distribution[row.score] += 1;
    const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length : 0;
    return res.status(200).json({
      total: rows.length,
      average: Number(average.toFixed(2)),
      distribution,
      recent: rows.filter((row) => row.comment).slice(0, 10),
    });
  } catch (error) {
    console.warn('[admin-ratings] Lecture Directus impossible.', error);
    return res.status(503).json({ error: 'ratings_unavailable' });
  }
});

/** PRNG déterministe : les données mock sont stables d'un appel à l'autre. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Données de démonstration réalistes (site sans trafic réel pour l'instant).
 * Volumes plausibles pour une microfinance locale : creux le week-end,
 * tendance douce, ~55-70 % de visites uniques par rapport aux pages vues.
 */
function buildMockTraffic(startStr: string, endStr: string, days: number | null) {
  const series: { day: string; count: number; visitors: number }[] = [];
  for (const d = new Date(`${startStr}T00:00:00Z`); isoDay(d) <= endStr; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = isoDay(d);
    const epochDay = Math.floor(d.getTime() / 86_400_000);
    const rnd = mulberry32(epochDay)();
    const weekday = d.getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.55 : 1;
    const trend = 1 + 0.25 * Math.sin(epochDay / 9);
    const count = Math.round((70 + rnd * 60) * weekendDip * trend);
    const visitors = Math.round(count * (0.52 + rnd * 0.16));
    series.push({ day, count, visitors });
  }

  const pageviews = series.reduce((a, s) => a + s.count, 0);
  const visits = series.reduce((a, s) => a + s.visitors, 0);
  const pv = (r: number) => Math.round(pageviews * r);
  const vi = (r: number) => Math.round(visits * r);

  return {
    configured: true,
    available: true,
    mock: true,
    start: startStr,
    end: endStr,
    days,
    pageviews,
    visits,
    events: 0,
    series,
    topPages: [
      { path: '/fr-FR/home', title: 'Accueil', count: pv(0.34), visitors: vi(0.36) },
      { path: '/fr-FR/services', title: 'Services & Produits', count: pv(0.22), visitors: vi(0.21) },
      { path: '/fr-FR/contacts', title: 'Contacts', count: pv(0.14), visitors: vi(0.14) },
      { path: '/fr-FR/career', title: 'Carrière', count: pv(0.12), visitors: vi(0.11) },
      { path: '/fr-FR/about', title: 'À propos', count: pv(0.1), visitors: vi(0.1) },
      { path: '/fr-FR/faq', title: 'FAQ', count: pv(0.05), visitors: vi(0.05) },
    ],
    topRefs: [
      { name: 'Google', count: pv(0.38), visitors: vi(0.4) },
      { name: '(direct)', count: pv(0.27), visitors: vi(0.26) },
      { name: 'Facebook', count: pv(0.16), visitors: vi(0.16) },
      { name: 'WhatsApp', count: pv(0.1), visitors: vi(0.1) },
      { name: 'LinkedIn', count: pv(0.06), visitors: vi(0.05) },
      { name: 'Bing', count: pv(0.03), visitors: vi(0.03) },
    ],
    locations: [
      { name: 'Cameroun', count: pv(0.78), visitors: vi(0.8) },
      { name: 'France', count: pv(0.09), visitors: vi(0.08) },
      { name: 'États-Unis', count: pv(0.05), visitors: vi(0.05) },
      { name: 'Canada', count: pv(0.04), visitors: vi(0.04) },
      { name: 'Allemagne', count: pv(0.02), visitors: vi(0.02) },
    ],
    browsers: [
      { name: 'Chrome', count: pv(0.62), visitors: vi(0.62) },
      { name: 'Safari', count: pv(0.14), visitors: vi(0.14) },
      { name: 'Opera', count: pv(0.1), visitors: vi(0.1) },
      { name: 'Firefox', count: pv(0.08), visitors: vi(0.08) },
      { name: 'Edge', count: pv(0.06), visitors: vi(0.06) },
    ],
    systems: [
      { name: 'Android', count: pv(0.58), visitors: vi(0.6) },
      { name: 'Windows', count: pv(0.24), visitors: vi(0.22) },
      { name: 'iOS', count: pv(0.12), visitors: vi(0.12) },
      { name: 'macOS', count: pv(0.04), visitors: vi(0.04) },
      { name: 'Linux', count: pv(0.02), visitors: vi(0.02) },
    ],
    sizes: [
      { name: 'Téléphone', count: pv(0.66), visitors: vi(0.68) },
      { name: 'PC / portable', count: pv(0.28), visitors: vi(0.26) },
      { name: 'Tablette', count: pv(0.06), visitors: vi(0.06) },
    ],
  };
}

registerSubmissionRoutes(app, { directusUrl: DIRECTUS_URL, directusToken: DIRECTUS_TOKEN });

/** Volumes de formulaires reçus, désormais comptés dans Directus. */
app.get('/api/admin/operational-counts', async (req, res) => {
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!activeSessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  if (!DIRECTUS_TOKEN) return res.status(503).json({ error: 'counts_unavailable' });

  try {
    const counts = await readOperationalCounts({ directusUrl: DIRECTUS_URL, directusToken: DIRECTUS_TOKEN });
    return res.status(200).json(counts);
  } catch (error) {
    console.warn('[admin-counts] Lecture Directus impossible.', error);
    return res.status(503).json({ error: 'counts_unavailable' });
  }
});

app.get('/api/metrics/traffic', async (req, res) => {
  const authHeader = req.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  if (!activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!GOATCOUNTER_TOKEN || !GOATCOUNTER_CODE) {
    return res.status(200).json({ configured: false });
  }

  // Période : preset `?days=7|30|90|365` (défaut 30) OU plage `?start&end` (YYYY-MM-DD).
  const now = new Date();
  const rawStart = typeof req.query['start'] === 'string' ? req.query['start'] : '';
  const rawEnd = typeof req.query['end'] === 'string' ? req.query['end'] : '';
  const daysParam = Number(req.query['days']);
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 30;

  let start: Date;
  let end = now;
  const customRange = /^\d{4}-\d{2}-\d{2}$/.test(rawStart) && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd);
  if (customRange) {
    start = new Date(`${rawStart}T00:00:00Z`);
    end = new Date(`${rawEnd}T00:00:00Z`);
  } else if (days === 365) {
    // L'année en cours (1er Janvier au 31 Décembre)
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  } else {
    start = new Date(now.getTime() - (days - 1) * 86_400_000);
  }

  const startStr = isoDay(start);
  const endStr = isoDay(end);
  const cacheKey = `${startStr}|${endStr}`;

  if (MOCK_ANALYTICS) {
    const mock = buildMockTraffic(startStr, endStr, customRange ? null : days);
    const toVisits = (rows: any[]) => rows.map((row) => ({
      ...row,
      visits: Number(row['visitors'] ?? 0),
    }));
    return res.status(200).json({
      ...mock,
      series: mock.series.map((point) => ({ day: point.day, visits: point.visitors })),
      topPages: toVisits(mock.topPages),
      topRefs: toVisits(mock.topRefs),
      locations: toVisits(mock.locations),
      browsers: toVisits(mock.browsers),
      systems: toVisits(mock.systems),
      sizes: toVisits(mock.sizes),
    });
  }

  const cached = trafficCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TRAFFIC_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const base = `https://${GOATCOUNTER_CODE}.goatcounter.com/api/v0`;
    const periodStart = `${startStr}T00:00:00Z`;
    const periodEnd = endStr === isoDay(now)
      ? new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString()
      : `${endStr}T23:00:00Z`;
    const period = new URLSearchParams({ start: periodStart, end: periodEnd }).toString();
    const headers = { Authorization: `Bearer ${GOATCOUNTER_TOKEN}`, Accept: 'application/json' };
    // Timeout défensif : l'endpoint ne doit jamais rester bloqué si GoatCounter est lent.
    const opts = { headers, signal: AbortSignal.timeout(10_000) } as const;

    const [totalRes, hitsRes, refsRes, locRes, browserRes, systemRes, sizeRes] = await Promise.all([
      fetch(`${base}/stats/total?${period}`, opts),
      fetch(`${base}/stats/hits?${period}&group=day&limit=100`, opts),
      fetch(`${base}/stats/toprefs?${period}&limit=6`, opts),
      fetch(`${base}/stats/locations?${period}&limit=6`, opts),
      fetch(`${base}/stats/browsers?${period}&limit=6`, opts),
      fetch(`${base}/stats/systems?${period}&limit=6`, opts),
      fetch(`${base}/stats/sizes?${period}&limit=6`, opts),
    ]);

    if (!totalRes.ok) {
      throw new Error(`GoatCounter total ${totalRes.status}`);
    }

    const asJson = async (r: Response) => (r.ok ? r.json() : null);
    const total = (await totalRes.json()) as {
      total?: number;
      total_events?: number;
      stats?: Array<{ day?: string; daily?: number; hourly?: number[] }>;
    };
    const hitsBody = ((await asJson(hitsRes)) as { hits?: any[] } | null) ?? { hits: [] };
    const hits = hitsBody.hits ?? [];

    /** Les dimensions GoatCounter renvoient des lignes avec un nom et un count de visites. */
    const mapNamed = (body: any) =>
      (((body?.stats ?? body?.refs ?? []) as any[]).map((r) => ({
        name: r?.name ?? r?.ref ?? '(direct)',
        visits: Number(r?.count ?? 0),
      })));

    const topRefs = mapNamed(await asJson(refsRes));
    const locations = mapNamed(await asJson(locRes));
    const browsers = mapNamed(await asJson(browserRes));
    const systems = mapNamed(await asJson(systemRes));
    const sizes = mapNamed(await asJson(sizeRes));

    const topPages = hits
      .filter((h) => h?.event !== true)
      .map((h) => ({
        path: h?.path ?? '',
        title: h?.title ?? '',
        visits: Number(h?.count ?? 0),
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);

    // Total de visites : approximation par somme des visiteurs uniques par page
    // (l'API v0 n'expose pas de total dédupliqué global sur une plage).
    const totalEvents = Number(total.total_events ?? 0);
    const visits = Math.max(0, Number(total.total ?? 0) - totalEvents);

    // Séries quotidiennes (pages vues + visites) ; jours sans trafic = 0.
    const dailyVisits = new Map<string, number>();
    for (const s of (total.stats ?? [])) {
        if (!s?.day) continue;
        const sum = (arr: unknown) =>
          Array.isArray(arr) ? arr.reduce((a: number, b: number) => a + (b || 0), 0) : 0;
        const daily = typeof s.daily === 'number' ? s.daily : sum(s.hourly);
        dailyVisits.set(s.day, daily);
    }
    const series: { day: string; visits: number }[] = [];
    if (days === 1) {
      const todayStats = (total.stats ?? []).find((stat) => stat.day === startStr);
      const hourly = todayStats?.hourly ?? [];
      const lastHour = endStr === isoDay(now) ? now.getUTCHours() : 23;
      for (let hour = 0; hour <= lastHour; hour += 1) {
        series.push({
          day: `${startStr}T${String(hour).padStart(2, '0')}:00:00Z`,
          visits: Number(hourly[hour] ?? 0),
        });
      }
    } else {
      for (const d = new Date(`${startStr}T00:00:00Z`); isoDay(d) <= endStr; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = isoDay(d);
        series.push({ day, visits: dailyVisits.get(day) ?? 0 });
      }
    }

    const data = {
      configured: true,
      available: true,
      start: startStr,
      end: endStr,
      days: customRange ? null : days,
      visits,
      events: total.total_events ?? null,
      series,
      topPages,
      topRefs,
      locations,
      browsers,
      systems,
      sizes,
    };

    trafficCache.set(cacheKey, { at: Date.now(), data });
    return res.status(200).json(data);
  } catch (error) {
    console.warn('[metrics] Récupération GoatCounter impossible.', error);
    return res.status(200).json({ configured: true, available: false });
  }
});

/**
 * Proxy même origine vers Directus. Le navigateur reste en HTTPS et le serveur
 * SSR communique avec l'instance Directus sur le réseau d'infrastructure.
 */
app.use('/directus', express.raw({ type: '*/*', limit: '12mb' }), async (req, res, next) => {
  try {
    const target = new URL(req.url, `${DIRECTUS_URL}/`);
    const headers = new Headers({ accept: req.get('accept') || '*/*' });
    const contentType = req.get('content-type');
    const authorization = req.get('authorization');

    if (contentType) headers.set('content-type', contentType);
    if (authorization) headers.set('authorization', authorization);
    else if (DIRECTUS_TOKEN && /^\/assets\//.test(req.url)) {
      // Les médias v2 restent privés dans Directus ; seul le proxy même origine
      // ajoute le jeton serveur pour leur lecture.
      headers.set('authorization', `Bearer ${DIRECTUS_TOKEN}`);
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0;
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
    });

    res.status(upstream.status);
    for (const name of ['content-type', 'cache-control', 'etag', 'last-modified', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    next(error);
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch((error) => next(error instanceof Error ? error : new Error(String(error))));
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
