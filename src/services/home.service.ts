import { inject, Injectable, computed, signal, effect } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from './i18n.service';


@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly directus = inject(DirectusSdkService);
  private readonly i18nService = inject(I18nService);


  isLoading = computed(() => this.directus.isLoading());
  // Signal pour la page d'accueil
  homePage = computed(() => {
    const pages = this.directus.pagesWithSections();
    return pages.find(page => page.Slug === 'homepage');
  });

  // Sections spécifiques
  heroBannerSection = computed(() => {
    const sections = this.homePage()?.sections || [];
    return sections.find(section => section.Type === 'hero_banner') ?? null;
  });

  accountsSection = computed(() => {
    const sections = this.homePage()?.sections || [];
    return sections.find(section => section.Type === 'differents accounts type') ?? null;
  });

  statsSection = computed(() => {
    const sections = this.homePage()?.sections || [];
    return sections.find(section => section.Type === 'statistics informations') ?? null;
  });

  testimonialsSection = computed(() => {
    const sections = this.homePage()?.sections || [];
    return sections.find(section => section.Type === 'testimonials') ?? null;
  });

  // Données pour chaque section
  heroBannerData = computed(() => {
    const section = this.heroBannerSection();
    if (!section) return null;
    return {
      image: this.directus.getFileUrl(section.image),
      callToAction: section.call_to_action,
      callToActionLink: section.call_to_action_link,
      headline: section.headline,
      subheadline: section.subheadline
    };
  });

  accountsData = computed(() => {
    const section = this.accountsSection();
    return section?.account_types || [];
  });

  statsData = computed(() => {
    const section = this.statsSection();
    const linkedStatistics = section?.statistics || [];
    const dailySavers = this.directus.stats().find((stat) =>
      /épargnant|daily saver/i.test(stat.label || ''),
    );

    if (
      dailySavers &&
      !linkedStatistics.some((stat) => stat.statistics_id === dailySavers.statistics_id)
    ) {
      const translatedDailySavers = this.directus.getStatisticById(dailySavers.statistics_id);
      return translatedDailySavers ? [...linkedStatistics, translatedDailySavers] : linkedStatistics;
    }

    return linkedStatistics;
  });

  testimonialsData = computed(() => {
    const section = this.testimonialsSection();
    return section?.testimonials || [];
  });

  // Pour l'animation des statistiques
  animatedStats = computed(() => {
    return this.statsData().map(stat => ({
      ...stat,
      target: stat.value
        ? parseInt(stat.value.toString().replace(/[^\d-]/g, ''), 10)
        : 0
    }));
  });

  // Infinite Scroll Items avec traductions asynchrones
  private readonly infiniteScrollItemsSignal = signal<string[]>([]);
  infiniteScrollItems = this.infiniteScrollItemsSignal.asReadonly();

  // ✅ Stream des traductions pour les éléments de défilement
  private readonly scrollTranslationsStream = this.i18nService.translate.stream([
    'NAV.OPEN_ACCOUNT',
    'NAV.SAVINGS',
    'NAV.MICROFINANCE_STAR',
    'NAV.INVESTMENT_ADVICE',
    'NAV.ALWAYS_LISTENING',
    'NAV.FINSTAR',
    'NAV.CUSTOMER_SERVICE',
    'NAV.SATISFACTION_GUARANTEED'
  ]);

    scrollTranslations = toSignal(this.scrollTranslationsStream, { initialValue: {} });

    constructor() {
    // ✅ Effect pour mettre à jour les éléments de défilement quand les traductions changent
    effect(() => {
      const translations = this.scrollTranslations();
      const lang = this.i18nService.currentLanguage(); // Force la réactivité sur changement de langue
      
      const translationKeys = [
        'NAV.OPEN_ACCOUNT',
        'NAV.SAVINGS',
        'NAV.MICROFINANCE_STAR',
        'NAV.INVESTMENT_ADVICE',
        'NAV.ALWAYS_LISTENING',
        'NAV.FINSTAR',
        'NAV.CUSTOMER_SERVICE',
        'NAV.SATISFACTION_GUARANTEED'
      ];

      const items = translationKeys.map(key => translations[key] || key);
      this.infiniteScrollItemsSignal.set(items);
    });
  }
}
