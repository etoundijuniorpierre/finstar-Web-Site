import {
  Injectable,
  PLATFORM_ID,
  TransferState,
  computed,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TranslateService, TranslationObject } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { I18nService } from './i18n.service';

export interface V2Translation {
  languages_code: string;
  [field: string]: unknown;
}

interface TranslatedItem {
  translations: V2Translation[];
}

type ContentRecord = TranslatedItem & Record<string, unknown>;

export interface V2Faq extends TranslatedItem {
  id: number;
  sort: number;
  key: string;
  category: string;
}

export interface V2Agency extends TranslatedItem {
  id: number;
  sort: number;
  key: string;
  type: 'agence' | 'direction_generale';
  city: string;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  map_link?: string | null;
}

export type LocalizedAgency = Omit<V2Agency, 'translations'> & {
  name?: string;
  address?: string;
  hours?: string;
};

interface V2Snippet extends TranslatedItem {
  key: string;
}

interface DirectusV2State {
  siteSettings: ContentRecord | null;
  homePage: ContentRecord | null;
  servicesPage: ContentRecord | null;
  careersPage: ContentRecord | null;
  aboutPage: ContentRecord | null;
  contactSettings: ContentRecord | null;
  ctaBanner: ContentRecord | null;
  snippets: V2Snippet[];
  faq: V2Faq[];
  visions: ContentRecord[];
  stats: ContentRecord[];
  testimonials: ContentRecord[];
  creditProducts: ContentRecord[];
  productItems: ContentRecord[];
  creditCategories: ContentRecord[];
  loanProcess: ContentRecord[];
  aboutBlocks: ContentRecord[];
  partners: ContentRecord[];
  agencies: V2Agency[];
  jobOffers: ContentRecord[];
  accountTypes: ContentRecord[];
  accountOpeningGuides: ContentRecord[];
}

/** Exécute `task` sur chaque entrée avec au plus `limit` requêtes simultanées. */
async function mapLimited<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const DIRECTUS_V2_STATE = makeStateKey<DirectusV2State>('directus-v2-state');
const EMPTY_STATE: DirectusV2State = {
  siteSettings: null,
  homePage: null,
  servicesPage: null,
  careersPage: null,
  aboutPage: null,
  contactSettings: null,
  ctaBanner: null,
  snippets: [],
  faq: [],
  visions: [],
  stats: [],
  testimonials: [],
  creditProducts: [],
  productItems: [],
  creditCategories: [],
  loanProcess: [],
  aboutBlocks: [],
  partners: [],
  agencies: [],
  jobOffers: [],
  accountTypes: [],
  accountOpeningGuides: [],
};

/**
 * Contenu Directus partagé par tous les rendus d'un même processus serveur.
 *
 * Angular reconstruit un injecteur par rendu : sans ce cache, chaque page
 * pré-rendue relançait les 22 requêtes de contenu. Mesuré sur ce projet : 18
 * chargements complets par build, soit près de 400 requêtes strictement
 * identiques. C'est cette rafale — et non un manque de capacité de l'instance —
 * qui faisait échouer un build sur cinq.
 *
 * La péremption garde le cache honnête sur un serveur qui vit longtemps : un
 * build dure moins d'une minute et n'en voit jamais l'effet, tandis qu'un rendu
 * à la demande ne servira jamais un contenu vieux de plus d'une minute.
 */
const PEREMPTION_CACHE_MS = Number(process.env?.['DIRECTUS_CACHE_TTL_MS'] ?? 60_000);
let contenuPartage: { promesse: Promise<DirectusV2State>; expire: number } | null = null;

@Injectable({ providedIn: 'root' })
export class DirectusV2Service {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly transferState = inject(TransferState);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly state = signal<DirectusV2State>(EMPTY_STATE);
  private readonly readySignal = signal(false);

  readonly ready = this.readySignal.asReadonly();
  readonly siteSettings = computed(() => this.localizeOne(this.state().siteSettings, ['site_logo', 'agencies_hero_image']));
  readonly homePage = computed(() => this.localizeOne(this.state().homePage, ['hero_image']));
  readonly servicesPage = computed(() => this.localizeOne(this.state().servicesPage, ['intro_image']));
  readonly careersPage = computed(() => this.localizeOne(this.state().careersPage, ['intro_image']));
  readonly aboutPage = computed(() => this.localizeOne(this.state().aboutPage, ['image']));
  readonly contactSettings = computed<Record<string, unknown> | null>(() => {
    const item = this.localizeOne(this.state().contactSettings);
    if (!item) return null;
    const backgrounds = Array.isArray(item['backgrounds'])
      ? item['backgrounds'].map((value) => this.assetUrl(value)).filter(Boolean)
      : [];
    return { ...item, backgrounds };
  });
  readonly ctaBanner = computed(() => this.localizeOne(this.state().ctaBanner));
  readonly faq = computed(() => this.localize(this.state().faq));
  readonly visions = computed(() => this.localize(this.state().visions, ['image']));
  readonly stats = computed(() => this.localize(this.state().stats));
  readonly testimonials = computed(() => this.localize(this.state().testimonials, ['author_image']));
  readonly creditProducts = computed(() => this.localize(this.state().creditProducts, ['image']));
  readonly productItems = computed(() => this.localize(this.state().productItems, ['image']));
  readonly creditCategories = computed(() => this.localize(this.state().creditCategories));
  readonly loanProcess = computed(() => this.localize(this.state().loanProcess));
  readonly aboutBlocks = computed(() => this.localize(this.state().aboutBlocks));
  readonly partners = computed(() => this.localize(this.state().partners, ['logo']));
  readonly agencies = computed(() => this.localize(this.state().agencies, ['photo']) as LocalizedAgency[]);
  readonly jobOffers = computed(() => this.localize(this.state().jobOffers));
  readonly accountTypes = computed(() => this.localize(this.state().accountTypes));
  readonly accountOpeningGuides = computed(() => this.localize(this.state().accountOpeningGuides));

  constructor() {
    this.translate.onLangChange.subscribe(({ lang }) => {
      const current = this.state();
      if (this.hasContent(current)) this.applyLanguageOverlay(current, lang);
    });
  }

  async load(): Promise<void> {
    try {
      const hydrated = this.transferState.get(DIRECTUS_V2_STATE, EMPTY_STATE);
      if (isPlatformBrowser(this.platformId)) {
        if (hydrated !== EMPTY_STATE && this.hasContent(hydrated)) {
          this.state.set(hydrated);
          await this.applyEditorialTranslations(hydrated);
          this.transferState.remove(DIRECTUS_V2_STATE);
        }
        return;
      }

      if (!isPlatformServer(this.platformId)) return;
      const loaded = await this.chargerAvecCache();
      this.state.set(loaded);
      this.transferState.set(DIRECTUS_V2_STATE, loaded);
      await this.applyEditorialTranslations(loaded);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('DIRECTUS_TOKEN absent')) {
        console.warn('[Directus v2] Fallback legacy/i18n activé:', error);
      }
    } finally {
      // Une absence de configuration ou une panne Directus ne doit jamais
      // laisser les pages dans un état de chargement infini.
      this.readySignal.set(true);
    }
  }

  assetUrl(file: unknown): string | null {
    if (!file) return null;
    if (typeof file === 'string' && /^(?:https?:)?\/\//.test(file)) return file;
    const id = typeof file === 'string'
      ? file
      : typeof file === 'object'
        ? String((file as { id?: unknown; directus_files_id?: unknown }).id
          ?? (file as { directus_files_id?: unknown }).directus_files_id ?? '')
        : '';
    if (!id) return null;
    return `${environment.browserApiUrl.replace(/\/$/, '')}/assets/${encodeURIComponent(id)}`;
  }

  private hasContent(state: DirectusV2State): boolean {
    return Boolean(state.homePage || state.siteSettings || state.snippets.length || state.faq.length);
  }

  /**
   * Renvoie le contenu du cache de processus, ou lance un unique chargement que
   * les rendus concurrents partagent.
   */
  private async chargerAvecCache(): Promise<DirectusV2State> {
    const maintenant = Date.now();
    if (contenuPartage && contenuPartage.expire > maintenant) {
      return contenuPartage.promesse;
    }
    const promesse = this.loadFromDirectus();
    contenuPartage = { promesse, expire: maintenant + PEREMPTION_CACHE_MS };
    try {
      // Chaque rendu reçoit sa propre copie : un état partagé par référence
      // ferait fuir la moindre mutation d'une page vers les suivantes.
      return structuredClone(await promesse);
    } catch (error) {
      // Un échec ne doit pas être mémorisé : la page suivante doit pouvoir
      // retenter, sinon une seule panne passagère condamne tout le build.
      contenuPartage = null;
      throw error;
    }
  }

  private async loadFromDirectus(): Promise<DirectusV2State> {
    const token = this.serverToken();
    if (!token) throw new Error('DIRECTUS_TOKEN absent du serveur SSR.');

    const singletonNames = [
      'site_settings', 'home_page', 'services_page', 'careers_page',
      'about_page', 'contact_settings', 'cta_banner',
    ] as const;
    const collectionNames = [
      'content_snippets', 'faq', 'visions', 'stats', 'testimonials',
      'credit_products', 'product_items', 'credit_categories', 'loan_process',
      'about_blocks', 'partners', 'agencies', 'job_offers',
      'account_types', 'account_opening_guides',
    ] as const;
    // Le prerender lance plusieurs workers : 22 requêtes simultanées par worker
    // saturaient Directus (HTTP 503) et faisaient basculer TOUTE la page en
    // fallback legacy, silencieusement. On limite donc la concurrence.
    const singletonValues = await mapLimited(singletonNames, 4, (name) => this.readSingleton(name, token));
    const collectionValues = await mapLimited(collectionNames, 4, (name) => this.readCollection(name, token));
    const [
      siteSettings, homePage, servicesPage, careersPage, aboutPage, contactSettings, ctaBanner,
    ] = singletonValues;
    const [
      snippets, faq, visions, stats, testimonials, creditProducts, productItems,
      creditCategories, loanProcess, aboutBlocks, partners, agencies, jobOffers,
      accountTypes, accountOpeningGuides,
    ] = collectionValues;
    return {
      siteSettings, homePage, servicesPage, careersPage, aboutPage, contactSettings, ctaBanner,
      snippets: snippets as unknown as V2Snippet[], faq: faq as unknown as V2Faq[], visions, stats, testimonials,
      creditProducts, productItems, creditCategories, loanProcess, aboutBlocks, partners,
      agencies: agencies as unknown as V2Agency[], jobOffers,
      accountTypes, accountOpeningGuides,
    };
  }

  private async readSingleton(collection: string, token: string): Promise<ContentRecord | null> {
    const response = await this.request(collection, new URLSearchParams({ fields: '*,translations.*' }), token);
    const data = response as ContentRecord | ContentRecord[] | null;
    return Array.isArray(data) ? data[0] ?? null : data;
  }

  private async readCollection(collection: string, token: string): Promise<ContentRecord[]> {
    const params = new URLSearchParams({ fields: '*,translations.*', limit: '-1', sort: 'sort' });
    params.set('filter[status][_eq]', 'published');
    const data = await this.request(collection, params, token);
    return Array.isArray(data) ? data as ContentRecord[] : [];
  }

  private async request(collection: string, params: URLSearchParams, token: string): Promise<unknown> {
    const runtimeUrl = typeof process !== 'undefined' ? process.env?.['DIRECTUS_URL'] || '' : '';
    const baseUrl = (runtimeUrl || environment.apiUrl).replace(/\/$/, '');
    const url = `${baseUrl}/items/${collection}?${params}`;

    // Directus renvoie 502/503/504/429 quand plusieurs workers de prerender le
    // sollicitent en rafale. Sans réessai, une seule réponse en erreur suffisait
    // à faire échouer le build entier — et donc le déploiement.
    const REJOUABLES = new Set([429, 502, 503, 504]);
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30_000),
        });
        if (response.ok) {
          const body = await response.json() as { data?: unknown };
          return body.data ?? null;
        }
        if (!REJOUABLES.has(response.status)) {
          throw new Error(`${collection}: HTTP ${response.status}`);
        }
        lastError = new Error(`${collection}: HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
    throw lastError instanceof Error ? lastError : new Error(`${collection}: échec`);
  }

  private serverToken(): string {
    return typeof process !== 'undefined' ? process.env?.['DIRECTUS_TOKEN'] || '' : '';
  }

  private localizeOne(item: ContentRecord | null, fileFields: string[] = []): Record<string, unknown> | null {
    if (!item) return null;
    return this.localize([item], fileFields)[0] ?? null;
  }

  private localize<T extends TranslatedItem>(items: T[], fileFields: string[] = []): Array<Omit<T, 'translations'> & Record<string, unknown>> {
    const language = this.i18n.currentLanguage();
    return items.map((item) => {
      const translation = item.translations?.find((entry) => entry.languages_code === language)
        ?? item.translations?.find((entry) => entry.languages_code === 'fr-FR')
        ?? {};
      const { translations, ...root } = item;
      const { id: _translationId, languages_code: _lang, ...translated } = translation as Record<string, unknown>;
      for (const key of Object.keys(translated)) {
        if (key.endsWith('_id')) delete translated[key];
      }
      const localized: Record<string, unknown> = { ...root, ...translated };
      for (const fileField of fileFields) localized[fileField] = this.assetUrl(localized[fileField]);
      return localized as Omit<T, 'translations'> & Record<string, unknown>;
    });
  }

  private async applyEditorialTranslations(state: DirectusV2State): Promise<void> {
    const language = this.i18n.currentLanguage();
    await firstValueFrom(this.translate.use(language));
    this.applyLanguageOverlay(state, language);
  }

  private applyLanguageOverlay(state: DirectusV2State, language: string): void {
    const overlay: TranslationObject = {};
    for (const snippet of state.snippets) {
      const translated = snippet.translations?.find((entry) => entry.languages_code === language)?.['content'];
      if (typeof translated === 'string') this.setNested(overlay, snippet.key, translated);
    }
    for (const faq of state.faq) {
      const translated = faq.translations?.find((entry) => entry.languages_code === language);
      if (typeof translated?.['question'] === 'string') this.setNested(overlay, `FAQ.Q${faq.sort}`, translated['question']);
      if (typeof translated?.['answer'] === 'string') this.setNested(overlay, `FAQ.A${faq.sort}`, translated['answer']);
    }
    this.translate.setTranslation(language, overlay, true);
  }

  private setNested(target: TranslationObject, path: string, value: string): void {
    const parts = path.split('.');
    let cursor = target;
    for (const part of parts.slice(0, -1)) {
      const next = cursor[part];
      if (!next || typeof next !== 'object') cursor[part] = {};
      cursor = cursor[part] as TranslationObject;
    }
    cursor[parts.at(-1)!] = value;
  }
}
