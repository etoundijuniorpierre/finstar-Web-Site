import { inject, Injectable, computed, signal, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from './i18n.service';
import { DirectusV2Service } from './directus-v2.service';


@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly directusV2 = inject(DirectusV2Service);
  private readonly i18nService = inject(I18nService);


  isLoading = computed(() => !this.directusV2.ready());

  // Page d'accueil : singleton `home_page` + collections dédiées.
  homePage = computed(() => {
    const page = this.directusV2.homePage();
    if (!page) return null;

    return {
      Slug: 'homepage',
      visions: this.directusV2.visions().map((vision) => ({
        id: vision['id'], image: vision['image'], vision: vision['text'],
      })),
    } as any;
  });

  heroBannerData = computed(() => {
    const page = this.directusV2.homePage();
    if (!page) return null;

    return {
      image: page['hero_image'] as string | null,
      callToAction: page['hero_cta_label'] as string | null,
      callToActionLink: page['hero_cta_link'] as string | null,
      headline: page['hero_headline'] as string | null,
      subheadline: page['hero_subheadline'] as string | null,
    };
  });

  statsData = computed(() => this.directusV2.stats().map((stat) => ({
    statistics_id: Number(stat['id']),
    value: Number(stat['value'] || 0),
    label: String(stat['label'] || ''),
    show_plus: Boolean(stat['show_plus']),
  })) as any[]);

  testimonialsData = computed(() => this.directusV2.testimonials().map((testimonial) => ({
    testimonials_id: Number(testimonial['id']),
    Quote: String(testimonial['quote'] || ''),
    author_name: String(testimonial['author_name'] || ''),
    author_title: String(testimonial['author_title'] || ''),
    author_image: testimonial['author_image'] as string | null,
  })) as any[]);

  statsHeadline = computed(() => String(this.directusV2.homePage()?.['stats_headline'] || ''));

  // Pour l'animation des statistiques
  animatedStats = computed(() => {
    return this.statsData().map((stat: any) => ({
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
