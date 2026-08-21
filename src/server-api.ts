/**
 * Routes serveur du site : administration, avis, trafic, formulaires et relais
 * Directus.
 *
 * Elles suivent l'interface Web standard (`Request`/`Response`), forme exigée
 * par l'hébergeur pour exécuter le rendu serveur. Les secrets — jeton Directus,
 * jeton GoatCounter — ne sortent jamais d'ici : le navigateur n'appelle que ces
 * routes, servies depuis la même origine.
 */
import crypto from 'node:crypto';
import { environment } from './environments/environment';
import {
  clientIp,
  handleSubmissionRequest,
  readOperationalCounts,
  type SubmissionsOptions,
} from './server-submissions';

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

const submissionsOptions: SubmissionsOptions = {
  directusUrl: DIRECTUS_URL,
  directusToken: DIRECTUS_TOKEN,
};

const trafficCache = new Map<string, { at: number; data: unknown }>();
const activeSessions = new Set<string>();
const ratingAttempts = new Map<string, number[]>();

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const bearer = (request: Request): string =>
  (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ admin */

async function adminLogin(request: Request): Promise<Response> {
  const body = await readJson(request);
  const userName = typeof body['userName'] === 'string' ? body['userName'].trim() : '';
  const password = typeof body['password'] === 'string' ? body['password'] : '';

  if (!userName || !password) return Response.json({ authenticated: false }, { status: 400 });

  try {
    const query = new URLSearchParams({
      'filter[UserName][_eq]': userName,
      fields: 'id,PassWord',
      limit: '1',
    });

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (DIRECTUS_TOKEN) headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;

    const upstream = await fetch(`${DIRECTUS_URL}/items/AdminConnexion?${query}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      console.warn(`[admin-login] Directus AdminConnexion inaccessible: HTTP ${upstream.status}`);
      return Response.json({ authenticated: false }, { status: 401 });
    }

    const payload = await upstream.json() as { data?: Array<{ PassWord?: string }> };
    const authenticated = Array.isArray(payload.data)
      && payload.data.some((entry) => entry.PassWord === password);

    if (authenticated) {
      const token = crypto.randomUUID();
      activeSessions.add(token);
      return Response.json({ authenticated: true, token }, { status: 200 });
    }

    return Response.json({ authenticated: false }, { status: 401 });
  } catch (error) {
    console.warn('[admin-login] Verification AdminConnexion impossible.', error);
    return Response.json({ authenticated: false }, { status: 401 });
  }
}

async function adminVerify(request: Request): Promise<Response> {
  const body = await readJson(request);
  const token = typeof body['token'] === 'string' ? body['token'] : '';
  return token && activeSessions.has(token)
    ? Response.json({ valid: true }, { status: 200 })
    : Response.json({ valid: false }, { status: 401 });
}

/* ------------------------------------------------------------------ avis */

async function postRating(request: Request): Promise<Response> {
  const body = await readJson(request);
  const score = Number(body['score']);
  const comment = typeof body['comment'] === 'string' ? body['comment'].trim().slice(0, 1000) : '';
  const requestedPage = typeof body['page'] === 'string' ? body['page'].trim().slice(0, 180) : '/';
  const page = requestedPage.startsWith('/') ? requestedPage : '/';
  const lang = body['lang'] === 'en-US' ? 'en-US' : 'fr-FR';
  const honeypot = typeof body['company'] === 'string' ? body['company'] : '';

  if (honeypot) return Response.json({ accepted: true }, { status: 202 });
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return Response.json({ accepted: false, error: 'invalid_score' }, { status: 400 });
  }
  if (!DIRECTUS_TOKEN) {
    return Response.json({ accepted: false, error: 'ratings_unavailable' }, { status: 503 });
  }

  const ip = clientIp(request);
  const now = Date.now();
  const recent = (ratingAttempts.get(ip) || []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (recent.length >= 5) {
    return Response.json({ accepted: false, error: 'rate_limited' }, { status: 429 });
  }
  recent.push(now);
  ratingAttempts.set(ip, recent);

  try {
    const upstream = await fetch(`${DIRECTUS_URL}/items/site_ratings`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
      body: JSON.stringify({
        score,
        emoji: ['', '😞', '🙁', '😐', '🙂', '⭐'][score],
        comment: comment || null,
        page,
        lang,
        user_agent: request.headers.get('User-Agent')?.slice(0, 500) || null,
        ip_hash: crypto.createHash('sha256').update(`${ip}|${RATING_HASH_SALT}`).digest('hex'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);
    return Response.json({ accepted: true }, { status: 201 });
  } catch (error) {
    console.warn('[ratings] Écriture Directus impossible.', error);
    return Response.json({ accepted: false, error: 'ratings_unavailable' }, { status: 503 });
  }
}

async function adminRatings(request: Request, url: URL): Promise<Response> {
  if (!activeSessions.has(bearer(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!DIRECTUS_TOKEN) return Response.json({ error: 'ratings_unavailable' }, { status: 503 });

  try {
    const query = new URLSearchParams({
      fields: 'score,emoji,comment,page,lang,date_created', sort: '-date_created', limit: '-1',
    });

    // Même découpage temporel que le trafic, pour que les deux sections de la
    // page admin décrivent toujours la même période.
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';
    if (start && end) {
      query.set('filter[date_created][_gte]', `${start}T00:00:00Z`);
      query.set('filter[date_created][_lte]', `${end}T23:59:59Z`);
    } else {
      const days = Math.min(3650, Math.max(1, Number(url.searchParams.get('days')) || 30));
      const from = new Date(Date.now() - (days - 1) * 86_400_000);
      query.set('filter[date_created][_gte]', `${from.toISOString().slice(0, 10)}T00:00:00Z`);
    }

    const upstream = await fetch(`${DIRECTUS_URL}/items/site_ratings?${query}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`Directus HTTP ${upstream.status}`);

    const payload = await upstream.json() as {
      data?: Array<{ score: number; emoji?: string; comment?: string; page?: string; lang?: string; date_created?: string }>;
    };
    const rows = payload.data || [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    for (const row of rows) if (distribution[row.score] !== undefined) distribution[row.score] += 1;
    const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length : 0;

    return Response.json({
      total: rows.length,
      average: Number(average.toFixed(2)),
      distribution,
      recent: rows.filter((row) => row.comment).slice(0, 10),
    }, { status: 200 });
  } catch (error) {
    console.warn('[admin-ratings] Lecture Directus impossible.', error);
    return Response.json({ error: 'ratings_unavailable' }, { status: 503 });
  }
}

async function adminCounts(request: Request): Promise<Response> {
  if (!activeSessions.has(bearer(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!DIRECTUS_TOKEN) return Response.json({ error: 'counts_unavailable' }, { status: 503 });

  try {
    return Response.json(await readOperationalCounts(submissionsOptions), { status: 200 });
  } catch (error) {
    console.warn('[admin-counts] Lecture Directus impossible.', error);
    return Response.json({ error: 'counts_unavailable' }, { status: 503 });
  }
}

/* --------------------------------------------------------------- trafic */

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

async function metricsTraffic(request: Request, url: URL): Promise<Response> {
  if (!activeSessions.has(bearer(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!GOATCOUNTER_TOKEN || !GOATCOUNTER_CODE) {
    return Response.json({ configured: false }, { status: 200 });
  }

  // Période : preset `?days=7|30|90|365` (défaut 30) OU plage `?start&end` (YYYY-MM-DD).
  const now = new Date();
  const rawStart = url.searchParams.get('start') || '';
  const rawEnd = url.searchParams.get('end') || '';
  const daysParam = Number(url.searchParams.get('days'));
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
    const toVisits = (rows: Array<Record<string, unknown>>) => rows.map((row) => ({
      ...row,
      visits: Number(row['visitors'] ?? 0),
    }));
    return Response.json({
      ...mock,
      series: mock.series.map((point) => ({ day: point.day, visits: point.visitors })),
      topPages: toVisits(mock.topPages),
      topRefs: toVisits(mock.topRefs),
      locations: toVisits(mock.locations),
      browsers: toVisits(mock.browsers),
      systems: toVisits(mock.systems),
      sizes: toVisits(mock.sizes),
    }, { status: 200 });
  }

  const cached = trafficCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TRAFFIC_TTL_MS) {
    return Response.json(cached.data, { status: 200 });
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

    if (!totalRes.ok) throw new Error(`GoatCounter total ${totalRes.status}`);

    const asJson = async (r: Response) => (r.ok ? r.json() : null);
    const total = (await totalRes.json()) as {
      total?: number;
      total_events?: number;
      stats?: Array<{ day?: string; daily?: number; hourly?: number[] }>;
    };
    const hitsBody = ((await asJson(hitsRes)) as { hits?: Array<Record<string, unknown>> } | null) ?? { hits: [] };
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

    const topPages = (hits as any[])
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

    // Séries quotidiennes ; jours sans trafic = 0.
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
    return Response.json(data, { status: 200 });
  } catch (error) {
    console.warn('[metrics] Récupération GoatCounter impossible.', error);
    return Response.json({ configured: true, available: false }, { status: 200 });
  }
}

/* ------------------------------------------------------- relais Directus */

/**
 * Relais même origine vers Directus : le navigateur reste sur le domaine du
 * site, en HTTPS, tandis que l'instance n'est jointe qu'en HTTP côté serveur.
 */
async function proxyDirectus(request: Request, url: URL): Promise<Response> {
  try {
    const target = new URL(`${url.pathname.replace(/^\/directus/, '')}${url.search}`, `${DIRECTUS_URL}/`);
    const headers = new Headers({ accept: request.headers.get('accept') || '*/*' });
    const contentType = request.headers.get('content-type');
    const authorization = request.headers.get('authorization');

    if (contentType) headers.set('content-type', contentType);
    if (authorization) headers.set('authorization', authorization);
    else if (DIRECTUS_TOKEN && target.pathname.startsWith('/assets/')) {
      // Certains médias restent privés dans Directus ; seul ce relais ajoute le
      // jeton serveur pour leur lecture.
      headers.set('authorization', `Bearer ${DIRECTUS_TOKEN}`);
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });

    const out = new Headers();
    for (const name of ['content-type', 'cache-control', 'etag', 'last-modified', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: out });
  } catch (error) {
    console.warn('[directus-proxy] Relais impossible.', error);
    return new Response('Bad Gateway', { status: 502 });
  }
}

/* ------------------------------------------------------------- aiguillage */

/**
 * Traite les routes serveur. Renvoie `null` quand la requête ne relève pas
 * d'elles : le rendu Angular prend alors le relais.
 */
export async function handleServerRoutes(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith('/directus/') || path === '/directus') {
    return proxyDirectus(request, url);
  }

  if (!path.startsWith('/api/')) return null;

  if (request.method === 'POST') {
    if (path === '/api/admin/login') return adminLogin(request);
    if (path === '/api/admin/verify') return adminVerify(request);
    if (path === '/api/ratings') return postRating(request);
    const submission = handleSubmissionRequest(request, path, submissionsOptions);
    if (submission) return submission;
  }

  if (request.method === 'GET') {
    if (path === '/api/admin/ratings') return adminRatings(request, url);
    if (path === '/api/admin/operational-counts') return adminCounts(request);
    if (path === '/api/metrics/traffic') return metricsTraffic(request, url);
  }

  return Response.json({ error: 'not_found' }, { status: 404 });
}
