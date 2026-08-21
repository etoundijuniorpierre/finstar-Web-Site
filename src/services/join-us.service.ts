import { inject, computed, Injectable } from '@angular/core';
import { DirectusV2Service } from './directus-v2.service';

export interface JoinUsData {
  headline: string;
  call_to_action_link: string;
  subheadline?: string;
  page_slug: string;
  section_id: number;
}

@Injectable({ providedIn: 'root' })
export class JoinUsService {
  private readonly directusV2 = inject(DirectusV2Service);

  /**
   * Le bandeau est unique pour tout le site (singleton `cta_banner`). L'ancien
   * schéma le dupliquait par page, ce qui laissait certaines pages sans bandeau.
   */
  callToActionSections = computed<JoinUsData[]>(() => {
    const banner = this.directusV2.ctaBanner();
    if (!banner) return [];

    return [{
      headline: String(banner['headline'] || ''),
      call_to_action_link: String(banner['cta_label'] || ''),
      subheadline: banner['subheadline'] ? String(banner['subheadline']) : undefined,
      page_slug: '*',
      section_id: 0,
    }];
  });

  getCallToActionByPage(pageSlug: string): JoinUsData | null {
    const sections = this.callToActionSections();
    return sections.find(section => section.page_slug === pageSlug || section.page_slug === '*') || null;
  }

  getCallToActionById(sectionId: number): JoinUsData | null {
    return this.callToActionSections().find(section => section.section_id === sectionId) || null;
  }

  getDefaultCallToAction(): JoinUsData | null {
    return this.callToActionSections()[0] || null;
  }

  isLoading = computed(() => !this.directusV2.ready());
}
