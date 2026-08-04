import {
  inject,
  Injectable,
  signal,
  computed,
  WritableSignal,
  TransferState,
  PLATFORM_ID,
  effect,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseCandidature, SupabaseContact } from '../types/supabase';
import { environment } from '../environments/environment';
import {
  AccountType,
  EnrichedPageSection,
  GlobalSettings,
  Page,
  PageSection,
  PageSectionAccountTypes,
  PageSectionFiles,
  PageSectionsRelation,
  PageSectionStatistics,
  PageSectionTestimonials,
  PageWithSections,
  Schema,
  Statistic,
  Testimonial,
  GlobalSettingsTranslation,
  PageSectionTranslation,
  AccountTypeTranslation,
  StatisticTranslation,
  TestimonialTranslation,
  Product,
  ProductTranslation,
  Items,
  ItemsTranslation,
  Vision,
  VisionTranslation,
  PageProductRelation,
  PageVisionRelation,
  PageSectionProduct,
  ProductItems,
} from '../types/directus';
import {
  ACCOUNT_TYPES_KEY,
  GLOBAL_SETTINGS_KEY,
  PAGE_SECTIONS_ACCOUNT_TYPES_KEY,
  PAGE_SECTIONS_FILES_KEY,
  PAGE_SECTIONS_KEY,
  PAGE_SECTIONS_RELATIONS_KEY,
  PAGE_SECTIONS_STATISTICS_KEY,
  PAGE_SECTIONS_TESTIMONIALS_KEY,
  PAGES_KEY,
  STATISTICS_KEY,
  TESTIMONIALS_KEY,
  PRODUCTS_KEY,
  PRODUCT_TRANSLATIONS_KEY,
  ITEMS_KEY,
  ITEMS_TRANSLATIONS_KEY,
  VISION_KEY,
  VISION_TRANSLATIONS_KEY,
  PAGE_PRODUCT_RELATIONS_KEY,
  PAGE_VISION_RELATIONS_KEY,
  PAGE_SECTION_PRODUCT_RELATIONS_KEY,
  PRODUCT_ITEMS_RELATIONS_KEY,
} from '../assets/state-keys';
import {
  createDirectus,
  readItems,
  rest,
  createItem,
  uploadFiles,
} from '@directus/sdk';
import { AppData } from '../types/app-data';
import { I18nService } from './i18n.service';

/**
 * Déduplique uniquement les requêtes EN VOL (plusieurs services demandent la même
 * collection au démarrage). L'entrée est retirée dès que la promesse est réglée :
 * sans cela, la donnée resterait figée pour toute la durée du process — en SSR le
 * module vit aussi longtemps que le serveur Node, qui servirait donc du périmé
 * jusqu'à son redémarrage.
 */
const sharedReadCache = new Map<string, Promise<unknown>>();

/**
 * Retourne la valeur traduite si elle est réellement renseignée, sinon la valeur
 * racine (qui sert de défaut). Une chaîne vide compte comme « non renseignée » :
 * vider un champ de traduction dans Directus doit retomber sur la racine plutôt
 * que d'afficher du blanc sur le site.
 */
function preferTranslation<T>(
  translated: T | null | undefined,
  fallback: T,
): T {
  if (translated === null || translated === undefined) return fallback;
  if (typeof translated === 'string' && translated.trim() === '')
    return fallback;
  return translated as T;
}

/**
 * Normalisation de transition pour les anciennes valeurs encore présentes
 * dans Directus. Elle évite qu'un ancien libellé réapparaisse pendant la
 * migration des contenus, sans modifier les noms de produits comme FINSAVE.
 */
function normalizeFinstarText(value: string | null | undefined): string | null {
  if (value == null) return null;

  // Signature de marque conservée telle quelle selon la consigne métier.
  const signature = "FINSTAR, l'étoile de la microfinance !";
  const englishSignature = 'FINSTAR, the star of microfinance!';
  const signaturePlaceholder = '__FINSTAR_SIGNATURE__';
  const englishSignaturePlaceholder = '__FINSTAR_EN_SIGNATURE__';

  return value
    .replaceAll(signature, signaturePlaceholder)
    .replaceAll(englishSignature, englishSignaturePlaceholder)
    .replace(
      'Une microfinance agréée pour accompagner les projets des Camerounais',
      'Un établissement de microfinance étoilée qui éclaire vos projets et accompagne votre réussite',
    )
    .replace(
      'FINSTAR-CM S.A. accompagne les particuliers, entrepreneurs et PME avec des solutions d’épargne, de crédit et de conseil portées par un établissement de microfinance de deuxième catégorie',
      'FINSTAR-CM S.A. accompagne les particuliers, les associations, les entrepreneurs ainsi que les très petites, petites et moyennes entreprises en leur offrant des solutions d’épargne, de financement et d’accompagnement adaptées à leurs besoins, afin de transformer leurs ambitions en réussites durables',
    )
    .replace(
      'An approved microfinance institution supporting the projects of Cameroonians',
      'A star microfinance institution that illuminates your projects and supports your success',
    )
    .replace(
      'FINSTAR-CM S.A. supports individuals, entrepreneurs and SMEs with savings, credit and advisory solutions delivered by a second-tier microfinance institution.',
      'FINSTAR-CM S.A. supports individuals, associations, entrepreneurs, very small, small and medium-sized enterprises with savings, financing and advisory solutions tailored to their needs, helping turn ambitions into lasting success.',
    )
    .replace(
      '500 FCFA, plus un carnet de collecte à 500 FCFA',
      '1 000 FCFA, répartis comme suit : 500 FCFA correspondant au premier dépôt sur le compte et 500 FCFA pour le carnet de collecte',
    )
    .replace(
      'Retrait à distance ou procuration sous 50 000 FCFA',
      'Le retrait à distance est disponible pour les montants inférieurs à 50 000 FCFA. Toute procuration est traitée selon les conditions applicables en agence.',
    )
    .replace(
      '500 FCFA, plus a collection booklet at 500 FCFA',
      '1,000 FCFA, split as follows: 500 FCFA for the first account deposit and 500 FCFA for the collection booklet',
    )
    .replace(
      'Remote withdrawal or proxy under 50,000 FCFA',
      'Remote withdrawals are available for amounts below 50,000 FCFA. Proxies are handled according to the conditions applicable at the branch.',
    )
    .replace(
      'Rejoignez plus de 4 000 clients accompagnés',
      'Rejoignez plus de 1 500 clients accompagnés',
    )
    .replace(
      'Join more than 4,000 clients supported',
      'Join more than 1,500 clients supported',
    )
    .replace(/\bFINSTAR\b(?!-CM)/g, 'FINSTAR-CM')
    .replace(
      /\b(\d{4,})\s*FCFA\b/g,
      (_, amount: string) =>
        `${Number(amount)
          .toLocaleString('fr-FR')
          .replace(/\u202f/g, ' ')} FCFA`,
    )
    .replace(/\.{2,}/g, '.')
    .replaceAll(signaturePlaceholder, signature)
    .replaceAll(englishSignaturePlaceholder, englishSignature)
    .trim();
}

@Injectable({ providedIn: 'root' })
export class DirectusSdkService {
  private readonly transferState = inject(TransferState);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly apiUrl = this.isBrowser
    ? environment.browserApiUrl
    : environment.apiUrl;
  // The SDK constructs a URL immediately, so resolve the browser proxy path
  // against the current origin while keeping apiUrl relative for fetch calls.
  private readonly directusClientUrl = this.isBrowser
    ? new URL(environment.browserApiUrl, window.location.origin).toString()
    : environment.apiUrl;
  private readonly directusClient = createDirectus<Schema>(
    this.directusClientUrl,
  ).with(rest());
  private readonly i18nService = inject(I18nService);

  private readonly globalSettings = signal<GlobalSettings | null>(null);
  private readonly accountTypes = signal<AccountType[]>([]);
  private readonly sections = signal<PageSection[]>([]);
  private readonly pages = signal<Page[]>([]);
  private readonly statistics = signal<Statistic[]>([]);
  private readonly testimonials = signal<Testimonial[]>([]);
  private readonly pageSectionsRelations = signal<PageSectionsRelation[]>([]);
  private readonly sectionStatisticsRelations = signal<PageSectionStatistics[]>(
    [],
  );
  private readonly sectionTestimonialsRelations = signal<
    PageSectionTestimonials[]
  >([]);
  private readonly sectionAccountTypesRelations = signal<
    PageSectionAccountTypes[]
  >([]);
  private readonly accountTypeTranslations = signal<AccountTypeTranslation[]>(
    [],
  );
  private readonly statisticTranslations = signal<StatisticTranslation[]>([]);
  private readonly testimonialTranslations = signal<TestimonialTranslation[]>(
    [],
  );
  private readonly globalSettingsTranslations = signal<
    GlobalSettingsTranslation[]
  >([]);
  private readonly pageSectionTranslations = signal<PageSectionTranslation[]>(
    [],
  );
  private readonly sectionFilesRelations = signal<PageSectionFiles[]>([]);
  private readonly products = signal<Product[]>([]);
  private readonly productTranslations = signal<ProductTranslation[]>([]);
  private readonly items = signal<Items[]>([]);
  private readonly itemsTranslations = signal<ItemsTranslation[]>([]);
  private readonly vision = signal<Vision[]>([]);
  private readonly visionTranslations = signal<VisionTranslation[]>([]);
  private readonly pageProductRelations = signal<PageProductRelation[]>([]);
  private readonly pageVisionRelations = signal<PageVisionRelation[]>([]);
  private readonly pageSectionProductRelations = signal<PageSectionProduct[]>(
    [],
  );
  private readonly productItemsRelations = signal<any[]>([]);

  private readonly currentLanguage = computed(() =>
    this.i18nService.currentLanguage(),
  );

  // Interface publique en lecture seule
  public readonly settings = this.globalSettings.asReadonly();
  public readonly accounts = this.accountTypes.asReadonly();
  public readonly allPages = this.pages.asReadonly();
  public readonly allSections = this.sections.asReadonly();
  public readonly stats = this.statistics.asReadonly();
  public readonly testimonialsData = this.testimonials.asReadonly();
  public readonly pageSectionsRels = this.pageSectionsRelations.asReadonly();
  public readonly accountTypeTranslationsData =
    this.accountTypeTranslations.asReadonly();
  public readonly statisticTranslationsData =
    this.statisticTranslations.asReadonly();
  public readonly testimonialTranslationsData =
    this.testimonialTranslations.asReadonly();
  public readonly globalSettingsTranslationsData =
    this.globalSettingsTranslations.asReadonly();
  public readonly pageSectionTranslationsData =
    this.pageSectionTranslations.asReadonly();
  public readonly sectionStatsRels =
    this.sectionStatisticsRelations.asReadonly();
  public readonly sectionTestimonialsRels =
    this.sectionTestimonialsRelations.asReadonly();
  public readonly sectionAccountTypesRels =
    this.sectionAccountTypesRelations.asReadonly();
  public readonly sectionFilesRels = this.sectionFilesRelations.asReadonly();
  public readonly productsData = this.products.asReadonly();
  public readonly productTranslationsData =
    this.productTranslations.asReadonly();
  public readonly itemsData = this.items.asReadonly();
  public readonly itemsTranslationsData = this.itemsTranslations.asReadonly();
  public readonly visionData = this.vision.asReadonly();
  public readonly visionTranslationsData = this.visionTranslations.asReadonly();
  public readonly pageProductRelationsData =
    this.pageProductRelations.asReadonly();
  public readonly pageVisionRelationsData =
    this.pageVisionRelations.asReadonly();
  public readonly pageSectionProductRelationsData =
    this.pageSectionProductRelations.asReadonly();
  public readonly productItemsRelationsData =
    this.productItemsRelations.asReadonly();

  // Signaux de chargement pour chaque entité
  private readonly loadingStates = signal<Record<string, boolean>>({});
  private readonly errorStates = signal<Record<string, string | null>>({});

  constructor() {
    // Réagir aux changements de langue
    effect(() => {
      const lang = this.currentLanguage();
      // Forcer le recalcul des computed values quand la langue change
      this.translatedSettings();
      this.pagesWithSections();
    });
  }

  // Nouveau signal pour les paramètres globaux traduits
  public readonly translatedSettings = computed(() => {
    const settings = this.globalSettings();
    return settings ? this.getTranslatedGlobalSettings(settings) : null;
  });

  // Méthode pour obtenir la traduction d'une section
  private getTranslatedAccountType(account: AccountType): AccountType {
    const lang = this.currentLanguage();
    const translation = this.accountTypeTranslations().find(
      (t) =>
        t.Account_types_account_id === account.account_id &&
        t.languages_code === lang,
    );

    if (!translation) {
      return {
        ...account,
        Description:
          normalizeFinstarText(account.Description) ?? account.Description,
        full_description:
          normalizeFinstarText(account.full_description) ??
          account.full_description,
      };
    }

    return {
      ...account,
      account_name: preferTranslation(
        translation.account_name,
        account.account_name,
      ),
      Description:
        normalizeFinstarText(
          preferTranslation(translation.Description, account.Description),
        ) ?? account.Description,
      full_description:
        normalizeFinstarText(
          preferTranslation(
            translation.full_description,
            account.full_description,
          ),
        ) ?? account.full_description,
    };
  }

  private getTranslatedStatistic(statistic: Statistic): Statistic {
    const lang = this.currentLanguage();
    const translation = this.statisticTranslations().find(
      (t) =>
        t.Statistics_statistics_id === statistic.statistics_id &&
        t.languages_code === lang,
    );

    if (!translation) return statistic;

    return {
      ...statistic,
      value: preferTranslation(translation.value, statistic.value),
      label: preferTranslation(translation.label, statistic.label),
    };
  }

  private getTranslatedTestimonial(testimonial: Testimonial): Testimonial {
    const lang = this.currentLanguage();
    const translation = this.testimonialTranslations().find(
      (t) =>
        t.Testimonials_testimonials_id === testimonial.testimonials_id &&
        t.languages_code === lang,
    );

    if (!translation) return testimonial;

    return {
      ...testimonial,
      author_title: preferTranslation(
        translation.author_title,
        testimonial.author_title,
      ),
      Quote: preferTranslation(translation.Quote, testimonial.Quote),
    };
  }

  private getTranslatedSection(section: PageSection): PageSection {
    const lang = this.currentLanguage();
    const translation = this.pageSectionTranslations().find(
      (t) =>
        t.Pages_sections_Pages_sections_id === section.Pages_sections_id &&
        t.languages_code === lang,
    );

    if (!translation) {
      return {
        ...section,
        headline: normalizeFinstarText(section.headline),
        subheadline: normalizeFinstarText(section.subheadline),
        body_content: normalizeFinstarText(section.body_content),
      };
    }

    return {
      ...section,
      headline: normalizeFinstarText(
        preferTranslation(translation.headline, section.headline),
      ),
      subheadline: normalizeFinstarText(
        preferTranslation(translation.subheadline, section.subheadline),
      ),
      headlines2: preferTranslation(translation.headlines2, section.headlines2),
      body_content: normalizeFinstarText(
        preferTranslation(translation.body_content, section.body_content),
      ),
      call_to_action: preferTranslation(
        translation.call_to_action,
        section.call_to_action,
      ),
      call_to_action_link: preferTranslation(
        translation.call_to_action_link,
        section.call_to_action_link,
      ),
      subheadline2: preferTranslation(
        translation.subheadline2,
        section.subheadline2,
      ),
      table_data: preferTranslation(translation.table_data, section.table_data),
    };
  }

  private getTranslatedGlobalSettings(
    settings: GlobalSettings,
  ): GlobalSettings {
    const lang = this.currentLanguage();
    const translation = this.globalSettingsTranslations().find(
      (t) =>
        t.global_settings_settings_id === settings.settings_id &&
        t.languages_code === lang,
    );

    if (!translation) return settings;

    return {
      ...settings,
      site_name: preferTranslation(translation.site_name, settings.site_name),
      main_navigation: preferTranslation(
        translation.main_navigation,
        settings.main_navigation,
      ),
      Footer_Text: preferTranslation(
        translation.Footer_text,
        settings.Footer_Text,
      ),
      footer_social_links: preferTranslation(
        translation.footer_social_links,
        settings.footer_social_links,
      ),
      footer_address: preferTranslation(
        translation.footer_address,
        settings.footer_address,
      ),
      footer_email: preferTranslation(
        translation.footer_email,
        settings.footer_email,
      ),
      site_description: preferTranslation(
        translation.site_description,
        settings.site_description,
      ),
    };
  }
  private getTranslatedProduct(product: Product): Product {
    const lang = this.currentLanguage();
    const translation = this.productTranslations().find(
      (t) => t.Product_id === product.id && t.languages_code === lang,
    );
    if (!translation) return product;
    return {
      ...product,
      Name: preferTranslation(translation.Name, product.Name),
      headlines: preferTranslation(translation.Headlines, product.headlines),
      Table_data: preferTranslation(translation.Table_data, product.Table_data),
    };
  }

  private getTranslatedItem(item: Items): Items {
    const lang = this.currentLanguage();
    const translation = this.itemsTranslations().find(
      (t) => t.items_id === item.id && t.languages_code === lang,
    );
    if (!translation) {
      return {
        ...item,
        name: normalizeFinstarText(item.name) ?? item.name,
        description: normalizeFinstarText(item.description),
      };
    }
    return {
      ...item,
      name: preferTranslation(translation.name, item.name),
      description: normalizeFinstarText(
        preferTranslation(translation.description, item.description),
      ),
    };
  }

  private getTranslatedVision(vision: Vision): Vision {
    const lang = this.currentLanguage();
    const translation = this.visionTranslations().find(
      (t) => t.vision_id === vision.id && t.languages_code === lang,
    );
    if (!translation) return vision;
    return {
      ...vision,
      vision: preferTranslation(translation.vision, vision.vision),
    };
  }

  // Nouvelle méthode pour définir les données depuis le TransferState
  setData(data: AppData | null): void {
    if (data?.globalSettings) {
      this.globalSettings.set(data.globalSettings);
    }
    if (data?.accountTypes) {
      this.accountTypes.set(data.accountTypes);
    }
    if (data?.pages) {
      this.pages.set(data.pages);
    }
    if (data?.statistics) {
      this.statistics.set(data.statistics);
    }
    if (data?.testimonials) {
      this.testimonials.set(data.testimonials);
    }
    if (data?.sections) {
      this.sections.set(data.sections);
    }
    if (data?.pageSectionsRelations) {
      this.pageSectionsRelations.set(data.pageSectionsRelations);
    }
    if (data?.sectionAccountTypesRelations) {
      this.sectionAccountTypesRelations.set(data.sectionAccountTypesRelations);
    }
    if (data?.sectionStatisticsRelations) {
      this.sectionStatisticsRelations.set(data.sectionStatisticsRelations);
    }
    if (data?.sectionTestimonialsRelations) {
      this.sectionTestimonialsRelations.set(data.sectionTestimonialsRelations);
    }
    if (data?.sectionFilesRelations) {
      this.sectionFilesRelations.set(data.sectionFilesRelations);
    }
    if (data?.accountTypeTranslations) {
      this.accountTypeTranslations.set(data.accountTypeTranslations);
    }
    if (data?.statisticTranslations) {
      this.statisticTranslations.set(data.statisticTranslations);
    }
    if (data?.testimonialTranslations) {
      this.testimonialTranslations.set(data.testimonialTranslations);
    }
    if (data?.globalSettingsTranslations) {
      this.globalSettingsTranslations.set(data.globalSettingsTranslations);
    }
    if (data?.pageSectionTranslations) {
      this.pageSectionTranslations.set(data.pageSectionTranslations);
    }
    if (data?.products) {
      this.products.set(data.products);
    }
    if (data?.productTranslations) {
      this.productTranslations.set(data.productTranslations);
    }
    if (data?.items) {
      this.items.set(data.items);
    }
    if (data?.itemsTranslations) {
      this.itemsTranslations.set(data.itemsTranslations);
    }
    if (data?.vision) {
      this.vision.set(data.vision);
    }
    if (data?.visionTranslations) {
      this.visionTranslations.set(data.visionTranslations);
    }
    if (data?.pageProductRelations) {
      this.pageProductRelations.set(data.pageProductRelations);
    }
    if (data?.pageVisionRelations) {
      this.pageVisionRelations.set(data.pageVisionRelations);
    }
    if (data?.pageSectionProductRelations) {
      this.pageSectionProductRelations.set(data.pageSectionProductRelations);
    }
    if (data?.productItemsRelations) {
      this.productItemsRelations.set(data.productItemsRelations);
    }
  }

  public getError(entityName: string): string | null {
    return this.errorStates()[entityName] ?? null;
  }

  public clearError(entityName: string): void {
    this.setErrorState(entityName, null);
  }

  // Signal computed pour l'état de chargement
  public isLoading = computed(() =>
    Object.values(this.loadingStates()).some((state) => state),
  );

  // Méthode pour gérer l'état de chargement
  private setLoadingState(entity: string, state: boolean) {
    this.loadingStates.update((states) => ({ ...states, [entity]: state }));
  }

  // Méthode pour gérer les erreurs
  private setErrorState(entity: string, message: string | null) {
    this.errorStates.update((errors) => ({ ...errors, [entity]: message }));
  }

  // Construire manuellement l'URL Cloudinary à partir d'un UUID
  private buildCloudinaryUrl(uuid: string, format: string = 'png'): string {
    const cloudName = 'dfzilcxk8'; // Votre cloud name Cloudinary
    return `https://res.cloudinary.com/${cloudName}/image/upload/directus/${uuid}.${format}`;
  }

  // Méthode pour générer l'URL des fichiers depuis Cloudinary
  public getFileUrl(file: unknown): string | null {
    if (!file) return null;

    // Si c'est déjà une URL Cloudinary
    if (typeof file === 'string' && file.includes('cloudinary.com')) {
      return file;
    }

    // Si c'est un UUID string (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if (
      typeof file === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        file,
      )
    ) {
      return this.buildCloudinaryUrl(file);
    }

    // Si c'est un objet
    if (typeof file === 'object' && file !== null) {
      const fileObj = file as any;

      // Si c'est une relation M2M avec directus_files_id
      if (fileObj.directus_files_id) {
        return this.getFileUrl(fileObj.directus_files_id);
      }

      // Si l'objet a un ID
      if (fileObj.id && typeof fileObj.id === 'string') {
        return this.buildCloudinaryUrl(fileObj.id);
      }

      // Fallback: chercher dans metadata si disponible
      if (fileObj.metadata?.cloudinary?.secure_url) {
        return fileObj.metadata.cloudinary.secure_url;
      }
    }

    return null;
  }

  // Vérification des données
  hasData(): boolean {
    return (
      !!this.globalSettings() &&
      this.accountTypes().length > 0 &&
      this.pages().length > 0 &&
      this.sections().length > 0 &&
      this.statistics().length > 0 &&
      this.testimonials().length > 0
    );
  }

  // Charger toutes les données (pour SSR)
  async loadAllData(): Promise<void> {
    const tasks = [
      () => this.fetchGlobalSettings(),
      () => this.fetchAccountTypes(),
      () => this.fetchPages(),
      () => this.fetchStatistics(),
      () => this.fetchTestimonials(),
      () => this.fetchSections(),
      () => this.fetchPageSectionsRelations(),
      () => this.fetchSectionStatisticsRelations(),
      () => this.fetchSectionTestimonialsRelations(),
      () => this.fetchSectionAccountTypesRelations(),
      () => this.fetchSectionFilesRelations(),
      () => this.fetchAccountTypeTranslations(),
      () => this.fetchStatisticTranslations(),
      () => this.fetchTestimonialTranslations(),
      () => this.fetchGlobalSettingsTranslations(),
      () => this.fetchPageSectionTranslations(),
      () => this.fetchProducts(),
      () => this.fetchProductTranslations(),
      () => this.fetchItems(),
      () => this.fetchItemsTranslations(),
      () => this.fetchVision(),
      () => this.fetchVisionTranslations(),
      () => this.fetchPageProductRelations(),
      () => this.fetchPageVisionRelations(),
      () => this.fetchPageSectionProductRelations(),
      () => this.fetchProductItemsRelations(),
    ];

    const concurrency = 4;
    for (let index = 0; index < tasks.length; index += concurrency) {
      await Promise.allSettled(
        tasks.slice(index, index + concurrency).map((task) => task()),
      );
    }
  }

  /**
   * Méthode générique pour récupérer des données avec Directus SDK
   */
  private async fetchData<T>(
    collection: keyof Schema,
    entitySignal: WritableSignal<T[] | T | null>,
    entityName: string,
    options: {
      isSingle?: boolean;
      relations?: string[];
      transform?: (item: any) => T;
    } = {},
  ): Promise<void> {
    this.setLoadingState(entityName, true);
    this.setErrorState(entityName, null);

    try {
      // Construction dynamique des champs avec relations
      const fields: any[] = ['*'];
      if (options.relations) {
        fields.push(...options.relations);
      }

      const cacheKey = `${String(collection)}:${JSON.stringify(fields)}`;
      let request = sharedReadCache.get(cacheKey);
      if (!request) {
        request = this.directusClient.request(
          readItems(collection as any, { fields }),
        ) as Promise<unknown>;
        sharedReadCache.set(cacheKey, request);
        // Évacuer dès que la promesse est réglée (succès OU erreur) : on ne veut
        // dédupliquer que les appels concurrents, pas mettre la donnée en cache.
        // Le rejet est géré ici pour éviter une « unhandled rejection » ; l'await
        // ci-dessous relaie l'erreur au try/catch.
        request.then(
          () => sharedReadCache.delete(cacheKey),
          () => sharedReadCache.delete(cacheKey),
        );
      }

      const response = await request;

      if (options.isSingle) {
        const data = Array.isArray(response) ? response[0] : response;
        const transformedData = options.transform
          ? options.transform(data)
          : (data as T);
        entitySignal.set(transformedData);
      } else {
        const data = Array.isArray(response) ? response : [response];
        const transformedData = options.transform
          ? data.map((item) => options.transform!(item))
          : (data as T[]);
        entitySignal.set(transformedData);
      }
    } catch (error) {
      if (!environment.production) {
        console.error(`[DirectusSdk] Error fetching ${entityName}`);
      }
      this.setErrorState(entityName, `Échec du chargement des ${entityName}`);
    } finally {
      this.setLoadingState(entityName, false);
    }
  }

  initFromTransferState(): void {
    if (this.transferState.hasKey(GLOBAL_SETTINGS_KEY)) {
      const settings = this.transferState.get(GLOBAL_SETTINGS_KEY, null);
      this.globalSettings.set(settings);
    }

    if (this.transferState.hasKey(ACCOUNT_TYPES_KEY)) {
      const accounts = this.transferState.get(ACCOUNT_TYPES_KEY, []);
      this.accountTypes.set(accounts);
    }

    if (this.transferState.hasKey(PAGES_KEY)) {
      const pages = this.transferState.get(PAGES_KEY, []);
      this.pages.set(pages);
    }

    if (this.transferState.hasKey(TESTIMONIALS_KEY)) {
      const testimonials = this.transferState.get(TESTIMONIALS_KEY, []);
      this.testimonials.set(testimonials);
    }

    if (this.transferState.hasKey(STATISTICS_KEY)) {
      const statistics = this.transferState.get(STATISTICS_KEY, []);
      this.statistics.set(statistics);
    }

    if (this.transferState.hasKey(PAGE_SECTIONS_KEY)) {
      const sections = this.transferState.get(PAGE_SECTIONS_KEY, []);
      this.sections.set(sections);
    }

    if (this.transferState.hasKey(PAGE_SECTIONS_RELATIONS_KEY)) {
      const pageSectionsRels = this.transferState.get(
        PAGE_SECTIONS_RELATIONS_KEY,
        [],
      );
      this.pageSectionsRelations.set(pageSectionsRels);
    }

    if (this.transferState.hasKey(PAGE_SECTIONS_STATISTICS_KEY)) {
      const sectionStatsRels = this.transferState.get(
        PAGE_SECTIONS_STATISTICS_KEY,
        [],
      );
      this.sectionStatisticsRelations.set(sectionStatsRels);
    }

    if (this.transferState.hasKey(PAGE_SECTIONS_TESTIMONIALS_KEY)) {
      const sectionTestimonialsRels = this.transferState.get(
        PAGE_SECTIONS_TESTIMONIALS_KEY,
        [],
      );
      this.sectionTestimonialsRelations.set(sectionTestimonialsRels);
    }

    if (this.transferState.hasKey(PAGE_SECTIONS_ACCOUNT_TYPES_KEY)) {
      const sectionAccountTypesRels = this.transferState.get(
        PAGE_SECTIONS_ACCOUNT_TYPES_KEY,
        [],
      );
      this.sectionAccountTypesRelations.set(sectionAccountTypesRels);
    }

    if (this.transferState.hasKey(PAGE_SECTIONS_FILES_KEY)) {
      const sectionFilesRels = this.transferState.get(
        PAGE_SECTIONS_FILES_KEY,
        [],
      );
      this.sectionFilesRelations.set(sectionFilesRels);
    }
  }

  /**
   * Méthodes spécifiques pour chaque entité - MODIFIÉES avec relations
   */
  async fetchGlobalSettings(): Promise<void> {
    return this.fetchData<GlobalSettings>(
      'global_settings',
      this.globalSettings as WritableSignal<GlobalSettings | null>,
      'global_settings',
      {
        isSingle: true,
        transform: (settings) => {
          return {
            ...settings,
            site_logo: this.getFileUrl(settings.site_logo),
            Finsite_icon: this.getFileUrl(settings.Finsite_icon),
          };
        },
      },
    );
  }

  async submitCandidature(
    candidature: SupabaseCandidature,
    documents: Record<string, string> = {},
  ): Promise<any> {
    try {
      // Validation des données avant envoi
      const missing = [];
      if (!candidature.Nom) missing.push('Nom');
      if (!candidature.Prenom) missing.push('Prenom');

      if (missing.length > 0) {
        throw new Error(`Champs obligatoires manquants: ${missing.join(', ')}`);
      }

      // Préparation des données avec gestion des types correcte
      const candidatureData = {
        Nom: candidature.Nom.trim(),
        Prenom: candidature.Prenom.trim(),
        Poste_souhaite: candidature.Poste_souhaite || '',
        Age: Number(candidature.Age),
        Ville_de_residence: candidature.Ville_de_residence.trim(),
        Tel: candidature.Tel,
        Email: candidature.Email
          ? candidature.Email.trim().toLowerCase()
          : null,
        Dernier_diplome: candidature.Dernier_diplome.trim(),
        Situation_matrimoniale: candidature.Situation_matrimoniale,
        Nombre_d_enfants: candidature.Nombre_d_enfants,
        a_deja_travaille: candidature.a_deja_travaille,
        dernier_emploi: candidature.dernier_emploi || null,
        Nouvel_emploi_jours_et_horaires:
          candidature.Nouvel_emploi_jours_et_horaires,
        Travail_hors_de_la_ville: candidature.Travail_hors_de_la_ville,
        Condition_de_travail_hors_de_la_ville:
          candidature.Condition_de_travail_hors_de_la_ville || null,
        Salaire_souhaite: candidature.Salaire_souhaite,
        Methodes_de_remuneration: candidature.Methodes_de_remuneration,
        Villes_de_preference: candidature.Villes_de_preference,
        CV_Url: candidature.CV_Url || null,
        Fiche_Url: candidature.Fiche_Url || null,
        Type_candidature: candidature.Type_candidature || 'emploi',
        Type_stage: candidature.Type_stage || null,
        Duree_stage: candidature.Duree_stage || null,
        Theme_stage: candidature.Theme_stage || null,
        Etablissement: candidature.Etablissement || null,
        Service_stage: candidature.Service_stage || null,
        Avaliste: candidature.Avaliste || null,
        Avaliste_nom: candidature.Avaliste_nom || null,
        Avaliste_prenom: candidature.Avaliste_prenom || null,
        Avaliste_telephone: candidature.Avaliste_telephone || null,
        Avaliste_adresse: candidature.Avaliste_adresse || null,
        Avaliste_relation: candidature.Avaliste_relation || null,
        Caution_acceptee: candidature.Caution_acceptee ?? null,
      };

      const { url, anonKey } = environment.supabase;

      if (!url || !anonKey) {
        throw new Error('Supabase Configuration non configurée.');
      }

      let response = await fetch(`${url}/rpc/submit_candidature_complete`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidature_payload: candidatureData,
          documents_payload: documents,
        }),
      });

      // Compatibilité avec l'ancien schéma jusqu'à l'exécution du nouveau SQL.
      if (response.status === 404) {
        const {
          Type_candidature,
          Type_stage,
          Duree_stage,
          Theme_stage,
          Etablissement,
          Service_stage,
          Avaliste,
          Avaliste_nom,
          Avaliste_prenom,
          Avaliste_telephone,
          Avaliste_adresse,
          Avaliste_relation,
          Caution_acceptee,
          ...legacyCandidatureData
        } = candidatureData;
        response = await fetch(`${url}/Candidatures`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(legacyCandidatureData),
        });
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Erreur inconnue' }));
        throw new Error(
          errorData.message || "Échec de l'enregistrement de la candidature",
        );
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Erreur lors de l'envoi de la candidature: ${error.message}`,
        );
      }

      throw new Error("Erreur inconnue lors de l'envoi de la candidature");
    }
  }

  async submitContactForm(contactData: SupabaseContact): Promise<any> {
    try {
      // Validation des données
      const missing = [];
      if (!contactData.Nom) missing.push('Nom');
      if (!contactData.Prenom) missing.push('Prenom');

      if (missing.length > 0) {
        throw new Error(`Champs obligatoires manquants: ${missing.join(', ')}`);
      }

      const { url, anonKey } = environment.supabase;

      if (!url || !anonKey) {
        throw new Error('Supabase Configuration non configurée.');
      }

      const response = await fetch(`${url}/Contacts`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Erreur inconnue' }));
        throw new Error(
          errorData.message || "Échec de l'enregistrement du contact",
        );
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erreur lors de l'envoi du contact: ${error.message}`);
      }

      throw new Error("Erreur inconnue lors de l'envoi du contact");
    }
  }

  async getCandidaturesCount(): Promise<number> {
    try {
      const counts = await this.getOperationalCounts();
      return counts.candidatures;
    } catch (error) {
      console.warn(
        'Erreur lors de la récupération du nombre de candidatures',
        error,
      );
      return 0;
    }
  }

  async getContactsCount(): Promise<number> {
    try {
      const counts = await this.getOperationalCounts();
      return counts.contacts;
    } catch (error) {
      console.warn(
        'Erreur lors de la récupération du nombre de contacts',
        error,
      );
      return 0;
    }
  }

  async getOperationalCounts(): Promise<{
    contacts: number;
    candidatures: number;
  }> {
    const { url, anonKey } = environment.supabase;

    if (!url || !anonKey) {
      throw new Error('Configuration Supabase manquante.');
    }

    const response = await fetch(`${url}/rpc/get_operational_counts`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.message ||
          `RPC Supabase get_operational_counts inaccessible (HTTP ${response.status}).`,
      );
    }

    const data = (await response.json()) as {
      contacts?: number | string;
      candidatures?: number | string;
    };

    return {
      contacts: Number(data.contacts) || 0,
      candidatures: Number(data.candidatures) || 0,
    };
  }

  async uploadFile(
    file: File | Blob,
    subject?: string,
    customFileName?: string,
    bucketType: 'contacts' | 'candidatures' = 'contacts',
  ): Promise<string> {
    const { url, anonKey, contactsBucket, candidaturesBucket } =
      environment.supabase;

    if (!url || url.includes('YOUR_SUPABASE')) {
      console.warn('[Supabase] Configuration manquante.');
      throw new Error('Supabase Storage non configuré.');
    }

    const bucket =
      bucketType === 'candidatures' ? candidaturesBucket : contactsBucket;

    try {
      const now = new Date();
      const datePrefix = now.toISOString().split('T')[0];
      const timeSuffix = now.getTime();
      const cleanSubject = subject
        ? subject.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
        : 'contact';

      let fileName = '';
      if (customFileName) {
        fileName = customFileName;
      } else {
        const originalName = (file as any).name || 'document.pdf';
        const cleanFileName = originalName
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '');
        fileName = `${datePrefix}-${timeSuffix}-${cleanFileName}-${cleanSubject}`;
      }

      const folder = bucketType === 'candidatures' ? 'jobs' : 'contacts';
      const filePath = `${folder}/${fileName}`;
      // `supabase.url` targets PostgREST (`/rest/v1`); Storage is served from
      // the Supabase project root, not below the REST endpoint.
      const supabaseRootUrl = url.replace(/\/rest\/v1\/?$/, '');
      const encodedBucket = encodeURIComponent(bucket);
      const encodedFilePath = filePath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
      const uploadUrl = `${supabaseRootUrl}/storage/v1/object/${encodedBucket}/${encodedFilePath}`;
      const fileType = (file as any).type || 'application/pdf';

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': fileType,
          'x-upsert': 'true', // Autorise l'écrasement en cas de doublon (sécurité)
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        if (uploadResponse.status === 404) {
          throw new Error(
            `Le bucket Supabase "${bucket}" est introuvable. Créez ce bucket Storage ou corrigez sa configuration.`,
          );
        }
        throw new Error(errorData.message || "Échec de l'upload Supabase");
      }

      const publicUrl = `${supabaseRootUrl}/storage/v1/object/public/${encodedBucket}/${encodedFilePath}`;
      return publicUrl;
    } catch (error) {
      throw error;
    }
  }

  async fetchAccountTypes(): Promise<void> {
    return this.fetchData<AccountType>(
      'Account_types',
      this.accountTypes,
      'account_types',
      {
        transform: (account) => ({
          ...account,
          Icon: this.getFileUrl(account.Icon),
          Hover_image: this.getFileUrl(account.Hover_image),
        }),
      },
    );
  }

  async fetchPages(): Promise<void> {
    return this.fetchData<Page[]>('Pages', this.pages, 'pages');
  }

  // MODIFIÉE : Charger les sections avec les métadonnées des fichiers
  async fetchSections(): Promise<void> {
    return this.fetchData<PageSection[]>(
      'Pages_sections',
      this.sections,
      'sections',
      {
        relations: ['images.directus_files_id'],
        transform: (section) => {
          return {
            ...section,
            image: this.getFileUrl(section.image),
            images: section.images
              ? section.images.map((img: any) =>
                  this.getFileUrl(img.directus_files_id),
                )
              : null,
            document: this.getFileUrl(section.document),
          };
        },
      },
    );
  }

  async fetchStatistics(): Promise<void> {
    return this.fetchData<Statistic[]>(
      'Statistics',
      this.statistics,
      'statistics',
      {},
    );
  }

  // MODIFIÉE : Charger les témoignages avec les métadonnées des images d'auteur
  async fetchTestimonials(): Promise<void> {
    return this.fetchData<Testimonial[]>(
      'Testimonials',
      this.testimonials,
      'testimonials',
      {
        transform: (testimonial) => ({
          ...testimonial,
          author_image: this.getFileUrl(testimonial.author_image),
        }),
      },
    );
  }

  async fetchAccountTypeTranslations(): Promise<void> {
    return this.fetchData<AccountTypeTranslation[]>(
      'Account_types_translations',
      this.accountTypeTranslations,
      'account_type_translations',
    );
  }

  async fetchStatisticTranslations(): Promise<void> {
    return this.fetchData<StatisticTranslation[]>(
      'Statistics_translations',
      this.statisticTranslations,
      'statistic_translations',
    );
  }

  async fetchTestimonialTranslations(): Promise<void> {
    return this.fetchData<TestimonialTranslation[]>(
      'Testimonials_translations',
      this.testimonialTranslations,
      'testimonial_translations',
    );
  }

  async fetchGlobalSettingsTranslations(): Promise<void> {
    return this.fetchData<GlobalSettingsTranslation[]>(
      'global_settings_translations',
      this.globalSettingsTranslations,
      'global_settings_translations',
    );
  }

  async fetchPageSectionTranslations(): Promise<void> {
    return this.fetchData<PageSectionTranslation[]>(
      'Pages_sections_translations',
      this.pageSectionTranslations,
      'page_section_translations',
    );
  }

  async fetchPageSectionsRelations(): Promise<void> {
    return this.fetchData<PageSectionsRelation[]>(
      'Pages_Pages_sections',
      this.pageSectionsRelations,
      'page_sections_relations',
    );
  }

  async fetchSectionStatisticsRelations(): Promise<void> {
    return this.fetchData<PageSectionStatistics[]>(
      'Pages_sections_Statistics',
      this.sectionStatisticsRelations,
      'section_statistics_relations',
    );
  }

  async fetchSectionTestimonialsRelations(): Promise<void> {
    return this.fetchData<PageSectionTestimonials[]>(
      'Pages_sections_Testimonials',
      this.sectionTestimonialsRelations,
      'section_testimonials_relations',
    );
  }

  async fetchSectionAccountTypesRelations(): Promise<void> {
    return this.fetchData<PageSectionAccountTypes[]>(
      'Pages_sections_Account_types',
      this.sectionAccountTypesRelations,
      'section_account_types_relations',
    );
  }

  // MODIFIÉE : Charger les relations de fichiers avec les métadonnées
  async fetchSectionFilesRelations(): Promise<void> {
    return this.fetchData<PageSectionFiles[]>(
      'Pages_sections_files',
      this.sectionFilesRelations,
      'section_files_relations',
    );
  }

  async fetchProducts(): Promise<void> {
    return this.fetchData<Product[]>('Product', this.products, 'products', {
      transform: (product) => ({
        ...product,
        product_image: this.getFileUrl(product.product_image),
      }),
    });
  }

  async fetchProductTranslations(): Promise<void> {
    return this.fetchData<ProductTranslation[]>(
      'Product_translations',
      this.productTranslations,
      'product_translations',
    );
  }

  async fetchItems(): Promise<void> {
    return this.fetchData<Items[]>('items', this.items, 'items', {
      transform: (item) => ({
        ...item,
        image: this.getFileUrl(item.image),
      }),
    });
  }

  async fetchItemsTranslations(): Promise<void> {
    return this.fetchData<ItemsTranslation[]>(
      'items_translations',
      this.itemsTranslations,
      'items_translations',
    );
  }

  async fetchVision(): Promise<void> {
    return this.fetchData<Vision[]>('vision', this.vision, 'vision', {
      transform: (vision) => ({
        ...vision,
        image: this.getFileUrl(vision.image),
      }),
    });
  }

  async fetchVisionTranslations(): Promise<void> {
    return this.fetchData<VisionTranslation[]>(
      'vision_translations',
      this.visionTranslations,
      'vision_translations',
    );
  }

  async fetchPageProductRelations(): Promise<void> {
    return this.fetchData<PageProductRelation[]>(
      'Pages_Product',
      this.pageProductRelations,
      'page_product_relations',
    );
  }

  async fetchPageVisionRelations(): Promise<void> {
    return this.fetchData<PageVisionRelation[]>(
      'Pages_vision',
      this.pageVisionRelations,
      'page_vision_relations',
    );
  }

  async fetchPageSectionProductRelations(): Promise<void> {
    return this.fetchData<PageSectionProduct[]>(
      'Pages_sections_Product',
      this.pageSectionProductRelations,
      'page_section_product_relations',
    );
  }

  async fetchProductItemsRelations(): Promise<void> {
    return this.fetchData<any[]>(
      'Product_items',
      this.productItemsRelations,
      'product_items_relations',
    );
  }

  async loadAllDataExternal(): Promise<void> {
    if (this.hasData()) {
      return;
    }
    await this.loadAllData();
  }

  // Pages enrichies avec sections (optimisé avec computed)
  public pagesWithSections = computed<PageWithSections[]>(() => {
    const pages = this.pages();
    if (!pages.length) return [];

    return pages.map((page) => ({
      ...page,
      sections: this.getPageSections(page.page_id),
      products: this.getPageProducts(page.page_id),
      visions: this.getPageVision(page.page_id),
    }));
  });

  private enrichSection(section: PageSection): EnrichedPageSection {
    const translatedSection = this.getTranslatedSection(section);
    return {
      ...translatedSection,
      statistics: this.getRelatedStatistics(section.Pages_sections_id),
      testimonials: this.getRelatedTestimonials(section.Pages_sections_id),
      account_types: this.getRelatedAccountTypes(section.Pages_sections_id),
      product_data: this.getRelatedProducts(section.Pages_sections_id),
    };
  }

  public buildPagesWithSections(): PageWithSections[] {
    return this.pages().map((page) => ({
      ...page,
      sections: this.getPageSections(page.page_id),
      products: this.getPageProducts(page.page_id),
      visions: this.getPageVision(page.page_id),
    }));
  }

  private getPageSections(pageId: number): EnrichedPageSection[] {
    return this.pageSectionsRelations()
      .filter((rel) => rel.Pages_page_id === pageId)
      .map((rel) => {
        const section = this.sections().find(
          (s) => s.Pages_sections_id === rel.Pages_sections_Pages_sections_id,
        );
        return section ? this.enrichSection(section) : null;
      })
      .filter(Boolean) as EnrichedPageSection[];
  }

  private getPageProducts(pageId: number): Product[] {
    return this.pageProductRelations()
      .filter((rel) => rel.Pages_page_id === pageId)
      .map((rel) => {
        const product = this.products().find((p) => p.id === rel.Product_id);
        return product ? this.getTranslatedProduct(product) : null;
      })
      .filter(Boolean) as Product[];
  }

  private getPageVision(pageId: number): Vision[] {
    return this.pageVisionRelations()
      .filter((rel) => rel.Pages_page_id === pageId)
      .map((rel) => {
        const vision = this.vision().find((v) => v.id === rel.vision_id);
        return vision ? this.getTranslatedVision(vision) : null;
      })
      .filter(Boolean) as Vision[];
  }

  private getRelatedStatistics(sectionId: number): Statistic[] {
    return this.sectionStatisticsRelations()
      .filter((rel) => rel.Pages_sections_Pages_sections_id === sectionId)
      .map((rel) => {
        const statistic = this.statistics().find(
          (stat) => stat.statistics_id === rel.Statistics_statistics_id,
        );
        return statistic ? this.getTranslatedStatistic(statistic) : null;
      })
      .filter(Boolean) as Statistic[];
  }

  private getRelatedTestimonials(sectionId: number): Testimonial[] {
    return this.sectionTestimonialsRelations()
      .filter((rel) => rel.Pages_sections_Pages_sections_id === sectionId)
      .map((rel) => {
        const testimonial = this.testimonials().find(
          (test) => test.testimonials_id === rel.Testimonials_testimonials_id,
        );
        return testimonial ? this.getTranslatedTestimonial(testimonial) : null;
      })
      .filter(Boolean) as Testimonial[];
  }

  // Mettre à jour getRelatedAccountTypes pour utiliser les traductions
  private getRelatedAccountTypes(sectionId: number): AccountType[] {
    return this.sectionAccountTypesRelations()
      .filter((rel) => rel.Pages_sections_Pages_sections_id === sectionId)
      .map((rel) => {
        const account = this.accountTypes().find(
          (acc) => acc.account_id === rel.Account_types_account_id,
        );
        return account ? this.getTranslatedAccountType(account) : null;
      })
      .filter(Boolean) as AccountType[];
  }

  private getRelatedProducts(sectionId: number): Product[] {
    return this.pageSectionProductRelations()
      .filter((rel) => rel.Pages_sections_Pages_sections_id === sectionId)
      .map((rel) => {
        const product = this.products().find((p) => p.id === rel.Product_id);
        return product ? this.getTranslatedProduct(product) : null;
      })
      .filter(Boolean) as Product[];
  }

  // Méthodes utilitaires pour accéder aux données depuis les composants
  public getProductItems(productId: number): Items[] {
    return this.productItemsRelations()
      .filter((rel) => rel.Product_id === productId)
      .map((rel) => {
        const item = this.items().find((i) => i.id === rel.items_id);
        return item ? this.getTranslatedItem(item) : null;
      })
      .filter(Boolean) as Items[];
  }

  public getStatisticById(statisticId: number): Statistic | undefined {
    const statistic = this.statistics().find(
      (item) => item.statistics_id === statisticId,
    );
    return statistic ? this.getTranslatedStatistic(statistic) : undefined;
  }

  public getProductById(productId: number): Product | undefined {
    const product = this.products().find((p) => p.id === productId);
    return product ? this.getTranslatedProduct(product) : undefined;
  }

  public getItemById(itemId: number): Items | undefined {
    const item = this.items().find((i) => i.id === itemId);
    return item ? this.getTranslatedItem(item) : undefined;
  }

  public getVisionById(visionId: number): Vision | undefined {
    const vision = this.vision().find((v) => v.id === visionId);
    return vision ? this.getTranslatedVision(vision) : undefined;
  }
}
