import { Component, computed, effect, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AboutService } from '../../../services/about.service';
import { JoinUsComponent } from "../../shared/join-us/join-us";
import { PauseOffscreenDirective } from "../../shared/pause-offscreen.directive";
import { I18nService } from '../../../services/i18n.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SeoService } from '../../../services/seo.service';
import { TranslateModule } from '@ngx-translate/core';

interface TableItem {
  id: string;
  category: 'mission' | 'vision' | 'values' | 'partners' | 'other';
  title: string;
  content?: string;
  values?: string[];
  items?: string[];
  partners?: Partner[];
}

interface Partner {
  name: string;
  url: string;
  image: string;
  alt: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.html',
  styleUrl: './about.scss',
  imports: [CommonModule, JoinUsComponent, TranslateModule, NgOptimizedImage, PauseOffscreenDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.6s ease', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('0.3s ease', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('hoverScale', [
      state('normal', style({ transform: 'scale(1)' })),
      state('hover', style({ transform: 'scale(1.05)' })),
      transition('normal <=> hover', animate('0.3s ease'))
    ])
  ]
})
export class About {
  private readonly aboutService = inject(AboutService);
  private readonly i18nService = inject(I18nService);
  private readonly seoService = inject(SeoService);

  // ✅ Traductions réactives
  private readonly translationsStream = this.i18nService.translate.stream([
    'ABOUT.TITLE',
    'ABOUT.CATEGORY',
    'ABOUT.CONTENT',
    'COMMON.LOADING',
    'ERROR.TITLE',
    'ERROR.MESSAGE',
    'ERROR.RETRY'
  ]);

  translations = toSignal(this.translationsStream, { initialValue: {} });

  // Textes traduits réactifs
  readonly pageTitle = computed(() => this.translations()['ABOUT.TITLE']);
  readonly categoryText = computed(() => this.translations()['ABOUT.CATEGORY']);
  readonly contentText = computed(() => this.translations()['ABOUT.CONTENT']);
  readonly loadingText = computed(() => this.translations()['COMMON.LOADING']);
  readonly errorTitle = computed(() => this.translations()['ERROR.TITLE']);
  readonly errorMessage = computed(() => this.translations()['ERROR.MESSAGE']);
  readonly retryButton = computed(() => this.translations()['ERROR.RETRY']);

  // Données dynamiques
  aboutData = this.aboutService.aboutData;
  partnerImages = this.aboutService.partnerImages;
  isLoading = this.aboutService.isLoading;
  aboutPage = this.aboutService.aboutPage;

  // Gestion du survol des partenaires
  hoveredPartner = signal<Partner | null>(null);

  // Données transformées pour le tableau avec gestion d'erreur
  tableData = computed((): TableItem[] => {
    const data = this.aboutData()?.tableData?.data;
    const categoryTranslations = this.aboutData()?.categoryTranslations;

    if (!data || !Array.isArray(data) || !categoryTranslations) return [];

    return data.map((item: any): TableItem => {
      const category = item?.["Catégorie"] || 'Unknown';
      const content = item?.["Contenu"] || '';

      // ✅ Utilisation des traductions pour identifier les catégories (insensible à la casse)
      const cleanCategory = category.trim().toLowerCase();
      
      const isMission = cleanCategory === categoryTranslations.mission.toLowerCase().trim() || cleanCategory === 'mission';
      const isVision = cleanCategory === categoryTranslations.vision.toLowerCase().trim() || cleanCategory === 'vision';
      const isValues = cleanCategory === categoryTranslations.values.toLowerCase().trim() || cleanCategory === 'values';
      const isPartners = cleanCategory === categoryTranslations.partners.toLowerCase().trim() || cleanCategory === 'partners' || cleanCategory === 'nos partenaires' || cleanCategory === 'our partners';

      if (isMission) {
        return {
          id: 'mission',
          category: 'mission',
          title: category,
          content: content
        };
      } else if (isVision) {
        return {
          id: 'vision',
          category: 'vision',
          title: category,
          content: content
        };
      } else if (isValues) {
        return {
          id: 'values',
          category: 'values',
          title: category,
          content: typeof content === 'object' ? content.Description : content,
          values: typeof content === 'object' ? content["Valeurs Clés"] || [] : []
        };
      } else if (isPartners) {
        return {
          id: 'partners',
          category: 'partners',
          title: category,
          partners: Array.isArray(content) ?
            content.map((name: string) => this.getPartnerInfo(name)) :
            []
        };
      } else {
        return {
          id: category.replace(/\s+/g, '-').toLowerCase(),
          category: 'other',
          title: category,
          content: Array.isArray(content) ? undefined : content,
          items: Array.isArray(content) ? content : undefined
        };
      }
    });
  });

  constructor() {
    effect(() => {
      const lang = this.i18nService.currentLanguage();
      this.seoService.updatePageSeo('ABOUT');
    });
  }

  // Partenaires statiques avec leurs informations
  private getPartnerInfo(name: string): Partner {
    const partners: Record<string, Omit<Partner, 'name'>> = {
      'Afriland First Bank': {
        url: 'https://www.afrilandfirstbank.com/',
        image: '/assets/partner/afriland-picture.png',
        alt: 'Afriland First Bank'
      },
      'Ecobank': {
        url: 'https://www.ecobank.com/',
        image: '/assets/partner/Ecobank-Logo.png',
        alt: 'Ecobank'
      },
      'Saar Assurance': {
        url: 'https://www.saar-assurances.com/fr/group',
        image: '/assets/partner/saar-insurance.png',
        alt: 'Saar Insurance'
      }
    };

    const partnerInfo = partners[name];

    return {
      name,
      url: partnerInfo?.url || '#',
      image: partnerInfo?.image || '/assets/placeholder-partner.png',
      alt: partnerInfo?.alt || `${name} logo`
    };
  }

  onPartnerHover(partner: Partner) {
    this.hoveredPartner.set(partner);
  }

  onPartnerLeave() {
    this.hoveredPartner.set(null);
  }

  reloadPage(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
