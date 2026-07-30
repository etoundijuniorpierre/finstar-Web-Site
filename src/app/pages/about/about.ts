import { Component, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
import { AboutService } from '../../../services/about.service';
import { JoinUsComponent } from "../../shared/join-us/join-us";
import { PauseOffscreenDirective } from "../../shared/pause-offscreen.directive";
import { I18nService } from '../../../services/i18n.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SeoService } from '../../../services/seo.service';
import { TranslateModule } from '@ngx-translate/core';

interface TableItem {
  id: string;
  category: 'mission' | 'vision' | 'values' | 'beliefs' | 'promises' | 'partners' | 'other';
  title: string;
  content?: string;
  description?: string;
  header?: string;
  details?: TableItemDetail[];
  items?: string[];
  partners?: Partner[];
}

interface TableItemDetail {
  id: string;
  title: string;
  content?: string;
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
    'COMMON.LOADING',
    'ERROR.TITLE',
    'ERROR.MESSAGE',
    'ERROR.RETRY'
  ]);

  translations = toSignal(this.translationsStream, { initialValue: {} });

  // Textes traduits réactifs
  readonly pageTitle = computed(() => this.translations()['ABOUT.TITLE']);
  readonly loadingText = computed(() => this.translations()['COMMON.LOADING']);
  readonly errorTitle = computed(() => this.translations()['ERROR.TITLE']);
  readonly errorMessage = computed(() => this.translations()['ERROR.MESSAGE']);
  readonly retryButton = computed(() => this.translations()['ERROR.RETRY']);

  // Données dynamiques
  aboutData = this.aboutService.aboutData;
  partnerImages = this.aboutService.partnerImages;
  isLoading = this.aboutService.isLoading;
  aboutPage = this.aboutService.aboutPage;

  // Données transformées pour le tableau avec gestion d'erreur
  tableData = computed((): TableItem[] => {
    const data = this.aboutData()?.tableData?.data;

    if (!Array.isArray(data)) return [];

    return data
      .map((item: unknown, index): TableItem | null => this.toTableItem(item, index))
      .filter((item): item is TableItem => item !== null)
      .sort((left, right) => {
        const order: Record<TableItem['category'], number> = {
          vision: 0,
          mission: 1,
          beliefs: 2,
          values: 3,
          promises: 4,
          partners: 5,
          other: 6,
        };
        return order[left.category] - order[right.category];
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

  /**
   * Les traductions Directus utilisent des propriétés françaises ou anglaises.
   * Ce parseur accepte les deux formats ainsi que l'ancien format en liste.
   */
  private toTableItem(source: unknown, index: number): TableItem | null {
    if (!this.isRecord(source)) return null;

    const title = this.asText(this.readField(source, ['Catégorie', 'Category']));
    if (!title) return null;

    const rawContent = this.readField(source, ['Contenu', 'Content']);
    const description = this.asText(this.readField(source, ['Description']));
    const category = this.getCategory(title);
    const id = `${category}-${index}`;

    if (category === 'partners') {
      const partners = Array.isArray(rawContent)
        ? rawContent
            .map((name) => this.asText(name))
            .filter((name): name is string => !!name)
            .map((name) => this.getPartnerInfo(name))
        : [];

      return { id, category, title, description, partners };
    }

    if (Array.isArray(rawContent)) {
      return {
        id,
        category,
        title,
        description,
        items: rawContent
          .map((entry) => this.asText(entry))
          .filter((entry): entry is string => !!entry),
      };
    }

    if (this.isRecord(rawContent)) {
      const header = this.asText(this.readField(rawContent, ['header']));
      const detailsSource =
        this.readField(rawContent, [
          'Valeurs Clé',
          'Valeurs Clés',
          'Key Value',
          'Key Values',
        ]) ?? rawContent;

      return {
        id,
        category,
        title,
        description,
        header,
        details: this.toDetails(detailsSource, category),
      };
    }

    return {
      id,
      category,
      title,
      description,
      content: this.asText(rawContent),
    };
  }

  private toDetails(source: unknown, category: TableItem['category']): TableItemDetail[] {
    if (!this.isRecord(source)) return [];

    return Object.entries(source)
      .filter(([key]) => this.normalizeKey(key) !== 'header')
      .map(([key, value], index): TableItemDetail | null => {
        if (this.isRecord(value)) {
          let title = this.asText(this.readField(value, ['Titre', 'Title'])) || key;
          if (category === 'values') {
            const initials: Record<string, string> = {
              proximité: 'P',
              intégrité: 'I',
              service: 'S',
              transformation: 'T',
              excellence: 'E',
            };
            const initial = initials[this.normalizeKey(title)];
            if (initial && !title.match(/^(?:P|I|S|T|E)\s*[–-]/i)) {
              title = `${initial} – ${title}`;
            }
          }
          const content = this.asText(this.readField(value, ['Contenu', 'Content']));
          return { id: `${this.normalizeKey(key)}-${index}`, title, content };
        }

        const content = this.asText(value);
        return content
          ? { id: `${this.normalizeKey(key)}-${index}`, title: key, content }
          : null;
      })
      .filter((detail): detail is TableItemDetail => detail !== null);
  }

  private getCategory(title: string): TableItem['category'] {
    const normalized = this.normalizeKey(title);

    if (normalized.includes('mission')) return 'mission';
    if (normalized.includes('vision')) return 'vision';
    if (normalized.includes('valeur') || normalized.includes('value')) return 'values';
    if (normalized.includes('conviction') || normalized.includes('belief')) return 'beliefs';
    if (normalized.includes('promesse') || normalized.includes('promise')) return 'promises';
    if (normalized.includes('partenaire') || normalized.includes('partner')) return 'partners';
    return 'other';
  }

  private readField(source: Record<string, unknown>, names: string[]): unknown {
    const normalizedNames = new Set(names.map((name) => this.normalizeKey(name)));
    const match = Object.entries(source).find(([key]) =>
      normalizedNames.has(this.normalizeKey(key)),
    );
    return match?.[1];
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private asText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  reloadPage(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
