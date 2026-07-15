import { inject, Injectable, TransferState, PLATFORM_ID } from '@angular/core';
import { isPlatformServer, isPlatformBrowser } from '@angular/common';
import { DirectusSdkService } from './directus.sdk.service';
import {
  GLOBAL_SETTINGS_KEY,
  ACCOUNT_TYPES_KEY,
  PAGES_KEY,
  STATISTICS_KEY,
  TESTIMONIALS_KEY,
  PAGE_SECTIONS_KEY,
  PAGE_SECTIONS_RELATIONS_KEY,
  PAGE_SECTIONS_STATISTICS_KEY,
  PAGE_SECTIONS_TESTIMONIALS_KEY,
  PAGE_SECTIONS_ACCOUNT_TYPES_KEY,
  PAGE_SECTIONS_FILES_KEY,
  ACCOUNT_TYPE_TRANSLATIONS_KEY,
  STATISTIC_TRANSLATIONS_KEY,
  TESTIMONIAL_TRANSLATIONS_KEY,
  GLOBAL_SETTINGS_TRANSLATIONS_KEY,
  PAGE_SECTION_TRANSLATIONS_KEY,
  PRODUCTS_KEY,
  PRODUCT_TRANSLATIONS_KEY,
  ITEMS_KEY,
  ITEMS_TRANSLATIONS_KEY,
  VISION_KEY,
  VISION_TRANSLATIONS_KEY,
  PAGE_PRODUCT_RELATIONS_KEY,
  PAGE_VISION_RELATIONS_KEY,
  PAGE_SECTION_PRODUCT_RELATIONS_KEY,
  PRODUCT_ITEMS_RELATIONS_KEY
} from '../assets/state-keys';
import { AppData } from '../types/app-data';
import { AccountType, AccountTypeTranslation, GlobalSettings, GlobalSettingsTranslation, Page, PageSection, PageSectionAccountTypes, PageSectionFiles, PageSectionsRelation, PageSectionStatistics, PageSectionTestimonials, PageSectionAccountTypes as PageSectionAccountTypesMapping, PageSectionFiles as PageSectionFilesMapping, PageSectionTranslation, Statistic, StatisticTranslation, Testimonial, TestimonialTranslation, Product, ProductTranslation, Items, ItemsTranslation, Vision, VisionTranslation, PageProductRelation, PageVisionRelation, PageSectionProduct, ProductItems } from '../types/directus';
import { TranslateService } from '@ngx-translate/core';
import { I18nService } from './i18n.service';


@Injectable({ providedIn: 'root' })
export class AppInitService {
  private readonly directus = inject(DirectusSdkService);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transferState = inject(TransferState);
  private readonly i18nService = inject(I18nService);

  constructor(private readonly translate: TranslateService) {
    // Définir la langue par défaut
    translate.setFallbackLang('en-US');

    translate.use(this.i18nService.currentLanguage());
  }

  async init(): Promise<void> {

    if (this.isServer) {
      // Côté serveur : charger les données et les sauvegarder
      await this.loadServerData();
    } else {
      // Côté client : vérifier si les données sont déjà chargées
      await this.loadClientData();
    }
  }

  private async loadServerData(): Promise<void> {
    try {
      await this.directus.loadAllData();
      this.saveDataToTransferState();
    } catch (error) {
      console.error('[AppInit] Erreur lors du chargement des données serveur:', error);
    }
  }

  private async loadClientData(): Promise<void> {

    // Récupérer les données du TransferState
    const data = this.getDataFromTransferState();

    if (this.isValidAppData(data)) {
      this.directus.setData(data);
      return;
    }

    try {
      await this.directus.loadAllData();
    } catch (error) {
      console.error('[AppInit] Erreur lors du chargement des données client:', error);
    }
  }

  // Nouvelle méthode pour vérifier la validité des données
  private isValidAppData(data: AppData | null): boolean {
    if (!data) {
      return false;
    }

    const hasGlobalSettings = !!data.globalSettings;
    const hasPages = data.pages?.length > 0;

    // Only require essential data for the app to function
    return hasGlobalSettings && hasPages;
  }

  // Nouvelle méthode pour récupérer les données du TransferState
  private getDataFromTransferState(): AppData | null {
    const settings = this.transferState.get<GlobalSettings | null>(GLOBAL_SETTINGS_KEY, null);
    const accounts = this.transferState.get<AccountType[]>(ACCOUNT_TYPES_KEY, []);
    const pages = this.transferState.get<Page[]>(PAGES_KEY, []);
    const stats = this.transferState.get<Statistic[]>(STATISTICS_KEY, []);
    const testimonials = this.transferState.get<Testimonial[]>(TESTIMONIALS_KEY, []);
    const sections = this.transferState.get<PageSection[]>(PAGE_SECTIONS_KEY, []);
    const pageSectionsRels = this.transferState.get<PageSectionsRelation[]>(PAGE_SECTIONS_RELATIONS_KEY, []);
    const sectionStatsRels = this.
      transferState.get<PageSectionStatistics[]>(PAGE_SECTIONS_STATISTICS_KEY, []);
    const sectionTestimonialsRels = this.transferState.get<PageSectionTestimonials[]>(PAGE_SECTIONS_TESTIMONIALS_KEY, []);
    const sectionAccountTypesRels = this.transferState.get<PageSectionAccountTypes[]>(PAGE_SECTIONS_ACCOUNT_TYPES_KEY, []);
    const sectionFilesRels = this.transferState.get<PageSectionFiles[]>(PAGE_SECTIONS_FILES_KEY, []);
    const accountTypeTranslations = this.transferState.get<AccountTypeTranslation[]>(ACCOUNT_TYPE_TRANSLATIONS_KEY, []);
    const testimonialTranslations = this.transferState.get<TestimonialTranslation[]>(TESTIMONIAL_TRANSLATIONS_KEY, []);
    const globalSettingsTranslations = this.transferState.get<GlobalSettingsTranslation[]>(GLOBAL_SETTINGS_TRANSLATIONS_KEY, []);
    const statisticTranslations = this.transferState.get<StatisticTranslation[]>(STATISTIC_TRANSLATIONS_KEY, []);
    const pageSectionTranslations = this.transferState.get<PageSectionTranslation[]>(PAGE_SECTION_TRANSLATIONS_KEY, []);
    const products = this.transferState.get<Product[]>(PRODUCTS_KEY, []);
    const productTranslations = this.transferState.get<ProductTranslation[]>(PRODUCT_TRANSLATIONS_KEY, []);
    const items = this.transferState.get<Items[]>(ITEMS_KEY, []);
    const itemsTranslations = this.transferState.get<ItemsTranslation[]>(ITEMS_TRANSLATIONS_KEY, []);
    const vision = this.transferState.get<Vision[]>(VISION_KEY, []);
    const visionTranslations = this.transferState.get<VisionTranslation[]>(VISION_TRANSLATIONS_KEY, []);
    const pageProductRelations = this.transferState.get<PageProductRelation[]>(PAGE_PRODUCT_RELATIONS_KEY, []);
    const pageVisionRelations = this.transferState.get<PageVisionRelation[]>(PAGE_VISION_RELATIONS_KEY, []);
    const pageSectionProductRelations = this.transferState.get<PageSectionProduct[]>(PAGE_SECTION_PRODUCT_RELATIONS_KEY, []);
    const productItemsRelations = this.transferState.get<ProductItems[]>(PRODUCT_ITEMS_RELATIONS_KEY, []);

    return {
      globalSettings: settings,
      accountTypes: accounts,
      pages: pages,
      statistics: stats,
      testimonials: testimonials,
      sections: sections,
      pageSectionsRelations: pageSectionsRels,
      sectionStatisticsRelations: sectionStatsRels,
      sectionTestimonialsRelations: sectionTestimonialsRels,
      sectionAccountTypesRelations: sectionAccountTypesRels,
      sectionFilesRelations: sectionFilesRels,
      accountTypeTranslations,
      statisticTranslations,
      testimonialTranslations,
      globalSettingsTranslations,
      pageSectionTranslations,
      products,
      productTranslations,
      items,
      itemsTranslations,
      vision,
      visionTranslations,
      pageProductRelations,
      pageVisionRelations,
      pageSectionProductRelations,
      productItemsRelations
    };
  }

  private saveDataToTransferState(): void {
    const settings = this.directus.settings();
    const accounts = this.directus.accounts();
    const pages = this.directus.allPages();
    const pagesWithSections = this.directus.pagesWithSections();
    const stats = this.directus.stats();
    const testimonials = this.directus.testimonialsData();
    const sections = this.directus.allSections();
    const pageSectionsRels = this.directus.pageSectionsRels();
    const sectionStatsRels = this.directus.sectionStatsRels();
    const sectionTestimonialsRels = this.directus.sectionTestimonialsRels();
    const sectionAccountTypesRels = this.directus.sectionAccountTypesRels();
    const sectionFilesRels = this.directus.sectionFilesRels();
    const accountTypeTranslations = this.directus.accountTypeTranslationsData();
    const statisticTranslations = this.directus.statisticTranslationsData();
    const testimonialTranslations = this.directus.testimonialTranslationsData();
    const globalSettingsTranslations = this.directus.globalSettingsTranslationsData();
    const pageSectionTranslations = this.directus.pageSectionTranslationsData();
    const products = this.directus.productsData();
    const productTranslations = this.directus.productTranslationsData();
    const items = this.directus.itemsData();
    const itemsTranslations = this.directus.itemsTranslationsData();
    const vision = this.directus.visionData();
    const visionTranslations = this.directus.visionTranslationsData();
    const pageProductRelations = this.directus.pageProductRelationsData();
    const pageVisionRelations = this.directus.pageVisionRelationsData();
    const pageSectionProductRelations = this.directus.pageSectionProductRelationsData();
    const productItemsRelations = this.directus.productItemsRelationsData();

    // Sauvegarder seulement si les données existent
    if (settings) {
      this.transferState.set(GLOBAL_SETTINGS_KEY, settings);
    }
    if (accounts && accounts.length > 0) {
      this.transferState.set(ACCOUNT_TYPES_KEY, accounts);
    }
    if (pages && pages.length > 0) {
      this.transferState.set(PAGES_KEY, pages);
    }
    if (stats && stats.length > 0) {
      this.transferState.set(STATISTICS_KEY, stats);
    }
    if (testimonials && testimonials.length > 0) {
      this.transferState.set(TESTIMONIALS_KEY, testimonials);
    }
    if (sections && sections.length > 0) {
      this.transferState.set(PAGE_SECTIONS_KEY, sections);
    }
    if (pageSectionsRels && pageSectionsRels.length > 0) {
      this.transferState.set(PAGE_SECTIONS_RELATIONS_KEY, pageSectionsRels);
    }
    if (sectionStatsRels && sectionStatsRels.length > 0) {
      this.transferState.set
        (PAGE_SECTIONS_STATISTICS_KEY, sectionStatsRels);
    }
    if (sectionTestimonialsRels && sectionTestimonialsRels.length > 0) {
      this.transferState.set(PAGE_SECTIONS_TESTIMONIALS_KEY, sectionTestimonialsRels);
    }
    if (sectionAccountTypesRels && sectionAccountTypesRels.length > 0) {
      this.transferState.set(PAGE_SECTIONS_ACCOUNT_TYPES_KEY, sectionAccountTypesRels);
    }
    if (sectionFilesRels && sectionFilesRels.length > 0) {
      this.transferState.set(PAGE_SECTIONS_FILES_KEY, sectionFilesRels);
    }
    if (accountTypeTranslations && accountTypeTranslations.length > 0) {
      this.transferState.set(ACCOUNT_TYPE_TRANSLATIONS_KEY, accountTypeTranslations);
    }
    if (statisticTranslations && statisticTranslations.length > 0) {
      this.transferState.set(STATISTIC_TRANSLATIONS_KEY, statisticTranslations);
    }
    if (testimonialTranslations && testimonialTranslations.length > 0) {
      this.transferState.set(TESTIMONIAL_TRANSLATIONS_KEY, testimonialTranslations);
    }
    if (globalSettingsTranslations && globalSettingsTranslations.length > 0) {
      this.transferState.set(GLOBAL_SETTINGS_TRANSLATIONS_KEY, globalSettingsTranslations);
    }
    if (pageSectionTranslations && pageSectionTranslations.length > 0) {
      this.transferState.set(PAGE_SECTION_TRANSLATIONS_KEY, pageSectionTranslations);
    }
    if (products?.length > 0) {
      this.transferState.set(PRODUCTS_KEY, products);
    }
    if (productTranslations?.length > 0) {
      this.transferState.set(PRODUCT_TRANSLATIONS_KEY, productTranslations);
    }
    if (items?.length > 0) {
      this.transferState.set(ITEMS_KEY, items);
    }
    if (itemsTranslations?.length > 0) {
      this.transferState.set(ITEMS_TRANSLATIONS_KEY, itemsTranslations);
    }
    if (vision?.length > 0) {
      this.transferState.set(VISION_KEY, vision);
    }
    if (visionTranslations?.length > 0) {
      this.transferState.set(VISION_TRANSLATIONS_KEY, visionTranslations);
    }
    if (pageProductRelations?.length > 0) {
      this.transferState.set(PAGE_PRODUCT_RELATIONS_KEY, pageProductRelations);
    }
    if (pageVisionRelations?.length > 0) {
      this.transferState.set(PAGE_VISION_RELATIONS_KEY, pageVisionRelations);
    }
    if (pageSectionProductRelations?.length > 0) {
      this.transferState.set(PAGE_SECTION_PRODUCT_RELATIONS_KEY, pageSectionProductRelations);
    }
    if (productItemsRelations?.length > 0) {
      this.transferState.set(PRODUCT_ITEMS_RELATIONS_KEY, productItemsRelations);
    }
  }
}
