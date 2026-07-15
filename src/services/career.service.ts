import { inject, Injectable, computed } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';

@Injectable({ providedIn: 'root' })
export class CareerService {
  private readonly directus = inject(DirectusSdkService);

  isLoading = computed(() => this.directus.isLoading());

  // Page de carrière
  careerPage = computed(() => {
    const pages = this.directus.pagesWithSections();
    return pages.find(page => page.Slug === 'careers');
  });

  // Récupérer les sections par leur ID
  sectionById = (id: number) => computed(() => {
    const sections = this.careerPage()?.sections || [];
    return sections.find(s => s.Pages_sections_id === id) ?? null;
  });

  // Section d'introduction (ID 12)
  introSection = this.sectionById(12);

  // Section des emplois (ID 13)
  jobsSection = this.sectionById(13);

  // Données formatées
  introData = computed(() => {
    const section = this.introSection();
    if (!section) return null;
    return {
      headline: section.headline,
      subheadline: section.subheadline,
      headlines2: section.headlines2,
      body_content: section.body_content,
      image: section.image
    };
  });

  jobsData = computed(() => {
    const section = this.jobsSection();

    if (!section?.table_data) {
      return [];
    }

    try {
      let parsedData;

      // ✅ Même logique robuste que ContactService
      if (typeof section.table_data === 'string') {
        parsedData = JSON.parse(section.table_data);
      } else if (typeof section.table_data === 'object') {
        parsedData = section.table_data;
      } else {
        console.error('[CareerService] Type de données table_data non supporté:', typeof section.table_data);
        return [];
      }

      // ✅ Validation de la structure
      if (!parsedData || typeof parsedData !== 'object') {
        console.error('[CareerService] Données parsées invalides:', parsedData);
        return [];
      }

      return parsedData;
    } catch (e) {
      console.error('[CareerService] Erreur lors du parsing des données des emplois:', e);
      console.error('[CareerService] Données reçues:', section.table_data);
      console.error('[CareerService] Type des données:', typeof section.table_data);

      if (typeof section.table_data === 'string') {
        console.error('[CareerService] Contenu de la chaîne:', section.table_data.substring(0, 100) + '...');
      }

      return [];
    }
  });
}