import { inject, computed, Injectable } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';
import { PageSection } from '../types/directus';

export interface JoinUsData {
  headline: string;
  call_to_action_link: string;
  subheadline?: string;
  page_slug: string;
  section_id: number;
}

@Injectable({ providedIn: 'root' })
export class JoinUsService {
  private readonly directus = inject(DirectusSdkService);

  // Signal pour toutes les sections call_to_action disponibles
  callToActionSections = computed<JoinUsData[]>(() => {
    const pages = this.directus.pagesWithSections();
    const sections: JoinUsData[] = [];

    pages.forEach(page => {
      const callToActionSections = page.sections.filter(
        section => section.Type === 'call_to_action'
      );

      callToActionSections.forEach(section => {
        sections.push({
          headline: section.headline || 'Rejoignez plus de 1 500 clients accompagnés',
          call_to_action_link: section.call_to_action_link || 'Prenez rendez-vous dès maintenant',
          subheadline: section.subheadline || undefined,
          page_slug: page.Slug,
          section_id: section.Pages_sections_id
        });
      });
    });

    return sections;
  });

  // Méthode pour récupérer une section call_to_action spécifique par page
  getCallToActionByPage(pageSlug: string): JoinUsData | null {
    const sections = this.callToActionSections();
    return sections.find(section => section.page_slug === pageSlug) || null;
  }

  // Méthode pour récupérer une section call_to_action par ID
  getCallToActionById(sectionId: number): JoinUsData | null {
    const sections = this.callToActionSections();
    return sections.find(section => section.section_id === sectionId) || null;
  }

  // Méthode pour récupérer la première section call_to_action disponible
  getDefaultCallToAction(): JoinUsData | null {
    const sections = this.callToActionSections();
    return sections[0] || null;
  }

  // État de chargement
  isLoading = computed(() => this.directus.isLoading());
}
