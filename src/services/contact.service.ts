import { inject, Injectable, computed } from '@angular/core';
import { I18nService } from './i18n.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { DirectusV2Service } from './directus-v2.service';

export interface ContactInfo {
  contact_info: {
    emails: string[];
    phone_numbers: string[];
    customer_service: { whatsapp: string };
  };
  social_media: { platforms: string[] };
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly directusV2 = inject(DirectusV2Service);
  private readonly i18nService = inject(I18nService);

  // État de chargement
  isLoading = computed(() => !this.directusV2.ready());

  /** Présence des réglages de contact (garde d'affichage côté template). */
  contactPage = computed(() => this.directusV2.contactSettings());

  // En-têtes de la page contact (singleton `contact_settings`).
  contactInfoSection = computed(() => {
    const settings = this.directusV2.contactSettings();
    if (!settings) return null;

    return {
      headline: String(settings['headline'] || ''),
      headlines2: String(settings['headline_2'] || ''),
    };
  });

  backgroundImages = computed<string[]>(() => {
    const settings = this.directusV2.contactSettings();
    if (!settings || !Array.isArray(settings['backgrounds'])) return [];
    return settings['backgrounds'].filter((url): url is string => typeof url === 'string');
  });

  // Coordonnées et agences, issues de vraies colonnes (plus de blob JSON).
  contactData = computed<ContactInfo | null>(() => {
    const settings = this.directusV2.contactSettings();
    if (!settings) return null;

    return {
      contact_info: {
        emails: Array.isArray(settings['emails']) ? settings['emails'].map(String) : [],
        phone_numbers: Array.isArray(settings['phone_numbers'])
          ? settings['phone_numbers'].map(String)
          : [],
        customer_service: { whatsapp: String(settings['whatsapp'] || '') },
      },
      social_media: { platforms: [] },
    };
  });

  private readonly staticTranslationsStream = this.i18nService.translate.stream([
    'CONTACT.EMAILS',
    'CONTACT.PHONE',
    'CONTACT.CUSTOMER_SERVICE',
    'CONTACT.FOLLOW_US',
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
}
