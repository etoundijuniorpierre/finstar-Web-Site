import {
  Component,
  inject,
  ChangeDetectionStrategy,
  AfterViewInit,
  ElementRef,
  Renderer2,
  PLATFORM_ID,
  computed,
  OnDestroy,
  signal,
  viewChild,
  effect,
  NgZone,
  DestroyRef
} from '@angular/core';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HomeService } from '../../../services/home.service';
import { CtaButton } from "../../shared/cta-button/cta-button";
import { JoinUsComponent } from "../../shared/join-us/join-us";
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from '../../../services/i18n.service';
import { SeoService } from '../../../services/seo.service';
import { DirectusV2Service } from '../../../services/directus-v2.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CtaButton, JoinUsComponent, TranslateModule, RouterModule, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements AfterViewInit, OnDestroy {
  private readonly homeService = inject(HomeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly i18nService = inject(I18nService);
  private readonly seoService = inject(SeoService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly directusV2 = inject(DirectusV2Service);
  homePage = this.homeService.homePage;
  visionsData = computed(() => this.homePage()?.visions || []);

  // ✅ Utilisation de viewChild au lieu de @ViewChild
  private readonly performanceSection = viewChild<ElementRef<HTMLElement>>('performanceSection');

  // ✅ Signal pour les valeurs animées séparé des données
  animatedValues = signal<number[]>([]);
  private readonly animationPlayed = signal(false);

  private performanceObserver?: IntersectionObserver;

  // Données réactives
  heroBannerData = this.homeService.heroBannerData;
  animatedStats = this.homeService.animatedStats;
  testimonialsData = this.homeService.testimonialsData;
  statsHeadline = this.homeService.statsHeadline;
  infiniteScrollItems = this.homeService.infiniteScrollItems;
  isLoading = this.homeService.isLoading;

  // ✅ Utilisation de translate.stream pour la réactivité complète
  private readonly translationsStream = this.i18nService.translate.stream([
    'HOME.TITLE',
    'COMMON.LOADING',
    'ERROR.TITLE',
    'ERROR.MESSAGE',
    'ERROR.RETRY',
    'HOME.US'
  ]);

  // Conversion de l'observable en signal réactif
  translations = toSignal(this.translationsStream, { initialValue: {} });

  // Textes traduits réactifs
  readonly pageTitle = computed(() => this.translations()['HOME.TITLE'] || '');
  readonly loadingText = computed(() => this.translations()['COMMON.LOADING'] || '');
  readonly errorTitle = computed(() => this.translations()['ERROR.TITLE'] || '');
  readonly errorMessage = computed(() => this.translations()['ERROR.MESSAGE'] || '');
  readonly retryButton = computed(() => this.translations()['ERROR.RETRY'] || '');
  readonly usTitle = computed(() => this.translations()['HOME.US'] || '');
  readonly aboutLink = computed(() => this.i18nService.createLocalizedLink('/about'));
  readonly agenciesLink = computed(() => this.i18nService.createLocalizedLink('/agencies'));
  /**
   * Aperçu réservé aux agences : la direction générale n'accueille pas les
   * opérations courantes, la mettre ici induirait le visiteur en erreur.
   */
  readonly agenciesPreview = computed(() =>
    this.directusV2.agencies().filter((agency) => agency.type !== 'direction_generale').slice(0, 3),
  );

  displayedStats = computed(() => {
    const stats = this.animatedStats();
    const values = this.animatedValues();
    const locale = this.i18nService.currentLanguage().startsWith('fr')
      ? 'fr-FR'
      : 'en-US';

    return stats.map((stat: any, index: number) => {
      const hasPlus = Boolean(stat.show_plus);
      
      return {
        ...stat,
        displayValue: new Intl.NumberFormat(locale).format(values[index] ?? 0),
        suffix: hasPlus ? '+' : ''
      };
    });
  });

  tripleScrollItems = computed(() => {
    const items = this.infiniteScrollItems();
    return [...items, ...items, ...items];
  });

  // Navigation témoignages - séparée mobile/desktop
  currentTestimonialIndex = signal(0);
  slideDirection = signal<'next' | 'prev'>('next');
  private autoplayInterval?: ReturnType<typeof setInterval>;
  private autoplayStartTimeout?: ReturnType<typeof setTimeout>;
  private resizeTimeout?: ReturnType<typeof setTimeout>;
  private statsAnimationFrame?: number;
  private removeResizeListener?: () => void;
  isHoveringTestimonials = signal(false);
  private touchStartX = 0;
  private touchEndX = 0;

  isMobileView = signal(false);

  // Desktop: groupes de 3
  desktopGroups = computed(() => {
    const testimonials = this.testimonialsData();
    const groups = [];
    for (let i = 0; i < testimonials.length; i += 3) {
      groups.push(testimonials.slice(i, i + 3));
    }
    return groups;
  });

  // Mobile: tous les témoignages individuellement
  mobileTestimonials = computed(() => this.testimonialsData());

  currentGroup = computed(() => {
    if (this.isMobileView()) {
      const testimonials = this.mobileTestimonials();
      const index = this.currentTestimonialIndex();
      return testimonials[index] ? [testimonials[index]] : [];
    } else {
      const groups = this.desktopGroups();
      const index = this.currentTestimonialIndex();
      return groups[index] || [];
    }
  });

  maxIndex = computed(() => {
    if (this.isMobileView()) {
      return this.mobileTestimonials().length - 1;
    } else {
      return this.desktopGroups().length - 1;
    }
  });

  ngOnDestroy(): void {
    this.performanceObserver?.disconnect();
    if (this.autoplayStartTimeout) {
      clearTimeout(this.autoplayStartTimeout);
    }
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    if (this.statsAnimationFrame) {
      cancelAnimationFrame(this.statsAnimationFrame);
    }
    this.stopAutoplay();
    this.removeResizeListener?.();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupResizeListener();
    }
  }

  private setupResizeListener(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobileView.set(window.innerWidth <= 1024);
      this.removeResizeListener = this.renderer.listen('window', 'resize', () => {
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
          if (this.destroyRef.destroyed) return;
          this.isMobileView.set(window.innerWidth <= 1024);
          this.currentTestimonialIndex.set(0);
        }, 250);
      });
    }
  }

  constructor() {

    // Effet unique pour synchroniser SEO, Langue et Animation de Performance
    effect(() => {
      this.i18nService.currentLanguage(); // Déclenchement sur changement de langue
      const stats = this.animatedStats();
      const section = this.performanceSection();
      
      this.seoService.updatePageSeo('HOME');
      this.currentTestimonialIndex.set(0);
      
      // Réinitialiser l'animation.
      // Navigateur : on part de 0, le compteur s'animera à l'entrée dans le
      // viewport (évite le flash des valeurs finales affichées puis remises à 0).
      // SSR : on affiche directement les valeurs cibles pour le référencement.
      this.animationPlayed.set(false);
      this.animatedValues.set(
        isPlatformBrowser(this.platformId)
          ? stats.map(() => 0)
          : stats.map((stat: any) => stat.target)
      );

      // Si on est dans le navigateur et qu'on a tout ce qu'il faut
      if (isPlatformBrowser(this.platformId) && section && stats.length > 0) {
        // On s'assure d'avoir un observer propre
        if (this.performanceObserver) {
          this.performanceObserver.disconnect();
          this.performanceObserver = undefined;
        }
        this.attachIntersectionObserver(section.nativeElement);
      }
    });

    // Démarrer l'autoplay des témoignages
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.runOutsideAngular(() => {
        this.autoplayStartTimeout = setTimeout(() => {
          if (!this.destroyRef.destroyed) {
            this.startAutoplay();
          }
        }, 2000);
      });
    }
  }

  private attachIntersectionObserver(el: HTMLElement): void {
    if (this.performanceObserver || !isPlatformBrowser(this.platformId) || this.destroyRef.destroyed) return;

    this.performanceObserver = new IntersectionObserver(
      (entries) => {
        if (this.destroyRef.destroyed) return;
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (!this.animationPlayed()) {
            this.runCounterAnimation();
          }
        } else if (!entry.isIntersecting) {
          // Reset quand la section sort de l'écran pour permettre de rejouer
          this.animationPlayed.set(false);
        }
      },
      { threshold: [0, 0.1] }
    );

    this.performanceObserver.observe(el);
  }

  private runCounterAnimation(): void {
    if (this.animationPlayed() || this.destroyRef.destroyed) return;
    this.animationPlayed.set(true);

    const stats = this.animatedStats();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Réinitialiser à 0
    this.animatedValues.set(stats.map(() => 0));

    if (prefersReducedMotion) {
      this.animatedValues.set(stats.map((s: any) => s.target));
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      if (this.destroyRef.destroyed) return;

      const elapsed = now - start;
      const isFinished = stats.every((stat: any) => {
        const isSpecial = (stat.label || '').toLowerCase().match(/client|customer|agenc|agency/);
        const DURATION = isSpecial ? 2500 : 1000;
        return elapsed >= DURATION;
      });

      this.animatedValues.set(stats.map((stat: any) => {
        const isSpecial = (stat.label || '').toLowerCase().match(/client|customer|agenc|agency/);
        const DURATION = isSpecial ? 2500 : 1000;
        
        const progress = Math.min(elapsed / DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        return Math.round(stat.target * eased);
      }));

      if (!isFinished) {
        this.statsAnimationFrame = requestAnimationFrame(tick);
      } else {
        this.animatedValues.set(stats.map((s: any) => s.target));
        this.statsAnimationFrame = undefined;
      }
    };

    this.statsAnimationFrame = requestAnimationFrame(tick);
  }

  prevTestimonialGroup(): void {
    this.moveTestimonialGroup(-1);
    this.resetAutoplay();
  }

  nextTestimonialGroup(): void {
    this.moveTestimonialGroup(1);
    this.resetAutoplay();
  }

  private moveTestimonialGroup(direction: 1 | -1): void {
    this.slideDirection.set(direction > 0 ? 'next' : 'prev');
    const current = this.currentTestimonialIndex();
    const max = this.maxIndex();

    if (max <= 0) {
      this.currentTestimonialIndex.set(0);
      return;
    }

    if (direction > 0) {
      this.currentTestimonialIndex.set(current < max ? current + 1 : 0);
    } else {
      this.currentTestimonialIndex.set(current > 0 ? current - 1 : max);
    }
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.nextTestimonialGroup();
      } else {
        this.prevTestimonialGroup();
      }
    }
  }

  startAutoplay(): void {
    if (
      this.destroyRef.destroyed ||
      !isPlatformBrowser(this.platformId) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;

    this.stopAutoplay();
    this.ngZone.runOutsideAngular(() => {
      this.autoplayInterval = setInterval(() => {
        if (this.destroyRef.destroyed) return;
        if (!this.isHoveringTestimonials() && document.visibilityState === 'visible') {
          this.ngZone.run(() => {
            if (!this.destroyRef.destroyed) {
              this.moveTestimonialGroup(1);
            }
          });
        }
      }, 10000);
    });
  }

  stopAutoplay(): void {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = undefined;
    }
  }

  resetAutoplay(): void {
    this.stopAutoplay();
    this.startAutoplay();
  }

  onTestimonialsMouseEnter(): void {
    this.isHoveringTestimonials.set(true);
  }

  onTestimonialsMouseLeave(): void {
    this.isHoveringTestimonials.set(false);
  }

  reloadPage(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.location.reload();
    }
  }
}
