import { inject, Injectable, computed, signal, effect } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';
import { I18nService } from './i18n.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { EnrichedPageSection } from '../types/directus';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly directus = inject(DirectusSdkService);
  private readonly i18nService = inject(I18nService);

  // État de chargement
  isLoading = computed(() => this.directus.isLoading());

  // Signal pour la page de contact
  contactPage = computed(() => {
    const pages = this.directus.pagesWithSections();
    return pages.find(page => page.Slug === 'contact');
  });

  // Signal pour les sections de la page
  contactSections = computed<EnrichedPageSection[]>(() => {
    const page = this.contactPage();
    return (page?.sections as EnrichedPageSection[]) || [];
  });

  // Section d'informations de contact
  contactInfoSection = computed<EnrichedPageSection | null>(() => {
    const sections = this.contactSections();
    return sections.find(section => section.Type === 'text_block') ?? null;
  });

  backgroundImages = computed<string[]>(() => {
    const relations = this.directus.sectionFilesRels();
    const sectionId = 15; 
    const sectionFiles = relations
      .filter(rel => rel.Pages_sections_Pages_sections_id === sectionId)
      .map(rel => {
        return `${this.directus.apiUrl}/assets/${rel.directus_files_id}?format=webp&quality=80&width=1920`;
      });
    
    if (sectionFiles.length > 0) {
      return sectionFiles;
    }

    return [];
  });

  // Données de contact parsées
  contactData = computed(() => {
    const section = this.contactInfoSection();

    if (!section?.table_data) {
      return null;
    }

    try {
      let parsedData;

      if (typeof section.table_data === 'string') {
        parsedData = JSON.parse(section.table_data);
      } else if (typeof section.table_data === 'object') {
        parsedData = section.table_data;
      } else {
        console.error('[ContactService] Type de données table_data non supporté:', typeof section.table_data);
        return null;
      }

      if (!parsedData || typeof parsedData !== 'object') {
        console.error('[ContactService] Données parsées invalides:', parsedData);
        return null;
      }

      return parsedData as {
        contact_info: {
          emails: string[];
          phone_numbers: string[];
          customer_service: {
            whatsapp: string;
          };
        };
        social_media: {
          platforms: string[];
        };
        agencies: {
          locations: string[];
        };
      };
    } catch (e) {
      console.error('[ContactService] Erreur lors du parsing des données de contact:', e);
      return null;
    }
  });

  private readonly staticTranslationsStream = this.i18nService.translate.stream([
    'CONTACT.EMAILS',
    'CONTACT.PHONE',
    'CONTACT.CUSTOMER_SERVICE',
    'CONTACT.FOLLOW_US',
    'CONTACT.OUR_AGENCIES',
    'CONTACT.SEND_MESSAGE_TITLE',
    'CONTACT.FULL_NAME',
    'CONTACT.EMAIL',
    'CONTACT.SUBJECT',
    'CONTACT.MESSAGE',
    'CONTACT.SEND_MESSAGE',
    'CONTACT.SENDING',
    'CONTACT.WHATSAPP',
    'CONTACT.LOADING',
    'CONTACT.ERROR_TITLE',
    'CONTACT.ERROR_MESSAGE',
    'CONTACT.RETRY'
  ]);

  // Signaux pour les traductions statiques
  staticTranslations = toSignal(this.staticTranslationsStream, { initialValue: {} });

  // Méthode pour forcer le rechargement des données
  async refreshData(): Promise<void> {
    await this.directus.loadAllDataExternal();
  }
}
