import { inject, Injectable, computed } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';

@Injectable({ providedIn: 'root' })
export class AboutService {
  private readonly directus = inject(DirectusSdkService);

  isLoading = computed(() => this.directus.isLoading());

  // Page "À propos"
  aboutPage = computed(() => {
    const pages = this.directus.pagesWithSections();
    return pages.find(page => page.Slug === 'about');
  });

  // Récupération des sections par ID
  sectionById = (id: number) => computed(() => {
    const sections = this.aboutPage()?.sections || [];
    return sections.find(s => s.Pages_sections_id === id) ?? null;
  });

  // Section 17 (Qui Sommes Nous)
  section17 = this.sectionById(17);

  // Section 18 (Galerie de partenaires)
  section18 = this.sectionById(18);

  // Données de la section 17 avec parsing robuste
  aboutData = computed(() => {
    const section = this.section17();
    
    if (!section) return null;

    let tableData = null;

    if (section.table_data) {
      try {
        let parsedData;

        if (typeof section.table_data === 'string') {
          parsedData = JSON.parse(section.table_data);
        } else if (typeof section.table_data === 'object') {
          parsedData = section.table_data;
        }

        if (parsedData && typeof parsedData === 'object') {
          tableData = parsedData;
        }
      } catch (e) {
        console.error('[AboutService] Erreur lors du parsing des données de tableau:', e);
      }
    }

    return {
      headline: section.headline,
      subheadline: section.subheadline,
      image: this.directus.getFileUrl(section.image),
      tableData: tableData
    };
  });

  // Images des partenaires
  partnerImages = computed(() => {
    const section = this.section18();
    if (!section?.images) return [];
    return section.images
      .map(img => this.directus.getFileUrl(img))
      .filter((url): url is string => !!url);
  });
}
